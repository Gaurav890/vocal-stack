/**
 * Default stall threshold in milliseconds
 * Based on human perception of silence: 500-1000ms feels like a pause
 * Most LLM APIs stream chunks every 50-200ms when active
 */
export const DEFAULT_STALL_THRESHOLD_MS = 700;

/**
 * Default filler phrases to inject during stalls
 */
export const DEFAULT_FILLER_PHRASES = ['um', 'let me think', 'hmm'];

/**
 * Default maximum fillers per response
 * Prevents over-use of filler words
 */
export const DEFAULT_MAX_FILLERS_PER_RESPONSE = 3;
