export { countSpeechCharacters } from './graphemes';
export { normalizeForSpeech, normalizeSpeechStream } from './normalizer';
export { SpeechSegmenter, segmentSpeechStream } from './segmenter';
export type {
  NormalizeSpeechOptions,
  SpeechBoundary,
  SpeechDiagnostic,
  SpeechSegment,
  SpeechSegmenterOptions,
  SpeechTextConfig,
  SpeechTextInput,
  SpeechTextMode,
  SpeechTextTransform,
  SpeechTransformContext,
} from './types';
