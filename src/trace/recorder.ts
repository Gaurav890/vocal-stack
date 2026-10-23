import { VoicePipelineError } from '../errors';
import type {
  VoiceTrace,
  VoiceTraceConfiguration,
  VoiceTraceContentMode,
  VoiceTraceEvent,
  VoiceTraceRecorderOptions,
  VoiceTraceSink,
} from './types';
import { VOICE_TRACE_SCHEMA_VERSION } from './types';

interface StoredTrace {
  readonly turnId: string;
  readonly startedAt: number;
  readonly configuration: VoiceTraceConfiguration;
  readonly events: VoiceTraceEvent[];
  truncated: boolean;
}

function positiveInteger(value: number, name: string, minimum = 1): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new VoicePipelineError(
      `${name} must be an integer greater than or equal to ${minimum}`,
      'VOICE_TRACE_INVALID_CONFIG'
    );
  }
}

export class VoiceTraceRecorder implements VoiceTraceSink {
  private readonly content: VoiceTraceContentMode;
  private readonly redact?: VoiceTraceRecorderOptions['redact'];
  private readonly maxEventsPerTurn: number;
  private readonly maxStoredTraces: number;
  private readonly traces = new Map<string, StoredTrace>();
  private readonly completedOrder: string[] = [];

  constructor(options: VoiceTraceRecorderOptions = {}) {
    this.content = options.content ?? 'none';
    this.redact = options.redact;
    this.maxEventsPerTurn = options.maxEventsPerTurn ?? 10_000;
    this.maxStoredTraces = options.maxStoredTraces ?? 100;

    if (this.content !== 'none' && this.content !== 'redacted' && this.content !== 'full') {
      throw new VoicePipelineError('Trace content mode is invalid', 'VOICE_TRACE_INVALID_CONFIG');
    }
    positiveInteger(this.maxEventsPerTurn, 'maxEventsPerTurn', 2);
    positiveInteger(this.maxStoredTraces, 'maxStoredTraces');
    if (this.content === 'redacted' && !this.redact) {
      throw new VoicePipelineError(
        'A redact function is required when trace content is redacted',
        'VOICE_TRACE_INVALID_CONFIG'
      );
    }
  }

  record(event: VoiceTraceEvent): void {
    if (event.type === 'turn.started') {
      this.removeCompletedId(event.turnId);
      this.traces.set(event.turnId, {
        turnId: event.turnId,
        startedAt: event.startedAt,
        configuration: event.configuration,
        events: [this.sanitize(event)],
        truncated: false,
      });
      return;
    }

    const stored = this.traces.get(event.turnId);
    if (!stored) {
      throw new VoicePipelineError(
        `Trace event ${event.type} arrived before turn.started`,
        'VOICE_TRACE_EVENT_ORDER',
        { context: { turnId: event.turnId, eventType: event.type } }
      );
    }

    const sanitized = this.sanitize(event);
    if (event.type === 'turn.ended') {
      if (stored.events.length >= this.maxEventsPerTurn) {
        stored.events[this.maxEventsPerTurn - 1] = sanitized;
        stored.truncated = true;
      } else {
        stored.events.push(sanitized);
      }
      this.completedOrder.push(event.turnId);
      this.evictCompletedTraces();
      return;
    }

    // Reserve one slot for turn.ended so every completed trace keeps its terminal outcome.
    if (stored.events.length >= this.maxEventsPerTurn - 1) {
      stored.truncated = true;
      return;
    }
    stored.events.push(sanitized);
  }

  getTrace(turnId: string): VoiceTrace | undefined {
    const stored = this.traces.get(turnId);
    return stored ? this.snapshot(stored) : undefined;
  }

  getTraces(): readonly VoiceTrace[] {
    return [...this.traces.values()].map((trace) => this.snapshot(trace));
  }

  clear(): void {
    this.traces.clear();
    this.completedOrder.length = 0;
  }

  private sanitize(event: VoiceTraceEvent): VoiceTraceEvent {
    if (event.type !== 'input.delta' && event.type !== 'speech.segment') {
      if (event.type !== 'stall.cue.requested') return event;
    }

    const { text: _text, ...metadata } = event;
    if (event.text === undefined || this.content === 'none') return metadata;
    if (this.content === 'full') return { ...metadata, text: event.text };
    const text = this.redact?.(event.text, {
      turnId: event.turnId,
      eventType: event.type,
    });
    if (typeof text !== 'string') {
      throw new VoicePipelineError(
        'Voice trace redactors must return a string',
        'VOICE_TRACE_REDACTION_FAILED'
      );
    }
    return {
      ...metadata,
      text,
    };
  }

  private snapshot(stored: StoredTrace): VoiceTrace {
    let ended: Extract<VoiceTraceEvent, { readonly type: 'turn.ended' }> | undefined;
    for (let index = stored.events.length - 1; index >= 0; index--) {
      const event = stored.events[index];
      if (event?.type === 'turn.ended') {
        ended = event;
        break;
      }
    }
    const durationMs = stored.events.at(-1)?.atMs ?? 0;
    return {
      schemaVersion: VOICE_TRACE_SCHEMA_VERSION,
      turnId: stored.turnId,
      startedAt: stored.startedAt,
      durationMs,
      content: this.content,
      configuration: stored.configuration,
      events: stored.events.map((event) => ({ ...event })),
      ...(ended?.type !== 'turn.ended' ? {} : { outcome: ended.outcome }),
      ...(ended?.type !== 'turn.ended' || ended.errorCode === undefined
        ? {}
        : { errorCode: ended.errorCode }),
      truncated: stored.truncated,
    };
  }

  private removeCompletedId(turnId: string): void {
    const index = this.completedOrder.indexOf(turnId);
    if (index >= 0) this.completedOrder.splice(index, 1);
  }

  private evictCompletedTraces(): void {
    while (this.completedOrder.length > this.maxStoredTraces) {
      const turnId = this.completedOrder.shift();
      if (turnId !== undefined) this.traces.delete(turnId);
    }
  }
}

export function createVoiceTraceRecorder(
  options: VoiceTraceRecorderOptions = {}
): VoiceTraceRecorder {
  return new VoiceTraceRecorder(options);
}
