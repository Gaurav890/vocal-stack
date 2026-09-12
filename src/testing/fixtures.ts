import type { VoiceScenarioStep } from './scenario';

export const builtInVoiceScenarios = {
  bargeIn: [
    { atMs: 0, type: 'delta', text: 'Let me check that carefully now.' },
    { atMs: 50, type: 'playback.ack', segment: 0, charactersPlayed: 6 },
    { atMs: 75, type: 'interrupt', reason: 'barge-in' },
  ],
  stalledFirstResponse: [
    { atMs: 600, type: 'stall' },
    { atMs: 700, type: 'delta', text: 'Thanks for waiting.' },
    { atMs: 750, type: 'source.complete' },
  ],
  sourceFailure: (error: unknown): readonly VoiceScenarioStep[] => [
    { atMs: 0, type: 'delta', text: 'Starting ' },
    { atMs: 20, type: 'source.error', error },
  ],
} as const satisfies Record<
  string,
  readonly VoiceScenarioStep[] | ((error: unknown) => readonly VoiceScenarioStep[])
>;
