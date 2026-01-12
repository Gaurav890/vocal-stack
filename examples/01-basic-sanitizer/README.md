# Basic Sanitizer Example

This example demonstrates how to use the **SpeechSanitizer** module to clean text for Text-to-Speech (TTS) output.

## What it demonstrates

- Quick sanitization with `sanitizeForSpeech()` function
- Custom sanitizer configuration with specific rules
- Streaming sanitization for real-time LLM output
- Removing markdown, URLs, code blocks, and special characters

## Key Concepts

### 1. Quick Sanitization

The simplest way to clean text:

```javascript
import { sanitizeForSpeech } from 'vocal-stack/sanitizer';

const text = '# Hello **world**!';
const clean = sanitizeForSpeech(text);
// Output: "Hello world!"
```

### 2. Custom Configuration

Configure which rules to apply:

```javascript
const sanitizer = new SpeechSanitizer({
  rules: ['markdown', 'urls', 'code-blocks'],
  customReplacements: new Map([
    ['https://', 'link at ']
  ])
});

const result = sanitizer.sanitize(text);
```

### 3. Streaming Support

Process LLM output as it streams:

```javascript
for await (const chunk of sanitizer.sanitizeStream(llmStream)) {
  sendToTTS(chunk);
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
1. Basic markdown cleaning
2. Custom rules and replacements
3. Streaming sanitization with simulated delays

## Use Cases

- Clean LLM responses before sending to TTS
- Remove unspeakable text (URLs, code, markdown)
- Real-time text processing for voice agents
- Preparing documentation or articles for audio conversion

## Next Steps

- Try `02-flow-control` to handle streaming latency
- Explore `04-full-pipeline` to see all modules working together
