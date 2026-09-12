import { VoicePipelineError } from '../errors';
import { codeUnitIndexAtGrapheme, graphemeLength } from './graphemes';
import { normalizeSpeechStream } from './normalizer';
import type {
  SpeechBoundary,
  SpeechSegment,
  SpeechSegmenterOptions,
  SpeechTextConfig,
  SpeechTextInput,
} from './types';

const DEFAULTS = {
  locale: 'en',
  mode: 'balanced',
  minChars: 24,
  targetChars: 120,
  maxChars: 240,
  maxWaitMs: 250,
  idPrefix: 'segment',
} as const;

export class SpeechSegmenter {
  private readonly options: Required<SpeechSegmenterOptions>;
  private buffer = '';
  private sequence = 0;

  constructor(options: SpeechSegmenterOptions = {}) {
    this.options = { ...DEFAULTS, ...options };
    if (
      !['balanced', 'source'].includes(this.options.mode) ||
      !Number.isInteger(this.options.minChars) ||
      !Number.isInteger(this.options.targetChars) ||
      !Number.isInteger(this.options.maxChars) ||
      !Number.isFinite(this.options.maxWaitMs) ||
      this.options.minChars < 1 ||
      this.options.targetChars < this.options.minChars ||
      this.options.maxChars < this.options.targetChars ||
      this.options.maxWaitMs < 0
    ) {
      throw new VoicePipelineError(
        'Text limits and mode must satisfy balanced|source, integer character limits, 1 <= minChars <= targetChars <= maxChars, and finite maxWaitMs >= 0',
        'VOICE_TEXT_INVALID_CONFIG'
      );
    }
  }

  get pendingText(): string {
    return this.buffer;
  }

  push(text: string): SpeechSegment[] {
    if (!text) return [];
    if (this.options.mode === 'source') return [this.createSegment(text, 'source', false)];

    this.buffer += text;
    return this.drainBalanced();
  }

  flushTimeout(): SpeechSegment[] {
    if (!this.buffer) return [];
    const wordBoundary = this.lastWhitespaceAtOrBefore(
      Math.min(graphemeLength(this.buffer, this.options.locale), this.options.maxChars)
    );
    const end = wordBoundary > 0 ? wordBoundary : this.buffer.length;
    return [this.take(end, 'timeout', false)];
  }

  finish(): SpeechSegment[] {
    if (!this.buffer) return [];
    return [this.take(this.buffer.length, 'flush', true)];
  }

  private drainBalanced(): SpeechSegment[] {
    const segments: SpeechSegment[] = [];
    while (this.buffer) {
      const length = graphemeLength(this.buffer, this.options.locale);
      if (length < this.options.minChars) break;

      const sentence = this.findSentenceBoundary();
      if (sentence > 0) {
        segments.push(this.take(sentence, 'sentence', false));
        continue;
      }

      if (length >= this.options.targetChars) {
        const clause = this.findClauseBoundary();
        if (clause > 0) {
          segments.push(this.take(clause, 'clause', false));
          continue;
        }
      }

      if (length < this.options.maxChars) break;

      const word = this.lastWhitespaceAtOrBefore(this.options.maxChars);
      if (word > 0) {
        segments.push(this.take(word, 'word', false));
      } else {
        const end = codeUnitIndexAtGrapheme(
          this.buffer,
          this.options.maxChars,
          this.options.locale
        );
        segments.push(this.take(end, 'max-length', false));
      }
    }
    return segments;
  }

  private findSentenceBoundary(): number {
    const expression = /[.!?。！？]+(?:["'’”)\]]*)?(?=\s|$)/gu;
    for (const match of this.buffer.matchAll(expression)) {
      const end = (match.index ?? 0) + match[0].length;
      const length = graphemeLength(this.buffer.slice(0, end), this.options.locale);
      if (length >= this.options.minChars && length <= this.options.maxChars) {
        return this.includeFollowingWhitespace(end);
      }
    }
    return 0;
  }

  private findClauseBoundary(): number {
    const candidates: Array<{ end: number; distance: number }> = [];
    const expression = /[,;:，、；：—–](?=\s|$)/gu;
    for (const match of this.buffer.matchAll(expression)) {
      const end = (match.index ?? 0) + match[0].length;
      const length = graphemeLength(this.buffer.slice(0, end), this.options.locale);
      if (length >= this.options.minChars && length <= this.options.maxChars) {
        candidates.push({ end, distance: Math.abs(length - this.options.targetChars) });
      }
    }
    candidates.sort((left, right) => left.distance - right.distance);
    return candidates[0] ? this.includeFollowingWhitespace(candidates[0].end) : 0;
  }

  private lastWhitespaceAtOrBefore(graphemes: number): number {
    const limit = codeUnitIndexAtGrapheme(this.buffer, graphemes, this.options.locale);
    let last = 0;
    for (const match of this.buffer.slice(0, limit).matchAll(/\s+/gu)) {
      last = (match.index ?? 0) + match[0].length;
    }
    return last;
  }

  private includeFollowingWhitespace(index: number): number {
    const trailing = this.buffer.slice(index).match(/^\s+/u)?.[0] ?? '';
    return index + trailing.length;
  }

  private take(end: number, boundary: SpeechBoundary, final: boolean): SpeechSegment {
    const text = this.buffer.slice(0, end);
    this.buffer = this.buffer.slice(end);
    return this.createSegment(text, boundary, final);
  }

  private createSegment(text: string, boundary: SpeechBoundary, final: boolean): SpeechSegment {
    const sequence = this.sequence++;
    return {
      id: `${this.options.idPrefix}-${sequence + 1}`,
      sequence,
      text,
      boundary,
      final,
    };
  }
}

export async function* segmentSpeechStream(
  input: SpeechTextInput,
  options: SpeechTextConfig = {}
): AsyncIterable<SpeechSegment> {
  const segmenter = new SpeechSegmenter(options);
  const iterator = normalizeSpeechStream(input, options)[Symbol.asyncIterator]();
  let pendingNext: Promise<IteratorResult<string>> | undefined;

  while (true) {
    pendingNext ??= iterator.next();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = segmenter.pendingText
      ? new Promise<'timeout'>((resolve) => {
          timer = setTimeout(resolve, options.maxWaitMs ?? 250, 'timeout');
        })
      : undefined;
    const next = timeout ? await Promise.race([pendingNext, timeout]) : await pendingNext;

    if (next === 'timeout') {
      yield* segmenter.flushTimeout();
      continue;
    }

    if (timer !== undefined) clearTimeout(timer);

    pendingNext = undefined;
    if (next.done) break;
    yield* segmenter.push(next.value);
  }

  yield* segmenter.finish();
}
