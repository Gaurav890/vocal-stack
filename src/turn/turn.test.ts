import { describe, expect, it, vi } from 'vitest';
import { VoicePipelineError } from '../errors';
import { MemoryTelemetrySink } from '../telemetry';
import { VirtualClock } from '../testing';
import { createVoicePipeline } from './pipeline';
import type { VoiceTurnEvent } from './types';

async function collectTurnEvents(events: AsyncIterable<VoiceTurnEvent>): Promise<VoiceTurnEvent[]> {
  const result: VoiceTurnEvent[] = [];
  for await (const event of events) result.push(event);
  return result;
}

async function drainMicrotasks(): Promise<void> {
  for (let index = 0; index < 5; index++) await Promise.resolve();
}

async function* emptyStream(): AsyncIterable<string> {
  yield* [];
}

describe('VoicePipeline', () => {
  it('completes a turn and reconstructs only acknowledged speech', async () => {
    const pipeline = createVoicePipeline();
    const turn = pipeline.startTurn({
      id: 'complete',
      source: async function* () {
        yield 'Hello **world**.';
      },
    });

    for await (const event of turn.events) {
      if (event.type === 'speech.segment') {
        turn.acknowledgePlayback({ segmentId: event.segment.id, charactersPlayed: 8 });
      }
    }
    const result = await turn.result;
    expect(result.outcome).toBe('completed');
    expect(result.generatedText).toBe('Hello **world**.');
    expect(result.heardText).toBe('Hello wo');
    expect(result.acknowledgementConfidence).toBe('partial');
    expect(result.metrics.chunkCount).toBe(1);
  });

  it('settles interruption while next() remains pending and calls iterator.return()', async () => {
    const returned = vi.fn();
    const pipeline = createVoicePipeline();
    const turn = pipeline.startTurn({
      id: 'pending',
      source: () => ({
        [Symbol.asyncIterator]: () => ({
          next: () => new Promise<IteratorResult<string>>(() => {}),
          return: () => {
            returned();
            return new Promise<IteratorResult<string>>(() => {});
          },
        }),
      }),
    });
    await drainMicrotasks();

    turn.interrupt({ reason: 'barge-in' });
    const result = await turn.result;
    expect(result.outcome).toBe('interrupted');
    expect(result.interruption?.reason).toBe('barge-in');
    expect(returned).toHaveBeenCalledOnce();
    expect(pipeline.activeTurnCount).toBe(0);
  });

  it('aborts the source signal and cancels a ReadableStream reader', async () => {
    let sourceSignal: AbortSignal | undefined;
    let cancelledWith: unknown;
    const pipeline = createVoicePipeline();
    const stream = new ReadableStream<string>({
      cancel(reason) {
        cancelledWith = reason;
      },
    });
    const turn = pipeline.startTurn({
      id: 'readable',
      source: (signal) => {
        sourceSignal = signal;
        return stream;
      },
    });
    await drainMicrotasks();
    turn.interrupt({ reason: 'user-spoke' });
    await turn.result;
    expect(sourceSignal?.aborted).toBe(true);
    expect(cancelledWith).toBe('user-spoke');
  });

  it('preserves source and transform failures with stable codes', async () => {
    const sourceFailure = new Error('provider unavailable');
    const sourceTurn = createVoicePipeline().startTurn({
      id: 'source-failure',
      source: async function* () {
        yield await Promise.reject(sourceFailure);
      },
    });
    const sourceResult = await sourceTurn.result;
    expect(sourceResult.outcome).toBe('failed');
    expect(sourceResult.error?.code).toBe('VOICE_SOURCE_FAILED');
    expect(sourceResult.error?.cause).toBe(sourceFailure);

    const transformFailure = new Error('bad transform');
    const transformTurn = createVoicePipeline({
      text: {
        transforms: [
          () => {
            throw transformFailure;
          },
        ],
      },
    }).startTurn({
      id: 'transform-failure',
      source: async function* () {
        yield 'hello ';
      },
    });
    const transformResult = await transformTurn.result;
    expect(transformResult.outcome).toBe('failed');
    expect(transformResult.error?.code).toBe('VOICE_TRANSFORM_FAILED');
    expect(transformResult.error?.cause).toBe(transformFailure);
  });

  it('validates acknowledgement ranges, monotonicity, and segment order', async () => {
    let release!: () => void;
    const pipeline = createVoicePipeline({ text: { minChars: 5 } });
    const turn = pipeline.startTurn({
      id: 'acks',
      source: async function* () {
        yield 'First sentence. Second sentence. ';
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    });
    const iterator = turn.events[Symbol.asyncIterator]();
    const first = await iterator.next();
    const second = await iterator.next();
    if (
      first.done ||
      second.done ||
      first.value.type !== 'speech.segment' ||
      second.value.type !== 'speech.segment'
    ) {
      throw new Error('Expected two segments');
    }

    expect(() =>
      turn.acknowledgePlayback({ segmentId: first.value.segment.id, charactersPlayed: 1.5 })
    ).toThrow('integer');
    expect(() =>
      turn.acknowledgePlayback({
        segmentId: first.value.segment.id,
        charactersPlayed: 1,
        audioMs: -1,
      })
    ).toThrow('non-negative');
    expect(() =>
      turn.acknowledgePlayback({
        segmentId: first.value.segment.id,
        charactersPlayed: 1,
        audioMs: Number.POSITIVE_INFINITY,
      })
    ).toThrow('finite');
    expect(() => turn.acknowledgePlayback({ segmentId: 'unknown', charactersPlayed: 1 })).toThrow(
      'not been emitted'
    );
    expect(() =>
      turn.acknowledgePlayback({ segmentId: second.value.segment.id, charactersPlayed: 1 })
    ).toThrowError(VoicePipelineError);
    turn.acknowledgePlayback({
      segmentId: first.value.segment.id,
      charactersPlayed: Array.from(first.value.segment.text).length,
    });
    turn.acknowledgePlayback({ segmentId: second.value.segment.id, charactersPlayed: 2 });
    expect(() =>
      turn.acknowledgePlayback({
        segmentId: first.value.segment.id,
        charactersPlayed: Array.from(first.value.segment.text).length,
      })
    ).toThrow('earlier segment');
    expect(() =>
      turn.acknowledgePlayback({ segmentId: second.value.segment.id, charactersPlayed: 1 })
    ).toThrow('monotonic');
    expect(() =>
      turn.acknowledgePlayback({ segmentId: second.value.segment.id, charactersPlayed: 10_000 })
    ).toThrow('between');
    release();
    await turn.result;
  });

  it('updates the result when playback confirmation arrives after source settlement', async () => {
    let release!: () => void;
    const turn = createVoicePipeline({ text: { minChars: 5 } }).startTurn({
      id: 'complete-ack',
      source: async function* () {
        yield 'Fully heard.';
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    });
    const iterator = turn.events[Symbol.asyncIterator]();
    const next = await iterator.next();
    if (next.done || next.value.type !== 'speech.segment') throw new Error('Expected segment');
    turn.acknowledgePlayback({
      segmentId: next.value.segment.id,
      charactersPlayed: 5,
    });
    await drainMicrotasks();
    release();
    const result = await turn.result;
    expect(result.acknowledgementConfidence).toBe('partial');
    expect(result.heardText).toBe('Fully');
    turn.acknowledgePlayback({
      segmentId: next.value.segment.id,
      charactersPlayed: next.value.segment.text.length,
      audioMs: 110,
    });
    expect(result.heardText).toBe('Fully heard.');
    expect(result.acknowledgementConfidence).toBe('complete');
    expect(result.metrics.acknowledgedCharacters).toBe(next.value.segment.text.length);
    expect(result.metrics.timeToFirstAudioMs).toBeDefined();
  });

  it('supports concurrent independent turns', async () => {
    const pipeline = createVoicePipeline();
    const create = (id: string, text: string) =>
      pipeline.startTurn({
        id,
        source: async function* () {
          await Promise.resolve();
          yield text;
        },
      });
    const first = create('one', 'First.');
    const second = create('two', 'Second.');
    expect(pipeline.activeTurnCount).toBe(2);
    const [firstResult, secondResult] = await Promise.all([first.result, second.result]);
    expect(firstResult.generatedText).toBe('First.');
    expect(secondResult.generatedText).toBe('Second.');
    expect(pipeline.activeTurnCount).toBe(0);
  });

  it('handles consumer cancellation as interruption', async () => {
    const turn = createVoicePipeline().startTurn({
      id: 'consumer-cancel',
      source: () => ({
        [Symbol.asyncIterator]: () => ({
          next: () => new Promise<IteratorResult<string>>(() => {}),
        }),
      }),
    });
    await drainMicrotasks();
    await turn.events[Symbol.asyncIterator]().return?.();
    const result = await turn.result;
    expect(result.outcome).toBe('interrupted');
    expect(result.interruption?.reason).toBe('consumer-cancelled');
  });

  it('flushes pending speech on its configured virtual timeout', async () => {
    const clock = new VirtualClock();
    let release!: () => void;
    const turn = createVoicePipeline({
      clock,
      text: { minChars: 30, targetChars: 40, maxChars: 50, maxWaitMs: 100 },
    }).startTurn({
      id: 'timeout',
      source: async function* () {
        yield 'waiting for more ';
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    });
    const nextEvent = turn.events[Symbol.asyncIterator]().next();
    await drainMicrotasks();
    clock.advanceTo(100);
    const event = await nextEvent;
    expect(event.value).toMatchObject({
      type: 'speech.segment',
      segment: { boundary: 'timeout', text: 'waiting for ' },
    });
    turn.interrupt({ reason: 'test' });
    release();
    await turn.result;
  });

  it('emits at most the configured pre-speech stall cues', async () => {
    const clock = new VirtualClock();
    const pipeline = createVoicePipeline({
      clock,
      stallCues: { enabled: true, delayMs: 100, text: 'Still working.', maxPerTurn: 2 },
    });
    const turn = pipeline.startTurn({
      id: 'stall',
      source: () => ({
        [Symbol.asyncIterator]: () => ({
          next: () => new Promise<IteratorResult<string>>(() => {}),
        }),
      }),
    });
    const eventsPromise = collectTurnEvents(turn.events);
    await drainMicrotasks();
    clock.advanceTo(250);
    turn.interrupt({ reason: 'done' });
    const events = await eventsPromise;
    expect(events.filter((event) => event.type === 'stall.cue.requested')).toHaveLength(2);
    expect((await turn.result).metrics.stallCount).toBe(2);
    expect(clock.pendingTimerCount).toBe(0);
  });

  it('tracks a stall without emitting cues when cues are disabled', async () => {
    const clock = new VirtualClock();
    const turn = createVoicePipeline({ clock, stallCues: { delayMs: 50 } }).startTurn({
      id: 'silent-stall',
      source: () => ({
        [Symbol.asyncIterator]: () => ({
          next: () => new Promise<IteratorResult<string>>(() => {}),
        }),
      }),
    });
    await drainMicrotasks();
    clock.advanceTo(50);
    turn.interrupt({ reason: 'test' });
    const result = await turn.result;
    expect(result.metrics.stallCount).toBe(1);
    expect(result.metrics.cueRequests).toBe(0);
  });

  it('isolates diagnostic-listener failures and returns diagnostics', async () => {
    const failures: unknown[] = [];
    const turn = createVoicePipeline({
      text: { maxPendingChars: 32 },
      onDiagnostic: () => {
        throw new Error('listener');
      },
      telemetry: { onSinkError: (failure) => failures.push(failure) },
    }).startTurn({
      id: 'diagnostic',
      source: async function* () {
        yield `\`\`\`${'x'.repeat(40)}`;
      },
    });
    const result = await turn.result;
    expect(result.outcome).toBe('completed');
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(failures).toHaveLength(result.diagnostics.length);
  });

  it('isolates synchronous and asynchronous telemetry sink failures', async () => {
    const sinkErrors: unknown[] = [];
    const pipeline = createVoicePipeline({
      telemetry: {
        sinks: [
          {
            record: () => {
              throw new Error('sync sink');
            },
          },
          {
            record: async () => {
              throw new Error('async sink');
            },
          },
        ],
        onSinkError: ({ error }) => sinkErrors.push(error),
      },
    });
    const turn = pipeline.startTurn({
      id: 'sink-errors',
      source: async function* () {
        yield 'Safe turn.';
      },
    });
    expect((await turn.result).outcome).toBe('completed');
    await drainMicrotasks();
    expect(sinkErrors).toHaveLength(2);
  });

  it('records supplied stages without capturing speech content', async () => {
    const clock = new VirtualClock();
    const sink = new MemoryTelemetrySink();
    const pipeline = createVoicePipeline({ clock, telemetry: { sinks: [sink] } });
    const turn = pipeline.startTurn({
      id: 'metrics',
      source: () => ({
        [Symbol.asyncIterator]: () => ({
          next: () => new Promise<IteratorResult<string>>(() => {}),
        }),
      }),
    });
    turn.recordStage({ stage: 'llm', phase: 'start' });
    clock.advanceTo(20);
    turn.recordStage({ stage: 'llm', phase: 'first-output' });
    clock.advanceTo(50);
    turn.recordStage({ stage: 'llm', phase: 'end' });
    clock.advanceTo(60);
    turn.interrupt({ reason: 'test' });
    const result = await turn.result;
    expect(result.metrics.llmTtftMs).toBe(20);
    expect(result.metrics.stageDurations[0]?.durationMs).toBe(50);
    expect(result.metrics.endToEndResponseLatencyMs).toBeUndefined();
    expect(JSON.stringify(sink.getEvents())).not.toContain('speech text');
    turn.recordStage({ stage: 'llm', phase: 'start' });
  });

  it('validates pipeline configuration and active turn identifiers', async () => {
    expect(() => createVoicePipeline({ stallCues: { delayMs: -1 } })).toThrow('stall cue delayMs');
    expect(() => createVoicePipeline({ stallCues: { delayMs: Number.NaN } })).toThrow(
      'stall cue delayMs'
    );
    expect(() => createVoicePipeline({ stallCues: { maxPerTurn: 0 } })).toThrow('maxPerTurn');
    expect(() => createVoicePipeline({ stallCues: { maxPerTurn: 1.5 } })).toThrow('maxPerTurn');
    expect(() => createVoicePipeline({ telemetry: { maxStoredMetrics: 0 } })).toThrow(
      'maxStoredMetrics'
    );
    expect(() => createVoicePipeline({ telemetry: { maxStoredMetrics: 1.5 } })).toThrow(
      'maxStoredMetrics'
    );

    const pipeline = createVoicePipeline();
    expect(() => pipeline.startTurn({ id: '', source: emptyStream })).toThrow('non-empty');
    const active = pipeline.startTurn({
      id: 'same',
      source: () => ({
        [Symbol.asyncIterator]: () => ({
          next: () => new Promise<IteratorResult<string>>(() => {}),
        }),
      }),
    });
    expect(() => pipeline.startTurn({ id: 'same', source: emptyStream })).toThrow('already active');
    active.interrupt({ reason: 'cleanup' });
    await active.result;
  });

  it('bounds stored metrics and can clear them', async () => {
    const pipeline = createVoicePipeline({ telemetry: { maxStoredMetrics: 1 } });
    for (const id of ['first', 'second']) {
      await pipeline.startTurn({ id, source: emptyStream }).result;
    }
    expect(pipeline.getMetrics()).toHaveLength(1);
    expect(pipeline.getMetrics()[0]?.turnId).toBe('second');
    pipeline.clearMetrics();
    expect(pipeline.getMetrics()).toEqual([]);
  });

  it('rejects non-string chunks with a stable pipeline error', async () => {
    const turn = createVoicePipeline().startTurn({
      id: 'invalid-chunk',
      source: (() => ({
        [Symbol.asyncIterator]: () => ({
          next: () => Promise.resolve({ value: 42, done: false }),
          return: () => Promise.resolve({ value: undefined, done: true }),
        }),
      })) as never,
    });
    const result = await turn.result;
    expect(result.outcome).toBe('failed');
    expect(result.error?.code).toBe('VOICE_SOURCE_INVALID_CHUNK');
  });

  it('suppresses late source results and tolerates cancellation errors', async () => {
    let resolveNext!: (value: IteratorResult<string>) => void;
    const turn = createVoicePipeline().startTurn({
      id: 'late',
      source: () => ({
        [Symbol.asyncIterator]: () => ({
          next: () =>
            new Promise<IteratorResult<string>>((resolve) => {
              resolveNext = resolve;
            }),
          return: () => {
            throw new Error('cancel failed');
          },
        }),
      }),
    });
    await drainMicrotasks();
    turn.interrupt({ reason: 'barge-in' });
    turn.interrupt({ reason: 'duplicate' });
    resolveNext({ value: 'too late', done: false });
    await drainMicrotasks();
    expect((await turn.result).generatedText).toBe('');
  });
});
