---
title: Building Production-Ready Voice AI Agents with vocal-stack
published: false
description: A new toolkit that solves the "last mile" challenges in voice AI - text sanitization, flow control, and performance monitoring
tags: javascript, ai, opensource, tutorial
cover_image: https://dev-to-uploads.s3.amazonaws.com/uploads/articles/YOUR_COVER_IMAGE.png
canonical_url: https://github.com/gaurav890/vocal-stack
series: Voice AI Development
---

# Building Production-Ready Voice AI Agents with vocal-stack

Have you ever built a voice AI agent and thought, "Why does it sound so... robotic?" 🤖

You've integrated the latest LLM, connected a premium TTS service, but something feels off. The agent speaks markdown syntax ("hash hello"), spells out URLs character by character, and has those awkward silences that make conversations feel unnatural.

I've been there. And that's why I built **vocal-stack** - a toolkit that solves the "last mile" challenges in voice AI.

## The Problem: LLM Output ≠ TTS-Ready Text

Let's look at a typical scenario:

```typescript
// Your beautiful LLM response
const llmOutput = `
## Welcome!

Check out [our docs](https://example.com) for more info.

Here's some code:
\`\`\`javascript
const agent = new VoiceAgent();
\`\`\`

Visit https://example.com to learn more!!!
`;

// Send directly to TTS
await textToSpeech(llmOutput);
```

**What your TTS says:**
> "Hash hash Welcome! Check out open bracket our docs close bracket open parenthesis h-t-t-p-s colon slash slash example dot com close parenthesis..."

😱 Not great, right?

## The Solution: vocal-stack

vocal-stack is a lightweight, platform-agnostic library that handles three critical aspects of voice AI:

### 1. 🧹 Text Sanitization
Clean LLM output for TTS by removing markdown, URLs, code blocks, and complex punctuation.

### 2. ⚡ Flow Control
Manage streaming latency with smart filler injection - say "um" or "let me think" during natural pauses.

### 3. 📊 Performance Monitoring
Track metrics like Time to First Token (TTFT), total duration, and percentiles to optimize your agent.

## Try It Yourself! 🎮

Before diving into code, try these **interactive demos** right in your browser (no installation needed):

### Demo 1: Text Sanitization

{% embed https://stackblitz.com/github/gaurav890/vocal-stack/tree/main/stackblitz-demos/01-basic-sanitizer %}

**What it does:**
- Removes markdown syntax
- Strips URLs and code blocks
- Normalizes punctuation
- Shows before/after comparison with statistics

### Demo 2: Flow Control & Filler Injection

{% embed https://stackblitz.com/github/gaurav890/vocal-stack/tree/main/stackblitz-demos/02-flow-control %}

**What it does:**
- Simulates LLM streaming with stalls
- Injects natural fillers ("um", "let me think")
- Visualizes the timeline of events
- Tracks performance metrics

### Demo 3: Complete Pipeline

{% embed https://stackblitz.com/github/gaurav890/vocal-stack/tree/main/stackblitz-demos/03-full-pipeline %}

**What it does:**
- Shows all three modules working together
- Side-by-side raw vs cleaned output
- Visual pipeline flow
- Real-world performance metrics

## Quick Start

Install the package:

```bash
npm install vocal-stack
```

### Example 1: Basic Text Sanitization

```typescript
import { sanitizeForSpeech } from 'vocal-stack';

const markdown = '## Hello World\nCheck out [this link](https://example.com)';
const speakable = sanitizeForSpeech(markdown);
// Output: "Hello World Check out this link"

await textToSpeech(speakable); // Now it sounds natural! ✨
```

### Example 2: Handling Streaming Latency

```typescript
import { FlowController } from 'vocal-stack/flow';

const controller = new FlowController({
  stallThresholdMs: 700,
  enableFillers: true,
  fillerPhrases: ['um', 'let me think', 'hmm'],
  onFillerInjected: (filler) => {
    textToSpeech(filler); // Inject filler during stalls
  },
});

for await (const chunk of controller.wrap(llmStream)) {
  await textToSpeech(chunk);
}
```

**The magic:** When the LLM takes more than 700ms to respond, vocal-stack automatically injects a natural filler phrase. But **only before the first chunk** - once the agent starts speaking, it continues naturally without interruption.

### Example 3: Performance Monitoring

```typescript
import { VoiceAuditor } from 'vocal-stack/monitor';

const auditor = new VoiceAuditor({
  enableRealtime: true,
  onMetric: (metric) => {
    console.log(`TTFT: ${metric.metrics.timeToFirstToken}ms`);
  },
});

for await (const chunk of auditor.track('request-123', llmStream)) {
  await textToSpeech(chunk);
}

// Get statistics
const summary = auditor.getSummary();
console.log(summary);
// {
//   avgTimeToFirstToken: 150,
//   p95TimeToFirstToken: 300,
//   avgTotalDuration: 2000
// }
```

## Real-World Example: OpenAI Integration

Here's a complete example using OpenAI's GPT-4 and TTS:

```typescript
import OpenAI from 'openai';
import { SpeechSanitizer, FlowController, VoiceAuditor } from 'vocal-stack';

const openai = new OpenAI();

// Setup vocal-stack components
const sanitizer = new SpeechSanitizer({
  rules: ['markdown', 'urls', 'code-blocks']
});

const flowController = new FlowController({
  stallThresholdMs: 1000,
  enableFillers: true,
  onFillerInjected: async (filler) => {
    // Send filler to TTS immediately
    const audio = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: filler,
    });
    playAudio(audio);
  },
});

