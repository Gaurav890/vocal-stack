/**
 * Flow module - Latency management and filler injection
 * @packageDocumentation
 */

export { BufferManager } from './buffer-manager';
// Constants (for reference)
export {
  DEFAULT_FILLER_PHRASES,
  DEFAULT_MAX_FILLERS_PER_RESPONSE,
  DEFAULT_STALL_THRESHOLD_MS,
} from './constants';
export { FillerInjector } from './filler-injector';
// Main flow controller (high-level API)
export { FlowController, withFlowControl } from './flow-controller';
// Low-level event-based API
export { FlowManager } from './flow-manager';

// Internal components (for advanced users)
export { StallDetector } from './stall-detector';
// State machine
export { ConversationStateMachine } from './state-machine';
// Types and enums
export {
  ConversationState,
  type FlowConfig,
  type FlowEvent,
  type FlowEventListener,
  type FlowManagerConfig,
  type FlowStats,
} from './types';
