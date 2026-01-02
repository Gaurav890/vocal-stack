# vocal-stack

> High-performance utility library for Voice AI agents

**vocal-stack** solves the "last mile" challenges when building production-ready voice AI agents: text sanitization for TTS, latency management with smart filler injection, and performance monitoring.

Platform-agnostic • Streaming-first • TypeScript strict • 90%+ test coverage

---

## Features

### 🧹 **Text Sanitizer**
Transform LLM output into TTS-optimized strings
- Strip markdown, URLs, code blocks, complex punctuation
- Plugin-based system for extensibility
- Streaming and sync APIs

### ⚡ **Flow Control**
Manage latency with intelligent filler injection
- Detect stream stalls (default 700ms threshold)
- Inject filler phrases ("um", "let me think") only before first chunk
- Handle barge-in with state machine and buffer management
- Dual API: high-level stream wrapper + low-level event-based

### 📊 **Latency Monitoring**
Track and profile voice agent performance
- Measure time to first token (TTFT) and total duration
- Calculate percentiles (p50, p95, p99)
- Export metrics (JSON, CSV)
- Real-time monitoring with callbacks

---

## Installation

```bash
npm install vocal-stack
```

```bash
yarn add vocal-stack
```

```bash
pnpm add vocal-stack
```

**Requirements**: Node.js 18+

## Quick Start

### Text Sanitization

```typescript
import { sanitizeForSpeech } from 'vocal-stack';

const markdown = '## Hello World\nCheck out [this link](https://example.com)';
const speakable = sanitizeForSpeech(markdown);
// Output: "Hello World Check out this link"
```

### Flow Control

```typescript
import { withFlowControl } from 'vocal-stack';

for await (const chunk of withFlowControl(llmStream)) {
  sendToTTS(chunk);
}
```

### Latency Monitoring

```typescript
import { VoiceAuditor } from 'vocal-stack';

const auditor = new VoiceAuditor();

for await (const chunk of auditor.track('request-123', llmStream)) {
  sendToTTS(chunk);
}

console.log(auditor.getSummary()); // { avgTimeToFirstToken: 150, ... }
```

### Composable Architecture

```typescript
import { SpeechSanitizer, FlowController, VoiceAuditor } from 'vocal-stack';

const sanitizer = new SpeechSanitizer({ rules: ['markdown', 'urls'] });
const flowController = new FlowController({
  stallThresholdMs: 700,
  onFillerInjected: (filler) => sendToTTS(filler),
});
const auditor = new VoiceAuditor({ enableRealtime: true });

// Compose: LLM → Sanitize → Flow Control → Monitor → TTS
async function processVoiceStream(llmStream: AsyncIterable<string>) {
  const sanitized = sanitizer.sanitizeStream(llmStream);
  const controlled = flowController.wrap(sanitized);
  const monitored = auditor.track('req-123', controlled);

  for await (const chunk of monitored) {
    await sendToTTS(chunk);
  }

  console.log('Performance:', auditor.getSummary());
}
```

## API Overview

### Sanitizer Module

**High-Level API:**
```typescript
import { sanitizeForSpeech } from 'vocal-stack';

const clean = sanitizeForSpeech(text); // Quick one-liner
```

**Class-Based API:**
```typescript
import { SpeechSanitizer } from 'vocal-stack';

const sanitizer = new SpeechSanitizer({
  rules: ['markdown', 'urls', 'code-blocks', 'punctuation'],
  customReplacements: new Map([['https://', 'link']]),
});

// Sync
const result = sanitizer.sanitize(text);

// Streaming
for await (const chunk of sanitizer.sanitizeStream(llmStream)) {
  console.log(chunk);
}
```

### Flow Module

**High-Level API:**
```typescript
import { FlowController, withFlowControl } from 'vocal-stack';

// Convenience function
for await (const chunk of withFlowControl(llmStream)) {
  sendToTTS(chunk);
}

// Class-based with configuration
const controller = new FlowController({
  stallThresholdMs: 700,
  fillerPhrases: ['um', 'let me think'],
  enableFillers: true,
  onFillerInjected: (filler) => sendToTTS(filler),
});

for await (const chunk of controller.wrap(llmStream)) {
  sendToTTS(chunk);
}

// Barge-in support
controller.interrupt();
```

**Low-Level API:**
```typescript
import { FlowManager } from 'vocal-stack';

const manager = new FlowManager({ stallThresholdMs: 700 });

manager.on((event) => {
  switch (event.type) {
    case 'stall-detected':
      console.log(`Stalled for ${event.durationMs}ms`);
      break;
    case 'filler-injected':
      sendToTTS(event.filler);
      break;
  }
});

manager.start();
for await (const chunk of llmStream) {
  manager.processChunk(chunk);
  sendToTTS(chunk);
}
manager.complete();
```

### Monitor Module

```typescript
import { VoiceAuditor } from 'vocal-stack';

const auditor = new VoiceAuditor({
  enableRealtime: true,
  onMetric: (metric) => console.log(metric),
});

// Automatic tracking with stream wrapper
for await (const chunk of auditor.track('req-123', llmStream)) {
  sendToTTS(chunk);
}

// Get statistics
const summary = auditor.getSummary();
console.log(summary);
// {
//   count: 10,
//   avgTimeToFirstToken: 150,
//   p50TimeToFirstToken: 120,
//   p95TimeToFirstToken: 300,
//   ...
// }

// Export data
const json = auditor.export('json');
const csv = auditor.export('csv');
```

---

## Tree-Shakeable Imports

```typescript
// Import only what you need
import { SpeechSanitizer } from 'vocal-stack/sanitizer';
import { FlowController } from 'vocal-stack/flow';
import { VoiceAuditor } from 'vocal-stack/monitor';
```

---

## Architecture

vocal-stack is built with three independent, composable modules:

```
LLM Stream → Sanitizer → Flow Controller → Monitor → TTS
```

- **Sanitizer**: Cleans text for TTS
- **Flow Controller**: Manages latency and injects fillers
- **Monitor**: Tracks performance metrics

Each module works standalone or together. Use only what you need.

---

## Documentation

- API Reference (coming soon)
- Examples in `./examples/`

---

## License

MIT

---

## Contributing

Contributions welcome! Please open an issue or PR.
