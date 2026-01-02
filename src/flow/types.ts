/**
 * Configuration for flow control
 */
export interface FlowConfig {
  /**
   * Stall threshold in milliseconds
   * @default 700
   */
  readonly stallThresholdMs?: number;

  /**
   * Filler phrases to inject
   * @default ['um', 'let me think', 'hmm']
   */
  readonly fillerPhrases?: readonly string[];

  /**
   * Whether to enable filler injection
   * @default true
   */
  readonly enableFillers?: boolean;

  /**
   * Maximum number of fillers to inject per response
   * @default 3
   */
  readonly maxFillersPerResponse?: number;

  /**
   * Callback when filler is injected
   */
  readonly onFillerInjected?: (filler: string) => void;

  /**
   * Callback when stall is detected
   */
  readonly onStallDetected?: (durationMs: number) => void;

  /**
   * Callback when first chunk is emitted
   */
  readonly onFirstChunk?: () => void;
}

/**
 * Conversation states
 */
export enum ConversationState {
  IDLE = 'idle',
  WAITING = 'waiting',
  SPEAKING = 'speaking',
  INTERRUPTED = 'interrupted',
}

/**
 * Statistics tracked by flow controller
 */
export interface FlowStats {
  readonly fillersInjected: number;
  readonly stallsDetected: number;
  readonly chunksProcessed: number;
  readonly firstChunkTime: number | null;
  readonly totalDurationMs: number;
}

/**
 * Flow events for low-level API
 */
export type FlowEvent =
  | {
      type: 'stall-detected';
      durationMs: number;
    }
  | {
      type: 'filler-injected';
      filler: string;
    }
  | {
      type: 'first-chunk';
      chunk: string;
    }
  | {
      type: 'state-change';
      from: ConversationState;
      to: ConversationState;
    }
  | {
      type: 'interrupted';
    }
  | {
      type: 'chunk-processed';
      chunk: string;
    }
  | {
      type: 'completed';
      stats: FlowStats;
    };

/**
 * Event listener for flow events
 */
export type FlowEventListener = (event: FlowEvent) => void;

/**
 * Configuration for low-level FlowManager
 */
export interface FlowManagerConfig {
  /**
   * Stall threshold in milliseconds
   * @default 700
   */
  readonly stallThresholdMs?: number;

  /**
   * Filler phrases to inject
   * @default ['um', 'let me think', 'hmm']
   */
  readonly fillerPhrases?: readonly string[];

  /**
   * Whether to enable filler injection
   * @default true
   */
  readonly enableFillers?: boolean;

  /**
   * Maximum number of fillers to inject per response
   * @default 3
   */
  readonly maxFillersPerResponse?: number;

  /**
   * Buffer size for barge-in scenarios
   * @default 10
   */
  readonly bufferSize?: number;
}
