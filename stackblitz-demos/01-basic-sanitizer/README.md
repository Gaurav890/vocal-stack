# Text Sanitizer Demo

Interactive demo showcasing vocal-stack's text sanitization features.

## What it demonstrates

- Real-time text sanitization
- Multiple sanitization rules (markdown, URLs, code blocks, punctuation)
- Before/after comparison
- Statistics (characters removed, size reduction)

## How to use

### Option 1: Open in StackBlitz

1. Click this button: [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/gaurav890/vocal-stack/tree/main/stackblitz-demos/01-basic-sanitizer)

2. Wait for dependencies to install

3. The demo will open automatically!

### Option 2: Manual Setup

1. Go to [StackBlitz](https://stackblitz.com)

2. Click "New Project" → "Node.js"

3. Copy the contents of this folder

4. Click "Run" to start the demo

### Option 3: Run Locally

```bash
cd stackblitz-demos/01-basic-sanitizer
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Features

### Interactive UI
- Select which sanitization rules to apply
- Try preset examples or paste your own text
- See real-time results

### Example Texts
- **Markdown**: Headings, bold, italic, links
- **URLs**: Various URL formats
- **Code**: Code blocks and inline code
- **Mixed**: Combination of all types

### Statistics
- Characters removed
- Original vs cleaned length
- Size reduction percentage

## Try It!

1. Select sanitization rules
2. Enter or select example text
3. Click "Sanitize Text"
4. See the cleaned output!

## Use Cases

This demo shows how vocal-stack cleans text for:
- Text-to-Speech (TTS) systems
- Voice assistants
- Audio content generation
- Accessibility tools

## Learn More

- [vocal-stack on npm](https://www.npmjs.com/package/vocal-stack)
- [Full Documentation](../../README.md)
- [All Examples](../../examples)
