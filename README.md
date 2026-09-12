# vocal-stack

Provider-neutral reliability primitives for custom TypeScript voice pipelines.

`vocal-stack` sits between a model text stream and your TTS/audio layer. It does not replace your
agent framework, transport, VAD, STT, TTS, or telephony provider. It handles the failure-prone seam
between them:

- turn arbitrary model deltas into safe, natural TTS segments;
- stop local output immediately when a listener interrupts;
- distinguish generated text from text confirmed as played;
- normalize lifecycle and latency telemetry across providers; and
- replay stalls, failures, and barge-in timelines in deterministic tests.

The package has no runtime dependencies and supports Node.js 22, 24, and 26 plus modern browsers.

## Install

```sh
npm install vocal-stack
```

## Quick start

```ts
import { createVoicePipeline } from 'vocal-stack/turn';

const pipeline = createVoicePipeline({
  text: {
    locale: 'en',
    mode: 'balanced',
    minChars: 24,
    targetChars: 120,
    maxChars: 240,
    maxWaitMs: 250,
  },
  stallCues: { enabled: false },
  telemetry: { sinks: [myTelemetrySink] },
});

const turn = pipeline.startTurn({
  id: 'turn-123',
  source: (signal) => createModelTextStream({ signal }),
});

for await (const event of turn.events) {
  if (event.type === 'speech.segment') {
    await tts.send(event.segment.text);
  }

  if (event.type === 'stall.cue.requested') {
    await playPreparedCue(event.text);
  }
}

const result = await turn.result;
```

Call `turn.interrupt({ reason: 'barge-in' })` from your VAD or input-activity handler while the
event loop is active.

Call `acknowledgePlayback` from the audio player as audio is confirmed—not when text is sent to a
TTS provider:

```ts
import { countSpeechCharacters } from 'vocal-stack/text';

turn.acknowledgePlayback({
  segmentId: 'turn-123-segment-1',
  charactersPlayed: 42,
  audioMs: 1_800,
});
```

Use `countSpeechCharacters(text, locale)` when acknowledging a full segment; it matches the
Unicode-grapheme counting used for validation.

`result.generatedText` contains received model text. `result.heardText` contains only acknowledged
graphemes. Outcomes are always explicit: `completed`, `interrupted`, or `failed`.

## Text reliability

Use the text API independently when you already own turn orchestration:

```ts
import {
  normalizeForSpeech,
  normalizeSpeechStream,
  segmentSpeechStream,
} from 'vocal-stack/text';

normalizeForSpeech('Read [the guide](https://example.com).');
// "Read the guide."

for await (const segment of segmentSpeechStream(modelDeltas, {
  mode: 'balanced',
  minChars: 24,
  targetChars: 120,
  maxChars: 240,
  maxWaitMs: 250,
})) {
  await tts.send(segment.text);
}
```

Normalization is incremental across source chunk boundaries. It preserves sentence punctuation,
contractions, link labels, whitespace, emoji, combining marks, and CJK text. Fenced code, images,
bare URLs, and email addresses are omitted by default. Numbers, dates, currencies, and
pronunciations are left to the TTS provider.

Balanced mode prefers sentence boundaries, then clauses near the target length, then word
boundaries. It force-splits only at a Unicode grapheme boundary. `mode: 'source'` forwards
normalized source deltas without sentence buffering for providers that want token-like input.

## Prompt interruption

`interrupt()` performs local settlement before waiting for the provider. It aborts the source
signal, calls an async iterator's `return()` or a `ReadableStream` reader's `cancel()`, stops local
timers, suppresses late deltas, and closes the event stream even if upstream ignores cancellation.
Each turn owns independent state, so one pipeline can safely run concurrent turns.

## Telemetry without transcript capture

```ts
turn.recordStage({ stage: 'llm', phase: 'start', operationId: 'response-1' });
turn.recordStage({ stage: 'llm', phase: 'first-output', operationId: 'response-1' });
turn.recordStage({ stage: 'llm', phase: 'end', operationId: 'response-1' });
```

Known stages are `turn-detection`, `stt`, `llm`, `tool`, `tts`, `playback`, and
`realtime-model`. Namespaced custom stages such as `acme.cache` are supported. Metrics use a
monotonic clock for durations and a separate wall timestamp for correlation. No prompts,
transcripts, tool arguments, or speech text enter telemetry events.

Sinks may be synchronous or asynchronous. Sink and diagnostic-listener failures are routed to
`onSinkError` and cannot fail a turn. JSON and JSONL metric exports are available from
`vocal-stack/telemetry`.

## Deterministic scenarios

```ts
import { createVoicePipeline } from 'vocal-stack/turn';
import { expectVoiceScenario, runVoiceScenario, VirtualClock } from 'vocal-stack/testing';

const clock = new VirtualClock();
const pipeline = createVoicePipeline({
  clock,
  text: { minChars: 5, targetChars: 24, maxChars: 80, maxWaitMs: 800 },
});

const scenario = await runVoiceScenario({
  pipeline,
  timeline: [
    { atMs: 0, type: 'delta', text: 'Let me ' },
    { atMs: 600, type: 'stall' },
    { atMs: 700, type: 'delta', text: 'check that.' },
    { atMs: 850, type: 'playback.ack', segment: 0, charactersPlayed: 8 },
    { atMs: 900, type: 'interrupt', reason: 'barge-in' },
  ],
});

expectVoiceScenario(scenario)
  .toHaveOutcome('interrupted')
  .toHaveHeardText('Let me c')
  .toSettleWithin(20)
  .toHaveNoPendingTimers();
```

Timeline steps cover deltas, stalls, source completion/failure, stage markers, playback
acknowledgements, consumer cancellation, and interruption.

## Provider recipes

Copyable, compile-checked recipes live in [`recipes`](./recipes):

- AI SDK text streaming with ElevenLabs WebSocket TTS;
- OpenAI Realtime lifecycle events;
- LiveKit Node metrics/hooks; and
- Deepgram Flux source-mode streaming and cancellation.

Provider packages remain outside the core runtime.

## Package entry points

| Entry point | Purpose |
| --- | --- |
| `vocal-stack/text` | normalization and speech segmentation |
| `vocal-stack/turn` | turn lifecycle, interruption, playback acknowledgement |
| `vocal-stack/telemetry` | stages, metrics, sinks, JSON/JSONL export |
| `vocal-stack/testing` | virtual clock, scenario runner, fluent assertions |
| `vocal-stack/sanitizer` | deprecated v1 compatibility API |
| `vocal-stack/flow` | deprecated v1 compatibility API |
| `vocal-stack/monitor` | deprecated v1 compatibility API |

The root export contains both v2 and compatibility APIs. See the executable
[`v2-quickstart.ts`](./examples/v2-quickstart.ts), [API reference](./docs/API.md), and
[v1 migration guide](./docs/MIGRATION.md).

## Scope

VAD models, semantic end-of-turn detection, STT/TTS clients, WebRTC, telephony, audio DSP, model
orchestration, and hosted dashboards are intentionally out of scope. Use `vocal-stack` alongside a
framework such as LiveKit Agents, Pipecat, or an Agents SDK when those capabilities are needed.

## Development

```sh
nvm use
npm ci
npm run check
```

CI runs Node.js 22.12, 24, and 26, enforces coverage and package-size floors, validates ESM/CJS and
types from the packed tarball, and runs browser smoke tests in Chromium, Firefox, and WebKit.

See [CONTRIBUTING.md](./CONTRIBUTING.md), [SECURITY.md](./SECURITY.md), and the public
[roadmap](./ROADMAP.md).

## License

MIT
