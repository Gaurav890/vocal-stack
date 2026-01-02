import { SanitizerError } from '../errors';
import { ruleRegistry } from './rules';
import type { SanitizationResult, SanitizerConfig, SanitizerPlugin } from './types';

/**
 * Speech sanitizer that transforms text for TTS optimization
 */
export class SpeechSanitizer {
  private readonly config: Required<SanitizerConfig>;
  private readonly plugins: readonly SanitizerPlugin[];

  constructor(config: SanitizerConfig = {}) {
    this.config = {
      rules: config.rules ?? ['markdown', 'urls', 'code-blocks', 'punctuation'],
      plugins: config.plugins ?? [],
      preserveLineBreaks: config.preserveLineBreaks ?? false,
      customReplacements: config.customReplacements ?? new Map(),
    };
    this.plugins = [...this.config.plugins].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Sanitize a string synchronously
   */
  sanitize(text: string): string {
    if (!text || text.trim().length === 0) {
      return '';
    }

    let result = text;

    try {
      // Apply built-in rules
      for (const rule of this.config.rules) {
        const ruleFunction = ruleRegistry.get(rule);
        if (ruleFunction) {
          result = ruleFunction(result, this.config);
        }
      }

      // Apply plugins (sync only in this version)
      for (const plugin of this.plugins) {
        const transformed = plugin.transform(result);
        if (transformed instanceof Promise) {
          throw new SanitizerError(
            `Plugin ${plugin.name} returned a Promise in sync sanitize(). Use sanitizeAsync() instead.`
          );
        }
        result = transformed;
      }

      // Apply custom replacements
      for (const [pattern, replacement] of this.config.customReplacements) {
        if (typeof pattern === 'string') {
          result = result.replaceAll(pattern, replacement);
        } else {
          result = result.replace(pattern, replacement);
        }
      }

      // Clean up whitespace
      if (this.config.preserveLineBreaks) {
        // Collapse multiple spaces on same line but keep line breaks
        result = result.replace(/ +/g, ' ').replace(/^\s+|\s+$/gm, '');
      } else {
        // Collapse all whitespace including line breaks
        result = result.replace(/\s+/g, ' ').trim();
      }

      return result;
    } catch (error) {
      if (error instanceof SanitizerError) {
        throw error;
      }
      throw new SanitizerError('Failed to sanitize text', {
        originalText: text.substring(0, 100),
        error,
      });
    }
  }

  /**
   * Sanitize with detailed result metadata
   */
  sanitizeWithMetadata(text: string): SanitizationResult {
    const original = text;
    const sanitized = this.sanitize(text);

    return {
      original,
      sanitized,
      appliedRules: this.config.rules as string[],
      metadata: {
        removedCount: original.length - sanitized.length,
        transformedCount: this.config.rules.length + this.plugins.length,
      },
    };
  }

  /**
   * Sanitize a stream of text chunks (AsyncIterable)
   */
  async *sanitizeStream(input: AsyncIterable<string>): AsyncIterable<string> {
    let buffer = '';
    const sentenceBoundary = /[.!?]\s+/;

    for await (const chunk of input) {
      buffer += chunk;

      // Process complete sentences
      const sentences = buffer.split(sentenceBoundary);
      buffer = sentences.pop() ?? ''; // Keep incomplete sentence

      for (const sentence of sentences) {
        if (sentence.trim()) {
          yield `${this.sanitize(sentence)} `;
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      yield this.sanitize(buffer);
    }
  }
}

/**
 * Convenience function for one-off sanitization
 */
export function sanitizeForSpeech(text: string, config?: SanitizerConfig): string {
  const sanitizer = new SpeechSanitizer(config);
  return sanitizer.sanitize(text);
}
