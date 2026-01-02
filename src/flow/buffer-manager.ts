/**
 * Buffer manager for barge-in scenarios
 */
export class BufferManager {
  private buffer: string[] = [];
  private readonly maxSize: number;
  private head = 0;
  private size = 0;

  constructor(maxSize = 10) {
    if (maxSize <= 0) {
      throw new Error('Buffer size must be positive');
    }
    this.maxSize = maxSize;
  }

  /**
   * Add chunk to buffer
   */
  add(chunk: string): void {
    if (this.size < this.maxSize) {
      this.buffer.push(chunk);
      this.size++;
    } else {
      // Circular buffer - overwrite oldest
      this.buffer[this.head] = chunk;
      this.head = (this.head + 1) % this.maxSize;
    }
  }

  /**
   * Get all buffered chunks in order
   */
  getAll(): readonly string[] {
    if (this.size < this.maxSize) {
      return [...this.buffer];
    }

    // Return in order: from head to end, then from start to head
    return [...this.buffer.slice(this.head), ...this.buffer.slice(0, this.head)];
  }

  /**
   * Clear all buffered chunks
   */
  clear(): void {
    this.buffer = [];
    this.head = 0;
    this.size = 0;
  }

  /**
   * Get current buffer size
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Check if buffer is full
   */
  isFull(): boolean {
    return this.size === this.maxSize;
  }
}
