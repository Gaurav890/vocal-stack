import { describe, expect, it } from 'vitest';
import { SpeechSanitizer, sanitizeForSpeech } from './sanitizer';

describe('SpeechSanitizer', () => {
  describe('constructor', () => {
    it('should use default config when none provided', () => {
      const sanitizer = new SpeechSanitizer();
      expect(sanitizer).toBeDefined();
    });

    it('should accept custom config', () => {
      const sanitizer = new SpeechSanitizer({
        rules: ['markdown'],
        preserveLineBreaks: true,
      });
      expect(sanitizer).toBeDefined();
    });
  });

  describe('sanitize()', () => {
    it('should return empty string for empty input', () => {
      const sanitizer = new SpeechSanitizer();
      expect(sanitizer.sanitize('')).toBe('');
      expect(sanitizer.sanitize('   ')).toBe('');
    });

    it('should strip markdown headers', () => {
      const sanitizer = new SpeechSanitizer();
      expect(sanitizer.sanitize('## Hello World')).toBe('Hello World');
      expect(sanitizer.sanitize('### Title Here')).toBe('Title Here');
      expect(sanitizer.sanitize('# Single Hash')).toBe('Single Hash');
    });

    it('should remove bold and italic formatting', () => {
      const sanitizer = new SpeechSanitizer();
      expect(sanitizer.sanitize('**bold text**')).toBe('bold text');
      expect(sanitizer.sanitize('*italic text*')).toBe('italic text');
      expect(sanitizer.sanitize('__bold text__')).toBe('bold text');
      expect(sanitizer.sanitize('_italic text_')).toBe('italic text');
    });

    it('should remove inline code', () => {
      const sanitizer = new SpeechSanitizer();
      // Note: Punctuation rule also removes parentheses for TTS
      expect(sanitizer.sanitize('Use `print` function for output')).toBe(
        'Use print function for output'
      );
    });

    it('should extract text from links', () => {
      const sanitizer = new SpeechSanitizer();
      expect(sanitizer.sanitize('[Click here](https://example.com)')).toBe('Click here');
      expect(sanitizer.sanitize('Visit [our site](http://test.com) today')).toBe(
        'Visit our site today'
      );
    });

    it('should remove images', () => {
      const sanitizer = new SpeechSanitizer();
      // Markdown removes image syntax, punctuation removes remaining !
      const result1 = sanitizer.sanitize('![alt text](image.png)');
      expect(result1).toContain('alt text');
      expect(result1).not.toContain('[');
      expect(result1).not.toContain(']');
    });

    it('should remove URLs', () => {
      const sanitizer = new SpeechSanitizer();
      expect(sanitizer.sanitize('Visit https://example.com')).toBe('Visit');
      expect(sanitizer.sanitize('Check out http://test.com')).toBe('Check out');
      expect(sanitizer.sanitize('Go to www.example.com')).toBe('Go to');
    });

    it('should remove email addresses', () => {
      const sanitizer = new SpeechSanitizer();
      expect(sanitizer.sanitize('Contact us at test@example.com')).toBe('Contact us at');
    });

    it('should remove code blocks', () => {
      const sanitizer = new SpeechSanitizer();
      const input = 'Here is code:\n```javascript\nconsole.log("hi");\n```\nDone';
      const output = sanitizer.sanitize(input);
      expect(output).not.toContain('console.log');
      expect(output).not.toContain('```');
      // Note: Punctuation rule converts colons to commas for TTS
      expect(output).toContain('Here is code');
      expect(output).toContain('Done');
    });

    it('should normalize punctuation', () => {
      const sanitizer = new SpeechSanitizer();
      expect(sanitizer.sanitize('Hello!!!')).toBe('Hello!');
      expect(sanitizer.sanitize('What???')).toBe('What?');
      expect(sanitizer.sanitize('Wait...')).toBe('Wait.');
      expect(sanitizer.sanitize('Hello---world')).toBe('Hello world');
    });

    it('should remove brackets and parentheses', () => {
      const sanitizer = new SpeechSanitizer();
      expect(sanitizer.sanitize('Hello (world) [test]')).toBe('Hello world test');
    });

    it('should handle complex markdown', () => {
      const sanitizer = new SpeechSanitizer();
      const input = `
## Title
This is **bold** and *italic*.
- Item 1
- Item 2
Check [this link](https://example.com).
      `.trim();

      const output = sanitizer.sanitize(input);
      expect(output).not.toContain('##');
      expect(output).not.toContain('**');
      expect(output).not.toContain('*');
      expect(output).not.toContain('[');
      expect(output).not.toContain('https://');
      expect(output).toContain('Title');
      expect(output).toContain('bold');
      expect(output).toContain('italic');
    });

    it('should apply custom replacements', () => {
      const sanitizer = new SpeechSanitizer({
        customReplacements: new Map([
          ['AI', 'artificial intelligence'],
          [/\bML\b/, 'machine learning'],
        ]),
      });

      expect(sanitizer.sanitize('AI and ML are cool')).toBe(
        'artificial intelligence and machine learning are cool'
      );
    });

    it('should preserve line breaks when configured', () => {
      const sanitizer = new SpeechSanitizer({
        preserveLineBreaks: true,
        rules: [],
      });

      const input = 'Line 1\nLine 2\nLine 3';
      const output = sanitizer.sanitize(input);
      expect(output).toContain('\n');
      expect(output.split('\n')).toHaveLength(3);
    });

    it('should collapse whitespace by default', () => {
      const sanitizer = new SpeechSanitizer({
        preserveLineBreaks: false,
        rules: [],
      });

      const input = 'Line 1\n\nLine 2   with  spaces';
      const output = sanitizer.sanitize(input);
      expect(output).toBe('Line 1 Line 2 with spaces');
    });

    it('should apply only specified rules', () => {
      const sanitizer = new SpeechSanitizer({
        rules: ['markdown'],
      });

      const input = '## Title with https://example.com';
      const output = sanitizer.sanitize(input);
      expect(output).not.toContain('##');
      expect(output).toContain('https://'); // URL rule not applied
    });
  });

  describe('sanitizeWithMetadata()', () => {
    it('should return metadata about sanitization', () => {
      const sanitizer = new SpeechSanitizer();
      const result = sanitizer.sanitizeWithMetadata('## Hello **World**!');

      expect(result.original).toBe('## Hello **World**!');
      expect(result.sanitized).toBe('Hello World!');
      expect(result.appliedRules).toContain('markdown');
      expect(result.metadata.removedCount).toBeGreaterThan(0);
      expect(result.metadata.transformedCount).toBeGreaterThan(0);
    });
  });

  describe('sanitizeStream()', () => {
    it('should process async iterable stream', async () => {
      const sanitizer = new SpeechSanitizer();

      async function* mockStream() {
        yield '## Hello ';
        yield '**world**. ';
        yield 'How are you?';
      }

      const results: string[] = [];
      for await (const chunk of sanitizer.sanitizeStream(mockStream())) {
        results.push(chunk);
      }

      const combined = results.join('');
      expect(combined).not.toContain('##');
      expect(combined).not.toContain('**');
      expect(combined).toContain('Hello');
      expect(combined).toContain('world');
    });

    it('should handle sentence boundaries in streams', async () => {
      const sanitizer = new SpeechSanitizer({ rules: [] });

      async function* mockStream() {
        yield 'First sentence. ';
        yield 'Second sentence! ';
        yield 'Third sentence?';
      }

      const results: string[] = [];
      for await (const chunk of sanitizer.sanitizeStream(mockStream())) {
        results.push(chunk);
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it('should process incomplete sentences', async () => {
      const sanitizer = new SpeechSanitizer({ rules: [] });

      async function* mockStream() {
        yield 'Incomplete';
      }

      const results: string[] = [];
      for await (const chunk of sanitizer.sanitizeStream(mockStream())) {
        results.push(chunk);
      }

      expect(results.join('')).toContain('Incomplete');
    });
  });

  describe('plugin system', () => {
    it('should apply plugins in priority order', () => {
      const plugin1 = {
        name: 'plugin1',
        priority: 1,
        transform: (text: string) => text.replace('hello', 'hi'),
      };

      const plugin2 = {
        name: 'plugin2',
        priority: 2,
        transform: (text: string) => text.toUpperCase(),
      };

      const sanitizer = new SpeechSanitizer({
        rules: [],
        plugins: [plugin1, plugin2],
      });

      const result = sanitizer.sanitize('hello world');
      expect(result).toBe('HI WORLD'); // plugin1 runs first (priority 1) making "hi world", then plugin2 makes it uppercase
    });
  });
});

describe('sanitizeForSpeech()', () => {
  it('should sanitize text with default config', () => {
    const result = sanitizeForSpeech('## Hello **World**!');
    expect(result).toBe('Hello World!');
  });

  it('should accept custom config', () => {
    const result = sanitizeForSpeech('## Hello World', {
      rules: ['markdown'], // Only markdown, not punctuation
    });
    expect(result).toBe('Hello World'); // markdown strips ##
    expect(result).not.toContain('##');
  });
});
