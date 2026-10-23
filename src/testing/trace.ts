import { VoicePipelineError } from '../errors';
import { validateVoiceTrace } from '../trace/export';
import type { VoiceTrace, VoiceTraceEvent } from '../trace/types';
import type { VoicePipelineOptions } from '../turn/types';
import type { VoiceScenarioStep } from './scenario';

export interface VoiceTraceScenario {
  readonly turnId: string;
  readonly timeline: readonly VoiceScenarioStep[];
  readonly pipelineOptions: Pick<VoicePipelineOptions, 'text' | 'stallCues'>;
  /** Replaying the original transformation behavior requires the caller to restore its transforms. */
  readonly requiresTransforms: boolean;
}

export interface VoiceTraceScenarioOptions {
  /** Truncated traces are rejected by default because omitted events can change the outcome. */
  readonly allowTruncated?: boolean;
}

function traceError(message: string, code = 'VOICE_TRACE_NOT_REPLAYABLE'): VoicePipelineError {
  return new VoicePipelineError(message, code);
}

interface TimelineState {
  readonly timeline: VoiceScenarioStep[];
  hasTerminalAction: boolean;
  hasConsumerCancellation: boolean;
  hasTimeoutFlush: boolean;
}

function appendInputDelta(
  event: Extract<VoiceTraceEvent, { readonly type: 'input.delta' }>,
  state: TimelineState
): void {
  if (event.text === undefined) {
    throw traceError(
      'This trace does not contain input text. Record with full or redacted content to replay it.',
      'VOICE_TRACE_CONTENT_REQUIRED'
    );
  }
  state.timeline.push({ atMs: event.atMs, type: 'delta', text: event.text });
}

function appendInterruption(
  event: Extract<VoiceTraceEvent, { readonly type: 'turn.interrupted' }>,
  state: TimelineState
): void {
  if (state.hasConsumerCancellation && event.reason === 'consumer-cancelled') return;
  state.timeline.push({ atMs: event.atMs, type: 'interrupt', reason: event.reason });
  state.hasTerminalAction = true;
}

function appendTurnEnd(
  event: Extract<VoiceTraceEvent, { readonly type: 'turn.ended' }>,
  state: TimelineState
): void {
  if (state.hasTerminalAction) return;
  if (event.outcome === 'completed') {
    state.timeline.push({ atMs: event.atMs, type: 'source.complete' });
  } else if (event.outcome === 'interrupted') {
    state.timeline.push({ atMs: event.atMs, type: 'interrupt', reason: 'recorded-interruption' });
  } else {
    state.timeline.push({
      atMs: event.atMs,
      type: 'source.error',
      error: new VoicePipelineError(
        'Recorded voice source failure',
        event.errorCode ?? 'VOICE_SOURCE_FAILED'
      ),
    });
  }
  state.hasTerminalAction = true;
}

function appendTraceEvent(event: VoiceTraceEvent, state: TimelineState): void {
  switch (event.type) {
    case 'input.delta':
      appendInputDelta(event, state);
      return;
    case 'stage.recorded':
      state.timeline.push({ atMs: event.atMs, type: 'stage', marker: event.marker });
      return;
    case 'stall.cue.requested':
      state.timeline.push({ atMs: event.atMs, type: 'stall' });
      return;
    case 'playback.acknowledged':
      state.timeline.push({
        atMs: event.atMs,
        type: 'playback.ack',
        segment: event.segmentSequence,
        charactersPlayed: event.charactersPlayed,
        ...(event.audioMs === undefined ? {} : { audioMs: event.audioMs }),
      });
      return;
    case 'speech.segment':
      if (event.boundary === 'timeout') {
        state.timeline.push({ atMs: event.atMs, type: 'speech.flush' });
        state.hasTimeoutFlush = true;
      }
      return;
    case 'source.completed':
      state.timeline.push({ atMs: event.atMs, type: 'source.complete' });
      state.hasTerminalAction = true;
      return;
    case 'source.failed':
      state.timeline.push({
        atMs: event.atMs,
        type: 'source.error',
        error: new VoicePipelineError('Recorded voice source failure', event.errorCode),
      });
      state.hasTerminalAction = true;
      return;
    case 'consumer.cancelled':
      state.timeline.push({ atMs: event.atMs, type: 'consumer.cancel' });
      state.hasConsumerCancellation = true;
      state.hasTerminalAction = true;
      return;
    case 'turn.interrupted':
      appendInterruption(event, state);
      return;
    case 'turn.ended':
      appendTurnEnd(event, state);
      return;
    default:
      return;
  }
}

export function scenarioFromTrace(
  input: VoiceTrace,
  options: VoiceTraceScenarioOptions = {}
): VoiceTraceScenario {
  const trace = validateVoiceTrace(input);
  if (trace.truncated && !options.allowTruncated) {
    throw traceError('Truncated voice traces cannot be replayed safely', 'VOICE_TRACE_TRUNCATED');
  }

  const state: TimelineState = {
    timeline: [],
    hasTerminalAction: false,
    hasConsumerCancellation: false,
    hasTimeoutFlush: false,
  };
  for (const event of trace.events) appendTraceEvent(event, state);

  return {
    turnId: trace.turnId,
    timeline: state.timeline,
    pipelineOptions: {
      text: {
        ...(trace.configuration.text.locale === undefined
          ? {}
          : { locale: trace.configuration.text.locale }),
        mode: trace.configuration.text.mode,
        minChars: trace.configuration.text.minChars,
        targetChars: trace.configuration.text.targetChars,
        maxChars: trace.configuration.text.maxChars,
        maxWaitMs: state.hasTimeoutFlush
          ? Number.MAX_SAFE_INTEGER
          : trace.configuration.text.maxWaitMs,
        maxPendingChars: trace.configuration.text.maxPendingChars,
      },
      stallCues: {
        enabled: trace.configuration.stallCues.enabled,
        delayMs: trace.configuration.stallCues.delayMs,
        maxPerTurn: trace.configuration.stallCues.maxPerTurn,
      },
    },
    requiresTransforms: trace.configuration.text.hasTransforms,
  };
}
