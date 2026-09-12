import { VoicePipelineError } from '../errors';
import type { ClockTimer, VoiceClock } from '../telemetry/clock';
import { systemClock } from '../telemetry/clock';
import { TurnTelemetryRecorder } from '../telemetry/recorder';
import type { StageMarker, TelemetrySinkError, VoiceTurnMetrics } from '../telemetry/types';
import { graphemeLength, sliceGraphemes } from '../text/graphemes';
import { IncrementalSpeechNormalizer } from '../text/normalizer';
import { SpeechSegmenter } from '../text/segmenter';
import type { SpeechDiagnostic, SpeechSegment, SpeechTextTransform } from '../text/types';
import { AsyncEventQueue } from './async-queue';
import type {
  PlaybackAcknowledgement,
  StartVoiceTurnOptions,
  VoicePipeline,
  VoicePipelineOptions,
  VoiceTurn,
  VoiceTurnEvent,
  VoiceTurnInterruption,
  VoiceTurnOutcome,
  VoiceTurnResult,
} from './types';

interface ResolvedPipelineOptions {
  readonly text: VoicePipelineOptions['text'];
  readonly stallCues: {
    readonly enabled: boolean;
    readonly delayMs: number;
    readonly text: string;
    readonly maxPerTurn: number;
  };
  readonly clock: VoiceClock;
  readonly sinks: NonNullable<VoicePipelineOptions['telemetry']>['sinks'];
  readonly onSinkError: (failure: TelemetrySinkError) => void;
  readonly maxStoredMetrics: number;
  readonly onDiagnostic?: (diagnostic: SpeechDiagnostic) => void;
}

interface TextReadResult {
  readonly done?: boolean;
  readonly value?: string | undefined;
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

class VoiceTurnHandle implements VoiceTurn {
  readonly events: AsyncIterable<VoiceTurnEvent>;
  readonly result: Promise<VoiceTurnResult>;
  private readonly eventQueue: AsyncEventQueue<VoiceTurnEvent>;
  private readonly resultDeferred = deferred<VoiceTurnResult>();
  private readonly abortController = new AbortController();
  private readonly normalizer: IncrementalSpeechNormalizer;
  private readonly segmenter: SpeechSegmenter;
  private readonly telemetry: TurnTelemetryRecorder;
  private readonly transforms: readonly SpeechTextTransform[];
  private readonly emittedSegments: SpeechSegment[] = [];
  private readonly diagnostics: SpeechDiagnostic[] = [];
  private readonly acknowledgements = new Map<string, number>();
  private generatedText = '';
  private terminal = false;
  private sourceCanceller: (() => void) | undefined;
  private segmentTimer: ClockTimer | undefined;
  private stallTimer: ClockTimer | undefined;
  private cueRequests = 0;
  private lastAcknowledgedSegment = -1;
  private settledResult: VoiceTurnResult | undefined;

  constructor(
    public readonly id: string,
    private readonly source: StartVoiceTurnOptions['source'],
    private readonly options: ResolvedPipelineOptions,
    private readonly onSettled: (metrics: VoiceTurnMetrics) => void
  ) {
    this.eventQueue = new AsyncEventQueue(() => this.interrupt({ reason: 'consumer-cancelled' }));
    this.events = this.eventQueue;
    this.result = this.resultDeferred.promise;
    this.transforms = options.text?.transforms ?? [];
    this.normalizer = new IncrementalSpeechNormalizer({
      ...(options.text?.maxPendingChars === undefined
        ? {}
        : { maxPendingChars: options.text.maxPendingChars }),
      onDiagnostic: (diagnostic) => this.reportDiagnostic(diagnostic),
    });
    this.segmenter = new SpeechSegmenter({
      ...(options.text?.locale === undefined ? {} : { locale: options.text.locale }),
      ...(options.text?.mode === undefined ? {} : { mode: options.text.mode }),
      ...(options.text?.minChars === undefined ? {} : { minChars: options.text.minChars }),
      ...(options.text?.targetChars === undefined ? {} : { targetChars: options.text.targetChars }),
      ...(options.text?.maxChars === undefined ? {} : { maxChars: options.text.maxChars }),
      ...(options.text?.maxWaitMs === undefined ? {} : { maxWaitMs: options.text.maxWaitMs }),
      idPrefix: `${id}-segment`,
    });
    this.telemetry = new TurnTelemetryRecorder(
      id,
      options.clock,
      options.sinks ?? [],
      options.onSinkError
    );

    this.scheduleStall();
    queueMicrotask(() => void this.consumeSource());
  }

