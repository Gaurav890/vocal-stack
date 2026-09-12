import type { StagePhase, VoiceStage } from 'vocal-stack/telemetry';
import type { VoiceTurn } from 'vocal-stack/turn';

export interface LiveKitMetricHook {
  readonly component: 'stt' | 'llm' | 'tts' | 'turn_detector' | 'realtime_model';
  readonly phase: 'started' | 'first_output' | 'completed' | 'cancelled' | 'failed';
  readonly operationId?: string;
  readonly monotonicAt?: number;
}

const STAGES: Record<LiveKitMetricHook['component'], VoiceStage> = {
  stt: 'stt',
  llm: 'llm',
  tts: 'tts',
  turn_detector: 'turn-detection',
  realtime_model: 'realtime-model',
};

const PHASES: Record<LiveKitMetricHook['phase'], StagePhase> = {
  started: 'start',
  first_output: 'first-output',
  completed: 'end',
  cancelled: 'cancel',
  failed: 'error',
};

export function recordLiveKitMetric(turn: VoiceTurn, metric: LiveKitMetricHook): void {
  turn.recordStage({
    stage: STAGES[metric.component],
    phase: PHASES[metric.phase],
    ...(metric.operationId === undefined ? {} : { operationId: metric.operationId }),
    ...(metric.monotonicAt === undefined ? {} : { at: metric.monotonicAt }),
  });
}
