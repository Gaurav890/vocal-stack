/**
 * Manages filler phrase injection
 */
export class FillerInjector {
  private readonly phrases: readonly string[];
  private readonly maxFillers: number;
  private fillersUsed = 0;
  private lastFillerIndex = -1;

  constructor(phrases: readonly string[], maxFillers: number) {
    this.phrases = phrases;
    this.maxFillers = maxFillers;
  }

  /**
   * Get next filler phrase (returns null if limit reached)
   */
  getFiller(): string | null {
    if (this.fillersUsed >= this.maxFillers) {
      return null;
    }

    // Rotate through phrases to avoid repetition
    this.lastFillerIndex = (this.lastFillerIndex + 1) % this.phrases.length;
    this.fillersUsed++;

    return this.phrases[this.lastFillerIndex] ?? null;
  }

  /**
   * Reset filler state
   */
  reset(): void {
    this.fillersUsed = 0;
    this.lastFillerIndex = -1;
  }

  /**
   * Check if more fillers can be injected
   */
  canInjectMore(): boolean {
    return this.fillersUsed < this.maxFillers;
  }

  /**
   * Get count of fillers used
   */
  getUsedCount(): number {
    return this.fillersUsed;
  }
}
