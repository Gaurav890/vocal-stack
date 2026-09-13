<div align="center">

# vocal-stack

**Provider-neutral reliability primitives for TypeScript voice pipelines.**

Turn unpredictable model deltas into speech-safe segments, interrupt output promptly, distinguish
generated text from what listeners actually heard, and test voice timelines without real delays.

[![npm version](https://img.shields.io/npm/v/vocal-stack.svg)](https://www.npmjs.com/package/vocal-stack)
[![npm downloads](https://img.shields.io/npm/dm/vocal-stack.svg)](https://www.npmjs.com/package/vocal-stack)
[![CI](https://github.com/Gaurav890/vocal-stack/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Gaurav890/vocal-stack/actions/workflows/ci.yml)
[![minified and gzipped size](https://img.shields.io/bundlephobia/minzip/vocal-stack)](https://bundlephobia.com/package/vocal-stack)
[![Node.js](https://img.shields.io/node/v/vocal-stack.svg)](https://www.npmjs.com/package/vocal-stack)
[![license](https://img.shields.io/npm/l/vocal-stack.svg)](./LICENSE)

[Quick start](#quick-start) · [Why vocal-stack?](#why-vocal-stack) ·
[API](https://github.com/Gaurav890/vocal-stack/blob/main/docs/API.md) ·
[Recipes](https://github.com/Gaurav890/vocal-stack/tree/main/recipes) ·
[Migration guide](https://github.com/Gaurav890/vocal-stack/blob/main/docs/MIGRATION.md)

</div>

## Why vocal-stack?

A model emits arbitrary text chunks. A TTS provider needs meaningful text. A listener can interrupt
at any moment. Most custom voice pipelines connect those parts with application-specific buffering,
cancellation, and timing code that is difficult to test.

`vocal-stack` owns that narrow reliability layer:

| Voice-pipeline problem | What vocal-stack provides |
| --- | --- |
| Markdown, URLs, or sentences split across model chunks | Incremental normalization that is invariant to chunk boundaries |
| Tiny deltas sound unnatural when sent directly to TTS | Unicode-safe sentence, clause, word, timeout, and maximum-length segmentation |
| Barge-in waits for a stalled upstream iterator | Immediate local settlement plus source abort and iterator/reader cancellation |
| Generated text is mistaken for audio the listener heard | Monotonic, grapheme-counted playback acknowledgements |
| Provider metrics use incompatible names and clocks | Privacy-safe stage markers and normalized latency metrics |
| Stall and interruption tests depend on real time | A virtual clock, declarative scenarios, and fluent assertions |

It is not another agent framework. Bring your own model, VAD, STT, TTS, transport, and
orchestration. The package has **zero runtime dependencies** and works with Node.js 22+, ESM,
CommonJS, and modern browsers.

```text
VAD / STT → model text stream → vocal-stack → TTS → audio player
```

## Install

```sh
npm install vocal-stack
```

```sh
pnpm add vocal-stack
```

```sh
yarn add vocal-stack
```

## Quick start

This complete example feeds chunked model output into a turn, plays every speech segment, and
acknowledges only the text confirmed as played:

```ts
import { countSpeechCharacters } from 'vocal-stack/text';
import { createVoicePipeline } from 'vocal-stack/turn';

async function* modelText(signal: AbortSignal): AsyncIterable<string> {
  for (const delta of [
    'Read [the ',
    'guide](https://example.com) ',
    'before continuing.',
  ]) {
    if (signal.aborted) return;
    yield delta;
  }
}

async function playSegment(text: string): Promise<void> {
  // Replace this with your TTS and audio-player integration.
  console.log(text);
}

async function main(): Promise<void> {
  const pipeline = createVoicePipeline({
    text: { mode: 'balanced' },
    stallCues: { enabled: false },
  });

  const turn = pipeline.startTurn({
    id: 'answer-1',
    source: modelText,
  });

  for await (const event of turn.events) {
    if (event.type !== 'speech.segment') continue;

    await playSegment(event.segment.text);
    turn.acknowledgePlayback({
      segmentId: event.segment.id,
      charactersPlayed: countSpeechCharacters(event.segment.text),
    });
  }

  const result = await turn.result;
  console.log(result.outcome);   // "completed"
  console.log(result.heardText); // "Read the guide before continuing."
}

void main();
```

Call `turn.interrupt({ reason: 'barge-in' })` from your VAD or input-activity handler. The turn
closes its local event stream immediately even when the upstream source ignores cancellation.

## Use only what you need

Each stable v2 capability has a dedicated entry point. Importing the root package is also
supported.

| Entry point | Use it for |
| --- | --- |
| `vocal-stack/text` | Streaming normalization and speech segmentation |
| `vocal-stack/turn` | Turn lifecycle, interruption, and playback acknowledgement |
| `vocal-stack/telemetry` | Stage markers, metrics, sinks, and JSON/JSONL export |
| `vocal-stack/testing` | Virtual time, scenario execution, and assertions |

The v1 entry points—`vocal-stack/sanitizer`, `vocal-stack/flow`, and
`vocal-stack/monitor`—remain available as deprecated compatibility APIs throughout v2.

## Text that is safe to speak

Use the text layer independently when you already own turn orchestration:

```ts
import { normalizeForSpeech, segmentSpeechStream } from 'vocal-stack/text';

normalizeForSpeech('Read [the guide](https://example.com).');
// => "Read the guide."

async function* deltas() {
  yield 'One sentence. The next ';
  yield 'sentence arrived in another chunk.';
}

for await (const segment of segmentSpeechStream(deltas(), {
  mode: 'balanced',
  minChars: 24,
  targetChars: 120,
  maxChars: 240,
  maxWaitMs: 250,
})) {
  console.log(segment.text, segment.boundary);
}
```

Normalization preserves sentence punctuation, contractions, whitespace, Markdown link labels,
emoji, combining characters, and CJK text across arbitrary chunk boundaries. It omits fenced code,
images, bare URLs, and email addresses by default. Numbers, dates, currencies, and pronunciations
remain untouched for the TTS provider.

Balanced segmentation prefers complete sentences, then clauses near the target length, then word
boundaries. It force-splits only at a Unicode grapheme boundary. Use `mode: 'source'` when a provider
expects low-buffering source deltas.

## Interruption and heard-text tracking

Every turn owns independent state, so a pipeline can safely run concurrent responses.

`interrupt()`:

- aborts the source signal;
- cancels a Web `ReadableStream` reader or calls an async iterator's `return()`;
- stops timers and suppresses late deltas; and
- resolves the local event stream without waiting for upstream cooperation.

Turn outcomes are explicit: `completed`, `interrupted`, or `failed`. The result separates raw model
output in `generatedText` from acknowledged playback in `heardText`. Playback acknowledgements must
be monotonic and within the segment's grapheme length; invalid acknowledgements throw a stable
`VoicePipelineError`.

## Privacy-safe telemetry

Record provider lifecycle markers without coupling your application to a telemetry backend:

```ts
turn.recordStage({ stage: 'llm', phase: 'start', operationId: 'response-1' });
turn.recordStage({ stage: 'llm', phase: 'first-output', operationId: 'response-1' });
turn.recordStage({ stage: 'llm', phase: 'end', operationId: 'response-1' });
```

Built-in stages cover `turn-detection`, `stt`, `llm`, `tool`, `tts`, `playback`, and
`realtime-model`; namespaced custom stages are also supported. Durations use a monotonic clock,
while separate wall-clock timestamps support cross-system correlation.

Telemetry contains lifecycle, timing, count, and outcome fields—not prompts, transcripts, tool
arguments, or speech text. Sink failures are isolated from the voice turn. See the
[telemetry guide](https://github.com/Gaurav890/vocal-stack/blob/main/docs/TELEMETRY.md) for a generic
OpenTelemetry recipe.

## Deterministic voice tests

Reproduce stalls, partial playback, interruption, and source failure without sleeping in tests:

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

Timeline steps also cover source completion/error, stage markers, consumer cancellation, and
playback acknowledgements. Reusable barge-in, stalled-response, and source-failure scenarios are
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
- [v1 to v2 migration](https://github.com/Gaurav890/vocal-stack/blob/main/docs/MIGRATION.md)
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

Contributions are welcome, especially real integration reports, chunk-boundary fixtures, failure
scenarios, provider recipes, and documentation corrections. Read
[CONTRIBUTING.md](https://github.com/Gaurav890/vocal-stack/blob/main/CONTRIBUTING.md) before opening a
pull request. Security reports follow the private process in
[SECURITY.md](https://github.com/Gaurav890/vocal-stack/blob/main/SECURITY.md).

## License

[MIT](./LICENSE)
