import { describe, expect, it } from 'vitest';
import { VoicePipelineError } from '../errors';
import { countSpeechCharacters } from './graphemes';
import { normalizeForSpeech, normalizeSpeechStream } from './normalizer';
import { SpeechSegmenter, segmentSpeechStream } from './segmenter';
import type { SpeechDiagnostic } from './types';

async function collect(iterable: AsyncIterable<string>): Promise<string> {
  let result = '';
  for await (const value of iterable) result += value;
  return result;
}

async function* chunks(values: readonly string[]): AsyncIterable<string> {
  yield* values;
}

function partitions(text: string): string[][] {
  return [
    [text],
    Array.from(text),
    [text.slice(0, 1), text.slice(1, 7), text.slice(7, 19), text.slice(19)],
    text.match(/.{1,5}/gu) ?? [],
    ...Array.from({ length: text.length + 1 }, (_, index) => [
      text.slice(0, index),
      text.slice(index),
    ]),
  ];
}

describe('speech text normalization', () => {
  it('preserves speech punctuation, contractions, graphemes, and Markdown link labels', () => {
    const input = "**Don't** split e\u0301 or 👩‍👩‍👧‍👦. See [the docs](https://example.com/path).";
    expect(normalizeForSpeech(input)).toBe("Don't split e\u0301 or 👩‍👩‍👧‍👦. See the docs.");
  });

  it('counts playback positions in Unicode graphemes', () => {
    expect(countSpeechCharacters('e\u0301👩‍👩‍👧‍👦')).toBe(2);
  });

  it('omits fenced code, images, URLs, and email addresses by default', () => {
    const input =
      'Start ```ts\nconst secret = 1;\n``` visit (https://example.com). ![chart](chart.png) Email <me@example.com>, now.';
    expect(normalizeForSpeech(input)).toBe('Start visit. Email, now.');
  });

  it('preserves CJK speech, numbers, currency, dates, and empty input', async () => {
    const input = '今日は2026年9月12日で、価格は$12.50です。你好！';
    expect(normalizeForSpeech(input)).toBe(input);
    expect(normalizeForSpeech('')).toBe('');
    expect(await collect(normalizeSpeechStream(chunks([])))).toBe('');
  });

  it('is invariant across arbitrary chunk partitions', async () => {
    const input =
      "Hello, **world**! Read [our guide](https://example.com/a?q=1). ```ts\nignore()\n``` Don't email test@example.com.";
    const expected = normalizeForSpeech(input);

    for (const partition of partitions(input)) {
      expect(await collect(normalizeSpeechStream(chunks(partition)))).toBe(expected);
    }
  });

  it('handles split and unclosed constructs predictably', async () => {
    const diagnostics: SpeechDiagnostic[] = [];
    const result = await collect(
      normalizeSpeechStream(chunks(['Before [label](https://exam', 'ple.com']), {
        onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
      })
    );
    expect(result).toBe('Before label');
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: 'text.unclosed-construct', construct: 'link' })
    );
  });

  it('supports ordered asynchronous transforms', async () => {
    const output = await collect(
      normalizeSpeechStream(chunks(['hello world']), {
        transforms: [async (text) => text.replace('hello', 'hi'), (text) => text.toUpperCase()],
      })
    );
    expect(output).toBe('HI WORLD');
  });

  it('rejects asynchronous transforms in the synchronous API', () => {
    expect(() => normalizeForSpeech('hello', { transforms: [async (text) => text] })).toThrowError(
      VoicePipelineError
    );
  });

  it('bounds unresolved constructs and emits diagnostics', () => {
    const diagnostics: SpeechDiagnostic[] = [];
    normalizeForSpeech(`\`\`\`${'x'.repeat(100)}`, {
      maxPendingChars: 32,
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    expect(diagnostics.some((diagnostic) => diagnostic.code === 'text.buffer.limit')).toBe(true);
  });

  it('rejects invalid pending-text limits', () => {
    expect(() => normalizeForSpeech('hello', { maxPendingChars: 31 })).toThrow('maxPendingChars');
    expect(() => normalizeForSpeech('hello', { maxPendingChars: 32.5 })).toThrow('maxPendingChars');
  });

  it('handles plain brackets, nested link destinations, and unclosed images', () => {
    const diagnostics: SpeechDiagnostic[] = [];
    expect(normalizeForSpeech('A [plain] label and [link](https://x.test/a_(b)) done.')).toBe(
      'A plain label and link done.'
    );
    expect(
      normalizeForSpeech('Before ![unfinished image', {
        onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
      })
    ).toBe('Before');
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: 'text.unclosed-construct', construct: 'image' })
    );
  });

  it('bounds long plain words, links, images, destinations, and URLs', () => {
    const diagnostics: SpeechDiagnostic[] = [];
    const options = {
      maxPendingChars: 32,
      onDiagnostic: (diagnostic: SpeechDiagnostic) => diagnostics.push(diagnostic),
    };
    const plain = normalizeForSpeech(`${'a'.repeat(40)} end`, options);
    const link = normalizeForSpeech(`[${'b'.repeat(40)}](https://x.test)`, options);
    const image = normalizeForSpeech(`![${'c'.repeat(40)}](image.png)`, options);
    const destination = normalizeForSpeech(`[label](https://x.test/${'d'.repeat(40)})`, options);
    const url = normalizeForSpeech(`https://${'e'.repeat(40)}.test ignored after`, options);

    expect(plain).toBe(`${'a'.repeat(40)} end`);
    expect(link).toBe('b'.repeat(40));
    expect(image).toBe('');
    expect(destination).toBe('label');
    expect(url).toBe('ignored after');
    expect(diagnostics.map((diagnostic) => diagnostic.construct)).toEqual(
      expect.arrayContaining(['plain', 'link', 'image', 'url'])
    );
  });

  it('normalizes formatting markers while retaining ordinary symbols and punctuation', () => {
    expect(normalizeForSpeech('# Title + item > quote C# _italic_ *em* ~~gone~~ `code`!')).toBe(
      'Title item quote C# italic em gone code!'
    );
  });

  it('reads and cancels web streams', async () => {
    let cancelled: unknown;
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('hello ');
      },
      cancel(reason) {
        cancelled = reason;
      },
    });
    const iterator = normalizeSpeechStream(stream)[Symbol.asyncIterator]();
    expect(await iterator.next()).toEqual({ value: 'hello', done: false });
    await iterator.return?.();
    expect(cancelled).toBe('speech-text-consumer-cancelled');

    const completeStream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('complete.');
        controller.close();
      },
    });
    expect(await collect(normalizeSpeechStream(completeStream))).toBe('complete.');
  });
});

