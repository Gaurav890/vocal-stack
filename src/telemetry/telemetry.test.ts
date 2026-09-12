import { describe, expect, it } from 'vitest';
import { VirtualClock } from '../testing/virtual-clock';
import { exportTelemetryJson, exportTelemetryJsonl, MemoryTelemetrySink } from './export';
import { TurnTelemetryRecorder } from './recorder';
import type { TelemetrySinkError } from './types';

describe('TurnTelemetryRecorder', () => {
  it('derives stage and turn metrics from provider markers', () => {
    const clock = new VirtualClock({ wallEpochMs: 10_000 });
    const sink = new MemoryTelemetrySink();
    const recorder = new TurnTelemetryRecorder('turn', clock, [sink], () => {});

    recorder.recordStage({ stage: 'llm', phase: 'start', operationId: 'a' });
    clock.advanceTo(10);
    recorder.recordInputDelta(5);
    recorder.recordStage({ stage: 'llm', phase: 'first-output', operationId: 'a' });
    recorder.recordStage({ stage: 'llm', phase: 'first-output', operationId: 'a' });
    clock.advanceTo(30);
    recorder.recordStage({ stage: 'llm', phase: 'end', operationId: 'a' });
    recorder.recordStage({ stage: 'tts', phase: 'start' });
    clock.advanceTo(40);
    recorder.recordStage({ stage: 'tts', phase: 'first-output' });
    recorder.recordSegment();
    recorder.recordFirstAudio();
    recorder.recordFirstAudio(45);
    recorder.recordStall();
    recorder.recordCueRequest();
    recorder.setAcknowledgedCharacters(4);
    clock.advanceTo(50);
    recorder.recordStage({ stage: 'tts', phase: 'end' });
    const metrics = recorder.finish('completed');

    expect(metrics).toMatchObject({
      startedAt: 10_000,
      timeToFirstInputDeltaMs: 10,
      timeToFirstSegmentMs: 40,
      timeToFirstAudioMs: 40,
      llmTtftMs: 10,
      ttsTtfbMs: 10,
      endToEndResponseLatencyMs: 40,
      totalDurationMs: 50,
      chunkCount: 1,
      segmentCount: 1,
      stallCount: 1,
      cueRequests: 1,
      generatedCharacters: 5,
      acknowledgedCharacters: 4,
    });
    expect(sink.getEvents().at(-1)?.type).toBe('turn.metrics');
  });

  it('closes unfinished stages according to failed and interrupted outcomes', () => {
    const failures: TelemetrySinkError[] = [];
    const clock = new VirtualClock();
    const throwingSink = { record: () => Promise.reject(new Error('sink')) };
    const recorder = new TurnTelemetryRecorder('failed', clock, [throwingSink], (failure) =>
      failures.push(failure)
    );
    recorder.recordStage({ stage: 'tool', phase: 'start', wallAt: 123 });
    clock.advanceBy(25);
    const failed = recorder.finish('failed', 'PROVIDER_ERROR');
    expect(failed.errorCode).toBe('PROVIDER_ERROR');
    expect(failed.stageDurations[0]).toMatchObject({ outcome: 'failed', durationMs: 25 });

    const interrupted = new TurnTelemetryRecorder('interrupted', clock, [], () => {});
    interrupted.recordStage({ stage: 'acme.cache', phase: 'start' });
    clock.advanceBy(5);
    expect(interrupted.finish('interrupted').stageDurations[0]?.outcome).toBe('cancelled');
    return Promise.resolve().then(() => expect(failures.length).toBeGreaterThan(0));
  });

  it('records explicit cancel/error stages and ignores unmatched endings', () => {
    const clock = new VirtualClock();
    const recorder = new TurnTelemetryRecorder('stages', clock, [], () => {});
    recorder.recordStage({ stage: 'stt', phase: 'end' });
    recorder.recordStage({ stage: 'tool', phase: 'start', operationId: 'cancelled' });
    recorder.recordStage({ stage: 'tool', phase: 'cancel', operationId: 'cancelled' });
    recorder.recordStage({ stage: 'tool', phase: 'start', operationId: 'failed' });
    recorder.recordStage({ stage: 'tool', phase: 'error', operationId: 'failed' });
    const outcomes = recorder.finish('completed').stageDurations.map((stage) => stage.outcome);
    expect(outcomes).toEqual(['cancelled', 'failed']);
  });
});

describe('telemetry exports', () => {
  it('exports JSON/JSONL and manages in-memory events', () => {
    const clock = new VirtualClock();
    const recorder = new TurnTelemetryRecorder('export', clock, [], () => {});
    const metric = recorder.finish('completed');
    expect(JSON.parse(exportTelemetryJson([metric]))).toMatchObject({ version: 2 });
    expect(JSON.parse(exportTelemetryJsonl([metric]))).toMatchObject({ turnId: 'export' });
    expect(exportTelemetryJsonl([])).toBe('');

    const sink = new MemoryTelemetrySink();
    sink.record({ type: 'turn.metrics', turnId: 'export', at: 0, wallAt: 0, metrics: metric });
    expect(sink.getEvents()).toHaveLength(1);
    sink.clear();
    expect(sink.getEvents()).toEqual([]);
  });
});
