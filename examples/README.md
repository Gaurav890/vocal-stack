# Examples

Start with the v2 reliability API. The numbered directories are retained to demonstrate deprecated
v1 compatibility during migration.

## Start here

[`v2-quickstart.ts`](./v2-quickstart.ts) demonstrates the core path:

```text
model deltas → streaming normalization → speech segments → playback acknowledgement
```

The example is type-checked in CI against both the package source and the packed release artifact.
It accepts a `playSegment` callback, so it can be connected to any TTS and audio layer.

## Provider recipes

Provider integrations live in [`../recipes`](../recipes) rather than the core package. Each recipe
is independently compiled against the packed artifact in CI.

| Stack | What the recipe demonstrates |
| --- | --- |
| [AI SDK + ElevenLabs](../recipes/ai-sdk-elevenlabs) | Forwarding streamed model text into WebSocket TTS |
| [OpenAI Realtime](../recipes/openai-realtime) | Mapping realtime lifecycle events and interruption |
| [LiveKit Node](../recipes/livekit-node) | Recording provider metrics and lifecycle hooks |
| [Deepgram Flux](../recipes/deepgram-flux) | Source-mode segmentation and prompt cancellation |

Provider SDKs are development-only dependencies of their recipes and never enter the
`vocal-stack` runtime dependency graph.

## Build your own integration

1. Convert the provider's text output into an `AsyncIterable<string>` or `ReadableStream<string>`.
2. Pass a function that accepts the turn's `AbortSignal` to `pipeline.startTurn()`.
3. Send `speech.segment` events to TTS.
4. Acknowledge playback only as audio is confirmed by the player.
5. Call `turn.interrupt()` from VAD or user-input activity.
6. Record provider stage markers when real provider events are available.

See the [root quick start](../README.md#quick-start), [API reference](../docs/API.md), and
[telemetry guide](../docs/TELEMETRY.md) for the complete contract.

## Legacy v1 compatibility examples

These examples remain executable throughout v2, but new applications should use the `/text`,
`/turn`, `/telemetry`, and `/testing` entry points.

| Example | Deprecated API demonstrated |
| --- | --- |
| [`01-basic-sanitizer`](./01-basic-sanitizer) | `SpeechSanitizer` and `sanitizeForSpeech()` |
| [`02-flow-control`](./02-flow-control) | `FlowController` and `FlowManager` |
| [`03-monitoring`](./03-monitoring) | `VoiceAuditor` and legacy metric exporters |
| [`04-full-pipeline`](./04-full-pipeline) | Sanitizer, flow, and monitor composition |
| [`05-openai-tts`](./05-openai-tts) | Legacy OpenAI TTS integration |
| [`06-elevenlabs-tts`](./06-elevenlabs-tts) | Legacy ElevenLabs integration |
| [`07-custom-voice-agent`](./07-custom-voice-agent) | Legacy multi-turn agent composition |

For an existing v1 application, read the [v1 to v2 migration guide](../docs/MIGRATION.md).

## Contributing an example

Useful contributions focus on a real integration problem and keep provider code outside the core:

- include a concise README with setup and expected behavior;
- never commit API keys, generated audio, or transcripts;
- compile against the local packed `vocal-stack` artifact;
- add a deterministic scenario for any failure or interruption behavior; and
- avoid performance claims without a checked-in reproducible benchmark.

Open an [integration feedback issue](https://github.com/Gaurav890/vocal-stack/issues/new/choose) if
an integration pattern is not covered yet.
