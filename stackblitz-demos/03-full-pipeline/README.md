# Full Pipeline Demo

Complete demonstration of vocal-stack with all three modules working together.

## What it demonstrates

- **Sanitizer** - Clean markdown, URLs, code blocks from LLM output
- **Flow Control** - Inject natural fillers during stalls
- **Monitoring** - Track performance metrics (TTFT, duration)
- **Visual Pipeline** - See each step activate in real-time
- **Side-by-side comparison** - Raw vs cleaned output

## How to use

### Option 1: Open in StackBlitz

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/gaurav890/vocal-stack/tree/main/stackblitz-demos/03-full-pipeline)

### Option 2: Run Locally

```bash
cd stackblitz-demos/03-full-pipeline
npm install
npm run dev
```

## The Pipeline

```
LLM Stream → Sanitizer → Flow Control → Monitor → TTS Ready
```

### Step by Step

1. **LLM Stream** - Mock LLM generates markdown response
2. **Sanitizer** - Removes markdown, URLs, code blocks
3. **Flow Control** - Detects stalls, injects fillers
4. **Monitor** - Tracks TTFT, duration, token count
5. **TTS Ready** - Clean, speakable text output

## Features

### Visual Pipeline
Watch each step activate as data flows through:
- 🤖 LLM Stream generation
- 🧹 Text sanitization
- ⚡ Flow control & fillers
- 📊 Performance monitoring
- 🔊 TTS-ready output

### Dual Output View
- **Left**: Raw LLM output (with markdown)
- **Right**: Cleaned output (TTS-ready)

See exactly what gets removed!

### Comprehensive Metrics
- **TTFT** - Time to first token
- **Duration** - Total processing time
- **Chunks** - Number of text chunks
- **Fillers** - Number of fillers injected
- **Chars Removed** - Characters stripped
- **Reduction** - Size reduction percentage

## What You'll Learn

### Problem: Raw LLM Output
```
## Welcome!
This is **bold** text.
Visit https://example.com
```

### Solution: Cleaned Output
```
Welcome!
This is bold text.
Visit example.com
```

### Benefits
- ✅ Clean, speakable text
- ✅ Natural flow with fillers
- ✅ Performance tracking
- ✅ Production-ready

## Real-World Application

This pipeline is exactly what you'd use in production:

```javascript
import { SpeechSanitizer, FlowController, VoiceAuditor } from 'vocal-stack';

const sanitizer = new SpeechSanitizer();
const flowController = new FlowController();
const auditor = new VoiceAuditor();

// LLM → Sanitize → Flow → Monitor → TTS
const pipeline = auditor.track(
  'request-id',
  flowController.wrap(
    sanitizer.sanitizeStream(llmStream)
  )
);

for await (const chunk of pipeline) {
  await sendToTTS(chunk);
}
```

## Use Cases

- Voice assistants
- Customer service bots
- Educational AI tutors
- Gaming NPCs
- Accessibility tools
- Content creation

## Learn More

- [vocal-stack on npm](https://www.npmjs.com/package/vocal-stack)
- [Full Documentation](../../README.md)
- [All Examples](../../examples)
- [Basic Sanitizer Demo](../01-basic-sanitizer)
- [Flow Control Demo](../02-flow-control)
