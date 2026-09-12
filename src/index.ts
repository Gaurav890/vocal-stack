/**
 * vocal-stack - Provider-neutral reliability primitives for TypeScript voice pipelines
 * @packageDocumentation
 */

// Errors
export {
  FlowControlError,
  MonitorError,
  SanitizerError,
  VocalStackError,
  VoicePipelineError,
} from './errors';
// Flow
export {
  BufferManager,
  ConversationState,
  ConversationStateMachine,
  DEFAULT_FILLER_PHRASES,
  DEFAULT_MAX_FILLERS_PER_RESPONSE,
  DEFAULT_STALL_THRESHOLD_MS,
  FillerInjector,
  type FlowConfig,
  FlowController,
  type FlowEvent,
  type FlowEventListener,
  FlowManager,
  type FlowManagerConfig,
  type FlowStats,
  StallDetector,
  withFlowControl,
} from './flow';
// Monitor
export {
  type AuditorConfig,
  type ExportFormat,
  exportToCsv,
  exportToJson,
  MetricsCollector,
  type MetricsSummary,
  VoiceAuditor,
  type VoiceMetric,
} from './monitor';
// Sanitizer
export {
  type RuleFunction,
  ruleRegistry,
  type SanitizationResult,
  type SanitizerConfig,
  type SanitizerPlugin,
  type SanitizerRule,
  SpeechSanitizer,
  sanitizeForSpeech,
} from './sanitizer';
export * from './telemetry';
export * from './testing';
// V2 reliability APIs
export * from './text';
export * from './turn';
