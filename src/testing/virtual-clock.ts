import type { ClockTimer, VoiceClock } from '../telemetry';

interface ScheduledTimer {
  readonly id: number;
  readonly at: number;
  readonly callback: () => void;
  cancelled: boolean;
}

export class VirtualClock implements VoiceClock {
  private nowMs: number;
  private readonly wallEpochMs: number;
  private nextTimerId = 1;
  private readonly timers = new Map<number, ScheduledTimer>();

  constructor(options: { readonly nowMs?: number; readonly wallEpochMs?: number } = {}) {
    this.nowMs = options.nowMs ?? 0;
    this.wallEpochMs = options.wallEpochMs ?? 1_700_000_000_000;
  }

  get pendingTimerCount(): number {
    let count = 0;
    for (const timer of this.timers.values()) if (!timer.cancelled) count++;
    return count;
  }

  monotonicNow(): number {
    return this.nowMs;
  }

  wallNow(): number {
    return this.wallEpochMs + this.nowMs;
  }

  setTimeout(callback: () => void, delayMs: number): ClockTimer {
    const id = this.nextTimerId++;
    this.timers.set(id, {
      id,
      at: this.nowMs + Math.max(0, delayMs),
      callback,
      cancelled: false,
    });
    return id;
  }

  clearTimeout(timer: ClockTimer): void {
    if (typeof timer !== 'number') return;
    const scheduled = this.timers.get(timer);
    if (scheduled) scheduled.cancelled = true;
  }

  advanceBy(durationMs: number): void {
    if (durationMs < 0) throw new RangeError('VirtualClock cannot move backwards');
    this.advanceTo(this.nowMs + durationMs);
  }

  advanceTo(targetMs: number): void {
    if (targetMs < this.nowMs) throw new RangeError('VirtualClock cannot move backwards');

    while (true) {
      const next = this.nextTimerAtOrBefore(targetMs);
      if (!next) break;
      this.timers.delete(next.id);
      if (next.cancelled) continue;
      this.nowMs = next.at;
      next.callback();
    }
    this.nowMs = targetMs;
    this.removeCancelledTimers();
  }

  runAll(options: { readonly maxTimers?: number } = {}): void {
    const maxTimers = options.maxTimers ?? 10_000;
    let executed = 0;
    while (this.pendingTimerCount > 0) {
      if (executed++ >= maxTimers) throw new Error('VirtualClock timer limit exceeded');
      const next = this.nextTimerAtOrBefore(Number.POSITIVE_INFINITY);
      if (!next) return;
      this.advanceTo(next.at);
    }
  }

  private nextTimerAtOrBefore(targetMs: number): ScheduledTimer | undefined {
    let selected: ScheduledTimer | undefined;
    for (const timer of this.timers.values()) {
      if (timer.cancelled || timer.at > targetMs) continue;
      if (
        !selected ||
        timer.at < selected.at ||
        (timer.at === selected.at && timer.id < selected.id)
      ) {
        selected = timer;
      }
    }
    return selected;
  }

  private removeCancelledTimers(): void {
    for (const [id, timer] of this.timers) if (timer.cancelled) this.timers.delete(id);
  }
}
