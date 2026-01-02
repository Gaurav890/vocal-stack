import type { SanitizerConfig } from '../types';

/**
 * Strip markdown syntax to make text speakable
 */
export function markdownRule(text: string, _config: Required<SanitizerConfig>): string {
  let result = text;

  // Remove headers (##, ###, etc.)
  result = result.replace(/^#{1,6}\s+/gm, '');

  // Remove bold/italic (**text**, *text*, __text__, _text_)
  result = result.replace(/(\*\*|__)(.*?)\1/g, '$2');
  result = result.replace(/(\*|_)(.*?)\1/g, '$2');

  // Remove inline code (`code`)
  result = result.replace(/`([^`]+)`/g, '$1');

  // Remove links but keep text [text](url) -> text
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove images ![alt](url) -> alt or empty
  result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

  // Remove blockquotes (>)
  result = result.replace(/^>\s+/gm, '');

  // Remove horizontal rules (---, ***, ___)
  result = result.replace(/^[\-*_]{3,}$/gm, '');

  // Remove list markers (-, *, 1., etc.)
  result = result.replace(/^[\s]*[-*+]\s+/gm, '');
  result = result.replace(/^[\s]*\d+\.\s+/gm, '');

  // Remove strikethrough (~~text~~)
  result = result.replace(/~~(.*?)~~/g, '$1');

  // Remove task list markers (- [ ], - [x])
  result = result.replace(/^[\s]*-\s+\[[ xX]\]\s+/gm, '');

  return result;
}
