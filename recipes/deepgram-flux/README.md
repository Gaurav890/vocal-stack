# Deepgram Flux interruption

Use `fluxPipeline` to preserve source whitespace and forward normalized deltas without sentence
buffering. `sourceForFlux()` binds a Vocal Stack turn's abort signal to your Flux `Interrupt`
sender and the upstream iterator's `return()` method. Supply a `cancelFlux` callback that sends the
protocol's `Interrupt` message, including the current playback offset when it is available.

Reference: [Deepgram Flux voice-agent integration](https://developers.deepgram.com/docs/flux-tts/voice-agent).
