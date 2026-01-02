/**
 * Configuration for text sanitization
 */
export interface SanitizerConfig {
  /**
   * Rules to apply during sanitization
   * @default ['markdown', 'urls', 'code-blocks', 'punctuation']
   */
  readonly rules?: readonly SanitizerRule[];

  /**
   * Custom plugins for platform-specific transformations
   */
  readonly plugins?: readonly SanitizerPlugin[];

  /**
   * Whether to preserve line breaks
   * @default false
   */
  readonly preserveLineBreaks?: boolean;

  /**
   * Custom replacements for specific patterns
   */
  readonly customReplacements?: ReadonlyMap<string | RegExp, string>;
}

/**
 * Built-in rule identifiers
 */
export type SanitizerRule = 'markdown' | 'urls' | 'code-blocks' | 'punctuation';

/**
 * Plugin interface for custom sanitization logic
 */
export interface SanitizerPlugin {
  readonly name: string;
  readonly priority: number; // Lower runs first
  transform(text: string): string | Promise<string>;
}

/**
 * Result of sanitization operation
 */
export interface SanitizationResult {
  readonly original: string;
  readonly sanitized: string;
  readonly appliedRules: readonly string[];
  readonly metadata: {
    readonly removedCount: number;
    readonly transformedCount: number;
  };
}

/**
 * Rule function type
 */
export type RuleFunction = (text: string, config: Required<SanitizerConfig>) => string;
