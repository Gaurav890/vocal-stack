import type { VoicePipelineError } from '../errors';
import type { VoiceTurnOutcome } from '../shared';
import type { VoiceClock } from '../telemetry/clock';
import type { TelemetryConfig, VoiceTurnMetrics } from '../telemetry/types';
import type {
  SpeechDiagnostic,
  SpeechSegment,
  SpeechTextConfig,
  SpeechTextInput,
} from '../text/types';

export type { VoiceTurnOutcome } from '../shared';

export type VoiceTextSource = (signal: AbortSignal) => SpeechTextInput;

export interface StallCueConfig {
  readonly enabled?: boolean;
  readonly delayMs?: number;
  readonly text?: string;
  readonly maxPerTurn?: number;
}

export interface VoicePipelineOptions {
  readonly text?: SpeechTextConfig;
  readonly stallCues?: StallCueConfig;
  readonly telemetry?: TelemetryConfig;
  readonly clock?: VoiceClock;
  readonly onDiagnostic?: (diagnostic: SpeechDiagnostic) => void;
}

export interface StartVoiceTurnOptions {
  readonly id: string;
  readonly source: VoiceTextSource;
}

export interface PlaybackAcknowledgement {
  readonly segmentId: string;
  readonly charactersPlayed: number;
  readonly audioMs?: number;
}

export interface VoiceTurnInterruption {
  readonly reason: string;
}

export type AcknowledgementConfidence = 'none' | 'partial' | 'complete';

export type VoiceTurnEvent =
  | {
      readonly type: 'speech.segment';
      readonly segment: SpeechSegment;
    }
  | {
      readonly type: 'stall.cue.requested';
      readonly text: string;
      readonly sequence: number;
    }
  | {
      readonly type: 'turn.diagnostic';
      readonly diagnostic: SpeechDiagnostic;
    }
  | {
      readonly type: 'turn.ended';
      readonly outcome: VoiceTurnOutcome;
      readonly errorCode?: string;
    };

export interface VoiceTurnResult {
  readonly id: string;
  readonly outcome: VoiceTurnOutcome;
  readonly generatedText: string;
  readonly acknowledgedText: string;
  readonly heardText: string;
  readonly acknowledgementConfidence: AcknowledgementConfidence;
  readonly emittedSegments: readonly SpeechSegment[];
  readonly diagnostics: readonly SpeechDiagnostic[];
  readonly interruption?: VoiceTurnInterruption;
  readonly error?: VoicePipelineError;
  readonly metrics: VoiceTurnMetrics;
}

export interface VoiceTurn {
  readonly id: string;
  readonly events: AsyncIterable<VoiceTurnEvent>;
  readonly result: Promise<VoiceTurnResult>;
  acknowledgePlayback(acknowledgement: PlaybackAcknowledgement): void;
  interrupt(interruption: VoiceTurnInterruption): void;
  recordStage(marker: import('../telemetry/types').StageMarker): void;
}

export interface VoicePipeline {
  readonly clock: VoiceClock;
  startTurn(options: StartVoiceTurnOptions): VoiceTurn;
  getMetrics(): readonly VoiceTurnMetrics[];
  clearMetrics(): void;
  readonly activeTurnCount: number;
}
