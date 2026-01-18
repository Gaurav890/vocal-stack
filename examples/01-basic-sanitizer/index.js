import { SpeechSanitizer, sanitizeForSpeech } from 'vocal-stack/sanitizer';

console.log('=== Basic Sanitizer Example ===\n');

// Example 1: Quick sanitization with default function
console.log('Example 1: Quick sanitization');
const markdownText =
  '# Hello World\n\nCheck out this [link](https://example.com) and some **bold** text.';
const cleaned = sanitizeForSpeech(markdownText);

console.log('Original:', markdownText);
console.log('Cleaned:', cleaned);
console.log();

// Example 2: Using SpeechSanitizer class with custom rules
console.log('Example 2: Custom sanitizer configuration');
const sanitizer = new SpeechSanitizer({
  rules: ['markdown', 'urls', 'code-blocks'],
  customReplacements: new Map([
    ['https://', 'link at '],
    ['http://', 'link at '],
  ]),
});

const complexText = `
## API Documentation

Visit https://api.example.com for details.

\`\`\`javascript
const result = await fetch('/api');
\`\`\`

**Important**: This is a *critical* feature!
`;

const result = sanitizer.sanitize(complexText);
console.log('Original:', complexText);
console.log('Cleaned:', result);
console.log();

// Example 3: Streaming sanitization
console.log('Example 3: Streaming sanitization');

async function* mockLLMStream() {
  const chunks = [
    '# Streaming ',
    'Response\n\n',
    'Here is some ',
    '**bold** text ',
    'and a [link](https://example.com).',
  ];

  for (const chunk of chunks) {
    yield chunk;
    // Simulate streaming delay
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

console.log('Processing stream...');
const streamSanitizer = new SpeechSanitizer({ rules: ['markdown', 'urls'] });

for await (const chunk of streamSanitizer.sanitizeStream(mockLLMStream())) {
  if (chunk.trim()) {
    console.log('Chunk:', chunk);
  }
}

console.log('\n=== Example Complete ===');
