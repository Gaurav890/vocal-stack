import { SpeechSanitizer } from 'vocal-stack/sanitizer';

// Example texts
const examples = {
  markdown: `## Welcome to vocal-stack!

This is a **powerful** library for _voice AI_ agents.

Check out [our docs](https://github.com/vocal-stack) for more info.`,

  urls: `Visit our website at https://example.com for more information.

You can also check out http://docs.example.com/api for API docs.

Email us at support@example.com`,

  code: `Here's how to use it:

\`\`\`javascript
const sanitizer = new SpeechSanitizer();
const result = sanitizer.sanitize(text);
\`\`\`

Simply install with \`npm install vocal-stack\` and you're ready!`,

  mixed: `## Getting Started

This is **vocal-stack** - a library for voice AI.

### Features:
1. **Text Sanitization** - Clean markdown
2. **Flow Control** - Handle latency
3. **Monitoring** - Track performance

Check out https://github.com/vocal-stack for more!!!

Here's example code:
\`\`\`javascript
import { SpeechSanitizer } from 'vocal-stack';
const sanitizer = new SpeechSanitizer();
\`\`\`

Email: support@example.com
Website: https://example.com`
};

// Load example
window.loadExample = (exampleKey) => {
  const input = document.getElementById('input');
  input.value = examples[exampleKey];
};

// Clear all
window.clearAll = () => {
  document.getElementById('input').value = '';
  document.getElementById('output').value = '';
  document.getElementById('stats').style.display = 'none';
};

// Sanitize function
window.sanitize = () => {
  const inputEl = document.getElementById('input');
  const outputEl = document.getElementById('output');
  const inputText = inputEl.value;

  if (!inputText.trim()) {
    alert('Please enter some text to sanitize!');
    return;
  }

  // Get selected rules
  const rules = [];
  if (document.getElementById('rule-markdown').checked) rules.push('markdown');
  if (document.getElementById('rule-urls').checked) rules.push('urls');
  if (document.getElementById('rule-code-blocks').checked) rules.push('code-blocks');
  if (document.getElementById('rule-punctuation').checked) rules.push('punctuation');

  // Create sanitizer with selected rules
  const sanitizer = new SpeechSanitizer({ rules });

  // Sanitize
  const cleaned = sanitizer.sanitize(inputText);
  outputEl.value = cleaned;

  // Update stats
  const originalLength = inputText.length;
  const cleanedLength = cleaned.length;
  const charsRemoved = originalLength - cleanedLength;
  const reduction = ((charsRemoved / originalLength) * 100).toFixed(1);

  document.getElementById('stat-chars-removed').textContent = charsRemoved;
  document.getElementById('stat-original').textContent = originalLength;
  document.getElementById('stat-cleaned').textContent = cleanedLength;
  document.getElementById('stat-reduction').textContent = reduction + '%';
  document.getElementById('stats').style.display = 'grid';
};

// Initialize
console.log('vocal-stack Text Sanitizer Demo loaded!');
console.log('Try different examples or paste your own text.');