  acknowledgePlayback(acknowledgement: PlaybackAcknowledgement): void {
    if (!Number.isInteger(acknowledgement.charactersPlayed)) {
      throw this.acknowledgementError('charactersPlayed must be an integer', acknowledgement);
    }
    if (
      acknowledgement.audioMs !== undefined &&
      (!Number.isFinite(acknowledgement.audioMs) || acknowledgement.audioMs < 0)
    ) {
      throw this.acknowledgementError('audioMs must be finite and non-negative', acknowledgement);
    }

    const index = this.emittedSegments.findIndex(
      (segment) => segment.id === acknowledgement.segmentId
    );
    const segment = this.emittedSegments[index];
    if (!segment) {
      throw this.acknowledgementError(
        'The segment has not been emitted by this turn',
        acknowledgement
      );
    }

    const segmentLength = graphemeLength(segment.text, this.options.text?.locale);
    const previous = this.acknowledgements.get(segment.id) ?? 0;
    if (acknowledgement.charactersPlayed < previous) {
      throw this.acknowledgementError(
        'Playback acknowledgements must be monotonic',
        acknowledgement
      );
    }
    if (acknowledgement.charactersPlayed < 0 || acknowledgement.charactersPlayed > segmentLength) {
      throw this.acknowledgementError(
        `charactersPlayed must be between 0 and ${segmentLength}`,
        acknowledgement
      );
    }
    if (index < this.lastAcknowledgedSegment) {
      throw this.acknowledgementError(
        'Playback acknowledgements cannot move to an earlier segment',
        acknowledgement
      );
    }
    for (let preceding = 0; preceding < index; preceding++) {
      const prior = this.emittedSegments[preceding];
      if (
        prior &&
        (this.acknowledgements.get(prior.id) ?? 0) <
          graphemeLength(prior.text, this.options.text?.locale)
      ) {
        throw this.acknowledgementError(
          'Playback acknowledgements must follow segment order',
          acknowledgement
        );
      }
    }

    this.acknowledgements.set(segment.id, acknowledgement.charactersPlayed);
    this.lastAcknowledgedSegment = Math.max(this.lastAcknowledgedSegment, index);
    if (acknowledgement.audioMs !== undefined) this.telemetry.recordFirstAudio();
    const acknowledgedCharacters = this.acknowledgedCharacterCount();
    this.telemetry.setAcknowledgedCharacters(acknowledgedCharacters);
    if (this.settledResult) {
      const heardText = this.reconstructHeardText();
      Object.assign(this.settledResult, {
        acknowledgedText: heardText,
        heardText,
        acknowledgementConfidence: this.acknowledgementConfidence(acknowledgedCharacters),
      });
    }
  }

  interrupt(interruption: VoiceTurnInterruption): void {
    if (this.terminal) return;
    this.abortController.abort(interruption.reason);
    this.cancelSource();
    this.settle('interrupted', { interruption });
  }

  recordStage(marker: StageMarker): void {
    if (!this.terminal) this.telemetry.recordStage(marker);
  }

  private async consumeSource(): Promise<void> {
    if (this.terminal) return;
    try {
      const input = this.source(this.abortController.signal);
      if (typeof (input as ReadableStream<string>).getReader !== 'function') {
        const iterator = (input as AsyncIterable<string>)[Symbol.asyncIterator]();
        this.sourceCanceller = () => {
          try {
            const returned = iterator.return?.();
            if (returned instanceof Promise) void returned.catch(() => {});
          } catch {
            // Cancellation is best-effort; local settlement has already happened.
          }
        };
        await this.consumeIterator(() => iterator.next());
      } else {
        const reader = (input as ReadableStream<string>).getReader();
        this.sourceCanceller = () => {
          try {
            void reader.cancel(this.abortController.signal.reason).catch(() => {});
          } catch {
            // Cancellation is best-effort; local settlement has already happened.
          }
        };
        try {
          await this.consumeIterator(() => reader.read());
        } finally {
          try {
            reader.releaseLock();
          } catch {
            // A cancelled reader can already have released its lock.
          }
        }
      }

      if (this.terminal) return;
      await this.finishText();
      if (!this.terminal) this.settle('completed');
    } catch (error) {
      if (this.terminal) return;
      const pipelineError =
        error instanceof VoicePipelineError
          ? error
          : new VoicePipelineError('Voice text source failed', 'VOICE_SOURCE_FAILED', {
              cause: error,
            });
      this.cancelSource();
      this.settle('failed', { error: pipelineError });
    }
  }

