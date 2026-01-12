# Custom Voice Agent Example

This example demonstrates how to build a **production-ready conversational voice agent** using vocal-stack. This is the most comprehensive example, showing all features working together in a real-world application.

## What it demonstrates

- Complete conversational agent with multi-turn context
- Event-driven architecture for flexibility
- Custom TTS provider integration
- Barge-in (interruption) support
- Conversation history management
- Error handling and retry logic
- Performance monitoring and metrics export
- Production-ready code patterns

## Files

- `agent.js` - `CustomVoiceAgent` class (reusable agent implementation)
- `index.js` - Usage examples and demonstrations
- `README.md` - This file

## Features

### CustomVoiceAgent Class

A complete, production-ready voice agent with:

✓ **Multi-turn conversations** - Maintains conversation history with configurable length
✓ **Auto-sanitization** - Cleans LLM output for TTS
✓ **Natural flow** - Fillers during stalls, smooth transitions
✓ **Barge-in support** - Interrupt agent mid-response
✓ **Event-driven** - React to agent events (chunks, fillers, metrics)
✓ **Flexible TTS** - Plug in any TTS provider
✓ **Monitoring** - Track performance metrics
✓ **Error handling** - Graceful error recovery

## Prerequisites

1. OpenAI API key (for GPT-4 and optionally TTS)
2. Node.js 18+ installed

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set your API key:
```bash
export OPENAI_API_KEY=sk-your-key-here
```

3. Run the examples:
```bash
npm start
```

## Code Structure

### Creating an Agent

```javascript
import { CustomVoiceAgent } from './agent.js';

const agent = new CustomVoiceAgent({
  openaiApiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4-turbo',
  systemPrompt: 'You are a helpful assistant.',
  maxHistoryLength: 10,
  sanitizerRules: ['markdown', 'urls', 'code-blocks'],
  stallThresholdMs: 1000,
  enableFillers: true,
  fillerPhrases: ['um', 'let me think', 'hmm'],
  enableMonitoring: true,
  ttsProvider: async (text) => {
    // Your TTS implementation
  },
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `openaiApiKey` | string | `process.env.OPENAI_API_KEY` | OpenAI API key |
| `model` | string | `'gpt-4-turbo'` | LLM model to use |
| `systemPrompt` | string | `'You are a helpful voice assistant.'` | System prompt for agent |
| `maxHistoryLength` | number | `10` | Max messages to keep in history |
| `sanitizerRules` | array | `['markdown', 'urls', 'code-blocks']` | Text sanitization rules |
| `stallThresholdMs` | number | `1000` | Stall detection threshold |
| `enableFillers` | boolean | `true` | Enable filler injection |
| `fillerPhrases` | array | `['um', 'let me think', ...]` | Filler phrases to use |
| `enableMonitoring` | boolean | `true` | Enable performance tracking |
| `ttsProvider` | function | `null` | Custom TTS function |

### Event Handling

The agent emits events for various actions:

```javascript
// Request lifecycle
agent.on('request-start', (data) => {
  console.log(`Processing: ${data.message}`);
});

agent.on('chunk', (data) => {
  console.log(`Chunk: ${data.chunk}`);
});

agent.on('request-complete', (data) => {
  console.log(`Response: ${data.response}`);
});

// Flow control
agent.on('filler-injected', (data) => {
  console.log(`Filler: ${data.filler}`);
});

agent.on('interrupted', (data) => {
  console.log('User interrupted');
});

// Monitoring
agent.on('metric', (metric) => {
  console.log(`TTFT: ${metric.metrics.timeToFirstToken}ms`);
});

// Errors
agent.on('error', (data) => {
  console.error(`Error: ${data.error.message}`);
});

// Other
agent.on('history-cleared', () => {
  console.log('History cleared');
});

agent.on('audio-saved', (data) => {
  console.log(`Audio saved: ${data.filename}`);
});
```

### Basic Usage

```javascript
// Simple chat
const response = await agent.chat('Hello, how are you?');
console.log(response.text);

// With custom request ID
const response2 = await agent.chat('Tell me a joke', 'req-123');

// Get conversation history
const history = agent.getHistory();

// Clear history
agent.clearHistory();

// Interrupt processing
agent.interrupt();

// Get statistics
const stats = agent.getStats();

// Export metrics
const json = agent.exportMetrics('json');
const csv = agent.exportMetrics('csv');
```

## Examples

### Example 1: Basic Conversational Agent

Multi-turn conversation with event listeners:

```javascript
const agent = new CustomVoiceAgent({
  openaiApiKey: process.env.OPENAI_API_KEY,
  systemPrompt: 'You are a friendly voice assistant.',
});

agent.on('chunk', (data) => {
  process.stdout.write(data.chunk);
});

await agent.chat('Hello!');
await agent.chat('Tell me about AI.');
await agent.chat('That\'s interesting!');
```

### Example 2: With TTS Provider

Integrate with OpenAI TTS:

```javascript
import OpenAI from 'openai';

const openai = new OpenAI();
const audioChunks = [];

async function ttsProvider(text) {
  const mp3 = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'alloy',
    input: text,
  });

  const buffer = Buffer.from(await mp3.arrayBuffer());
  audioChunks.push(buffer);
}

const agent = new CustomVoiceAgent({
  ttsProvider,
});

await agent.chat('Hello world!');

// Save combined audio
const audio = Buffer.concat(audioChunks);
await writeFile('output.mp3', audio);
```

### Example 3: Barge-in Support

Handle user interruptions:

```javascript
const agent = new CustomVoiceAgent({
  systemPrompt: 'Give detailed, verbose responses.',
});

