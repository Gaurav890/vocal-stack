# Flow Control Demo

Interactive demo showcasing vocal-stack's intelligent filler injection and flow control.

## What it demonstrates

- Real-time LLM stream simulation
- Automatic stall detection
- Smart filler injection ("um", "let me think")
- Visual timeline of events
- Performance metrics (TTFT, stalls, fillers)

## How to use

### Option 1: Open in StackBlitz

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/gaurav890/vocal-stack/tree/main/stackblitz-demos/02-flow-control)

### Option 2: Run Locally

```bash
cd stackblitz-demos/02-flow-control
npm install
npm run dev
```

## Features

### Configurable Parameters

- **Stall Threshold** - Time before a stall is detected (default: 1000ms)
- **Enable Fillers** - Toggle filler injection on/off
- **Chunk Delay** - Simulate LLM chunk timing (default: 200ms)
- **Initial Stall** - Simulate thinking time before first chunk (default: 1500ms)

### Visual Feedback

- **Live Output** - See chunks and fillers appear in real-time
- **Timeline** - Visual representation of the stream
  - Blue = Text chunks
  - Orange = Fillers
  - Red = Stalls detected
- **Statistics** - Track performance metrics

### Key Insights

**Fillers are only injected BEFORE the first chunk!**

This is intentional - once the agent starts speaking, it sounds more natural to continue without interruption.

## How It Works

1. **Stream starts** - LLM begins generating response
2. **Stall detected** - If no chunk arrives within threshold
3. **Filler injected** - Natural phrase like "um" or "let me think"
4. **First chunk** - LLM output arrives
5. **Continue** - No more fillers, just natural flow

## Experiment!

Try different configurations:

1. **Long initial stall** (2000ms+) with fillers enabled
   - See how fillers make the experience natural

2. **Short stall threshold** (300ms) with fast chunks
   - No fillers needed, smooth flow

3. **Disable fillers** with long stall
   - Notice the awkward silence

4. **Slow chunks** (1000ms) with fillers enabled
   - Only first stall gets a filler!

## Use Cases

- Voice assistants (Alexa-like)
- Customer service bots
- Educational AI tutors
- Gaming NPCs with voice
- Any real-time voice application

## Learn More

- [vocal-stack on npm](https://www.npmjs.com/package/vocal-stack)
- [Full Documentation](../../README.md)
- [Flow Control Examples](../../examples/02-flow-control)
