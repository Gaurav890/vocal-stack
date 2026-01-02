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
import { ConversationState, type FlowConfig, type FlowStats } from './types';

/**
 * High-level stream wrapper for flow control
 */
export class FlowController {
  private readonly config: Required<FlowConfig>;
  private readonly stateMachine: ConversationStateMachine;
  private readonly stallDetector: StallDetector;
  private readonly fillerInjector: FillerInjector;
  private readonly bufferManager: BufferManager;
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

  constructor(config: FlowConfig = {}) {
    this.config = {
      stallThresholdMs: config.stallThresholdMs ?? DEFAULT_STALL_THRESHOLD_MS,
      fillerPhrases: config.fillerPhrases ?? DEFAULT_FILLER_PHRASES,
      enableFillers: config.enableFillers ?? true,
      maxFillersPerResponse: config.maxFillersPerResponse ?? DEFAULT_MAX_FILLERS_PER_RESPONSE,
      onFillerInjected: config.onFillerInjected ?? (() => {}),
      onStallDetected: config.onStallDetected ?? (() => {}),
      onFirstChunk: config.onFirstChunk ?? (() => {}),
    };

    this.stateMachine = new ConversationStateMachine();
    this.fillerInjector = new FillerInjector(
      this.config.fillerPhrases,
      this.config.maxFillersPerResponse
    );
    this.bufferManager = new BufferManager(10); // Default buffer size of 10

    this.stallDetector = new StallDetector(
      this.config.stallThresholdMs,
      this.handleStall.bind(this)
    );
  }

  /**
   * Wrap an async iterable with flow control
   */
  async *wrap(input: AsyncIterable<string>): AsyncIterable<string> {
    this.reset();
    this.startTime = Date.now();
    this.stateMachine.transition(ConversationState.WAITING);
    this.stallDetector.start();

    try {
      for await (const chunk of input) {
        // Check if interrupted
        if (this.stateMachine.getState() === ConversationState.INTERRUPTED) {
          break;
        }

        this.stallDetector.notifyChunk();
        this.stats.chunksProcessed++;

        // Add to buffer before yielding
        this.bufferManager.add(chunk);

        // Handle first chunk
        if (!this.firstChunkEmitted) {
          this.firstChunkEmitted = true;
          this.stats.firstChunkTime = Date.now() - (this.startTime ?? Date.now());
          this.stateMachine.transition(ConversationState.SPEAKING);
          this.config.onFirstChunk();
        }

        yield chunk;
      }

      // Only transition to IDLE if not interrupted
      if (this.stateMachine.getState() !== ConversationState.INTERRUPTED) {
        this.stateMachine.transition(ConversationState.IDLE);
      }
    } catch (error) {
      throw new FlowControlError('Flow control error during stream processing', { error });
    } finally {
      this.stallDetector.stop();
      this.stats.totalDurationMs = Date.now() - (this.startTime ?? Date.now());
    }
  }

  /**
   * Interrupt the current flow (for barge-in)
   */
  interrupt(): void {
    const currentState = this.stateMachine.getState();
    if (currentState === ConversationState.SPEAKING || currentState === ConversationState.WAITING) {
      this.stateMachine.transition(ConversationState.INTERRUPTED);
      this.stallDetector.stop();
      this.fillerInjector.reset(); // Cancel any pending fillers
      this.bufferManager.clear(); // Clear buffered chunks
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
   * Get buffered chunks (for advanced barge-in scenarios)
   */
  getBufferedChunks(): readonly string[] {
    return this.bufferManager.getAll();
  }

  private handleStall(durationMs: number): void {
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
        this.config.onFillerInjected(filler);
      }
    }

    this.stats.stallsDetected++;
    this.config.onStallDetected(durationMs);
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

/**
 * Convenience function to create and use flow controller
 */
export function withFlowControl(
  input: AsyncIterable<string>,
  config?: FlowConfig
): AsyncIterable<string> {
  const controller = new FlowController(config);
  return controller.wrap(input);
}
