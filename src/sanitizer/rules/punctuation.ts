import type { SanitizerConfig } from '../types';

/**
 * Normalize punctuation for better TTS handling
 */
export function punctuationRule(text: string, _config: Required<SanitizerConfig>): string {
  let result = text;

  // Replace multiple exclamation marks with single
  result = result.replace(/!{2,}/g, '!');

  // Replace multiple question marks with single
  result = result.replace(/\?{2,}/g, '?');

  // Replace ellipsis variations with single space or period
  result = result.replace(/\.{3,}/g, '.');

  // Remove multiple dashes/hyphens
  result = result.replace(/-{2,}/g, ' ');

  // Replace em dash and en dash with space
  result = result.replace(/[—–]/g, ' ');

  // Remove parentheses and brackets but keep content
  result = result.replace(/[()[\]{}]/g, '');

  // Replace multiple commas with single
  result = result.replace(/,{2,}/g, ',');

  // Remove semicolons and colons (can be disruptive in speech)
  result = result.replace(/[;:]/g, ',');

  // Remove quotation marks
  result = result.replace(/["'"'`]/g, '');

  // Remove asterisks and underscores (from markdown remnants)
  result = result.replace(/[*_]/g, '');

  // Remove forward slashes and backslashes
  result = result.replace(/[/\\]/g, ' ');

  // Remove pipes and ampersands
  result = result.replace(/[|&]/g, ' ');

  // Remove @ # $ % symbols
  result = result.replace(/[@#$%]/g, '');

  return result;
}
