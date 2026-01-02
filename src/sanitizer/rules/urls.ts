import type { SanitizerConfig } from '../types';

/**
 * Remove or replace URLs to make text speakable
 */
export function urlsRule(text: string, _config: Required<SanitizerConfig>): string {
  let result = text;

  // Match URLs with protocol (http://, https://, ftp://, etc.)
  const urlWithProtocol = /\b(https?:\/\/|ftp:\/\/|www\.)[^\s<>"{}|\\^`[\]]+/gi;

  // Match email addresses
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

  // Remove URLs with protocol
  result = result.replace(urlWithProtocol, '');

  // Remove email addresses
  result = result.replace(emailPattern, '');

  // Remove standalone domain-like patterns (example.com)
  result = result.replace(/\b[a-z0-9-]+\.[a-z]{2,}\b/gi, '');

  return result;
}
