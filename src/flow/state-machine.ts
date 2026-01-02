import { FlowControlError } from '../errors';
import { ConversationState } from './types';

/**
 * Valid state transitions
 * IDLE → SPEAKING/WAITING
 * WAITING → SPEAKING/IDLE/INTERRUPTED
 * SPEAKING → INTERRUPTED/IDLE
 * INTERRUPTED → IDLE/WAITING
 */
const VALID_TRANSITIONS: ReadonlyMap<ConversationState, readonly ConversationState[]> = new Map([
  [ConversationState.IDLE, [ConversationState.SPEAKING, ConversationState.WAITING]],
  [
    ConversationState.WAITING,
    [ConversationState.SPEAKING, ConversationState.IDLE, ConversationState.INTERRUPTED],
  ],
  [ConversationState.SPEAKING, [ConversationState.INTERRUPTED, ConversationState.IDLE]],
  [ConversationState.INTERRUPTED, [ConversationState.IDLE, ConversationState.WAITING]],
]);

/**
 * Conversation state machine
 */
export class ConversationStateMachine {
  private currentState: ConversationState = ConversationState.IDLE;
  private readonly listeners: Set<(from: ConversationState, to: ConversationState) => void> =
    new Set();

  /**
   * Get current state
   */
  getState(): ConversationState {
    return this.currentState;
  }

  /**
   * Attempt to transition to new state
   */
  transition(to: ConversationState): boolean {
    const validTransitions = VALID_TRANSITIONS.get(this.currentState);

    if (!validTransitions?.includes(to)) {
      throw new FlowControlError(`Invalid state transition: ${this.currentState} -> ${to}`, {
        from: this.currentState,
        to,
      });
    }

    const from = this.currentState;
    this.currentState = to;

    // Notify listeners
    for (const listener of this.listeners) {
      listener(from, to);
    }

    return true;
  }

  /**
   * Add state change listener
   */
  onStateChange(listener: (from: ConversationState, to: ConversationState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Reset to IDLE
   */
  reset(): void {
    this.currentState = ConversationState.IDLE;
  }
}
