/**
 * Flow module - Latency management and filler injection
 * @packageDocumentation
 */

// Main flow controller (high-level API)
export { FlowController, withFlowControl } from './flow-controller';

// Low-level event-based API
export { FlowManager } from './flow-manager';

// State machine
export { ConversationStateMachine } from './state-machine';

// Types and enums
export {
  ConversationState,
  type FlowConfig,
  type FlowStats,
  type FlowEvent,
  type FlowEventListener,
  type FlowManagerConfig,
} from './types';

// Constants (for reference)
export {
  DEFAULT_STALL_THRESHOLD_MS,
  DEFAULT_FILLER_PHRASES,
  DEFAULT_MAX_FILLERS_PER_RESPONSE,
} from './constants';

// Internal components (for advanced users)
export { StallDetector } from './stall-detector';
export { FillerInjector } from './filler-injector';
export { BufferManager } from './buffer-manager';