  private async consumeIterator(read: () => Promise<TextReadResult>): Promise<void> {
    while (!this.terminal) {
      const next = await read();
      if (this.terminal || next.done) return;
      if (typeof next.value !== 'string') {
        throw new VoicePipelineError(
          'Voice text sources must yield strings',
          'VOICE_SOURCE_INVALID_CHUNK'
        );
      }

      this.generatedText += next.value;
      this.telemetry.recordInputDelta(graphemeLength(next.value, this.options.text?.locale));
      const normalized = this.normalizer.write(next.value);
      const transformed = await this.applyTransforms(normalized, false);
      if (this.terminal) return;
      this.emitSegments(this.segmenter.push(transformed));
      this.scheduleSegmentFlush();
    }
  }

  private async finishText(): Promise<void> {
    const finalText = await this.applyTransforms(this.normalizer.end(), true);
    if (this.terminal) return;
    this.emitSegments(this.segmenter.push(finalText));
    this.emitSegments(this.segmenter.finish());
  }

  private async applyTransforms(text: string, final: boolean): Promise<string> {
    let transformed = text;
    try {
      for (const transform of this.transforms)
        transformed = await transform(transformed, { final });
      return transformed;
    } catch (error) {
      throw new VoicePipelineError('Speech text transform failed', 'VOICE_TRANSFORM_FAILED', {
        cause: error,
      });
    }
  }

  private emitSegments(segments: readonly SpeechSegment[]): void {
    if (this.terminal) return;
    for (const segment of segments) {
      if (this.terminal) return;
      this.emittedSegments.push(segment);
      this.telemetry.recordSegment();
      this.eventQueue.push({ type: 'speech.segment', segment });
      this.stopStallTimer();
    }
  }

  private scheduleSegmentFlush(): void {
    if (this.terminal || !this.segmenter.pendingText || this.segmentTimer) return;
    this.segmentTimer = this.options.clock.setTimeout(() => {
      this.segmentTimer = undefined;
      if (this.terminal) return;
      this.emitSegments(this.segmenter.flushTimeout());
      if (this.segmenter.pendingText) this.scheduleSegmentFlush();
    }, this.options.text?.maxWaitMs ?? 250);
  }

  private scheduleStall(): void {
    if (this.terminal || this.emittedSegments.length > 0 || this.stallTimer) return;
    this.stallTimer = this.options.clock.setTimeout(() => {
      this.stallTimer = undefined;
      if (this.terminal || this.emittedSegments.length > 0) return;
      this.telemetry.recordStall();
      if (this.options.stallCues.enabled && this.cueRequests < this.options.stallCues.maxPerTurn) {
        this.cueRequests++;
        this.telemetry.recordCueRequest();
        this.eventQueue.push({
          type: 'stall.cue.requested',
          text: this.options.stallCues.text,
          sequence: this.cueRequests - 1,
        });
        if (this.cueRequests < this.options.stallCues.maxPerTurn) this.scheduleStall();
      }
    }, this.options.stallCues.delayMs);
  }

  private stopStallTimer(): void {
    if (this.stallTimer === undefined) return;
    this.options.clock.clearTimeout(this.stallTimer);
    this.stallTimer = undefined;
  }

  private cancelSource(): void {
    const cancel = this.sourceCanceller;
    this.sourceCanceller = undefined;
    cancel?.();
  }

  private stopTimers(): void {
    if (this.segmentTimer !== undefined) {
      this.options.clock.clearTimeout(this.segmentTimer);
      this.segmentTimer = undefined;
    }
    this.stopStallTimer();
  }

  private settle(
    outcome: VoiceTurnOutcome,
    options: { interruption?: VoiceTurnInterruption; error?: VoicePipelineError } = {}
  ): void {
    if (this.terminal) return;
    this.terminal = true;
    this.stopTimers();
    const metrics = this.telemetry.finish(outcome, options.error?.code);
    const heardText = this.reconstructHeardText();
    const acknowledgedCharacters = this.acknowledgedCharacterCount();
    const emittedCharacters = this.emittedSegments.reduce(
      (sum, segment) => sum + graphemeLength(segment.text, this.options.text?.locale),
      0
    );
    const result: VoiceTurnResult = {
      id: this.id,
      outcome,
      generatedText: this.generatedText,
      acknowledgedText: heardText,
      heardText,
      acknowledgementConfidence: this.acknowledgementConfidence(
        acknowledgedCharacters,
        emittedCharacters
      ),
      emittedSegments: [...this.emittedSegments],
      diagnostics: [...this.diagnostics],
      ...(options.interruption === undefined ? {} : { interruption: options.interruption }),
      ...(options.error === undefined ? {} : { error: options.error }),
      metrics,
    };
    this.settledResult = result;
    this.eventQueue.push({
      type: 'turn.ended',
      outcome,
      ...(options.error === undefined ? {} : { errorCode: options.error.code }),
    });
    this.eventQueue.close();
    this.resultDeferred.resolve(result);
    this.onSettled(metrics);
  }

