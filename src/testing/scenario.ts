import { VoicePipelineError } from '../errors';
import type { StageMarker } from '../telemetry/types';
import type { VoicePipeline, VoiceTurnEvent, VoiceTurnOutcome, VoiceTurnResult } from '../turn';
import { VirtualClock } from './virtual-clock';

export type VoiceScenarioStep =
  | { readonly atMs: number; readonly type: 'delta'; readonly text: string }
  | { readonly atMs: number; readonly type: 'stall' }
  | { readonly atMs: number; readonly type: 'source.complete' }
  | { readonly atMs: number; readonly type: 'source.error'; readonly error: unknown }
  | { readonly atMs: number; readonly type: 'stage'; readonly marker: StageMarker }
  | {
      readonly atMs: number;
      readonly type: 'playback.ack';
      readonly segment: number;
      readonly charactersPlayed: number;
      readonly audioMs?: number;
    }
  | { readonly atMs: number; readonly type: 'consumer.cancel' }
  | { readonly atMs: number; readonly type: 'interrupt'; readonly reason: string };

export interface VoiceScenario {
  readonly pipeline: VoicePipeline;
  readonly timeline: readonly VoiceScenarioStep[];
  readonly turnId?: string;
}

export interface VoiceScenarioResult {
  readonly turn: VoiceTurnResult;
  readonly events: readonly VoiceTurnEvent[];
  readonly settledInMs: number;
  readonly pendingTimerCount: number;
}

interface SourceEntry {
  readonly value?: string;
  readonly done?: boolean;
  readonly error?: unknown;
}

class ScenarioSource {
  private readonly values: SourceEntry[] = [];
  private readonly waiters: Array<{
    resolve: (result: IteratorResult<string>) => void;
    reject: (error: unknown) => void;
  }> = [];
  private ended = false;

  push(value: string): void {
    this.deliver({ value });
  }

  complete(): void {
    this.ended = true;
    this.deliver({ done: true });
  }

  fail(error: unknown): void {
    this.ended = true;
    this.deliver({ error });
  }

  iterable(): AsyncIterable<string> {
    return {
      [Symbol.asyncIterator]: () => ({
        next: () => {
          const queued = this.values.shift();
          if (queued) return this.resolveEntry(queued);
          if (this.ended) return Promise.resolve({ value: undefined, done: true });
          return new Promise<IteratorResult<string>>((resolve, reject) => {
            this.waiters.push({ resolve, reject });
          });
        },
        return: () => {
          this.ended = true;
          for (const waiter of this.waiters.splice(0)) {
            waiter.resolve({ value: undefined, done: true });
          }
          return Promise.resolve({ value: undefined, done: true });
        },
      }),
    };
  }

  private deliver(entry: SourceEntry): void {
    const waiter = this.waiters.shift();
    if (!waiter) {
      this.values.push(entry);
      return;
    }
    if (entry.error !== undefined) waiter.reject(entry.error);
    else if (entry.done) waiter.resolve({ value: undefined, done: true });
    else waiter.resolve({ value: entry.value ?? '', done: false });
  }

  private resolveEntry(entry: SourceEntry): Promise<IteratorResult<string>> {
    if (entry.error !== undefined) return Promise.reject(entry.error);
    if (entry.done) return Promise.resolve({ value: undefined, done: true });
    return Promise.resolve({ value: entry.value ?? '', done: false });
  }
}

async function drainMicrotasks(): Promise<void> {
  for (let iteration = 0; iteration < 8; iteration++) await Promise.resolve();
}

