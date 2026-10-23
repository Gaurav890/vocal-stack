# API reference

## `vocal-stack/text`

### `normalizeForSpeech(text, options?)`

Synchronous normalization for complete strings. Throws `VOICE_TEXT_ASYNC_TRANSFORM` when a
transform returns a promise.

### `normalizeSpeechStream(input, options?)`

Normalizes an `AsyncIterable<string>` or `ReadableStream<string>` incrementally. Ordered transforms
may be synchronous or asynchronous. Pending unresolved text defaults to 4,096 characters;
`text.buffer.limit` diagnostics report forced output or discarded construct content.

### `SpeechSegmenter`

- `push(text)` accepts normalized text and returns zero or more `SpeechSegment` values.
- `flushTimeout()` emits the best current word boundary with boundary `timeout`.
- `finish()` emits remaining text with boundary `flush` and `final: true`.

`SpeechSegment.boundary` is `sentence`, `clause`, `word`, `max-length`, `timeout`, `source`, or
`flush`.

### `segmentSpeechStream(input, options?)`

Composes streaming normalization with segmentation and timeout flushing.

### `countSpeechCharacters(text, locale?)`

Counts the Unicode graphemes used by playback acknowledgement validation.

## `vocal-stack/turn`

### `createVoicePipeline(options?)`

Creates a concurrency-safe pipeline. Options include `text`, `stallCues`, `telemetry`, `trace`,
`clock`, and `onDiagnostic`.

### `pipeline.startTurn({ id, source })`

`source(signal)` returns an async iterable or Web `ReadableStream`. Duplicate active IDs throw
`VOICE_TURN_DUPLICATE_ID`.

The returned `VoiceTurn` exposes:

- `events`: `speech.segment`, `stall.cue.requested`, `turn.diagnostic`, and `turn.ended`;
- `acknowledgePlayback({ segmentId, charactersPlayed, audioMs? })`;
- `interrupt({ reason })`;
- `flushSpeech()` to emit pending text at the best current boundary;
- `recordStage(marker)`; and
- `result`.

Playback acknowledgements are grapheme-counted, monotonic, range-checked, and ordered by segment.
Invalid acknowledgements throw `VOICE_PLAYBACK_ACK_INVALID`.

`VoiceTurnResult` includes the outcome, raw generated text, acknowledged/heard text,
acknowledgement confidence, emitted segments, diagnostics, optional interruption or error, and
final metrics. Failed turns resolve with a stable `VoicePipelineError.code` and preserve the
original error in `error.cause`.

## `vocal-stack/telemetry`

### `turn.recordStage(marker)`

Markers contain `stage`, `phase`, optional `operationId`, optional monotonic `at`, and optional wall
timestamp `wallAt`. Phases are `start`, `first-output`, `end`, `cancel`, and `error`.

### `TelemetrySink`

Implement `record(event)` and pass the sink under `telemetry.sinks`. Content fields do not exist on
the stable event schema.

### Exports

- `MemoryTelemetrySink`
- `exportTelemetryJson(metrics)`
- `exportTelemetryJsonl(metrics)`
- `systemClock`

## `vocal-stack/trace`

### `createVoiceTraceRecorder(options?)`

Creates a bounded in-memory `VoiceTraceSink`. Pass it to
`createVoicePipeline({ trace: { sinks: [recorder] } })`.

Content modes are:

- `none` (default): records structure, timing, character counts, stage markers, acknowledgements,
  diagnostics, and outcomes without speech text;
- `redacted`: requires a synchronous `redact(text, context)` function and stores its output; and
- `full`: stores model deltas, emitted segment text, and cue text unchanged.

The recorder exposes `getTrace(turnId)`, `getTraces()`, and `clear()`. `maxEventsPerTurn` and
`maxStoredTraces` bound memory. A trace that reaches its event limit is marked `truncated` while
retaining its terminal `turn.ended` event.

### Trace exports

- `exportVoiceTraceJson(trace)` / `parseVoiceTraceJson(json)`
- `exportVoiceTraceJsonl(trace)` / `parseVoiceTraceJsonl(jsonl)`
- `validateVoiceTrace(value)`
- `VOICE_TRACE_SCHEMA_VERSION`

Trace events use turn-relative monotonic `atMs` values plus an increasing `sequence` for stable
ordering at equal timestamps. The trace header keeps one wall-clock `startedAt` for external
correlation.

## `vocal-stack/testing`

### `VirtualClock`

Implements the pipeline clock and exposes `advanceTo`, `advanceBy`, `runAll`, and
`pendingTimerCount`.

### `runVoiceScenario({ pipeline, timeline, turnId? })`

Requires a pipeline configured with a `VirtualClock`. Returns the turn result, collected events,
settlement duration, and remaining timer count.

### `expectVoiceScenario(result)`

Fluent assertions include outcome, heard/generated text, segment count, settlement time, and timer
cleanup.

`builtInVoiceScenarios` provides reusable barge-in, stalled-first-response, and source-failure
timelines.

### `scenarioFromTrace(trace, options?)`

Converts a completed trace into a replay plan containing `turnId`, `timeline`, serializable
`pipelineOptions`, and `requiresTransforms`. Input deltas must have been recorded with `redacted` or
`full` content. Truncated traces are rejected unless `allowTruncated: true` is explicitly supplied.

Recorded timeout boundaries become explicit `speech.flush` steps. Automatic timeout flushing is
disabled for that replay, preventing browser timer jitter from changing segment boundaries.

Spread `pipelineOptions` into a pipeline configured with a `VirtualClock`, then pass the plan's
timeline to `runVoiceScenario()`. If `requiresTransforms` is true, restore the application's
original transforms before comparing replay results.
