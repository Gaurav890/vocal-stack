import type { VoiceTurnOutcome } from '../shared';

export type VoiceStage =
  | 'turn-detection'
  | 'stt'
  | 'llm'
  | 'tool'
  | 'tts'
  | 'playback'
  | 'realtime-model'
  | `${string}.${string}`;

export type StagePhase = 'start' | 'first-output' | 'end' | 'cancel' | 'error';

export interface StageMarker {
  readonly stage: VoiceStage;
  readonly phase: StagePhase;
  readonly operationId?: string;
  /** Monotonic timestamp supplied by the same clock used by the pipeline. */
  readonly at?: number;
  /** Wall-clock timestamp used only for cross-system correlation. */
  readonly wallAt?: number;
}

export interface StageDuration {
  readonly stage: VoiceStage;
  readonly operationId?: string;
  readonly durationMs: number;
  readonly timeToFirstOutputMs?: number;
  readonly outcome: 'completed' | 'cancelled' | 'failed';
}

export interface VoiceTurnMetrics {
  readonly turnId: string;
  readonly startedAt: number;
  readonly outcome: VoiceTurnOutcome;
  readonly errorCode?: string;
  readonly timeToFirstInputDeltaMs?: number;
  readonly timeToFirstSegmentMs?: number;
  readonly timeToFirstAudioMs?: number;
  readonly llmTtftMs?: number;
  readonly ttsTtfbMs?: number;
  readonly endToEndResponseLatencyMs?: number;
  readonly totalDurationMs: number;
  readonly stageDurations: readonly StageDuration[];
  readonly chunkCount: number;
  readonly segmentCount: number;
  readonly stallCount: number;
  readonly cueRequests: number;
  readonly generatedCharacters: number;
  readonly acknowledgedCharacters: number;
}

export type TelemetryEvent =
  | {
      readonly type: 'stage';
      readonly turnId: string;
      readonly at: number;
      readonly wallAt: number;
      readonly marker: Omit<StageMarker, 'at' | 'wallAt'>;
    }
  | {
      readonly type: 'turn.metrics';
      readonly turnId: string;
      readonly at: number;
      readonly wallAt: number;
      readonly metrics: VoiceTurnMetrics;
    };

export interface TelemetrySink {
  record(event: TelemetryEvent): void | Promise<void>;
}

export interface TelemetrySinkError {
  readonly error: unknown;
  readonly sink?: TelemetrySink;
  readonly event?: TelemetryEvent;
  readonly source: 'sink' | 'diagnostic-listener';
}

export interface TelemetryConfig {
  readonly sinks?: readonly TelemetrySink[];
  readonly onSinkError?: (failure: TelemetrySinkError) => void;
  readonly maxStoredMetrics?: number;
}
