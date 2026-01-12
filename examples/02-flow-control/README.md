# Flow Control Example

This example demonstrates how to use the **Flow Control** module to handle streaming latency, inject natural fillers, and support user interruptions (barge-in).

## What it demonstrates

- Automatic filler injection when LLM stalls
- Barge-in support (user interruption)
- Low-level event-based API for fine-grained control
- State machine transitions (idle → waiting → speaking)

## Key Concepts

### 1. Filler Injection

When the LLM takes too long to respond, inject natural fillers:

```javascript
const controller = new FlowController({
  stallThresholdMs: 700,  // Detect stalls after 700ms
  enableFillers: true,
  fillerPhrases: ['um', 'let me think', 'hmm'],
  onFillerInjected: (filler) => sendToTTS(filler),
});

for await (const chunk of controller.wrap(llmStream)) {
  sendToTTS(chunk);
}
```

### 2. Barge-in Support

Handle user interruptions gracefully:

```javascript
const controller = new FlowController();

// When user interrupts
userInterrupted && controller.interrupt();

// Stream automatically stops
for await (const chunk of controller.wrap(llmStream)) {
  sendToTTS(chunk);
}
```

### 3. Low-Level Event API

For advanced control:

```javascript
const manager = new FlowManager();

manager.on((event) => {
  switch (event.type) {
    case 'stall-detected':
      console.log('LLM is stalling');
      break;
    case 'filler-injected':
      sendToTTS(event.filler);
      break;
    case 'state-change':
      console.log(`${event.from} → ${event.to}`);
      break;
  }
});

manager.start();
manager.processChunk('Hello');
manager.complete();
```

## How to Run

1. Install dependencies:
```bash
npm install
```

2. Run the example:
```bash
npm start
```

## Expected Output

You'll see three examples:
1. Filler injection when LLM stalls (before first chunk)
2. Barge-in interruption (stream stops after 2nd chunk)
3. Low-level event tracking (all state transitions logged)

## Important Rules

- **Fillers are ONLY injected before the first chunk**
- After first chunk is sent, no more fillers (natural flow)
- Interruption clears buffer and stops stream immediately
- State transitions: `idle → waiting → speaking → interrupted`

## Use Cases

- Voice assistants that feel more natural during processing
- Customer service bots with realistic conversation flow
- Interactive voice agents that respond to user interruptions
- Any real-time voice AI application

## Next Steps

- Try `03-monitoring` to track performance metrics
- Explore `04-full-pipeline` to combine with sanitization
