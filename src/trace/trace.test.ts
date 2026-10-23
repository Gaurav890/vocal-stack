import { describe, expect, it, vi } from 'vitest';
import { expectVoiceScenario, runVoiceScenario, scenarioFromTrace, VirtualClock } from '../testing';
import { createVoicePipeline } from '../turn';
import {
  createVoiceTraceRecorder,
  exportVoiceTraceJson,
  exportVoiceTraceJsonl,
  parseVoiceTraceJson,
  parseVoiceTraceJsonl,
  VoiceTraceRecorder,
  validateVoiceTrace,
} from './index';
import type { VoiceTrace, VoiceTraceEvent } from './types';

const replayTextConfig = {
  minChars: 5,
  targetChars: 24,
  maxChars: 80,
  maxWaitMs: 800,
} as const;

function requireTrace(recorder: VoiceTraceRecorder, turnId: string) {
  const trace = recorder.getTrace(turnId);
  if (!trace) throw new Error(`Missing trace for ${turnId}`);
  return trace;
}

function validTrace(): VoiceTrace {
  const configuration = {
    text: {
      locale: 'en',
      mode: 'balanced' as const,
      minChars: 24,
      targetChars: 120,
      maxChars: 240,
      maxWaitMs: 250,
      maxPendingChars: 4_096,
      hasTransforms: false,
    },
    stallCues: { enabled: false, delayMs: 600, maxPerTurn: 1 },
  };
  return {
    schemaVersion: 1,
    turnId: 'valid-trace',
    startedAt: 100,
    durationMs: 1,
    content: 'none',
    configuration,
    events: [
      {
        type: 'turn.started',
        turnId: 'valid-trace',
        atMs: 0,
        sequence: 0,
        startedAt: 100,
        configuration,
      },
      { type: 'source.completed', turnId: 'valid-trace', atMs: 1, sequence: 1 },
    ],
    truncated: false,
  };
}