const auditor = new VoiceAuditor({ enableRealtime: true });

// Get LLM stream
async function* getLLMStream(prompt) {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) yield content;
  }
}

// Process through vocal-stack pipeline
const pipeline = auditor.track(
  'request-id',
  flowController.wrap(
    sanitizer.sanitizeStream(getLLMStream('Hello!'))
  )
);

let fullText = '';
for await (const chunk of pipeline) {
  fullText += chunk;
}

// Convert cleaned text to speech
const mp3 = await openai.audio.speech.create({
  model: 'tts-1',
  voice: 'alloy',
  input: fullText,
});

// Play audio and log metrics
playAudio(mp3);
console.log('Performance:', auditor.getSummary());
```

## Architecture: Composable by Design

The beauty of vocal-stack is its modularity. Each of the three modules works independently:

```
LLM Stream → Sanitizer → Flow Control → Monitor → TTS
```

**Use only what you need:**

```typescript
// Just sanitization
import { SpeechSanitizer } from 'vocal-stack/sanitizer';

// Just flow control
import { FlowController } from 'vocal-stack/flow';

// Just monitoring
import { VoiceAuditor } from 'vocal-stack/monitor';

// All together
import { SpeechSanitizer, FlowController, VoiceAuditor } from 'vocal-stack';
```

Tree-shakeable imports mean you only ship what you use! 📦

## Platform Agnostic

vocal-stack works with **any** LLM or TTS provider:

**LLMs:**
- ✅ OpenAI (GPT-4, GPT-3.5)
- ✅ Anthropic Claude
- ✅ Google Gemini
- ✅ Local LLMs (Ollama, LM Studio)
- ✅ Any streaming text API

**TTS:**
- ✅ OpenAI TTS
- ✅ ElevenLabs
- ✅ Google Cloud TTS
- ✅ Azure TTS
- ✅ AWS Polly
- ✅ Any TTS provider

## Use Cases

vocal-stack is perfect for building:

- 🎙️ **Voice Assistants** - Alexa-like experiences
- 💬 **Customer Service Bots** - AI phone agents
- 🎓 **Educational AI Tutors** - Interactive learning
- 🎮 **Gaming NPCs** - Voice-enabled characters
- ♿ **Accessibility Tools** - Screen readers
- 🎧 **Content Creation** - Blog-to-podcast conversion
- 🏠 **Smart Home Devices** - Custom voice assistants
- 📞 **IVR Systems** - Professional phone systems

## Performance

vocal-stack adds **minimal overhead** (~2-3ms per chunk):

| Operation | Overhead | Impact |
|-----------|----------|--------|
| Text sanitization | < 1ms | Negligible |
| Flow control | < 1ms | Negligible |
| Monitoring | < 0.5ms | Negligible |

For a typical 50-chunk response, total overhead is only ~100-150ms.

## Before vs After

Let me show you a real comparison:

### Without vocal-stack ❌

```typescript
const response = await llm.generate(prompt);
await tts.speak(response);
```

**Problems:**
- ❌ Awkward silences during processing
- ❌ Markdown spoken aloud ("hash hello")
- ❌ URLs spoken character-by-character
- ❌ No performance tracking
- ❌ Manual error handling

### With vocal-stack ✅

```typescript
const pipeline = auditor.track(
  'req-id',
  flowController.wrap(
    sanitizer.sanitizeStream(llmStream)
  )
);

for await (const chunk of pipeline) {
  await tts.speak(chunk);
}
```

**Benefits:**
- ✅ Natural fillers during stalls
- ✅ Clean, speakable text
- ✅ Automatic metrics tracking
- ✅ Composable pipeline
- ✅ Production-ready

## Advanced Features

### Low-Level API for Fine-Grained Control

Need more control? vocal-stack offers a low-level event-based API:

```typescript
import { FlowManager } from 'vocal-stack/flow';

