/**
 * Mock TTS provider for testing
 */

export interface TTSChunk {
  text: string;
  timestamp: number;
}

export class MockTTSProvider {
  private chunks: TTSChunk[] = [];
  private interrupted = false;

  /**
   * Send text to TTS (simulates TTS API call)
   */
  async send(text: string): Promise<void> {
    if (this.interrupted) {
      return;
    }

    // Simulate API latency
    await new Promise((resolve) => setTimeout(resolve, 5));

    this.chunks.push({
      text,
      timestamp: Date.now(),
    });
  }

  /**
   * Get all chunks sent to TTS
   */
  getChunks(): TTSChunk[] {
    return [...this.chunks];
  }

  /**
   * Get text of all chunks
   */
  getText(): string {
    return this.chunks.map((c) => c.text).join('');
  }

  /**
   * Get count of chunks sent
   */
  getCount(): number {
    return this.chunks.length;
  }

  /**
   * Clear all chunks
   */
  clear(): void {
    this.chunks = [];
    this.interrupted = false;
  }

  /**
   * Interrupt TTS (simulates barge-in)
   */
  interrupt(): void {
    this.interrupted = true;
  }

  /**
   * Check if interrupted
   */
  isInterrupted(): boolean {
    return this.interrupted;
  }

  /**
   * Get timing statistics
   */
  getTimingStats(): {
    firstChunkTime: number | null;
    lastChunkTime: number | null;
    totalDuration: number;
  } {
    if (this.chunks.length === 0) {
      return {
        firstChunkTime: null,
        lastChunkTime: null,
        totalDuration: 0,
      };
    }

    const first = this.chunks[0].timestamp;
    const last = this.chunks[this.chunks.length - 1].timestamp;

    return {
      firstChunkTime: first,
      lastChunkTime: last,
      totalDuration: last - first,
    };
  }
}
