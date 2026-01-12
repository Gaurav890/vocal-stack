# ElevenLabs TTS Integration Example

This example demonstrates real-world integration of **vocal-stack** with **ElevenLabs Text-to-Speech API** and **OpenAI's GPT-4**.

## What it demonstrates

- ElevenLabs TTS with custom voice settings
- OpenAI GPT-4 streaming
- Complete pipeline: GPT-4 → vocal-stack → ElevenLabs
- Production-ready ElevenLabs Voice Agent class
- Voice selection and listing
- High-quality audio generation
- Performance tracking

## Prerequisites

1. **ElevenLabs API key**
   - Sign up at [elevenlabs.io](https://elevenlabs.io)
   - Get API key from Settings

2. **OpenAI API key**
   - For GPT-4 access

3. Node.js 18+ installed

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set your API keys:
```bash
export ELEVENLABS_API_KEY=your-elevenlabs-key
export OPENAI_API_KEY=sk-your-openai-key
```

3. Run the example:
```bash
npm start
```

Or in one command:
```bash
ELEVENLABS_API_KEY=... OPENAI_API_KEY=... npm start
```

## What it does

### Example 1: Basic Pipeline

1. Sends prompt to GPT-4
2. Streams response chunks
3. Sanitizes markdown and URLs via vocal-stack
4. Tracks performance metrics
5. Converts to speech with ElevenLabs
6. Saves as `elevenlabs-output.mp3`

### Example 2: Production-Ready Agent

Demonstrates complete `ElevenLabsVoiceAgent` class:
- Voice selection and listing
- Custom TTS settings (stability, similarity, style)
- Clean encapsulation
- Comprehensive error handling
- Statistics tracking

## Generated Files

After running:
- `elevenlabs-output.mp3` - Basic example output
- `agent-output-elevenlabs.mp3` - High-quality agent output

## Code Structure

### Basic Usage

```javascript
import { ElevenLabsClient } from 'elevenlabs';
import { SpeechSanitizer, FlowController, VoiceAuditor } from 'vocal-stack';

const elevenlabs = new ElevenLabsClient({ apiKey: '...' });

// Process through vocal-stack
const pipeline = auditor.track(
  'request-id',
  flowController.wrap(
    sanitizer.sanitizeStream(llmStream)
  )
);

let fullText = '';
for await (const chunk of pipeline) {
  fullText += chunk;
}

// Convert to speech with ElevenLabs
const audio = await elevenlabs.textToSpeech.convert(voiceId, {
  text: fullText,
  model_id: 'eleven_multilingual_v2',
  voice_settings: {
    stability: 0.5,
    similarity_boost: 0.75,
  },
});
```

### Production Class

```javascript
class ElevenLabsVoiceAgent {
  constructor(elevenLabsApiKey, openaiApiKey, voiceId) {
    this.elevenlabs = new ElevenLabsClient({ apiKey: elevenLabsApiKey });
    this.sanitizer = new SpeechSanitizer({...});
    this.flowController = new FlowController({...});
    this.auditor = new VoiceAuditor({...});
    this.voiceId = voiceId;
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

  async convertToSpeech(text, outputFile, options) {
    const audio = await this.elevenlabs.textToSpeech.convert(
      this.voiceId,
      { text, model_id: 'eleven_turbo_v2_5', ... }
    );
    // Save to file...
  }

  async listVoices() {
    return await this.elevenlabs.voices.getAll();
  }
}
```

## ElevenLabs Configuration

### Available Models

| Model | Speed | Quality | Use Case |
|-------|-------|---------|----------|
| `eleven_turbo_v2_5` | Fastest | Good | Real-time applications |
| `eleven_turbo_v2` | Fast | Good | Interactive agents |
| `eleven_multilingual_v2` | Medium | Best | High-quality, multilingual |
| `eleven_monolingual_v1` | Medium | Great | English only |

### Voice Settings

```javascript
{
  stability: 0.5,           // 0-1, higher = more consistent
  similarity_boost: 0.75,   // 0-1, higher = more like original voice
  style: 0.0,               // 0-1, higher = more expressive
  use_speaker_boost: true   // Enhance clarity
}
```

**Recommended Settings**:
- **Narration**: `stability: 0.7, similarity: 0.8, style: 0.3`
- **Conversational**: `stability: 0.5, similarity: 0.75, style: 0.0`
- **Dramatic**: `stability: 0.3, similarity: 0.7, style: 0.8`

### Popular Voices (Pre-made)

- `pNInz6obpgDQGcFmaJgB` - Adam (deep, authoritative)
- `EXAVITQu4vr4xnSDxMaL` - Bella (conversational)
- `TxGEqnHWrfWFTfGW9XjX` - Josh (friendly male)
- `21m00Tcm4TlvDq8ikWAM` - Rachel (calm female)
- `AZnzlk1XvdvUeBnXmlld` - Domi (confident female)

List all voices:
```javascript
const voices = await elevenlabs.voices.getAll();
```

## Benefits of Using vocal-stack

### Without vocal-stack:
```javascript
let text = '';
for await (const chunk of llmStream) {
  text += chunk;
}
await convertToSpeech(text); // Markdown, URLs included!
```

Problems:
- ✗ Markdown formatting spoken aloud
- ✗ URLs spoken character by character
- ✗ Code blocks sent to TTS
- ✗ No performance tracking
- ✗ No filler injection during stalls

### With vocal-stack:
```javascript
const pipeline = auditor.track(
  id,
  flowController.wrap(
    sanitizer.sanitizeStream(llmStream)
  )
);
```

Benefits:
- ✓ Clean, speakable text
- ✓ Natural fillers during LLM stalls
- ✓ Performance metrics
- ✓ Composable pipeline
- ✓ Production-ready

## Cost Considerations

**ElevenLabs Pricing** (as of 2024):

| Tier | Characters/month | Cost |
|------|-----------------|------|
| Free | 10,000 | $0 |
| Starter | 30,000 | $5 |
| Creator | 100,000 | $22 |
| Pro | 500,000 | $99 |
| Scale | 2M+ | Custom |

**GPT-4 Turbo**:
- Input: $10.00 / 1M tokens
- Output: $30.00 / 1M tokens

Example cost for 1000 voice responses (avg 100 words = 500 chars):
- ElevenLabs: ~$11 (Creator tier)
- GPT-4: ~$1.30
- **Total: ~$12.30**

## Streaming Audio (Advanced)

For real-time applications, stream audio chunks:

```javascript
const audioStream = await elevenlabs.textToSpeech.convertAsStream(voiceId, {
  text: chunk,
  model_id: 'eleven_turbo_v2_5',
});

for await (const audioChunk of audioStream) {
  // Play audio chunk immediately
  playAudio(audioChunk);
}
```

## Use Cases

- **Customer Service**: AI voice agents with natural-sounding voices
- **Audiobook Generation**: Convert books to high-quality audio
- **Gaming**: Voice-enabled NPCs with unique voices
- **Education**: Interactive tutors with engaging voices
- **Podcasts**: AI-generated podcast content
- **Accessibility**: Screen readers with premium voices
- **Voicemail/IVR**: Professional phone systems

## Troubleshooting

### "ELEVENLABS_API_KEY not set"
Set your API key: `export ELEVENLABS_API_KEY=...`

### "Quota exceeded"
Check your usage at elevenlabs.io/usage

### Audio quality issues
- Use `eleven_multilingual_v2` for best quality
- Adjust voice settings (stability, similarity)
- Try different voices
- Ensure input text is clean (vocal-stack helps!)

### Slow generation
- Use `eleven_turbo_v2_5` for fastest results
- Consider streaming for real-time applications

## Comparison: ElevenLabs vs OpenAI TTS

| Feature | ElevenLabs | OpenAI TTS |
|---------|-----------|------------|
| Quality | ★★★★★ | ★★★★☆ |
| Speed | ★★★★☆ | ★★★★★ |
| Voices | 100+ pre-made + custom | 6 built-in |
| Languages | 29+ | 57+ |
| Customization | High (stability, style) | Limited (speed only) |
| Cost | Variable ($5-$99/mo) | $15/1M chars |
| Voice cloning | ✓ (paid tiers) | ✗ |

**When to use ElevenLabs**:
- Need highest quality voices
- Want voice customization
- Building premium products
- Need voice cloning

**When to use OpenAI**:
- Need fastest generation
- Want simple integration
- Cost-sensitive projects
- Need many languages

## Next Steps

- Try `07-custom-voice-agent` for a complete implementation
- Clone your own voice (ElevenLabs Pro+)
- Implement streaming audio playback
- Add conversation history for context
- Export metrics for analysis
- A/B test different voices and settings

## Resources

- [ElevenLabs API Docs](https://docs.elevenlabs.io)
- [ElevenLabs Voice Library](https://elevenlabs.io/voice-library)
- [vocal-stack Documentation](../../README.md)
- [OpenAI Chat Completions](https://platform.openai.com/docs/guides/text-generation)
