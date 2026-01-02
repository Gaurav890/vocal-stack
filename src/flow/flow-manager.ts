import { FlowControlError } from '../errors';
import { BufferManager } from './buffer-manager';
import {
  DEFAULT_FILLER_PHRASES,
  DEFAULT_MAX_FILLERS_PER_RESPONSE,
  DEFAULT_STALL_THRESHOLD_MS,
} from './constants';
import { FillerInjector } from './filler-injector';
import { StallDetector } from './stall-detector';
import { ConversationStateMachine } from './state-machine';
import {
  ConversationState,
  type FlowEvent,
  type FlowEventListener,
  type FlowManagerConfig,
  type FlowStats,
} from './types';

/**
 * Low-level event-based flow manager
 */
export class FlowManager {
  private readonly config: Required<FlowManagerConfig>;
  private readonly stateMachine: ConversationStateMachine;
  private readonly stallDetector: StallDetector;
  private readonly fillerInjector: FillerInjector;
  private readonly bufferManager: BufferManager;
  private readonly listeners: Set<FlowEventListener> = new Set();
  private firstChunkEmitted = false;
  private stats: {
    fillersInjected: number;
    stallsDetected: number;
    chunksProcessed: number;
    firstChunkTime: number | null;
    totalDurationMs: number;
  } = {
    fillersInjected: 0,
    stallsDetected: 0,
    chunksProcessed: 0,
    firstChunkTime: null,
    totalDurationMs: 0,
  };
  private startTime: number | null = null;
  private stateChangeUnsubscribe: (() => void) | null = null;

  constructor(config: FlowManagerConfig = {}) {
    this.config = {
      stallThresholdMs: config.stallThresholdMs ?? DEFAULT_STALL_THRESHOLD_MS,
      fillerPhrases: config.fillerPhrases ?? DEFAULT_FILLER_PHRASES,
      enableFillers: config.enableFillers ?? true,
      maxFillersPerResponse: config.maxFillersPerResponse ?? DEFAULT_MAX_FILLERS_PER_RESPONSE,
      bufferSize: config.bufferSize ?? 10,
    };

    this.stateMachine = new ConversationStateMachine();
    this.fillerInjector = new FillerInjector(
      this.config.fillerPhrases,
      this.config.maxFillersPerResponse
    );
    this.bufferManager = new BufferManager(this.config.bufferSize);
    this.stallDetector = new StallDetector(
      this.config.stallThresholdMs,
      this.handleStall.bind(this)
    );
  }

  /**
   * Add event listener
   */
  on(listener: FlowEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Start flow tracking
   */
  start(): void {
    if (this.startTime !== null) {
      throw new FlowControlError('FlowManager already started');
    }

    this.reset();
    this.startTime = Date.now();
    this.stateMachine.transition(ConversationState.WAITING);
    this.stallDetector.start();

    // Listen to state changes
    this.stateChangeUnsubscribe = this.stateMachine.onStateChange((from, to) => {
      this.emit({
        type: 'state-change',
        from,
        to,
      });
    });
  }

  /**
   * Process a chunk from the stream
   */
  processChunk(chunk: string): void {
    if (this.startTime === null) {
      throw new FlowControlError('FlowManager not started. Call start() first.');
    }

    // Check if interrupted
    if (this.stateMachine.getState() === ConversationState.INTERRUPTED) {
      return;
    }

    this.stallDetector.notifyChunk();
    this.stats.chunksProcessed++;

    // Add to buffer
    this.bufferManager.add(chunk);

    // Handle first chunk
    if (!this.firstChunkEmitted) {
      this.firstChunkEmitted = true;
      this.stats.firstChunkTime = Date.now() - this.startTime;
      this.stateMachine.transition(ConversationState.SPEAKING);
      this.emit({
        type: 'first-chunk',
        chunk,
      });
    }

    this.emit({
      type: 'chunk-processed',
      chunk,
    });
  }

  /**
   * Complete the flow
   */
  complete(): void {
    if (this.startTime === null) {
      throw new FlowControlError('FlowManager not started');
    }

    this.stallDetector.stop();
    this.stats.totalDurationMs = Date.now() - this.startTime;

    // Only transition to IDLE if not interrupted
    if (this.stateMachine.getState() !== ConversationState.INTERRUPTED) {
      this.stateMachine.transition(ConversationState.IDLE);
    }

    this.emit({
      type: 'completed',
      stats: this.getStats(),
    });

    // Cleanup
    if (this.stateChangeUnsubscribe) {
      this.stateChangeUnsubscribe();
      this.stateChangeUnsubscribe = null;
    }

    this.startTime = null;
  }

  /**
   * Interrupt the flow (for barge-in)
   */
  interrupt(): void {
    const currentState = this.stateMachine.getState();
    if (currentState === ConversationState.SPEAKING || currentState === ConversationState.WAITING) {
      this.stateMachine.transition(ConversationState.INTERRUPTED);
      this.stallDetector.stop();
      this.fillerInjector.reset();
      this.bufferManager.clear();

      this.emit({
        type: 'interrupted',
      });
    }
  }

  /**
   * Get current conversation state
   */
  getState(): ConversationState {
    return this.stateMachine.getState();
  }

  /**
   * Get flow statistics
   */
  getStats(): FlowStats {
    return { ...this.stats };
  }

  /**
   * Get buffered chunks
   */
  getBufferedChunks(): readonly string[] {
    return this.bufferManager.getAll();
  }

  private handleStall(durationMs: number): void {
    this.stats.stallsDetected++;

    this.emit({
      type: 'stall-detected',
      durationMs,
    });

    // Only inject fillers if:
    // 1. Fillers are enabled
    // 2. First chunk hasn't been emitted yet
    // 3. Not interrupted
    if (
      this.config.enableFillers &&
      !this.firstChunkEmitted &&
      this.stateMachine.getState() !== ConversationState.INTERRUPTED
    ) {
      const filler = this.fillerInjector.getFiller();
      if (filler) {
        this.stats.fillersInjected++;
        this.emit({
          type: 'filler-injected',
          filler,
        });
      }
    }
  }

  private emit(event: FlowEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        // Don't let listener errors break the flow
        console.error('Error in FlowManager event listener:', error);
      }
    }
  }

  private reset(): void {
    this.firstChunkEmitted = false;
    this.fillerInjector.reset();
    this.bufferManager.clear();
    this.stats = {
      fillersInjected: 0,
      stallsDetected: 0,
      chunksProcessed: 0,
      firstChunkTime: null,
      totalDurationMs: 0,
    };
  }
}
