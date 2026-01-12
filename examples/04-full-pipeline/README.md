# Full Pipeline Example

This example demonstrates how to combine **all three modules** (Sanitizer, Flow Control, and Monitor) into a complete, production-ready voice AI pipeline.

## What it demonstrates

- Composing all three modules together
- Side-by-side comparison (with vs without vocal-stack)
- Production-ready VoiceAgent class pattern
- Complete LLM → TTS pipeline
- Real-world integration patterns

## Key Concepts

### 1. Composable Pipeline

The beauty of vocal-stack is how easily the modules compose:

```javascript
const sanitized = sanitizer.sanitizeStream(llmStream);
const controlled = flowController.wrap(sanitized);
const monitored = auditor.track(requestId, controlled);

for await (const chunk of monitored) {
  sendToTTS(chunk);
}
```

**Flow**: `LLM → Sanitizer → Flow Control → Monitor → TTS`

### 2. With vs Without Comparison

**Without vocal-stack:**
- ✗ Awkward silences during LLM processing
- ✗ Markdown symbols spoken aloud
- ✗ URLs and code blocks sent to TTS
- ✗ No performance tracking

**With vocal-stack:**
- ✓ Natural fillers during stalls
- ✓ Clean, speakable text
- ✓ Unspeakable content removed
- ✓ Complete performance metrics

### 3. Production-Ready Pattern

Wrap everything in a clean class:

```javascript
class VoiceAgent {
  constructor() {
    this.sanitizer = new SpeechSanitizer({...});
    this.flowController = new FlowController({...});
    this.auditor = new VoiceAuditor({...});
  }

  async processRequest(requestId, llmStream) {
    const pipeline = this.auditor.track(
      requestId,
      this.flowController.wrap(
        this.sanitizer.sanitizeStream(llmStream)
      )
    );

    for await (const chunk of pipeline) {
      await this.sendToTTS(chunk);
    }
  }

  interrupt() {
    this.flowController.interrupt();
  }

  getStats() {
    return this.auditor.getSummary();
  }
}
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

1. **Full Pipeline**: Complete composable pipeline with all modules
   - LLM output with markdown and URLs
   - Automatic sanitization
   - Filler injection on stalls
   - Performance tracking
   - Clean TTS output

2. **Comparison**: Side-by-side demonstration
   - Raw output (problems highlighted)
   - Processed output (benefits highlighted)

3. **Production Pattern**: VoiceAgent class
   - Clean encapsulation
   - Easy to use
   - All features integrated

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Voice Agent                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────┐   ┌──────────┐   ┌──────┐   ┌─────────┐ │
│  │ LLM  │ → │Sanitizer │ → │ Flow │ → │ Monitor │ │
│  └──────┘   └──────────┘   └──────┘   └─────────┘ │
│                                           │         │
│                                           ↓         │
│                                        ┌─────┐     │
│                                        │ TTS │     │
│                                        └─────┘     │
└─────────────────────────────────────────────────────┘
```

## Benefits of Composable Design

1. **Use what you need**: Each module works independently
2. **Easy testing**: Test modules separately
3. **Clear separation**: Each module has one job
4. **Extensible**: Add custom processing steps
5. **Type-safe**: Full TypeScript support

## Use Cases

- **Customer Service Bots**: Natural conversations with proper flow
- **Voice Assistants**: Handle markdown from LLM responses
- **Educational Agents**: Track performance and optimize
- **Gaming NPCs**: Voice-enabled characters with natural timing
- **Accessibility Tools**: Convert text content to clean speech

## Performance Impact

vocal-stack adds minimal overhead:
- Sanitization: < 1ms per chunk
- Flow control: < 1ms per chunk
- Monitoring: < 0.5ms per chunk

**Total overhead: ~2-3ms per chunk** (negligible for voice applications)

## Next Steps

- Try `05-openai-tts` for real OpenAI integration
- Try `06-elevenlabs-tts` for ElevenLabs integration
- Adapt the VoiceAgent pattern for your use case
- Add custom sanitization rules for your domain
- Export metrics and analyze performance trends

## Key Takeaways

1. All three modules work seamlessly together
2. Composable pipeline pattern is clean and maintainable
3. Each module is optional (use what you need)
4. Production-ready class pattern is easy to implement
5. Minimal performance overhead
6. Type-safe and well-tested