export async function runVoiceScenario(scenario: VoiceScenario): Promise<VoiceScenarioResult> {
  const clock = scenario.pipeline.clock;
  if (!(clock instanceof VirtualClock)) {
    throw new VoicePipelineError(
      'runVoiceScenario requires a pipeline configured with the same VirtualClock',
      'VOICE_SCENARIO_CLOCK_REQUIRED'
    );
  }

  const timeline = [...scenario.timeline].sort((left, right) => left.atMs - right.atMs);
  if (timeline.some((step) => step.atMs < 0)) {
    throw new VoicePipelineError(
      'Scenario timestamps must be non-negative',
      'VOICE_SCENARIO_INVALID_TIMELINE'
    );
  }

  const source = new ScenarioSource();
  const scenarioStartedAt = clock.monotonicNow();
  const turn = scenario.pipeline.startTurn({
    id: scenario.turnId ?? 'scenario-turn',
    source: () => source.iterable(),
  });
  const events: VoiceTurnEvent[] = [];
  const eventIterator = turn.events[Symbol.asyncIterator]();
  const eventPump = (async () => {
    while (true) {
      const next = await eventIterator.next();
      if (next.done) return;
      events.push(next.value);
    }
  })();

  let terminalActionAt = scenarioStartedAt + (timeline.at(-1)?.atMs ?? 0);
  try {
    for (const step of timeline) {
      clock.advanceTo(scenarioStartedAt + step.atMs);
      await drainMicrotasks();

      switch (step.type) {
        case 'delta':
          source.push(step.text);
          break;
        case 'stall':
          break;
        case 'source.complete':
          source.complete();
          terminalActionAt = scenarioStartedAt + step.atMs;
          break;
        case 'source.error':
          source.fail(step.error);
          terminalActionAt = scenarioStartedAt + step.atMs;
          break;
        case 'stage':
          turn.recordStage(step.marker);
          break;
        case 'playback.ack': {
          const segments = events
            .filter((event) => event.type === 'speech.segment')
            .map((event) => event.segment);
          const segment = segments[step.segment];
          if (!segment) {
            throw new VoicePipelineError(
              `Scenario referenced speech segment ${step.segment} before it was emitted`,
              'VOICE_SCENARIO_SEGMENT_MISSING'
            );
          }
          turn.acknowledgePlayback({
            segmentId: segment.id,
            charactersPlayed: step.charactersPlayed,
            ...(step.audioMs === undefined ? {} : { audioMs: step.audioMs }),
          });
          break;
        }
        case 'consumer.cancel':
          await eventIterator.return?.();
          terminalActionAt = scenarioStartedAt + step.atMs;
          break;
        case 'interrupt':
          turn.interrupt({ reason: step.reason });
          terminalActionAt = scenarioStartedAt + step.atMs;
          break;
      }
      await drainMicrotasks();
    }
  } catch (error) {
    turn.interrupt({ reason: 'scenario-error' });
    await turn.result;
    await eventPump;
    throw error;
  }

  const hasTerminalStep = timeline.some(
    (step) =>
      step.type === 'source.complete' ||
      step.type === 'source.error' ||
      step.type === 'consumer.cancel' ||
      step.type === 'interrupt'
  );
  if (!hasTerminalStep) {
    source.complete();
    terminalActionAt = clock.monotonicNow();
    await drainMicrotasks();
  }

  const result = await turn.result;
  await eventPump;
  return {
    turn: result,
    events,
    settledInMs: Math.max(0, clock.monotonicNow() - terminalActionAt),
    pendingTimerCount: clock.pendingTimerCount,
  };
}

class VoiceScenarioExpectation {
  constructor(private readonly result: VoiceScenarioResult) {}

  toHaveOutcome(outcome: VoiceTurnOutcome): this {
    this.assert(
      this.result.turn.outcome === outcome,
      `Expected outcome ${outcome}, received ${this.result.turn.outcome}`
    );
    return this;
  }

  toHaveHeardText(text: string): this {
    this.assert(
      this.result.turn.heardText === text,
      `Expected heard text ${JSON.stringify(text)}, received ${JSON.stringify(this.result.turn.heardText)}`
    );
    return this;
  }

  toHaveGeneratedText(text: string): this {
    this.assert(
      this.result.turn.generatedText === text,
      `Expected generated text ${JSON.stringify(text)}, received ${JSON.stringify(this.result.turn.generatedText)}`
    );
    return this;
  }

  toHaveSegmentCount(count: number): this {
    this.assert(
      this.result.turn.emittedSegments.length === count,
      `Expected ${count} segments, received ${this.result.turn.emittedSegments.length}`
    );
    return this;
  }

  toSettleWithin(durationMs: number): this {
    this.assert(
      this.result.settledInMs <= durationMs,
      `Expected settlement within ${durationMs}ms, received ${this.result.settledInMs}ms`
    );
    return this;
  }

  toHaveNoPendingTimers(): this {
    this.assert(
      this.result.pendingTimerCount === 0,
      `Expected no pending timers, received ${this.result.pendingTimerCount}`
    );
    return this;
  }

  private assert(condition: boolean, message: string): void {
    if (!condition) throw new Error(message);
  }
}

export function expectVoiceScenario(result: VoiceScenarioResult): VoiceScenarioExpectation {
  return new VoiceScenarioExpectation(result);
}
