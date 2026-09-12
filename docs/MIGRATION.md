# Migrating from v1 to v2

Version 2 focuses the package on reliability primitives. Existing root imports and the
`/sanitizer`, `/flow`, and `/monitor` entry points remain available throughout v2, but are
deprecated in favor of the APIs below.

## Sanitizer

Replace `SpeechSanitizer.sanitizeStream()` with `normalizeSpeechStream()` or
`segmentSpeechStream()`. Streaming normalization now treats source chunks as transport details and
preserves sentence punctuation. `SpeechSanitizer.sanitizeAsync()` has been added for the method v1
error messages already referenced.

```ts
// v1
const sanitized = sanitizer.sanitizeStream(modelStream);

// v2
const segments = segmentSpeechStream(modelStream, { mode: 'balanced' });
```

## Flow control

Replace `FlowController` or `FlowManager` with `createVoicePipeline()`. Automatic filler callbacks
are replaced by explicit, disabled-by-default `stall.cue.requested` events. Interruption now owns an
`AbortSignal`, upstream cancellation, timer cleanup, and immediate local settlement.

## Monitor

Replace `VoiceAuditor` with a `TelemetrySink` and per-turn stage markers. `VoiceAuditor.tokenCount`
still exists as a deprecated alias, but counts arbitrary chunks—not model tokens. Failed legacy
tracked streams are now recorded as failed instead of completed.

## Runtime requirements

The minimum Node.js version is 22. Browser consumers should use the ESM export. CommonJS remains
available on Node.js.