describe('voice trace recording and replay', () => {
  it('records a full interrupted turn and replays its heard text deterministically', async () => {
    const clock = new VirtualClock();
    const recorder = createVoiceTraceRecorder({ content: 'full' });
    const original = await runVoiceScenario({
      pipeline: createVoicePipeline({
        clock,
        text: replayTextConfig,
        trace: { sinks: [recorder] },
      }),
      turnId: 'recorded-turn',
      timeline: [
        { atMs: 0, type: 'stage', marker: { stage: 'llm', phase: 'start' } },
        { atMs: 5, type: 'delta', text: 'Hello ' },
        { atMs: 10, type: 'delta', text: 'world' },
        { atMs: 15, type: 'speech.flush' },
        { atMs: 20, type: 'playback.ack', segment: 0, charactersPlayed: 5, audioMs: 100 },
        { atMs: 30, type: 'interrupt', reason: 'barge-in' },
      ],
    });

    const trace = recorder.getTrace('recorded-turn');
    expect(trace).toMatchObject({
      schemaVersion: 1,
      turnId: 'recorded-turn',
      content: 'full',
      outcome: 'interrupted',
      durationMs: 30,
      truncated: false,
    });
    expect(trace?.events.map((event) => event.type)).toContain('playback.acknowledged');

    if (!trace) throw new Error('Missing recorded trace');
    const replayPlan = scenarioFromTrace(trace);
    const replayClock = new VirtualClock();
    const replay = await runVoiceScenario({
      pipeline: createVoicePipeline({ clock: replayClock, ...replayPlan.pipelineOptions }),
      turnId: replayPlan.turnId,
      timeline: replayPlan.timeline,
    });

    expectVoiceScenario(replay)
      .toHaveOutcome(original.turn.outcome)
      .toHaveGeneratedText(original.turn.generatedText)
      .toHaveHeardText(original.turn.heardText)
      .toHaveNoPendingTimers();
    expect(replayPlan.requiresTransforms).toBe(false);
    expect(replayPlan.pipelineOptions.text?.maxWaitMs).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('keeps speech content out by default and requires opt-in content for replay', async () => {
    const clock = new VirtualClock();
    const recorder = createVoiceTraceRecorder();
    await runVoiceScenario({
      pipeline: createVoicePipeline({
        clock,
        text: replayTextConfig,
        trace: { sinks: [recorder] },
      }),
      turnId: 'private-turn',
      timeline: [
        { atMs: 0, type: 'delta', text: 'Customer secret.' },
        { atMs: 1, type: 'source.complete' },
      ],
    });

    const trace = requireTrace(recorder, 'private-turn');
    expect(trace.content).toBe('none');
    expect(JSON.stringify(trace)).not.toContain('Customer secret');
    expect(trace.events.find((event) => event.type === 'input.delta')).toMatchObject({
      characters: 16,
    });
    expect(() => scenarioFromTrace(trace)).toThrow('does not contain input text');
  });

  it('applies an explicit redactor to every speech-bearing event', async () => {
    const redact = vi.fn((text: string) => text.replaceAll(/\d/gu, '#'));
    const recorder = createVoiceTraceRecorder({ content: 'redacted', redact });
    const clock = new VirtualClock();
    await runVoiceScenario({
      pipeline: createVoicePipeline({
        clock,
        text: replayTextConfig,
        stallCues: { enabled: true, delayMs: 1, text: 'Order 42 is loading.' },
        trace: { sinks: [recorder] },
      }),
      turnId: 'redacted-turn',
      timeline: [
        { atMs: 1, type: 'stall' },
        { atMs: 2, type: 'delta', text: 'Order 42 is ready.' },
        { atMs: 3, type: 'source.complete' },
      ],
    });

    const trace = requireTrace(recorder, 'redacted-turn');
    const serialized = exportVoiceTraceJson(trace);
    expect(serialized).not.toContain('42');
    expect(serialized).toContain('Order ## is ready.');
    expect(serialized).toContain('Order ## is loading.');
    expect(redact).toHaveBeenCalledWith(
      'Order 42 is ready.',
      expect.objectContaining({ eventType: 'input.delta' })
    );
    expect(scenarioFromTrace(trace).timeline.some((step) => step.type === 'stall')).toBe(true);
  });

  it('round-trips versioned JSON and JSONL traces', async () => {
    const recorder = createVoiceTraceRecorder({ content: 'full' });
    const clock = new VirtualClock();
    await runVoiceScenario({
      pipeline: createVoicePipeline({ clock, trace: { sinks: [recorder] } }),
      turnId: 'round-trip',
      timeline: [{ atMs: 2, type: 'source.error', error: new Error('provider failed') }],
    });
    const trace = requireTrace(recorder, 'round-trip');

    expect(parseVoiceTraceJson(exportVoiceTraceJson(trace))).toEqual(trace);
    expect(parseVoiceTraceJsonl(exportVoiceTraceJsonl(trace))).toEqual(trace);
    const plan = scenarioFromTrace(trace);
    expect(plan.timeline.find((step) => step.type === 'source.error')).toMatchObject({
      error: expect.objectContaining({ code: 'VOICE_SOURCE_FAILED' }),
    });
  });

  it('records consumer cancellation once and converts it to the matching scenario action', async () => {
    const recorder = createVoiceTraceRecorder({ content: 'full' });
    const clock = new VirtualClock();
    await runVoiceScenario({
      pipeline: createVoicePipeline({ clock, trace: { sinks: [recorder] } }),
      turnId: 'cancelled-turn',
      timeline: [{ atMs: 5, type: 'consumer.cancel' }],
    });
    const trace = requireTrace(recorder, 'cancelled-turn');
    const plan = scenarioFromTrace(trace);

    expect(plan.timeline.filter((step) => step.type === 'consumer.cancel')).toHaveLength(1);
    expect(plan.timeline.filter((step) => step.type === 'interrupt')).toHaveLength(0);
  });

  it('marks transform-dependent traces and preserves their serializable configuration', async () => {
    const recorder = createVoiceTraceRecorder({ content: 'full' });
    const clock = new VirtualClock();
    await runVoiceScenario({
      pipeline: createVoicePipeline({
        clock,
        text: { ...replayTextConfig, locale: 'fr', transforms: [(text) => text.toUpperCase()] },
        trace: { sinks: [recorder] },
      }),
      turnId: 'transformed-turn',
      timeline: [
        { atMs: 0, type: 'delta', text: 'bonjour.' },
        { atMs: 1, type: 'source.complete' },
      ],
    });

    const plan = scenarioFromTrace(requireTrace(recorder, 'transformed-turn'));
    expect(plan.requiresTransforms).toBe(true);
    expect(plan.pipelineOptions.text).toMatchObject({ locale: 'fr', minChars: 5 });
    expect(plan.pipelineOptions.text).not.toHaveProperty('transforms');
  });
});

describe('voice trace limits and validation', () => {
  it('bounds stored events, preserves the terminal event, and rejects truncated replay', async () => {
    const recorder = createVoiceTraceRecorder({ content: 'full', maxEventsPerTurn: 3 });
    const clock = new VirtualClock();
    await runVoiceScenario({
      pipeline: createVoicePipeline({ clock, trace: { sinks: [recorder] } }),
      turnId: 'bounded-turn',
      timeline: [
        { atMs: 0, type: 'delta', text: 'one ' },
        { atMs: 1, type: 'delta', text: 'two.' },
        { atMs: 2, type: 'source.complete' },
      ],
    });

    const trace = requireTrace(recorder, 'bounded-turn');
    expect(trace.events).toHaveLength(3);
    expect(trace.events.at(-1)?.type).toBe('turn.ended');
    expect(trace.truncated).toBe(true);
    expect(() => scenarioFromTrace(trace)).toThrow('Truncated');
    expect(scenarioFromTrace(trace, { allowTruncated: true }).timeline.length).toBeGreaterThan(0);
  });

  it('evicts only completed traces beyond the configured history', async () => {
    const recorder = createVoiceTraceRecorder({ content: 'full', maxStoredTraces: 1 });
    const clock = new VirtualClock();
    const pipeline = createVoicePipeline({ clock, trace: { sinks: [recorder] } });
    for (const turnId of ['first', 'second']) {
      await runVoiceScenario({
        pipeline,
        turnId,
        timeline: [{ atMs: 1, type: 'source.complete' }],
      });
    }
    expect(recorder.getTrace('first')).toBeUndefined();
    expect(recorder.getTrace('second')).toBeDefined();
    expect(recorder.getTraces()).toHaveLength(1);
    recorder.clear();
    expect(recorder.getTraces()).toEqual([]);
  });

  it('validates recorder configuration and event ordering', () => {
    expect(() => createVoiceTraceRecorder({ content: 'redacted' })).toThrow('redact function');
    expect(() => createVoiceTraceRecorder({ content: 'invalid' as 'none' })).toThrow(
      'content mode'
    );
    expect(() => createVoiceTraceRecorder({ maxEventsPerTurn: 1 })).toThrow('maxEventsPerTurn');
    expect(() => createVoiceTraceRecorder({ maxStoredTraces: 0 })).toThrow('maxStoredTraces');

    const invalidRedactor = createVoiceTraceRecorder({
      content: 'redacted',
      redact: (() => undefined) as unknown as (text: string) => string,
    });
    expect(() =>
      invalidRedactor.record({
        type: 'turn.started',
        turnId: 'invalid-redactor',
        atMs: 0,
        sequence: 0,
        startedAt: 0,
        configuration: {
          text: {
            locale: 'en',
            mode: 'balanced',
            minChars: 24,
            targetChars: 120,
            maxChars: 240,
            maxWaitMs: 250,
            maxPendingChars: 4_096,
            hasTransforms: false,
          },
          stallCues: { enabled: false, delayMs: 600, maxPerTurn: 1 },
        },
      })
    ).not.toThrow();
    expect(() =>
      invalidRedactor.record({
        type: 'input.delta',
        turnId: 'invalid-redactor',
        atMs: 1,
        sequence: 1,
        characters: 4,
        text: 'test',
      })
    ).toThrow('return a string');

    const recorder = new VoiceTraceRecorder();
    expect(() =>
      recorder.record({
        type: 'source.completed',
        turnId: 'missing-start',
        atMs: 0,
        sequence: 0,
      })
    ).toThrow('before turn.started');
  });

  it('rejects malformed JSON, JSONL, schemas, and event order', () => {
    expect(() => parseVoiceTraceJson('{')).toThrow('Unable to parse');
    expect(() => parseVoiceTraceJsonl('{}')).toThrow('header and events');
    expect(() => parseVoiceTraceJsonl('{}\n{}')).toThrow('header is invalid');
    expect(() => validateVoiceTrace(null)).toThrow('object');
    expect(() => validateVoiceTrace({ schemaVersion: 9 })).toThrow('Unsupported');

    const started: VoiceTraceEvent = {
      type: 'turn.started',
      turnId: 'invalid-order',
      atMs: 1,
      sequence: 1,
      startedAt: 0,
      configuration: {
        text: {
          locale: 'en',
          mode: 'balanced',
          minChars: 24,
          targetChars: 120,
          maxChars: 240,
          maxWaitMs: 250,
          maxPendingChars: 4_096,
          hasTransforms: false,
        },
        stallCues: { enabled: false, delayMs: 600, maxPerTurn: 1 },
      },
    };
    expect(() =>
      validateVoiceTrace({
        schemaVersion: 1,
        turnId: 'invalid-order',
        startedAt: 0,
        durationMs: 1,
        content: 'none',
        configuration: started.configuration,
        events: [started, { ...started, type: 'source.completed', sequence: 0 }],
        truncated: false,
      })
    ).toThrow('increasing sequence');
  });

  it('rejects invalid configuration, event payloads, and trace metadata', () => {
    const trace = validTrace();
    const started = trace.events[0];
    const completed = trace.events[1];

    expect(() =>
      validateVoiceTrace({
        ...trace,
        configuration: {
          ...trace.configuration,
          text: { ...trace.configuration.text, mode: 'paragraph' },
        },
      })
    ).toThrow('text mode');
    expect(() =>
      validateVoiceTrace({
        ...trace,
        configuration: {
          ...trace.configuration,
          text: { ...trace.configuration.text, targetChars: 1 },
        },
      })
    ).toThrow('character limits');
    expect(() =>
      validateVoiceTrace({
        ...trace,
        events: [
          started,
          {
            type: 'stage.recorded',
            turnId: trace.turnId,
            atMs: 0,
            sequence: 1,
            marker: { stage: 'llm', phase: 'waiting' },
          },
          { ...completed, sequence: 2 },
        ],
      })
    ).toThrow('stage phase');
    expect(() =>
      validateVoiceTrace({
        ...trace,
        events: [
          started,
          {
            type: 'speech.segment',
            turnId: trace.turnId,
            atMs: 0,
            sequence: 1,
            segmentId: 'segment-1',
            segmentSequence: 0,
            characters: 4,
            boundary: 'paragraph',
            final: false,
          },
          { ...completed, sequence: 2 },
        ],
      })
    ).toThrow('speech segment');
    expect(() =>
      validateVoiceTrace({
        ...trace,
        events: [started, { ...started, atMs: 1, sequence: 1 }],
      })
    ).toThrow('only one turn.started');
    expect(() => validateVoiceTrace({ ...trace, startedAt: 101 })).toThrow(
      'startedAt does not match'
    );
    expect(() => validateVoiceTrace({ ...trace, durationMs: 0 })).toThrow(
      'cannot precede its final event'
    );
    expect(() =>
      validateVoiceTrace({
        ...trace,
        events: [
          started,
          {
            type: 'input.delta',
            turnId: trace.turnId,
            atMs: 0,
            sequence: 1,
            characters: 6,
            text: 'secret',
          },
          { ...completed, sequence: 2 },
        ],
      })
    ).toThrow('Content-free traces');
  });

  it('isolates synchronous and asynchronous trace sink failures from the turn', async () => {
    const failures: unknown[] = [];
    const pipeline = createVoicePipeline({
      trace: {
        sinks: [
          { record: () => void 0 },
          { record: () => Promise.reject(new Error('async sink')) },
          {
            record: () => {
              throw new Error('sync sink');
            },
          },
        ],
        onSinkError: (failure) => failures.push(failure.error),
      },
    });
    const turn = pipeline.startTurn({
      id: 'sink-failure',
      source: async function* () {
        yield 'Still completes.';
      },
    });
    for await (const _event of turn.events) {
      // Drain the event stream.
    }
    expect((await turn.result).outcome).toBe('completed');
    await Promise.resolve();
    expect(failures.length).toBeGreaterThanOrEqual(4);
  });
});
