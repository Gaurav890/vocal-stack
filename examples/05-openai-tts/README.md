# OpenAI TTS Integration Example

This example demonstrates real-world integration of **vocal-stack** with **OpenAI's Chat Completion API** and **Text-to-Speech API**.

## What it demonstrates

- OpenAI Chat Completion streaming
- Text sanitization for OpenAI TTS
- Complete pipeline: GPT-4 → vocal-stack → OpenAI TTS
- Production-ready OpenAI Voice Agent class
- Audio file generation
- Performance tracking for OpenAI API calls

## Prerequisites

1. OpenAI API key with access to:
   - Chat Completions (GPT-4 or GPT-3.5-turbo)
   - Text-to-Speech (TTS-1 or TTS-1-HD)

2. Node.js 18+ installed

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set your OpenAI API key:
```bash
export OPENAI_API_KEY=sk-your-key-here
```

3. Run the example:
```bash
npm start
```

Or in one command:
```bash
OPENAI_API_KEY=sk-your-key-here npm start
```

## What it does

### Example 1: Basic Pipeline

1. Sends prompt to GPT-4
2. Streams response chunks
3. Sanitizes markdown and URLs
4. Tracks performance
5. Converts cleaned text to speech
6. Saves audio as `openai-output.mp3`

### Example 2: Production-Ready Agent

Demonstrates a complete `OpenAIVoiceAgent` class:
- Clean encapsulation
- Configurable TTS settings
- Comprehensive error handling
- Statistics tracking
- Easy to integrate

## Generated Files

After running, you'll have:
- `openai-output.mp3` - Audio from Example 1
- `agent-output.mp3` - Audio from Example 2 (higher quality, different voice)

## Code Structure

### Basic Usage

```javascript
import OpenAI from 'openai';
import { SpeechSanitizer, FlowController, VoiceAuditor } from 'vocal-stack';

const openai = new OpenAI();

// Get streaming response
async function* getOpenAIStream(prompt) {
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

// Process through vocal-stack
const pipeline = auditor.track(
  'request-id',
  flowController.wrap(
    sanitizer.sanitizeStream(getOpenAIStream(prompt))
  )
);

let fullText = '';
for await (const chunk of pipeline) {
  fullText += chunk;
}

// Convert to speech
const mp3 = await openai.audio.speech.create({
  model: 'tts-1',
  voice: 'alloy',
  input: fullText,
});
```

### Production Class

```javascript
class OpenAIVoiceAgent {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
    this.sanitizer = new SpeechSanitizer({...});
    this.flowController = new FlowController({...});
    this.auditor = new VoiceAuditor({...});
  }

  async processVoiceRequest(requestId, messages) {
    const llmStream = this.streamCompletion(messages);
    const pipeline = this.auditor.track(
      requestId,
      this.flowController.wrap(
        this.sanitizer.sanitizeStream(llmStream)
      )
    );

    let fullText = '';
    for await (const chunk of pipeline) {
      fullText += chunk;
    }

    return fullText;
  }

  async convertToSpeech(text, outputFile) {
    const mp3 = await this.openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: 'nova',
      input: text,
    });
    // Save to file...
  }
}
```

## OpenAI TTS Configuration

### Available Voices
- `alloy` - Neutral, balanced
- `echo` - Male, warm
- `fable` - British accent
- `onyx` - Deep, authoritative
- `nova` - Female, friendly
- `shimmer` - Soft, expressive

### Models
- `tts-1` - Fast, standard quality
- `tts-1-hd` - Slower, higher quality

### Speed
- Range: 0.25 to 4.0
- Default: 1.0

Example:
```javascript
await openai.audio.speech.create({
  model: 'tts-1-hd',
  voice: 'nova',
  input: text,
  speed: 1.2, // 20% faster
});
```

## Benefits of Using vocal-stack

### Without vocal-stack:
```javascript
const stream = await openai.chat.completions.create({...});
let text = '';
for await (const chunk of stream) {
  text += chunk.choices[0]?.delta?.content || '';
}
await convertToSpeech(text); // Markdown, URLs included!
```

Problems:
- ✗ Markdown spoken aloud ("hash hello", "asterisk asterisk bold")
- ✗ URLs spoken character by character
- ✗ Code blocks sent to TTS
- ✗ No latency tracking
- ✗ No filler injection

### With vocal-stack:
```javascript
const pipeline = auditor.track(
  id,
  flowController.wrap(
    sanitizer.sanitizeStream(openaiStream)
  )
);
```

Benefits:
- ✓ Clean, speakable text
- ✓ Natural fillers during stalls
- ✓ Performance metrics
- ✓ Composable pipeline
- ✓ Production-ready

## Cost Considerations

**GPT-4 Turbo (128K)**:
- Input: $10.00 / 1M tokens
- Output: $30.00 / 1M tokens

**TTS-1**:
- $15.00 / 1M characters

**TTS-1-HD**:
- $30.00 / 1M characters

Example cost for 1000 voice responses (avg 100 words each):
- GPT-4: ~$0.30
- TTS-1: ~$1.00
- **Total: ~$1.30**

## Use Cases

- **Customer Support**: AI voice agents that sound natural
- **Education**: Interactive tutors with voice
- **Accessibility**: Convert documentation to audio
- **Content Creation**: Turn blog posts into podcasts
- **Gaming**: Voice-enabled NPCs
- **Smart Home**: Custom voice assistants

## Troubleshooting

### "OPENAI_API_KEY not set"
Set your API key: `export OPENAI_API_KEY=sk-...`

### "Insufficient quota"
Check your OpenAI billing at platform.openai.com

### Audio quality issues
- Use `tts-1-hd` for better quality
- Try different voices
- Adjust speed (0.9-1.1 range is most natural)

## Next Steps

- Try `06-elevenlabs-tts` for ElevenLabs integration
- Customize sanitization rules for your use case
- Add conversation history for multi-turn dialogs
- Implement streaming audio playback
- Add error handling and retry logic
- Export metrics for analysis

## Resources

- [OpenAI TTS Docs](https://platform.openai.com/docs/guides/text-to-speech)
- [OpenAI Chat Completions](https://platform.openai.com/docs/guides/text-generation)
- [vocal-stack Documentation](../../README.md)
