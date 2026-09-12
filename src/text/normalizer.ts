import { VoicePipelineError } from '../errors';
import { graphemeLength, sliceGraphemes } from './graphemes';
import type {
  NormalizeSpeechOptions,
  SpeechDiagnostic,
  SpeechTextInput,
  SpeechTextTransform,
} from './types';

const DEFAULT_MAX_PENDING_CHARS = 4_096;
const URL_PREFIX = /^(?:https?:\/\/|www\.)/iu;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+[.!?,;:]?$/u;
const TRAILING_SPEECH_PUNCTUATION = /[.!?,;:]+$/u;

type ParserMode = 'plain' | 'fence' | 'label' | 'after-label' | 'destination' | 'discard-token';

function stripOpeningDelimiters(token: string): string {
  return token.replace(/^[([{<'‘“"]+/u, '');
}

function isUrlOrEmailToken(token: string): boolean {
  const candidate = stripOpeningDelimiters(token);
  return URL_PREFIX.test(candidate) || candidate.includes('@');
}

/** Incremental, chunk-boundary-independent speech text parser. */
export class IncrementalSpeechNormalizer {
  private readonly maxPendingChars: number;
  private readonly onDiagnostic: ((diagnostic: SpeechDiagnostic) => void) | undefined;
  private mode: ParserMode = 'plain';
  private token = '';
  private construct = '';
  private image = false;
  private destinationDepth = 0;
  private fenceTicks = 0;
  private discardedInConstruct = 0;
  private pendingSpace = false;
  private emittedContent = false;
  private output: string[] = [];

  constructor(options: NormalizeSpeechOptions = {}) {
    this.maxPendingChars = options.maxPendingChars ?? DEFAULT_MAX_PENDING_CHARS;
    this.onDiagnostic = options.onDiagnostic;

    if (!Number.isInteger(this.maxPendingChars) || this.maxPendingChars < 32) {
      throw new VoicePipelineError(
        'maxPendingChars must be an integer of at least 32',
        'VOICE_TEXT_INVALID_CONFIG'
      );
    }
  }

  write(chunk: string): string {
    this.output = [];
    for (const character of chunk) this.processCharacter(character);
    return this.output.join('');
  }

  end(): string {
    this.output = [];

    if (this.mode === 'plain' || this.mode === 'discard-token') {
      if (this.mode === 'plain') this.flushToken();
    } else if (this.mode === 'fence') {
      this.reportUnclosed('code-fence', this.discardedInConstruct);
    } else if (this.mode === 'label' || this.mode === 'after-label') {
      if (!this.image) this.emit(this.normalizeToken(this.construct));
      this.reportUnclosed(this.image ? 'image' : 'link', this.construct.length);
    } else if (this.mode === 'destination') {
      if (!this.image) this.emit(this.normalizeToken(this.construct));
      this.reportUnclosed(this.image ? 'image' : 'link', this.discardedInConstruct);
    }

    this.mode = 'plain';
    this.token = '';
    this.construct = '';
    this.pendingSpace = false;
    return this.output.join('');
  }

  private processCharacter(character: string): void {
    switch (this.mode) {
      case 'fence':
        this.processFence(character);
        return;
      case 'label':
        this.processLabel(character);
        return;
      case 'after-label':
        this.processAfterLabel(character);
        return;
      case 'destination':
        this.processDestination(character);
        return;
      case 'discard-token':
        if (/\s/u.test(character)) {
          this.mode = 'plain';
          this.pendingSpace = this.emittedContent;
        }
        return;
      case 'plain':
        this.processPlain(character);
    }
  }

  private processPlain(character: string): void {
    if (/\s/u.test(character)) {
      this.flushToken();
      this.pendingSpace = this.emittedContent;
      return;
    }

    if (character === '[') {
      const isImage = this.token.endsWith('!');
      if (isImage) this.token = this.token.slice(0, -1);
      this.flushToken();
      this.mode = 'label';
      this.image = isImage;
      this.construct = '';
      return;
    }

    this.token += character;
    if (this.token.endsWith('```')) {
      this.token = this.token.slice(0, -3);
      this.flushToken();
      this.mode = 'fence';
      this.fenceTicks = 0;
      this.discardedInConstruct = 0;
      return;
    }

    if (/[.?。？]/u.test(character) && !isUrlOrEmailToken(this.token)) {
      this.flushToken();
      return;
    }

    if (graphemeLength(this.token) > this.maxPendingChars) this.handlePlainOverflow();
  }

  private processFence(character: string): void {
    this.discardedInConstruct++;
    if (character === '`') {
      this.fenceTicks++;
      if (this.fenceTicks === 3) {
        this.mode = 'plain';
        this.fenceTicks = 0;
        this.discardedInConstruct = 0;
        this.pendingSpace = this.emittedContent;
      }
    } else {
      this.fenceTicks = 0;
    }

    if (this.discardedInConstruct >= this.maxPendingChars) {
      this.reportLimit('code-fence', this.discardedInConstruct);
      this.discardedInConstruct = 0;
    }
  }

  private processLabel(character: string): void {
    if (character === ']') {
      this.mode = 'after-label';
      return;
    }
    this.construct += character;
    if (graphemeLength(this.construct) > this.maxPendingChars) {
      if (!this.image) this.emit(this.normalizeToken(this.construct));
      this.reportLimit(this.image ? 'image' : 'link', this.construct.length);
      this.construct = '';
    }
  }

  private processAfterLabel(character: string): void {
    if (character === '(') {
      this.mode = 'destination';
      this.destinationDepth = 1;
      this.discardedInConstruct = 0;
      return;
    }

    if (!this.image) this.emit(this.normalizeToken(this.construct));
    this.construct = '';
    this.mode = 'plain';
    this.processPlain(character);
  }

  private processDestination(character: string): void {
    this.discardedInConstruct++;
    if (character === '(') this.destinationDepth++;
    if (character === ')') {
      this.destinationDepth--;
      if (this.destinationDepth === 0) {
        if (!this.image) this.emit(this.normalizeToken(this.construct));
        this.construct = '';
        this.mode = 'plain';
        this.discardedInConstruct = 0;
        return;
      }
    }

    if (this.discardedInConstruct >= this.maxPendingChars) {
      this.reportLimit(this.image ? 'image' : 'link', this.discardedInConstruct);
      this.discardedInConstruct = 0;
    }
  }

  private flushToken(): void {
    if (!this.token) return;
    this.emit(this.normalizeToken(this.token));
    this.token = '';
  }

  private normalizeToken(token: string): string {
    if (!token) return '';

    const constructCandidate = token
      .replace(/^[([{<'‘“"]+/u, '')
      .replace(/[)\]}>"'’”]+(?=[.!?,;:]*$)/u, '');
    if (URL_PREFIX.test(constructCandidate) || EMAIL.test(constructCandidate)) {
      const punctuation = token.match(TRAILING_SPEECH_PUNCTUATION)?.[0] ?? '';
      return punctuation ? (punctuation.at(-1) ?? '') : '';
    }

    if (/^(?:#{1,6}|[-+*>])$/u.test(token)) return '';

    return token
      .replace(/\*\*|__|~~|`/gu, '')
      .replace(/^\*+(?=\p{L})/u, '')
      .replace(/(?<=\p{L})\*+(?=\p{P}*$)/u, '')
      .replace(/^_+(?=\p{L})/u, '')
      .replace(/(?<=\p{L})_+(?=\p{P}*$)/u, '');
  }

  private emit(text: string): void {
    if (!text) return;
    if (
      this.pendingSpace &&
      this.emittedContent &&
      !/^\s/u.test(text) &&
      !/^[.!?,;:。！？]/u.test(text)
    ) {
      this.output.push(' ');
    }
    this.output.push(text);
    this.pendingSpace = false;
    this.emittedContent = true;
  }

  private handlePlainOverflow(): void {
    if (isUrlOrEmailToken(this.token)) {
      this.reportLimit('url', this.token.length);
      this.token = '';
      this.mode = 'discard-token';
      return;
    }

    const safe = sliceGraphemes(this.token, 0, this.maxPendingChars);
    this.emit(this.normalizeToken(safe));
    this.token = sliceGraphemes(this.token, this.maxPendingChars);
    this.reportLimit('plain', safe.length);
  }

  private reportLimit(construct: SpeechDiagnostic['construct'], discardedCharacters: number): void {
    this.onDiagnostic?.({
      code: 'text.buffer.limit',
      message: `Speech text exceeded the ${this.maxPendingChars}-character pending-text limit`,
      discardedCharacters,
      construct,
    });
  }

  private reportUnclosed(
    construct: Exclude<SpeechDiagnostic['construct'], 'plain' | 'url'>,
    discardedCharacters: number
  ): void {
    this.onDiagnostic?.({
      code: 'text.unclosed-construct',
      message: `Source ended inside an unclosed ${construct}`,
      discardedCharacters,
      construct,
    });
  }
}

function applySyncTransforms(text: string, transforms: readonly SpeechTextTransform[]): string {
  let result = text;
  for (const transform of transforms) {
    const next = transform(result, { final: true });
    if (next instanceof Promise) {
      throw new VoicePipelineError(
        'An asynchronous text transform was used with normalizeForSpeech(); use normalizeSpeechStream() instead',
        'VOICE_TEXT_ASYNC_TRANSFORM'
      );
    }
    result = next;
  }
  return result;
}

export function normalizeForSpeech(text: string, options: NormalizeSpeechOptions = {}): string {
  const normalizer = new IncrementalSpeechNormalizer(options);
  const normalized = normalizer.write(text) + normalizer.end();
  return applySyncTransforms(normalized, options.transforms ?? []);
}

export async function* normalizeSpeechStream(
  input: SpeechTextInput,
  options: NormalizeSpeechOptions = {}
): AsyncIterable<string> {
  const normalizer = new IncrementalSpeechNormalizer(options);
  const transforms = options.transforms ?? [];

  for await (const chunk of toAsyncIterable(input)) {
    let normalized = normalizer.write(chunk);
    for (const transform of transforms) normalized = await transform(normalized, { final: false });
    if (normalized) yield normalized;
  }

  let final = normalizer.end();
  for (const transform of transforms) final = await transform(final, { final: true });
  if (final) yield final;
}

export async function* toAsyncIterable(input: SpeechTextInput): AsyncIterable<string> {
  if (typeof (input as ReadableStream<string>).getReader === 'function') {
    const reader = (input as ReadableStream<string>).getReader();
    let completed = false;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) {
          completed = true;
          return;
        }
        yield next.value;
      }
    } finally {
      if (!completed) {
        try {
          await reader.cancel('speech-text-consumer-cancelled');
        } catch {
          // Local iteration has already stopped.
        }
      }
      reader.releaseLock();
    }
    return;
  }

  yield* input as AsyncIterable<string>;
}