  private reconstructHeardText(): string {
    return this.emittedSegments
      .map((segment) =>
        sliceGraphemes(
          segment.text,
          0,
          this.acknowledgements.get(segment.id) ?? 0,
          this.options.text?.locale
        )
      )
      .join('');
  }

  private acknowledgedCharacterCount(): number {
    let count = 0;
    for (const characters of this.acknowledgements.values()) count += characters;
    return count;
  }

  private acknowledgementConfidence(
    acknowledgedCharacters = this.acknowledgedCharacterCount(),
    emittedCharacters = this.emittedSegments.reduce(
      (sum, segment) => sum + graphemeLength(segment.text, this.options.text?.locale),
      0
    )
  ): VoiceTurnResult['acknowledgementConfidence'] {
    if (acknowledgedCharacters === 0) return 'none';
    return acknowledgedCharacters === emittedCharacters ? 'complete' : 'partial';
  }

  private reportDiagnostic(diagnostic: SpeechDiagnostic): void {
    if (this.terminal) return;
    this.diagnostics.push(diagnostic);
    this.eventQueue.push({ type: 'turn.diagnostic', diagnostic });
    if (!this.options.onDiagnostic) return;
    try {
      this.options.onDiagnostic(diagnostic);
    } catch (error) {
      this.options.onSinkError({ error, source: 'diagnostic-listener' });
    }
  }

  private acknowledgementError(
    message: string,
    acknowledgement: PlaybackAcknowledgement
  ): VoicePipelineError {
    return new VoicePipelineError(message, 'VOICE_PLAYBACK_ACK_INVALID', {
      context: { turnId: this.id, ...acknowledgement },
    });
  }
}

class DefaultVoicePipeline implements VoicePipeline {
  private readonly options: ResolvedPipelineOptions;
  private readonly activeTurns = new Map<string, VoiceTurnHandle>();
  private readonly metrics: VoiceTurnMetrics[] = [];

  constructor(options: VoicePipelineOptions = {}) {
    const onSinkError = options.telemetry?.onSinkError ?? (() => {});
    this.options = {
      text: options.text,
      stallCues: {
        enabled: options.stallCues?.enabled ?? false,
        delayMs: options.stallCues?.delayMs ?? 600,
        text: options.stallCues?.text ?? 'One moment.',
        maxPerTurn: options.stallCues?.maxPerTurn ?? 1,
      },
      clock: options.clock ?? systemClock,
      sinks: options.telemetry?.sinks ?? [],
      onSinkError,
      maxStoredMetrics: options.telemetry?.maxStoredMetrics ?? 100,
      ...(options.onDiagnostic === undefined ? {} : { onDiagnostic: options.onDiagnostic }),
    };
    if (
      !Number.isFinite(this.options.stallCues.delayMs) ||
      this.options.stallCues.delayMs < 0 ||
      !Number.isInteger(this.options.stallCues.maxPerTurn) ||
      this.options.stallCues.maxPerTurn < 1
    ) {
      throw new VoicePipelineError(
        'stall cue delayMs must be non-negative and maxPerTurn must be at least 1',
        'VOICE_TURN_INVALID_CONFIG'
      );
    }
    if (!Number.isInteger(this.options.maxStoredMetrics) || this.options.maxStoredMetrics < 1) {
      throw new VoicePipelineError(
        'maxStoredMetrics must be a positive integer',
        'VOICE_TELEMETRY_INVALID_CONFIG'
      );
    }
  }

  get clock(): VoiceClock {
    return this.options.clock;
  }

  get activeTurnCount(): number {
    return this.activeTurns.size;
  }

  startTurn({ id, source }: StartVoiceTurnOptions): VoiceTurn {
    if (!id) {
      throw new VoicePipelineError('A non-empty turn id is required', 'VOICE_TURN_INVALID_ID');
    }
    if (this.activeTurns.has(id)) {
      throw new VoicePipelineError(
        `A turn with id ${id} is already active`,
        'VOICE_TURN_DUPLICATE_ID'
      );
    }

    const turn = new VoiceTurnHandle(id, source, this.options, (metric) => {
      this.activeTurns.delete(id);
      this.metrics.push(metric);
      if (this.metrics.length > this.options.maxStoredMetrics) this.metrics.shift();
    });
    this.activeTurns.set(id, turn);
    return turn;
  }

  getMetrics(): readonly VoiceTurnMetrics[] {
    return [...this.metrics];
  }

  clearMetrics(): void {
    this.metrics.length = 0;
  }
}

export function createVoicePipeline(options: VoicePipelineOptions = {}): VoicePipeline {
  return new DefaultVoicePipeline(options);
}
