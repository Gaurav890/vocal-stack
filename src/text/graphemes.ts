const segmenters = new Map<string, Intl.Segmenter>();

function getSegmenter(locale: string): Intl.Segmenter {
  const existing = segmenters.get(locale);
  if (existing) return existing;

  const segmenter = new Intl.Segmenter(locale, { granularity: 'grapheme' });
  segmenters.set(locale, segmenter);
  return segmenter;
}

export function splitGraphemes(text: string, locale = 'en'): string[] {
  return Array.from(getSegmenter(locale).segment(text), ({ segment }) => segment);
}

export function graphemeLength(text: string, locale = 'en'): number {
  let count = 0;
  for (const _segment of getSegmenter(locale).segment(text)) count++;
  return count;
}

export function codeUnitIndexAtGrapheme(text: string, count: number, locale = 'en'): number {
  if (count <= 0) return 0;

  let seen = 0;
  for (const part of getSegmenter(locale).segment(text)) {
    seen++;
    if (seen === count) return part.index + part.segment.length;
  }
  return text.length;
}

export function sliceGraphemes(text: string, start: number, end?: number, locale = 'en'): string {
  return splitGraphemes(text, locale).slice(start, end).join('');
}

/** Count the same user-perceived characters used by playback acknowledgements. */
export function countSpeechCharacters(text: string, locale = 'en'): number {
  return graphemeLength(text, locale);
}
