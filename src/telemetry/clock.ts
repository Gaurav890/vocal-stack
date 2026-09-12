export type ClockTimer = ReturnType<typeof setTimeout> | number;

export interface VoiceClock {
  monotonicNow(): number;
  wallNow(): number;
  setTimeout(callback: () => void, delayMs: number): ClockTimer;
  clearTimeout(timer: ClockTimer): void;
}

export const systemClock: VoiceClock = {
  monotonicNow: () => globalThis.performance?.now() ?? Date.now(),
  wallNow: () => Date.now(),
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: (timer) => globalThis.clearTimeout(timer),
};
