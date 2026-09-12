export type SpeechBoundary =
  | 'sentence'
  | 'clause'
  | 'word'
  | 'max-length'
  | 'timeout'
  | 'source'
  | 'flush';

export type SpeechTextMode = 'balanced' | 'source';

export interface SpeechDiagnostic {
  readonly code: 'text.buffer.limit' | 'text.unclosed-construct';
  readonly message: string;
  readonly discardedCharacters: number;
  readonly construct: 'plain' | 'code-fence' | 'link' | 'image' | 'url';
}

export interface SpeechTransformContext {
  readonly final: boolean;
}

export type SpeechTextTransform = (
  text: string,
  context: SpeechTransformContext
) => string | Promise<string>;

export interface NormalizeSpeechOptions {
  readonly transforms?: readonly SpeechTextTransform[];
  readonly maxPendingChars?: number;
  readonly onDiagnostic?: (diagnostic: SpeechDiagnostic) => void;
}

export interface SpeechSegmenterOptions {
  readonly locale?: string;
  readonly mode?: SpeechTextMode;
  readonly minChars?: number;
  readonly targetChars?: number;
  readonly maxChars?: number;
  readonly maxWaitMs?: number;
  readonly idPrefix?: string;
}

export interface SpeechTextConfig extends NormalizeSpeechOptions, SpeechSegmenterOptions {}

export interface SpeechSegment {
  readonly id: string;
  readonly sequence: number;
  readonly text: string;
  readonly boundary: SpeechBoundary;
  readonly final: boolean;
}

export type SpeechTextInput = AsyncIterable<string> | ReadableStream<string>;
