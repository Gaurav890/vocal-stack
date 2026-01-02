/**
 * Mock stream generators for testing
 */

/**
 * Create a mock stream that yields chunks with a delay
 */
export async function* createMockStream(chunks: string[], delayMs = 0): AsyncIterable<string> {
  for (const chunk of chunks) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    yield chunk;
  }
}

/**
 * Create a mock stream with stalls at specific indexes
 */
export async function* createStallStream(
  chunks: string[],
  stallIndexes: number[],
  stallMs: number
): AsyncIterable<string> {
  for (let i = 0; i < chunks.length; i++) {
    if (stallIndexes.includes(i)) {
      await new Promise((resolve) => setTimeout(resolve, stallMs));
    }
    yield chunks[i];
  }
}

/**
 * Create a mock LLM stream with realistic chunking
 */
export async function* createMockLLMStream(
  text: string,
  options: {
    chunkSize?: number;
    initialDelayMs?: number;
    chunkDelayMs?: number;
  } = {}
): AsyncIterable<string> {
  const { chunkSize = 5, initialDelayMs = 0, chunkDelayMs = 10 } = options;

  if (initialDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, initialDelayMs));
  }

  // Split text into chunks
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  for (const chunk of chunks) {
    if (chunkDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, chunkDelayMs));
    }
    yield chunk;
  }
}

/**
 * Create a mock stream that can be interrupted
 */
export class InterruptibleMockStream {
  private interrupted = false;
  private chunks: string[];

  constructor(chunks: string[]) {
    this.chunks = chunks;
  }

  interrupt(): void {
    this.interrupted = true;
  }

  async *stream(delayMs = 0): AsyncIterable<string> {
    for (const chunk of this.chunks) {
      if (this.interrupted) {
        break;
      }
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      yield chunk;
    }
  }
}

/**
 * Create a mock stream that throws an error at a specific index
 */
export async function* createErrorStream(
  chunks: string[],
  errorAtIndex: number,
  error: Error
): AsyncIterable<string> {
  for (let i = 0; i < chunks.length; i++) {
    if (i === errorAtIndex) {
      throw error;
    }
    yield chunks[i];
  }
}
