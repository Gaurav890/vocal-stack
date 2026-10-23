import { VoicePipelineError } from '../errors';
import type { VoiceTrace, VoiceTraceContentMode, VoiceTraceEvent } from './types';
import { VOICE_TRACE_SCHEMA_VERSION } from './types';

interface JsonlHeader {
  readonly type: 'voice.trace';
  readonly schemaVersion: number;
  readonly turnId: string;
  readonly startedAt: number;
  readonly durationMs: number;
  readonly content: VoiceTraceContentMode;
  readonly configuration: VoiceTrace['configuration'];
  readonly outcome?: VoiceTrace['outcome'];
  readonly errorCode?: string;
  readonly truncated: boolean;
}

const eventTypes = new Set<VoiceTraceEvent['type']>([
  'turn.started',
  'input.delta',
  'speech.segment',
  'playback.acknowledged',
  'stage.recorded',
  'stall.cue.requested',
  'turn.diagnostic',
  'source.completed',
  'source.failed',
  'consumer.cancelled',
  'turn.interrupted',
  'turn.ended',
]);
const speechBoundaries = new Set([
  'sentence',
  'clause',
  'word',
  'max-length',
  'timeout',
  'source',
  'flush',
]);

function invalidTrace(message: string, cause?: unknown): VoicePipelineError {
  return new VoicePipelineError(message, 'VOICE_TRACE_INVALID', { cause });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, name: string, minimum = 0): asserts value is number {
  if (!Number.isFinite(value) || (value as number) < minimum) {
    throw invalidTrace(`${name} must be a finite number greater than or equal to ${minimum}`);
  }
}

function nonNegativeInteger(value: unknown, name: string): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw invalidTrace(`${name} must be a non-negative integer`);
  }
}

function optionalString(value: unknown, name: string): void {
  if (value !== undefined && typeof value !== 'string') {
    throw invalidTrace(`${name} must be a string when supplied`);
  }
}

function validateConfiguration(value: unknown): asserts value is VoiceTrace['configuration'] {
  if (!isRecord(value) || !isRecord(value.text) || !isRecord(value.stallCues)) {
    throw invalidTrace('Trace configuration is missing');
  }
  optionalString(value.text.locale, 'Trace text locale');
  if (value.text.mode !== 'balanced' && value.text.mode !== 'source') {
    throw invalidTrace('Trace text mode is invalid');
  }
  for (const field of ['minChars', 'targetChars', 'maxChars', 'maxPendingChars'] as const) {
    nonNegativeInteger(value.text[field], `Trace text ${field}`);
  }
  if (
    (value.text.minChars as number) < 1 ||
    (value.text.targetChars as number) < (value.text.minChars as number) ||
    (value.text.maxChars as number) < (value.text.targetChars as number) ||
    (value.text.maxPendingChars as number) < 32
  ) {
    throw invalidTrace('Trace text character limits are invalid');
  }
  finiteNumber(value.text.maxWaitMs, 'Trace text maxWaitMs');
  if (typeof value.text.hasTransforms !== 'boolean') {
    throw invalidTrace('Trace text hasTransforms must be boolean');
  }
  if (typeof value.stallCues.enabled !== 'boolean') {
    throw invalidTrace('Trace stallCues enabled must be boolean');
  }
  finiteNumber(value.stallCues.delayMs, 'Trace stallCues delayMs');
  nonNegativeInteger(value.stallCues.maxPerTurn, 'Trace stallCues maxPerTurn');
  if ((value.stallCues.maxPerTurn as number) < 1) {
    throw invalidTrace('Trace stallCues maxPerTurn must be at least 1');
  }
}

function validateStageMarker(value: unknown): void {
  if (!isRecord(value) || typeof value.stage !== 'string') {
    throw invalidTrace('Trace stage marker is invalid');
  }
  if (!['start', 'first-output', 'end', 'cancel', 'error'].includes(String(value.phase))) {
    throw invalidTrace('Trace stage phase is invalid');
  }
  optionalString(value.operationId, 'Trace stage operationId');
}

