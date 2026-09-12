# Provider recipes

These recipes keep provider SDKs outside `vocal-stack` while showing where the reliability layer
fits. Each adapter is deliberately small, compile-checked in CI, and safe to copy into an
application.

- `ai-sdk-elevenlabs`: turn an AI SDK `textStream` into a cancellable source and forward speech
  segments to an ElevenLabs WebSocket.
- `openai-realtime`: translate realtime lifecycle events into stable stage telemetry.
- `livekit-node`: translate LiveKit metrics/hooks into stable stage telemetry.
- `deepgram-flux`: use source-mode segmentation and propagate interruption to Flux.

Install only the SDKs used by your application. None of them are dependencies of the core package.
