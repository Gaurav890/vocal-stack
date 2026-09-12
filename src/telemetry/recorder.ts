import type { VoiceTurnOutcome } from '../shared';
import type { VoiceClock } from './clock';
import type {
  StageDuration,
  StageMarker,
  TelemetryEvent,
  TelemetrySink,
  TelemetrySinkError,
  VoiceTurnMetrics,
} from './types';

interface ActiveStage {
  readonly stage: StageMarker['stage'];
  readonly operationId?: string;
  readonly startedAt: number;
  firstOutputAt?: number;
}

export class TurnTelemetryRecorder {
  private readonly activeStages = new Map<string, ActiveStage>();
  private readonly stageDurations: StageDuration[] = [];
  private readonly startedAt: number;
  private readonly startedWallAt: number;
  private firstInputAt?: number;
  private firstSegmentAt?: number;
  private firstAudioAt?: number;
  private chunkCount = 0;
  private segmentCount = 0;
  private stallCount = 0;
  private cueRequests = 0;
  private generatedCharacters = 0;
  private acknowledgedCharacters = 0;
  private finishedMetrics: VoiceTurnMetrics | undefined;

  constructor(
    private readonly turnId: string,
    private readonly clock: VoiceClock,
    private readonly sinks: readonly TelemetrySink[],
    private readonly onSinkError: (failure: TelemetrySinkError) => void
  ) {
    this.startedAt = clock.monotonicNow();
    this.startedWallAt = clock.wallNow();
  }

  recordStage(marker: StageMarker): void {
    const at = marker.at ?? this.clock.monotonicNow();
    const wallAt = marker.wallAt ?? this.clock.wallNow();
    const key = `${marker.stage}\u0000${marker.operationId ?? ''}`;
    const current = this.activeStages.get(key);

    if (marker.phase === 'start') {
      this.activeStages.set(key, {
        stage: marker.stage,
        ...(marker.operationId === undefined ? {} : { operationId: marker.operationId }),
        startedAt: at,
      });
    } else if (marker.phase === 'first-output' && current && current.firstOutputAt === undefined) {
      current.firstOutputAt = at;
    } else if (
      current &&
      (marker.phase === 'end' || marker.phase === 'cancel' || marker.phase === 'error')
    ) {
      this.stageDurations.push({
        stage: current.stage,
        ...(current.operationId === undefined ? {} : { operationId: current.operationId }),
        durationMs: Math.max(0, at - current.startedAt),
        ...(current.firstOutputAt === undefined
          ? {}
          : { timeToFirstOutputMs: Math.max(0, current.firstOutputAt - current.startedAt) }),
        outcome:
          marker.phase === 'end' ? 'completed' : marker.phase === 'cancel' ? 'cancelled' : 'failed',
      });
      this.activeStages.delete(key);
    }

    this.emit({
      type: 'stage',
      turnId: this.turnId,
      at,
      wallAt,
      marker: {
        stage: marker.stage,
        phase: marker.phase,
        ...(marker.operationId === undefined ? {} : { operationId: marker.operationId }),
      },
    });
  }

  recordInputDelta(characters: number): void {
    const now = this.clock.monotonicNow();
    this.firstInputAt ??= now;
    this.chunkCount++;
    this.generatedCharacters += characters;
  }

  recordSegment(): void {
    this.firstSegmentAt ??= this.clock.monotonicNow();
    this.segmentCount++;
  }

  recordFirstAudio(at = this.clock.monotonicNow()): void {
    this.firstAudioAt ??= at;
    if (this.finishedMetrics) {
      const elapsed = this.firstAudioAt - this.startedAt;
      Object.assign(this.finishedMetrics, {
        timeToFirstAudioMs: elapsed,
        endToEndResponseLatencyMs: elapsed,
        totalDurationMs: Math.max(this.finishedMetrics.totalDurationMs, elapsed),
      });
    }
  }

  recordStall(): void {
    this.stallCount++;
  }

  recordCueRequest(): void {
    this.cueRequests++;
  }

  setAcknowledgedCharacters(characters: number): void {
    this.acknowledgedCharacters = characters;
    if (this.finishedMetrics) {
      Object.assign(this.finishedMetrics, { acknowledgedCharacters: characters });
    }
  }

  finish(outcome: VoiceTurnOutcome, errorCode?: string): VoiceTurnMetrics {
    const endedAt = this.clock.monotonicNow();
    const unfinishedOutcome =
      outcome === 'completed' ? 'completed' : outcome === 'failed' ? 'failed' : 'cancelled';
    for (const stage of this.activeStages.values()) {
      this.stageDurations.push({
        stage: stage.stage,
        ...(stage.operationId === undefined ? {} : { operationId: stage.operationId }),
        durationMs: Math.max(0, endedAt - stage.startedAt),
        ...(stage.firstOutputAt === undefined
          ? {}
          : { timeToFirstOutputMs: Math.max(0, stage.firstOutputAt - stage.startedAt) }),
        outcome: unfinishedOutcome,
      });
    }
    this.activeStages.clear();

    const llm = this.stageDurations.find((stage) => stage.stage === 'llm');
    const tts = this.stageDurations.find((stage) => stage.stage === 'tts');
    const metrics: VoiceTurnMetrics = {
      turnId: this.turnId,
      startedAt: this.startedWallAt,
      outcome,
      ...(errorCode === undefined ? {} : { errorCode }),
      ...(this.firstInputAt === undefined
        ? {}
        : { timeToFirstInputDeltaMs: this.firstInputAt - this.startedAt }),
      ...(this.firstSegmentAt === undefined
        ? {}
        : { timeToFirstSegmentMs: this.firstSegmentAt - this.startedAt }),
      ...(this.firstAudioAt === undefined
        ? {}
        : { timeToFirstAudioMs: this.firstAudioAt - this.startedAt }),
      ...(llm?.timeToFirstOutputMs === undefined ? {} : { llmTtftMs: llm.timeToFirstOutputMs }),
      ...(tts?.timeToFirstOutputMs === undefined ? {} : { ttsTtfbMs: tts.timeToFirstOutputMs }),
      ...(this.firstAudioAt !== undefined
        ? { endToEndResponseLatencyMs: this.firstAudioAt - this.startedAt }
        : {}),
      totalDurationMs: Math.max(0, endedAt - this.startedAt),
      stageDurations: [...this.stageDurations],
      chunkCount: this.chunkCount,
      segmentCount: this.segmentCount,
      stallCount: this.stallCount,
      cueRequests: this.cueRequests,
      generatedCharacters: this.generatedCharacters,
      acknowledgedCharacters: this.acknowledgedCharacters,
    };
    this.finishedMetrics = metrics;

    this.emit({
      type: 'turn.metrics',
      turnId: this.turnId,
      at: endedAt,
      wallAt: this.clock.wallNow(),
      metrics,
    });
    return metrics;
  }

  private emit(event: TelemetryEvent): void {
    for (const sink of this.sinks) {
      try {
        const result = sink.record(event);
        if (result instanceof Promise) {
          void result.catch((error: unknown) =>
            this.reportSinkError({ error, sink, event, source: 'sink' })
          );
        }
      } catch (error) {
        this.reportSinkError({ error, sink, event, source: 'sink' });
      }
    }
  }

  private reportSinkError(failure: TelemetrySinkError): void {
    try {
      this.onSinkError(failure);
    } catch {
      // Error reporting is deliberately isolated from the active turn.
    }
  }
}
