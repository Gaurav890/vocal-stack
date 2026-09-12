import { describe, expect, it } from 'vitest';
import { createVoicePipeline } from '../turn';
import { builtInVoiceScenarios } from './fixtures';
import { expectVoiceScenario, runVoiceScenario } from './scenario';
import { VirtualClock } from './virtual-clock';

describe('VirtualClock', () => {
  it('runs timers deterministically in timestamp and insertion order', () => {
    const clock = new VirtualClock();
    const order: number[] = [];
    clock.setTimeout(() => order.push(2), 20);
    clock.setTimeout(() => order.push(1), 10);
    clock.setTimeout(() => order.push(3), 20);
    clock.advanceTo(20);
    expect(order).toEqual([1, 2, 3]);
    expect(clock.monotonicNow()).toBe(20);
  });

  it('cancels timers and refuses to move backwards', () => {
    const clock = new VirtualClock();
    const timer = clock.setTimeout(() => {}, 10);
    clock.clearTimeout(timer);
    expect(clock.pendingTimerCount).toBe(0);
    expect(() => clock.advanceTo(-1)).toThrow('backwards');
  });

  it('advances by a duration, exposes wall time, and runs all timers', () => {
    const clock = new VirtualClock({ nowMs: 5, wallEpochMs: 1_000 });
    const calls: number[] = [];
    clock.setTimeout(() => calls.push(clock.monotonicNow()), -5);
    clock.setTimeout(() => calls.push(clock.monotonicNow()), 10);
    clock.runAll();
    expect(calls).toEqual([5, 15]);
    expect(clock.wallNow()).toBe(1_015);
    clock.advanceBy(5);
    expect(clock.monotonicNow()).toBe(20);
    expect(() => clock.advanceBy(-1)).toThrow('backwards');
    clock.clearTimeout({} as ReturnType<typeof setTimeout>);
  });

  it('protects runAll from endlessly scheduled timers', () => {
    const clock = new VirtualClock();
    const schedule = () => clock.setTimeout(schedule, 1);
    schedule();
    expect(() => clock.runAll({ maxTimers: 2 })).toThrow('timer limit');
  });
});