function validateDiagnostic(value: unknown): void {
  if (!isRecord(value) || typeof value.message !== 'string') {
    throw invalidTrace('Trace diagnostic is invalid');
  }
  nonNegativeInteger(value.discardedCharacters, 'Trace diagnostic discardedCharacters');
  if (value.code !== 'text.buffer.limit' && value.code !== 'text.unclosed-construct') {
    throw invalidTrace('Trace diagnostic code is invalid');
  }
  if (!['plain', 'code-fence', 'link', 'image', 'url'].includes(String(value.construct))) {
    throw invalidTrace('Trace diagnostic construct is invalid');
  }
}

function validateEvent(value: unknown, turnId: string): asserts value is VoiceTraceEvent {
  if (!isRecord(value) || typeof value.type !== 'string' || !eventTypes.has(value.type as never)) {
    throw invalidTrace('Trace contains an unknown event');
  }
  if (value.turnId !== turnId) throw invalidTrace('Trace event turnId does not match its trace');
  if (!Number.isFinite(value.atMs) || (value.atMs as number) < 0) {
    throw invalidTrace('Trace event atMs must be finite and non-negative');
  }
  if (!Number.isInteger(value.sequence) || (value.sequence as number) < 0) {
    throw invalidTrace('Trace event sequence must be a non-negative integer');
  }
  switch (value.type) {
    case 'turn.started':
      finiteNumber(value.startedAt, 'Trace turn startedAt');
      validateConfiguration(value.configuration);
      break;
    case 'input.delta':
      nonNegativeInteger(value.characters, 'Trace input characters');
      optionalString(value.text, 'Trace input text');
      break;
    case 'speech.segment':
      if (
        typeof value.segmentId !== 'string' ||
        typeof value.final !== 'boolean' ||
        !speechBoundaries.has(String(value.boundary))
      ) {
        throw invalidTrace('Trace speech segment is invalid');
      }
      nonNegativeInteger(value.segmentSequence, 'Trace segment sequence');
      nonNegativeInteger(value.characters, 'Trace segment characters');
      optionalString(value.text, 'Trace segment text');
      break;
    case 'playback.acknowledged':
      if (typeof value.segmentId !== 'string') {
        throw invalidTrace('Trace playback segmentId is invalid');
      }
      nonNegativeInteger(value.segmentSequence, 'Trace playback segment sequence');
      nonNegativeInteger(value.charactersPlayed, 'Trace playback acknowledgement');
      if (value.audioMs !== undefined) finiteNumber(value.audioMs, 'Trace playback audioMs');
      break;
    case 'stage.recorded':
      validateStageMarker(value.marker);
      break;
    case 'stall.cue.requested':
      nonNegativeInteger(value.cueSequence, 'Trace cue sequence');
      optionalString(value.text, 'Trace cue text');
      break;
    case 'turn.diagnostic':
      validateDiagnostic(value.diagnostic);
      break;
    case 'source.failed':
      if (typeof value.errorCode !== 'string') throw invalidTrace('Trace errorCode is invalid');
      break;
    case 'turn.interrupted':
      if (typeof value.reason !== 'string')
        throw invalidTrace('Trace interruption reason is invalid');
      break;
    case 'turn.ended':
      if (!['completed', 'interrupted', 'failed'].includes(String(value.outcome))) {
        throw invalidTrace('Trace outcome is invalid');
      }
      optionalString(value.errorCode, 'Trace errorCode');
      break;
  }
}

