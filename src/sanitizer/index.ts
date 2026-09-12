/**
 * Sanitizer module - Text processing and TTS optimization
 * @packageDocumentation
 */

// Rule registry (for advanced users who want to add custom rules)
export { ruleRegistry } from './rules';
// Main sanitizer class and convenience function
export { SpeechSanitizer, sanitizeForSpeech } from './sanitizer';
// Types
export type {
  RuleFunction,
  SanitizationResult,
  SanitizerConfig,
  SanitizerPlugin,
  SanitizerRule,
} from './types';