agent.on('interrupted', () => {
  console.log('User interrupted!');
});

// Start long response
const promise = agent.chat('Tell me everything about...');

// Interrupt after 1 second
setTimeout(() => agent.interrupt(), 1000);

await promise;
```

### Example 4: Context-Aware Conversation

Multi-turn conversation with context:

```javascript
const agent = new CustomVoiceAgent({
  systemPrompt: 'You are a helpful tutor. Remember context.',
  maxHistoryLength: 10,
});

await agent.chat('What is Python?');
await agent.chat('What are its use cases?');
await agent.chat('How does it compare to JavaScript?');
await agent.chat('Which should I learn first?');

// Agent remembers all previous context
const history = agent.getHistory();
console.log(`${history.length} messages in history`);
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CustomVoiceAgent                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐   ┌──────────────────┐              │
│  │ Conversation     │   │ Event Emitter    │              │
│  │ History Manager  │   │ (request events) │              │
│  └──────────────────┘   └──────────────────┘              │
│                                                             │
│  ┌──────┐   ┌──────────┐   ┌──────┐   ┌─────────┐       │
│  │ LLM  │ → │Sanitizer │ → │ Flow │ → │ Monitor │       │
│  │(GPT-4)│   │(vocal-  │   │(vocal│   │(vocal-  │       │
│  └──────┘   │stack)    │   │stack)│   │stack)   │       │
│             └──────────┘   └──────┘   └─────────┘       │
│                                           │               │
│                                           ↓               │
│                                    ┌─────────────┐       │
│                                    │ TTS Provider│       │
│                                    │ (pluggable) │       │
│                                    └─────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Advanced Usage

### Custom Sanitization Rules

```javascript
const agent = new CustomVoiceAgent({
  sanitizerRules: ['markdown', 'urls', 'code-blocks', 'emails', 'numbers'],
});
```

### Multiple Agents

Run multiple agents simultaneously:

```javascript
const englishAgent = new CustomVoiceAgent({
  systemPrompt: 'You speak English.',
});

const spanishAgent = new CustomVoiceAgent({
  systemPrompt: 'You speak Spanish.',
});
```

### Retry Logic

Add retry on errors:

```javascript
agent.on('error', async (data) => {
  console.log('Error occurred, retrying...');
  await agent.chat(data.message); // Retry
});
```

### Streaming Audio

For real-time applications:

```javascript
async function streamingTTS(text) {
  // Send text to TTS immediately
  // Play audio as it becomes available
  const audioStream = await ttsProvider.stream(text);
  for await (const chunk of audioStream) {
    playAudioChunk(chunk);
  }
}

const agent = new CustomVoiceAgent({
  ttsProvider: streamingTTS,
});
```

## Production Considerations

### 1. Error Handling

Always handle errors:
```javascript
try {
  await agent.chat(userInput);
} catch (error) {
  console.error('Chat failed:', error);
  // Notify user, log error, retry, etc.
}
```

### 2. Rate Limiting

Respect API limits:
```javascript
const rateLimit = new RateLimiter({ requestsPerSecond: 10 });

agent.on('request-start', async () => {
  await rateLimit.wait();
});
```

### 3. Conversation Persistence

Save conversation history:
```javascript
const history = agent.getHistory();
await saveToDatabase(userId, history);

// Later, restore:
agent.conversationHistory = loadFromDatabase(userId);
```

### 4. Security

Sanitize user input:
```javascript
function sanitizeInput(text) {
  // Remove dangerous content
  return text.replace(/[<>]/g, '');
}

await agent.chat(sanitizeInput(userInput));
```

### 5. Monitoring

Export and analyze metrics:
```javascript
setInterval(() => {
  const metrics = agent.exportMetrics('json');
  sendToMonitoringService(metrics);
}, 60000); // Every minute
```

## Use Cases

- **Customer Support**: AI phone agents for support calls
- **Virtual Assistants**: Smart home voice assistants
- **Education**: Interactive tutors and learning companions
- **Healthcare**: Medical information assistants
- **Gaming**: Voice-enabled NPCs and companions
- **Accessibility**: Voice interfaces for disabled users
- **Content Creation**: Podcast hosts, narrators
- **E-commerce**: Shopping assistants

## Troubleshooting

### Agent won't respond
- Check API key is set
- Verify network connection
- Check OpenAI service status

### Audio quality issues
- Use higher quality TTS model
- Ensure text is properly sanitized
- Check audio encoding settings

### High latency
- Use faster LLM model (gpt-3.5-turbo)
- Enable fillers for better UX
- Consider local LLM for lower latency

### Memory issues with long conversations
- Reduce `maxHistoryLength`
- Periodically clear history
- Summarize old messages

## Next Steps

1. **Customize the agent** for your use case
2. **Add voice input** (speech-to-text)
3. **Implement streaming audio** for lower latency
4. **Add authentication** and user management
5. **Deploy to production** (Docker, serverless, etc.)
6. **Scale horizontally** (multiple agent instances)
7. **Add analytics** and A/B testing
8. **Integrate with your platform** (web, mobile, phone)

## Resources

- [vocal-stack Documentation](../../README.md)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [Node.js EventEmitter](https://nodejs.org/api/events.html)
- [Production AI Best Practices](https://platform.openai.com/docs/guides/production-best-practices)

## License

This example is part of vocal-stack and uses the same MIT license.
