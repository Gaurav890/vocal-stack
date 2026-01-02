/**
 * Sanitizer module - Text processing and TTS optimization
 * @packageDocumentation
 */

// Main sanitizer class and convenience function
export { SpeechSanitizer, sanitizeForSpeech } from './sanitizer';

// Types
export type {
  SanitizerConfig,
  SanitizerPlugin,
  SanitizerRule,
  SanitizationResult,
  RuleFunction,
} from './types';

// Rule registry (for advanced users who want to add custom rules)
export { ruleRegistry } from './rules';
