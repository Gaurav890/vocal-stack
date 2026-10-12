<div align="center">

# vocal-stack

**Reliability between streaming model text and the microphone.**

Speech-safe text · immediate barge-in · heard-text accounting · normalized telemetry · deterministic tests

[![npm version](https://img.shields.io/npm/v/vocal-stack.svg)](https://www.npmjs.com/package/vocal-stack)
[![npm downloads](https://img.shields.io/npm/dm/vocal-stack.svg)](https://www.npmjs.com/package/vocal-stack)
[![CI](https://github.com/Gaurav890/vocal-stack/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Gaurav890/vocal-stack/actions/workflows/ci.yml)
[![minified and gzipped size](https://img.shields.io/bundlephobia/minzip/vocal-stack)](https://bundlephobia.com/package/vocal-stack)
[![Node.js](https://img.shields.io/node/v/vocal-stack.svg)](https://www.npmjs.com/package/vocal-stack)
[![license](https://img.shields.io/npm/l/vocal-stack.svg)](https://github.com/Gaurav890/vocal-stack/blob/main/LICENSE)

[Install in 60 seconds](#quick-start) ·
[Watch video](https://github.com/user-attachments/assets/ad7e6b0c-5196-4a7b-bf30-2d86a5dad50c) ·
[Download MP4](https://github.com/Gaurav890/vocal-stack/blob/main/.github/assets/vocal-stack-overview.mp4?raw=true) ·
[Read the API](https://github.com/Gaurav890/vocal-stack/blob/main/docs/API.md) ·
[⭐ Star vocal-stack](https://github.com/Gaurav890/vocal-stack)

</div>

![vocal-stack — reliability between the model and the microphone](https://raw.githubusercontent.com/Gaurav890/vocal-stack/main/.github/assets/vocal-stack-overview.jpg)

https://github.com/user-attachments/assets/ad7e6b0c-5196-4a7b-bf30-2d86a5dad50c

## The short version

Models stream arbitrary text fragments. TTS engines need meaningful, speakable units. Listeners can
interrupt halfway through a word, and generated text is not the same thing as audio they actually
heard.

`vocal-stack` is the small reliability layer between those systems:

```text
model deltas → vocal-stack → speech segments → your TTS → playback acknowledgements
```

It normalizes and segments streaming text, settles turns immediately on barge-in, reconstructs the
text confirmed as played, records provider-neutral latency metrics, and makes voice failures
repeatable in tests.

It is **not** another voice-agent framework. Bring your own model, VAD, STT, TTS, transport, and
orchestration.

## Is this for your stack?

| You need… | Use vocal-stack? |
| --- | :---: |
| A reliability layer for a custom TypeScript voice pipeline | **Yes** |
| Natural TTS boundaries from arbitrary model chunks | **Yes** |
| Barge-in that settles even when upstream ignores cancellation | **Yes** |
| A record of what was generated versus what was actually heard | **Yes** |
| Deterministic stall, interruption, and failure tests | **Yes** |
| A VAD, STT/TTS client, WebRTC transport, or telephony platform | No—keep your existing provider or framework |

## Install

```sh
npm install vocal-stack
```

Requires Node.js 22+. Ships ESM and CommonJS, works in modern browsers, and has **zero runtime
dependencies**.

## Quick start

This example streams model text into a turn, sends complete speech segments to TTS, and records only
the characters confirmed as played:

```ts
import { countSpeechCharacters } from 'vocal-stack/text';
import { createVoicePipeline } from 'vocal-stack/turn';

async function* modelText(signal: AbortSignal): AsyncIterable<string> {
  for (const delta of ['Read [the ', 'guide](https://example.com) ', 'before continuing.']) {
    if (signal.aborted) return;
    yield delta;
  }
}

async function sendToTts(text: string): Promise<void> {
  // Replace this with your TTS and audio-player integration.
  console.log(text);
}

const pipeline = createVoicePipeline({
  text: { mode: 'balanced' },
});

const turn = pipeline.startTurn({
  id: 'answer-1',
  source: modelText,
});

for await (const event of turn.events) {
  if (event.type !== 'speech.segment') continue;

  await sendToTts(event.segment.text);
  turn.acknowledgePlayback({
    segmentId: event.segment.id,
    charactersPlayed: countSpeechCharacters(event.segment.text),
  });
}

const result = await turn.result;
console.log(result.outcome);   // "completed"
console.log(result.heardText); // "Read the guide before continuing."
```

Call this from your VAD or input-activity handler:

```ts
turn.interrupt({ reason: 'barge-in' });
```

The local event stream closes immediately—even if the model source is stalled or ignores
cancellation.

## What it handles

| Voice-pipeline failure mode | vocal-stack behavior |
| --- | --- |
| Markdown, URLs, or sentences split across chunks | Parses incrementally; chunk boundaries do not change the normalized result |
| Tiny model deltas sound unnatural when spoken | Emits Unicode-safe sentence, clause, word, timeout, and maximum-length segments |
| Upstream hangs during barge-in | Aborts, cancels the reader/iterator, suppresses late deltas, and settles locally |
| Generated text is treated as heard text | Reconstructs heard text only from monotonic playback acknowledgements |
| Providers report incompatible lifecycle metrics | Normalizes stage markers and derived latency metrics with monotonic timing |
| Stall and failure tests depend on real time | Runs declarative scenarios against a virtual clock |

## Use only the layer you need

Every stable v2 capability has its own entry point. Root imports are also supported.

| Entry point | Purpose |
| --- | --- |
| `vocal-stack/text` | Streaming normalization and speech segmentation |
| `vocal-stack/turn` | Turn lifecycle, interruption, and playback acknowledgement |
| `vocal-stack/telemetry` | Stage markers, metrics, sinks, and JSON/JSONL export |
| `vocal-stack/testing` | Virtual time, scenario execution, fixtures, and assertions |

The v1 entry points—`vocal-stack/sanitizer`, `vocal-stack/flow`, and
`vocal-stack/monitor`—remain available as deprecated compatibility APIs throughout v2.

### Speech-safe text

```ts
import { normalizeForSpeech, segmentSpeechStream } from 'vocal-stack/text';

normalizeForSpeech('Read [the guide](https://example.com).');
// => "Read the guide."

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

Normalization preserves sentence punctuation, contractions, whitespace, Markdown link labels,
emoji, combining characters, and CJK text across arbitrary chunk boundaries. By default it omits
fenced code, images, bare URLs, and email addresses. Numbers, dates, currencies, and pronunciations
stay untouched for the TTS provider.

Use `mode: 'source'` when your provider expects low-buffering source deltas.

### Honest turn outcomes

Every turn has independent state, so one pipeline can run concurrent responses safely. Outcomes are
explicit: `completed`, `interrupted`, or `failed`.

The result keeps these separate:

- `generatedText`: everything produced by the model source;
- `heardText`: only acknowledged playback;
- `acknowledgementConfidence`: `none`, `partial`, or `complete`;
- `segments`, `diagnostics`, `metrics`, and the original failure cause when applicable.

Playback acknowledgements are grapheme-counted, monotonic, range-checked, and ordered by segment.
Invalid acknowledgements throw a stable `VoicePipelineError`.

### Privacy-safe telemetry

```ts
turn.recordStage({ stage: 'llm', phase: 'start', operationId: 'response-1' });
turn.recordStage({ stage: 'llm', phase: 'first-output', operationId: 'response-1' });
turn.recordStage({ stage: 'llm', phase: 'end', operationId: 'response-1' });
```

Built-in stages cover `turn-detection`, `stt`, `llm`, `tool`, `tts`, `playback`, and
`realtime-model`; namespaced custom stages are supported. Durations use a monotonic clock, while a
separate wall-clock timestamp supports correlation across systems.

Telemetry contains lifecycle, timing, count, and outcome fields—not prompts, transcripts, tool
arguments, or speech text. Sink failures never break the turn. See the
[telemetry guide](https://github.com/Gaurav890/vocal-stack/blob/main/docs/TELEMETRY.md) for the metric
schema and an OpenTelemetry recipe.

### Deterministic voice tests

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

Timeline steps also cover source completion/error, stage markers, consumer cancellation, stalls,
and playback acknowledgements. Reusable barge-in, stalled-response, and source-failure fixtures are
included.

## Provider recipes

Provider SDKs stay out of the runtime dependency graph. Copyable, compile-checked recipes show how
to connect the package to common voice stacks:

- [AI SDK + ElevenLabs](https://github.com/Gaurav890/vocal-stack/tree/main/recipes/ai-sdk-elevenlabs)
- [OpenAI Realtime](https://github.com/Gaurav890/vocal-stack/tree/main/recipes/openai-realtime)
- [LiveKit Node](https://github.com/Gaurav890/vocal-stack/tree/main/recipes/livekit-node)
- [Deepgram Flux](https://github.com/Gaurav890/vocal-stack/tree/main/recipes/deepgram-flux)

## Documentation

- [API reference](https://github.com/Gaurav890/vocal-stack/blob/main/docs/API.md)
- [Telemetry and OpenTelemetry](https://github.com/Gaurav890/vocal-stack/blob/main/docs/TELEMETRY.md)
- [v1 → v2 migration](https://github.com/Gaurav890/vocal-stack/blob/main/docs/MIGRATION.md)
- [Reproducible benchmarks](https://github.com/Gaurav890/vocal-stack/blob/main/docs/BENCHMARKS.md)
- [Examples](https://github.com/Gaurav890/vocal-stack/tree/main/examples)
- [Public roadmap](https://github.com/Gaurav890/vocal-stack/blob/main/ROADMAP.md)

## Scope

VAD models, semantic end-of-turn detection, STT/TTS clients, WebRTC, telephony, audio DSP, model
orchestration, and hosted dashboards are intentionally out of scope. Use `vocal-stack` alongside a
full framework when those capabilities are needed.

## Development

```sh
nvm use
npm ci
npm run check
```

CI tests Node.js 22.12, 24, and 26; enforces coverage and package-size thresholds; validates ESM,
CommonJS, and types from the packed artifact; compiles provider recipes; audits the development
toolchain; and runs browser smoke tests in Chromium, Firefox, and WebKit.

Contributions are welcome—especially integration reports, chunk-boundary fixtures, failure
scenarios, provider recipes, and documentation corrections. Read
[CONTRIBUTING.md](https://github.com/Gaurav890/vocal-stack/blob/main/CONTRIBUTING.md) before opening a
pull request. Report security issues through the private process in
[SECURITY.md](https://github.com/Gaurav890/vocal-stack/blob/main/SECURITY.md).

## Help make voice pipelines more reliable

If `vocal-stack` saves you from rebuilding this reliability glue, [star the repository](https://github.com/Gaurav890/vocal-stack).
Stars help other TypeScript voice developers find the project. If you ship it in a real pipeline,
an [integration report](https://github.com/Gaurav890/vocal-stack/issues/new?template=integration-feedback.yml)
is even more valuable.

## License

[MIT](https://github.com/Gaurav890/vocal-stack/blob/main/LICENSE)
