# vocal-stack

High-performance utility library for Voice AI agents.

## Overview

**vocal-stack** is a comprehensive toolkit for building Voice AI agents, handling the "last mile" challenges:
- **Text Sanitization**: Transform LLM output into TTS-optimized strings
- **Flow Control**: Manage latency with smart filler injection
- **Latency Monitoring**: Track and profile voice agent performance
- **Barge-in Support**: Handle interruptions gracefully

## Features

- **Platform-Agnostic**: Works with any TTS provider (OpenAI, ElevenLabs, Google/Azure/AWS)
- **Streaming-First**: Minimize Time to First Token (TTFT)
- **Composable**: Use modules independently or together
- **TypeScript**: Full type safety with strict mode
- **Well-Tested**: 90%+ test coverage

## Installation

```bash
npm install vocal-stack
```

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

## Documentation

Coming soon!

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