describe('voice scenarios', () => {
  it('provides reusable barge-in, stall, and failure fixtures', () => {
    expect(builtInVoiceScenarios.bargeIn.at(-1)?.type).toBe('interrupt');
    expect(builtInVoiceScenarios.stalledFirstResponse[0]?.type).toBe('stall');
    expect(builtInVoiceScenarios.sourceFailure(new Error('fixture'))[1]?.type).toBe('source.error');
  });
  it('replays a partial-playback barge-in timeline', async () => {
    const clock = new VirtualClock();
    const pipeline = createVoicePipeline({
      clock,
      text: { minChars: 5, targetChars: 24, maxChars: 80, maxWaitMs: 800 },
    });
    const result = await runVoiceScenario({
      pipeline,
      timeline: [
        { atMs: 0, type: 'delta', text: 'Let me ' },
        { atMs: 600, type: 'stall' },
        { atMs: 700, type: 'delta', text: 'check that.' },
        { atMs: 850, type: 'playback.ack', segment: 0, charactersPlayed: 8 },
        { atMs: 900, type: 'interrupt', reason: 'barge-in' },
      ],
    });

    expectVoiceScenario(result)
      .toHaveOutcome('interrupted')
      .toHaveGeneratedText('Let me check that.')
      .toHaveHeardText('Let me c')
      .toSettleWithin(20)
      .toHaveNoPendingTimers();
  });

  it('supports source completion, error, and stage steps', async () => {
    const clock = new VirtualClock();
    const completed = await runVoiceScenario({
      pipeline: createVoicePipeline({ clock }),
      timeline: [
        { atMs: 0, type: 'stage', marker: { stage: 'stt', phase: 'start' } },
        { atMs: 5, type: 'delta', text: 'Done.' },
        { atMs: 10, type: 'stage', marker: { stage: 'stt', phase: 'end' } },
        { atMs: 11, type: 'source.complete' },
      ],
    });
    expectVoiceScenario(completed).toHaveOutcome('completed').toHaveSegmentCount(1);

    const failureClock = new VirtualClock();
    const failed = await runVoiceScenario({
      pipeline: createVoicePipeline({ clock: failureClock }),
      timeline: [{ atMs: 1, type: 'source.error', error: new Error('failure') }],
    });
    expectVoiceScenario(failed).toHaveOutcome('failed').toHaveNoPendingTimers();
  });

  it('supports automatic completion and consumer cancellation', async () => {
    const automaticClock = new VirtualClock();
    const automatic = await runVoiceScenario({
      pipeline: createVoicePipeline({ clock: automaticClock }),
      turnId: 'automatic',
      timeline: [{ atMs: 2, type: 'delta', text: 'Automatic.' }],
    });
    expectVoiceScenario(automatic).toHaveOutcome('completed').toHaveSegmentCount(1);

    const cancellationClock = new VirtualClock();
    const cancelled = await runVoiceScenario({
      pipeline: createVoicePipeline({ clock: cancellationClock }),
      timeline: [{ atMs: 3, type: 'consumer.cancel' }],
    });
    expectVoiceScenario(cancelled).toHaveOutcome('interrupted');
  });

  it('treats timeline timestamps as offsets when a virtual clock is reused', async () => {
    const clock = new VirtualClock({ nowMs: 100 });
    const pipeline = createVoicePipeline({ clock });
    await runVoiceScenario({
      pipeline,
      timeline: [{ atMs: 5, type: 'source.complete' }],
    });
    const second = await runVoiceScenario({
      pipeline,
      turnId: 'second-scenario',
      timeline: [{ atMs: 5, type: 'source.complete' }],
    });
    expect(second.turn.metrics.startedAt).toBe(1_700_000_000_105);
    expect(clock.monotonicNow()).toBe(110);
  });

  it('rejects invalid clocks, timestamps, and premature acknowledgements', async () => {
    await expect(
      runVoiceScenario({ pipeline: createVoicePipeline(), timeline: [] })
    ).rejects.toThrow('VirtualClock');

    const negativeClock = new VirtualClock();
    await expect(
      runVoiceScenario({
        pipeline: createVoicePipeline({ clock: negativeClock }),
        timeline: [{ atMs: -1, type: 'stall' }],
      })
    ).rejects.toThrow('non-negative');

    const missingClock = new VirtualClock();
    await expect(
      runVoiceScenario({
        pipeline: createVoicePipeline({ clock: missingClock }),
        timeline: [
          { atMs: 0, type: 'playback.ack', segment: 0, charactersPlayed: 1 },
          { atMs: 1, type: 'interrupt', reason: 'cleanup' },
        ],
      })
    ).rejects.toThrow('before it was emitted');
  });

  it('reports fluent assertion failures', async () => {
    const clock = new VirtualClock();
    const result = await runVoiceScenario({
      pipeline: createVoicePipeline({ clock }),
      timeline: [{ atMs: 0, type: 'source.complete' }],
    });
    expect(() => expectVoiceScenario(result).toHaveOutcome('failed')).toThrow('Expected outcome');
    expect(() => expectVoiceScenario(result).toHaveHeardText('nope')).toThrow(
      'Expected heard text'
    );
    expect(() => expectVoiceScenario(result).toHaveGeneratedText('nope')).toThrow(
      'Expected generated text'
    );
    expect(() => expectVoiceScenario(result).toHaveSegmentCount(1)).toThrow('Expected 1 segments');
    const slower = { ...result, settledInMs: 2, pendingTimerCount: 1 };
    expect(() => expectVoiceScenario(slower).toSettleWithin(1)).toThrow('within 1ms');
    expect(() => expectVoiceScenario(slower).toHaveNoPendingTimers()).toThrow('no pending timers');
  });
});
