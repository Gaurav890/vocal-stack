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

Creates a concurrency-safe pipeline. Options include `text`, `stallCues`, `telemetry`, `clock`, and
`onDiagnostic`.

### `pipeline.startTurn({ id, source })`

`source(signal)` returns an async iterable or Web `ReadableStream`. Duplicate active IDs throw
`VOICE_TURN_DUPLICATE_ID`.

The returned `VoiceTurn` exposes:

- `events`: `speech.segment`, `stall.cue.requested`, `turn.diagnostic`, and `turn.ended`;
- `acknowledgePlayback({ segmentId, charactersPlayed, audioMs? })`;
- `interrupt({ reason })`;
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
