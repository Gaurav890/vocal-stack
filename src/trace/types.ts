import type { VoiceTurnOutcome } from '../shared';
import type { StageMarker } from '../telemetry/types';
import type { SpeechBoundary, SpeechDiagnostic, SpeechTextMode } from '../text/types';

export const VOICE_TRACE_SCHEMA_VERSION = 1 as const;

export type VoiceTraceContentMode = 'none' | 'redacted' | 'full';

export interface VoiceTraceConfiguration {
  readonly text: {
    readonly locale?: string;
    readonly mode: SpeechTextMode;
    readonly minChars: number;
    readonly targetChars: number;
    readonly maxChars: number;
    readonly maxWaitMs: number;
    readonly maxPendingChars: number;
    readonly hasTransforms: boolean;
  };
  readonly stallCues: {
    readonly enabled: boolean;
    readonly delayMs: number;
    readonly maxPerTurn: number;
  };
}

export interface VoiceTraceEventBase {
  readonly turnId: string;
  /** Milliseconds since this turn's `turn.started` event. */
  readonly atMs: number;
  /** Stable ordering for events recorded at the same timestamp. */
  readonly sequence: number;
}

type WithTraceBase<T> = T & VoiceTraceEventBase;

export type VoiceTraceEvent =
  | WithTraceBase<{
      readonly type: 'turn.started';
      readonly startedAt: number;
      readonly configuration: VoiceTraceConfiguration;
    }>
  | WithTraceBase<{
      readonly type: 'input.delta';
      readonly characters: number;
      readonly text?: string;
    }>
  | WithTraceBase<{
      readonly type: 'speech.segment';
      readonly segmentId: string;
      readonly segmentSequence: number;
      readonly characters: number;
      readonly boundary: SpeechBoundary;
      readonly final: boolean;
      readonly text?: string;
    }>
  | WithTraceBase<{
      readonly type: 'playback.acknowledged';
      readonly segmentId: string;
      readonly segmentSequence: number;
      readonly charactersPlayed: number;
      readonly audioMs?: number;
    }>
  | WithTraceBase<{
      readonly type: 'stage.recorded';
      readonly marker: Omit<StageMarker, 'at' | 'wallAt'>;
    }>
  | WithTraceBase<{
      readonly type: 'stall.cue.requested';
      readonly cueSequence: number;
      readonly text?: string;
    }>
  | WithTraceBase<{
      readonly type: 'turn.diagnostic';
      readonly diagnostic: SpeechDiagnostic;
    }>
  | WithTraceBase<{ readonly type: 'source.completed' }>
  | WithTraceBase<{
      readonly type: 'source.failed';
      readonly errorCode: string;
    }>
  | WithTraceBase<{ readonly type: 'consumer.cancelled' }>
  | WithTraceBase<{
      readonly type: 'turn.interrupted';
      readonly reason: string;
    }>
  | WithTraceBase<{
      readonly type: 'turn.ended';
      readonly outcome: VoiceTurnOutcome;
      readonly errorCode?: string;
    }>;

type WithoutTraceBase<T> = T extends VoiceTraceEvent ? Omit<T, keyof VoiceTraceEventBase> : never;

/** @internal Payload accepted by the pipeline before timing metadata is attached. */
export type VoiceTraceEventPayload = WithoutTraceBase<VoiceTraceEvent>;

export interface VoiceTrace {
  readonly schemaVersion: typeof VOICE_TRACE_SCHEMA_VERSION;
  readonly turnId: string;
  /** Wall-clock timestamp used only to correlate the trace with external systems. */
  readonly startedAt: number;
  readonly durationMs: number;
  readonly content: VoiceTraceContentMode;
  readonly configuration: VoiceTraceConfiguration;
  readonly events: readonly VoiceTraceEvent[];
  readonly outcome?: VoiceTurnOutcome;
  readonly errorCode?: string;
  /** True when the recorder reached its configured per-turn event limit. */
  readonly truncated: boolean;
}

export interface VoiceTraceSink {
  record(event: VoiceTraceEvent): void | Promise<void>;
}

export interface VoiceTraceSinkError {
  readonly error: unknown;
  readonly sink: VoiceTraceSink;
  readonly event: VoiceTraceEvent;
}

export interface VoiceTraceConfig {
  readonly sinks?: readonly VoiceTraceSink[];
  readonly onSinkError?: (failure: VoiceTraceSinkError) => void;
}

export interface VoiceTraceRedactionContext {
  readonly turnId: string;
  readonly eventType: 'input.delta' | 'speech.segment' | 'stall.cue.requested';
}

export interface VoiceTraceRecorderOptions {
  /** `none` is the privacy-safe default and never persists speech text. */
  readonly content?: VoiceTraceContentMode;
  /** Required when `content` is `redacted`. */
  readonly redact?: (text: string, context: VoiceTraceRedactionContext) => string;
  /** Maximum events retained per turn, including start and end. Defaults to 10,000. */
  readonly maxEventsPerTurn?: number;
  /** Maximum completed traces retained in memory. Defaults to 100. */
  readonly maxStoredTraces?: number;
}