export function validateVoiceTrace(value: unknown): VoiceTrace {
  if (!isRecord(value)) throw invalidTrace('Trace must be an object');
  if (value.schemaVersion !== VOICE_TRACE_SCHEMA_VERSION) {
    throw invalidTrace(`Unsupported voice trace schema version ${String(value.schemaVersion)}`);
  }
  if (typeof value.turnId !== 'string' || value.turnId.length === 0) {
    throw invalidTrace('Trace turnId must be a non-empty string');
  }
  finiteNumber(value.startedAt, 'Trace startedAt');
  finiteNumber(value.durationMs, 'Trace durationMs');
  if (value.content !== 'none' && value.content !== 'redacted' && value.content !== 'full') {
    throw invalidTrace('Trace content mode is invalid');
  }
  validateConfiguration(value.configuration);
  if (!Array.isArray(value.events)) throw invalidTrace('Trace events are missing');
  if (typeof value.truncated !== 'boolean') throw invalidTrace('Trace truncated must be boolean');
  if (
    value.outcome !== undefined &&
    !['completed', 'interrupted', 'failed'].includes(String(value.outcome))
  ) {
    throw invalidTrace('Trace outcome is invalid');
  }
  optionalString(value.errorCode, 'Trace errorCode');

  let lastSequence = -1;
  let lastAtMs = -1;
  for (const event of value.events) {
    validateEvent(event, value.turnId);
    if (event.sequence <= lastSequence || event.atMs < lastAtMs) {
      throw invalidTrace('Trace events must have increasing sequence and monotonic timestamps');
    }
    lastSequence = event.sequence;
    lastAtMs = event.atMs;
  }
  if (value.events[0]?.type !== 'turn.started') {
    throw invalidTrace('Trace must begin with turn.started');
  }
  if (value.events.slice(1).some((event) => isRecord(event) && event.type === 'turn.started')) {
    throw invalidTrace('Trace can contain only one turn.started event');
  }
  const started = value.events[0];
  if (!isRecord(started) || started.startedAt !== value.startedAt) {
    throw invalidTrace('Trace startedAt does not match turn.started');
  }
  if (lastAtMs > (value.durationMs as number)) {
    throw invalidTrace('Trace durationMs cannot precede its final event');
  }
  if (
    value.content === 'none' &&
    value.events.some(
      (event) =>
        isRecord(event) &&
        (event.type === 'input.delta' ||
          event.type === 'speech.segment' ||
          event.type === 'stall.cue.requested') &&
        event.text !== undefined
    )
  ) {
    throw invalidTrace('Content-free traces cannot contain speech text');
  }
  return value as unknown as VoiceTrace;
}

export function exportVoiceTraceJson(trace: VoiceTrace): string {
  return JSON.stringify(validateVoiceTrace(trace), null, 2);
}

export function parseVoiceTraceJson(json: string): VoiceTrace {
  try {
    return validateVoiceTrace(JSON.parse(json));
  } catch (error) {
    if (error instanceof VoicePipelineError) throw error;
    throw invalidTrace('Unable to parse voice trace JSON', error);
  }
}

export function exportVoiceTraceJsonl(trace: VoiceTrace): string {
  const valid = validateVoiceTrace(trace);
  const header: JsonlHeader = {
    type: 'voice.trace',
    schemaVersion: valid.schemaVersion,
    turnId: valid.turnId,
    startedAt: valid.startedAt,
    durationMs: valid.durationMs,
    content: valid.content,
    configuration: valid.configuration,
    ...(valid.outcome === undefined ? {} : { outcome: valid.outcome }),
    ...(valid.errorCode === undefined ? {} : { errorCode: valid.errorCode }),
    truncated: valid.truncated,
  };
  return [header, ...valid.events].map((entry) => JSON.stringify(entry)).join('\n');
}

export function parseVoiceTraceJsonl(jsonl: string): VoiceTrace {
  try {
    const lines = jsonl
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) throw invalidTrace('Voice trace JSONL requires a header and events');
    const header = JSON.parse(lines[0] ?? '') as unknown;
    if (!isRecord(header) || header.type !== 'voice.trace') {
      throw invalidTrace('Voice trace JSONL header is invalid');
    }
    const events = lines.slice(1).map((line) => JSON.parse(line) as unknown);
    const { type: _type, ...traceHeader } = header;
    return validateVoiceTrace({ ...traceHeader, events });
  } catch (error) {
    if (error instanceof VoicePipelineError) throw error;
    throw invalidTrace('Unable to parse voice trace JSONL', error);
  }
}
