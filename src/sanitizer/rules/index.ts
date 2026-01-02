import type { RuleFunction } from '../types';
import { codeBlocksRule } from './code-blocks';
import { markdownRule } from './markdown';
import { punctuationRule } from './punctuation';
import { urlsRule } from './urls';

/**
 * Registry of built-in sanitization rules
 */
export const ruleRegistry = new Map<string, RuleFunction>([
  ['markdown', markdownRule],
  ['urls', urlsRule],
  ['code-blocks', codeBlocksRule],
  ['punctuation', punctuationRule],
]);