const manager = new FlowManager({ stallThresholdMs: 700 });

manager.on((event) => {
  switch (event.type) {
    case 'stall-detected':
      console.log('LLM is stalling');
      break;
    case 'filler-injected':
      textToSpeech(event.filler);
      break;
    case 'state-change':
      console.log(`State: ${event.from} → ${event.to}`);
      break;
    case 'interrupted':
      cancelTTS(); // Handle barge-in
      break;
  }
});

manager.start();
for await (const chunk of llmStream) {
  manager.processChunk(chunk);
}
manager.complete();
```

### Barge-In Support

Handle user interruptions gracefully:

```typescript
const controller = new FlowController();

// User interrupts
userSpeaksDetected && controller.interrupt();

// Stream automatically stops, buffer cleared
```

### Custom Sanitization Rules

Add your own text transformations:

```typescript
const sanitizer = new SpeechSanitizer({
  rules: ['markdown', 'urls', 'code-blocks'],
  customReplacements: new Map([
    ['https://', 'link at '],
    ['$', 'dollars'],
    ['@', 'at'],
  ]),
});
```

## Production-Ready Features

vocal-stack is built for production:

- ✅ **TypeScript strict mode** - Full type safety
- ✅ **90%+ test coverage** - Thoroughly tested
- ✅ **ESM + CommonJS** - Works everywhere
- ✅ **Tree-shakeable** - Only ship what you use
- ✅ **Zero dependencies** - Lightweight
- ✅ **Node.js 18+** - Modern runtime support

## Examples & Documentation

The package includes:

- **7 comprehensive examples** - From basic to production-ready
- **3 interactive demos** - Try in browser, no installation
- **Complete API documentation** - Every feature documented
- **OpenAI integration example** - Real-world usage
- **ElevenLabs integration example** - Premium TTS
- **Custom voice agent template** - Production pattern

Check them out:
- 📚 [GitHub Repository](https://github.com/gaurav890/vocal-stack)
- 🎮 [Interactive Demos](https://github.com/gaurav890/vocal-stack/tree/main/stackblitz-demos)
- 📖 [Full Documentation](https://github.com/gaurav890/vocal-stack#readme)
- 📦 [npm Package](https://www.npmjs.com/package/vocal-stack)

## Installation

```bash
npm install vocal-stack
```

**Requirements:** Node.js 18+

## Contributing

vocal-stack is open source (MIT license) and welcomes contributions:

- 🐛 Report bugs
- 💡 Suggest features
- 📖 Improve docs
- 💻 Submit PRs
- ⭐ Star the repo!

## Try It Now!

The best way to understand vocal-stack is to **try it yourself**:

1. **Interactive Demos** (no installation):
   - [Text Sanitizer Demo](https://stackblitz.com/github/gaurav890/vocal-stack/tree/main/stackblitz-demos/01-basic-sanitizer)
   - [Flow Control Demo](https://stackblitz.com/github/gaurav890/vocal-stack/tree/main/stackblitz-demos/02-flow-control)
   - [Full Pipeline Demo](https://stackblitz.com/github/gaurav890/vocal-stack/tree/main/stackblitz-demos/03-full-pipeline)

2. **Quick start with npm**:
   ```bash
   npm install vocal-stack
   ```

3. **Clone the examples**:
   ```bash
   git clone https://github.com/gaurav890/vocal-stack
   cd vocal-stack/examples/01-basic-sanitizer
   npm install && npm start
   ```

## What's Next?

I'm actively working on:
- More TTS provider examples (Google, Azure, AWS)
- Plugin system for custom sanitization rules
- WebSocket integration helpers
- More interactive demos

## Conclusion

Building voice AI agents is exciting, but the "last mile" challenges can be frustrating. vocal-stack handles the boring but critical stuff - text sanitization, latency management, and performance monitoring - so you can focus on building amazing voice experiences.

Whether you're building a voice assistant, customer service bot, or interactive NPC, vocal-stack makes your agents sound more natural and professional.

Give it a try and let me know what you think! 🚀

---

## Links & Resources

- 🌐 **GitHub**: [github.com/gaurav890/vocal-stack](https://github.com/gaurav890/vocal-stack)
- 📦 **npm**: [npmjs.com/package/vocal-stack](https://www.npmjs.com/package/vocal-stack)
- 🎮 **Live Demos**: [Try in browser](https://github.com/gaurav890/vocal-stack/tree/main/stackblitz-demos)
- 📖 **Documentation**: [Full docs](https://github.com/gaurav890/vocal-stack#readme)

---

*Have questions or feedback? Drop a comment below or open an issue on GitHub!* 💬

#VoiceAI #LLM #TTS #JavaScript #TypeScript #OpenAI #ElevenLabs #OpenSource
