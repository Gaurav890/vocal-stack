# vocal-stack Examples

Welcome to the vocal-stack examples! These examples demonstrate how to use vocal-stack to build production-ready voice AI applications.

## Quick Start

Each example is self-contained with its own `package.json`, code, and documentation.

```bash
# Navigate to any example
cd 01-basic-sanitizer

# Install dependencies
npm install

# Run the example
npm start
```

## Examples Overview

### 1. Basic Sanitizer
**Directory**: [`01-basic-sanitizer/`](./01-basic-sanitizer)

Learn the fundamentals of text sanitization for TTS.

**What you'll learn**:
- Quick sanitization with `sanitizeForSpeech()`
- Custom sanitizer configuration
- Streaming sanitization for LLM output
- Removing markdown, URLs, and code blocks

**Best for**: Getting started with vocal-stack

[View Example →](./01-basic-sanitizer)

---

### 2. Flow Control
**Directory**: [`02-flow-control/`](./02-flow-control)

Handle streaming latency and user interruptions gracefully.

**What you'll learn**:
- Automatic filler injection on stalls
- Barge-in (interruption) support
- State machine transitions
- Low-level event-based API

**Best for**: Building natural-feeling voice agents

[View Example →](./02-flow-control)

---

### 3. Monitoring
**Directory**: [`03-monitoring/`](./03-monitoring)

Track performance metrics and analyze voice agent latency.

**What you'll learn**:
- Automatic stream tracking
- Manual tracking for fine control
- Real-time metric callbacks
- Summary statistics (averages, percentiles)
- Data export (JSON, CSV)

**Best for**: Optimizing performance and tracking improvements

[View Example →](./03-monitoring)

---

### 4. Full Pipeline
**Directory**: [`04-full-pipeline/`](./04-full-pipeline)

Combine all three modules into a complete voice pipeline.

**What you'll learn**:
- Composing Sanitizer → Flow → Monitor
- Side-by-side comparison (with vs without vocal-stack)
- Production-ready VoiceAgent class pattern
- Benefits of modular architecture

**Best for**: Understanding how everything works together

[View Example →](./04-full-pipeline)

---

### 5. OpenAI TTS Integration
**Directory**: [`05-openai-tts/`](./05-openai-tts)

Real-world integration with OpenAI's GPT-4 and TTS APIs.

**What you'll learn**:
- OpenAI Chat Completion streaming
- OpenAI TTS integration
- Complete GPT-4 → vocal-stack → TTS pipeline
- Audio file generation
- Voice and model selection

**Best for**: Building with OpenAI's APIs

**Requirements**: OpenAI API key

[View Example →](./05-openai-tts)

---

### 6. ElevenLabs TTS Integration
**Directory**: [`06-elevenlabs-tts/`](./06-elevenlabs-tts)

Real-world integration with ElevenLabs TTS and OpenAI GPT-4.

**What you'll learn**:
- ElevenLabs TTS with custom voice settings
- Voice listing and selection
- High-quality audio generation
- Comparison with OpenAI TTS

**Best for**: Building with premium TTS voices

**Requirements**: ElevenLabs API key + OpenAI API key

[View Example →](./06-elevenlabs-tts)

---

### 7. Custom Voice Agent
**Directory**: [`07-custom-voice-agent/`](./07-custom-voice-agent)

Complete production-ready conversational voice agent.

**What you'll learn**:
- Multi-turn conversations with context
- Event-driven architecture
- Custom TTS provider integration
- Barge-in support
- Conversation history management
- Error handling and retry logic
- Metrics export

**Best for**: Building production applications

**Requirements**: OpenAI API key

[View Example →](./07-custom-voice-agent)

---

## Learning Path

### Beginner
Start here if you're new to vocal-stack:

1. **Basic Sanitizer** - Learn text cleaning
2. **Flow Control** - Understand latency handling
3. **Monitoring** - Track performance

### Intermediate
Once you understand the basics:

4. **Full Pipeline** - See all modules working together
5. **OpenAI TTS** - Real-world integration

### Advanced
For production applications:

6. **ElevenLabs TTS** - Premium voice quality
7. **Custom Voice Agent** - Complete agent implementation

---

## Common Setup

Most examples require environment variables:

```bash
# OpenAI API key (for examples 5, 6, 7)
export OPENAI_API_KEY=sk-your-key-here

# ElevenLabs API key (for example 6)
export ELEVENLABS_API_KEY=your-key-here
```

Or set them inline:
```bash
OPENAI_API_KEY=sk-... npm start
```

---

## Quick Reference

### Use Case → Example

| Use Case | Recommended Example |
|----------|-------------------|
| Clean LLM output for TTS | 1. Basic Sanitizer |
| Handle streaming delays | 2. Flow Control |
| Track performance | 3. Monitoring |
| Understand vocal-stack | 4. Full Pipeline |
| Build with OpenAI | 5. OpenAI TTS |
| Premium voice quality | 6. ElevenLabs TTS |
| Production agent | 7. Custom Voice Agent |

### TTS Provider → Example

| Provider | Example |
|----------|---------|
| OpenAI TTS | 5. OpenAI TTS Integration |
| ElevenLabs | 6. ElevenLabs TTS Integration |
| Custom/Generic | 4. Full Pipeline, 7. Custom Voice Agent |

### Complexity Level

| Level | Examples |
|-------|----------|
| Simple | 1, 2, 3 |
| Medium | 4, 5, 6 |
| Advanced | 7 |

---

## Example Features Matrix

|  | Sanitizer | Flow | Monitor | TTS | Multi-turn | Events |
|---|-----------|------|---------|-----|------------|--------|
| **01-basic-sanitizer** | ✓ | | | | | |
| **02-flow-control** | | ✓ | | | | ✓ |
| **03-monitoring** | | | ✓ | | | ✓ |
| **04-full-pipeline** | ✓ | ✓ | ✓ | Mock | | |
| **05-openai-tts** | ✓ | ✓ | ✓ | OpenAI | | ✓ |
| **06-elevenlabs-tts** | ✓ | ✓ | ✓ | ElevenLabs | | ✓ |
| **07-custom-voice-agent** | ✓ | ✓ | ✓ | Pluggable | ✓ | ✓ |

---

## Tips for Learning

1. **Start Simple**: Begin with examples 1-3 to understand individual modules

2. **Run the Code**: Don't just read - run each example and observe the output

3. **Modify and Experiment**: Change parameters, try different inputs

4. **Read the READMEs**: Each example has detailed documentation

5. **Check the Code**: Examples are heavily commented

6. **Combine Concepts**: After understanding basics, try combining features

---

## Getting Help

- **Main Documentation**: [../README.md](../README.md)
- **API Reference**: Check individual module docs
- **Issues**: [GitHub Issues](https://github.com/your-repo/vocal-stack/issues)

---

## Contributing Examples

Have a cool use case? Want to add an example?

1. Follow the existing structure:
   ```
   XX-example-name/
   ├── package.json
   ├── index.js
   └── README.md
   ```

2. Include:
   - Clear, commented code
   - Comprehensive README
   - Self-contained example (own dependencies)
   - Real-world use case

3. Submit a PR!

---

## Example Code License

All examples are provided under the MIT license. Feel free to copy, modify, and use them in your projects!

---

## What's Next?

After exploring these examples:

1. **Build Your Application**: Adapt examples to your use case
2. **Customize**: Add your own rules, TTS providers, features
3. **Deploy**: Take your voice agent to production
4. **Share**: Show us what you built!

Happy coding! 🎙️✨