describe('SpeechSegmenter', () => {
  it('prefers sentence boundaries and preserves punctuation', () => {
    const segmenter = new SpeechSegmenter({ minChars: 8, targetChars: 20, maxChars: 40 });
    const segments = segmenter.push('A complete sentence. Another thought');
    expect(segments).toEqual([
      expect.objectContaining({ text: 'A complete sentence. ', boundary: 'sentence' }),
    ]);
    expect(segmenter.finish()[0]).toEqual(
      expect.objectContaining({ text: 'Another thought', boundary: 'flush', final: true })
    );
  });

  it('uses clause, word, and grapheme-safe maximum boundaries', () => {
    const clause = new SpeechSegmenter({ minChars: 5, targetChars: 10, maxChars: 20 });
    expect(clause.push('Alpha beta, gamma delta')[0]?.boundary).toBe('clause');

    const word = new SpeechSegmenter({ minChars: 3, targetChars: 5, maxChars: 8 });
    expect(word.push('one two three')[0]?.boundary).toBe('word');

    const maximum = new SpeechSegmenter({ minChars: 2, targetChars: 2, maxChars: 2 });
    const segment = maximum.push('👩‍👩‍👧‍👦🙂x')[0];
    expect(segment?.text).toBe('👩‍👩‍👧‍👦🙂');
    expect(segment?.boundary).toBe('max-length');
  });

  it('flushes the best available boundary on timeout', () => {
    const segmenter = new SpeechSegmenter({ minChars: 20, targetChars: 30, maxChars: 40 });
    segmenter.push('short phrase waiting');
    expect(segmenter.flushTimeout()[0]).toEqual(
      expect.objectContaining({ text: 'short phrase ', boundary: 'timeout' })
    );
  });

  it('emits source-mode input without sentence buffering', () => {
    const segmenter = new SpeechSegmenter({ mode: 'source' });
    expect(segmenter.push('token ')).toEqual([
      expect.objectContaining({ text: 'token ', boundary: 'source' }),
    ]);
  });

  it('segments normalized streams end to end', async () => {
    const segments = [];
    for await (const segment of segmentSpeechStream(chunks(['Hello **world**.']), {
      minChars: 5,
    })) {
      segments.push(segment);
    }
    expect(segments.map((segment) => segment.text).join('')).toBe('Hello world.');
  });

  it('validates segment sizes and handles empty flushes', () => {
    expect(() => new SpeechSegmenter({ minChars: 0 })).toThrow('Text limits');
    expect(() => new SpeechSegmenter({ minChars: 1.5 })).toThrow('Text limits');
    expect(() => new SpeechSegmenter({ maxWaitMs: Number.POSITIVE_INFINITY })).toThrow(
      'Text limits'
    );
    expect(() => new SpeechSegmenter({ mode: 'invalid' as never })).toThrow('Text limits');
    expect(() => new SpeechSegmenter({ minChars: 10, targetChars: 9 })).toThrow('Text limits');
    expect(() => new SpeechSegmenter({ targetChars: 20, maxChars: 19 })).toThrow('Text limits');
    expect(() => new SpeechSegmenter({ maxWaitMs: -1 })).toThrow('Text limits');
    const segmenter = new SpeechSegmenter();
    expect(segmenter.flushTimeout()).toEqual([]);
    expect(segmenter.finish()).toEqual([]);
    expect(segmenter.push('')).toEqual([]);
  });

  it('takes the timeout path while a stream is still active', async () => {
    async function* delayed(): AsyncIterable<string> {
      yield 'short phrase ';
      await new Promise((resolve) => setTimeout(resolve, 5));
      yield 'finished.';
    }
    const segments = [];
    for await (const segment of segmentSpeechStream(delayed(), {
      minChars: 30,
      targetChars: 40,
      maxChars: 50,
      maxWaitMs: 1,
    })) {
      segments.push(segment);
    }
    expect(segments.some((segment) => segment.boundary === 'timeout')).toBe(true);
    expect(segments.map((segment) => segment.text).join('')).toBe('short phrase finished.');
  });
});
