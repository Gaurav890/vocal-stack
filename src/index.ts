/**
 * vocal-stack - High-performance utility library for Voice AI agents
 * @packageDocumentation
 */

// Errors
export { VocalStackError, SanitizerError, FlowControlError, MonitorError } from './errors';

// Sanitizer
export {
  SpeechSanitizer,
  sanitizeForSpeech,
  ruleRegistry,
  type SanitizerConfig,
  type SanitizerPlugin,
  type SanitizerRule,
  type SanitizationResult,
  type RuleFunction,
} from './sanitizer';

// Monitor
export {
  VoiceAuditor,
  MetricsCollector,
  exportToCsv,
  exportToJson,
  type AuditorConfig,
  type VoiceMetric,
  type MetricsSummary,
  type ExportFormat,
} from './monitor';

// Flow
export {
  FlowController,
  withFlowControl,
  FlowManager,
  ConversationStateMachine,
  ConversationState,
  StallDetector,
  FillerInjector,
  BufferManager,
  DEFAULT_STALL_THRESHOLD_MS,
  DEFAULT_FILLER_PHRASES,
  DEFAULT_MAX_FILLERS_PER_RESPONSE,
  type FlowConfig,
  type FlowStats,
  type FlowEvent,
  type FlowEventListener,
  type FlowManagerConfig,
} from './flow';
