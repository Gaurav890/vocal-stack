import type { SanitizerConfig } from '../types';

/**
 * Remove code blocks and inline code to make text speakable
 */
export function codeBlocksRule(text: string, _config: Required<SanitizerConfig>): string {
  let result = text;

  // Remove fenced code blocks (```code```)
  // Match both with and without language specifier
  result = result.replace(/```[\s\S]*?```/g, '');

  // Remove indented code blocks (4 spaces or 1 tab at line start)
  result = result.replace(/^(?: {4}|\t).+$/gm, '');

  // Note: Inline code (`code`) is handled by markdown rule

  return result;
}
