# Project context

## Product boundary

`vocal-stack` is a small, provider-neutral reliability layer for custom TypeScript voice
pipelines. Its core responsibilities are:

- incremental, chunk-invariant text normalization;
- natural and bounded speech segmentation;
- immediate local barge-in settlement and upstream cancellation;
- generated-versus-heard text accounting;
- content-free lifecycle and latency telemetry; and
- deterministic failure, stall, and interruption scenarios.

VAD, STT/TTS clients, WebRTC, telephony, audio DSP, semantic end-of-turn detection, model
orchestration, and hosted dashboards are out of scope.

## Engineering constraints

- Node.js 22, 24, and 26 plus modern browsers.
- Strict TypeScript and named exports.
- Neutral ESM and Node ESM/CJS builds.
- Zero production dependencies.
- Provider integrations are compile-tested recipes, not runtime adapters.
- Existing v1 entry points remain compatible and deprecated throughout v2.
- Default telemetry must not contain prompts, transcripts, tool arguments, or speech text.
- Performance claims require a checked-in reproducible benchmark.

## Required checks

```sh
npm run check
npm run test:browser
npm audit
```

Stable publishing and release creation require explicit maintainer approval.
