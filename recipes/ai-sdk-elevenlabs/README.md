# AI SDK + ElevenLabs

Pass the turn's `AbortSignal` into AI SDK `streamText`, then send only `speech.segment` events to
ElevenLabs. This lets barge-in cancel model generation and prevents arbitrary model deltas from
becoming TTS boundaries.

```ts
const turn = pipeline.startTurn({
  id: crypto.randomUUID(),
  source: sourceFromAiSdk(model, prompt),
});

await sendSegmentsToElevenLabs(turn, elevenLabsSocket);
```

Call `turn.acknowledgePlayback(...)` from the audio player, not when text is submitted to TTS. That
keeps `heardText` limited to confirmed playback.

The recipe uses balanced segmentation to feed useful context into ElevenLabs and sends the
documented empty-text message when the turn ends. Configure `chunk_length_schedule` when opening
the socket; lowering it trades synthesis quality for earlier audio.

Reference: [ElevenLabs realtime TTS](https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts).
