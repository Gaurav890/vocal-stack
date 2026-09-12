# Telemetry and OpenTelemetry

The core telemetry schema is intentionally generic. It records timing, lifecycle, counts, and
outcomes without prompts, transcripts, tool arguments, or speech text.

An OpenTelemetry sink can translate stable events into your chosen convention:

```ts
const sink = {
  record(event) {
    if (event.type === 'stage') {
      span.addEvent(`voice.${event.marker.stage}.${event.marker.phase}`, {
        'voice.turn.id': event.turnId,
        'voice.operation.id': event.marker.operationId,
      });
    } else {
      span.setAttributes({
        'voice.turn.outcome': event.metrics.outcome,
        'voice.chunk.count': event.metrics.chunkCount,
        'voice.segment.count': event.metrics.segmentCount,
      });
      span.end();
    }
  },
};
```

Treat the attribute names above as an application recipe, not a promise that they match evolving
GenAI semantic conventions. Review your telemetry backend's retention and access policies before
enabling any content capture outside this package.
