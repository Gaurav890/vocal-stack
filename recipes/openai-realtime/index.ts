import type { VoiceTurn } from 'vocal-stack/turn';

export interface RealtimeLifecycleEvent {
  readonly type: string;
  readonly responseId?: string;
  readonly response_id?: string;
  readonly response?: {
    readonly id?: string;
    readonly status?: string;
  };
}

export function recordOpenAiRealtimeEvent(turn: VoiceTurn, event: RealtimeLifecycleEvent): void {
  const operationId = event.responseId ?? event.response_id ?? event.response?.id;
  const marker = (phase: 'start' | 'first-output' | 'end' | 'cancel' | 'error') =>
    turn.recordStage({
      stage: 'realtime-model',
      phase,
      ...(operationId === undefined ? {} : { operationId }),
    });

  switch (event.type) {
    case 'response.created':
      marker('start');
      break;
    case 'response.output_text.delta':
    case 'response.output_audio.delta':
    case 'response.output_audio_transcript.delta':
    case 'response.function_call_arguments.delta':
      marker('first-output');
      break;
    case 'response.done': {
      const status = event.response?.status;
      marker(
        status === 'cancelled'
          ? 'cancel'
          : status === 'failed' || status === 'incomplete'
            ? 'error'
            : 'end'
      );
      break;
    }
    case 'error':
      marker('error');
      break;
  }
}

export function acknowledgeRealtimePlayback(
  turn: VoiceTurn,
  segmentId: string,
  charactersPlayed: number,
  audioMs: number
): void {
  turn.acknowledgePlayback({ segmentId, charactersPlayed, audioMs });
}
