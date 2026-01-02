/**
 * Detects stream stalls based on timing
 */
export class StallDetector {
  private lastChunkTime: number | null = null;
  private stallTimer: NodeJS.Timeout | null = null;
  private readonly thresholdMs: number;
  private readonly onStall: (durationMs: number) => void;

  constructor(thresholdMs: number, onStall: (durationMs: number) => void) {
    this.thresholdMs = thresholdMs;
    this.onStall = onStall;
  }

  /**
   * Notify detector that a chunk was received
   */
  notifyChunk(): void {
    this.lastChunkTime = Date.now();
    this.clearTimer();
    this.scheduleStallCheck();
  }

  /**
   * Start monitoring for stalls
   */
  start(): void {
    this.lastChunkTime = Date.now();
    this.scheduleStallCheck();
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.clearTimer();
    this.lastChunkTime = null;
  }

  private scheduleStallCheck(): void {
    this.clearTimer();
    this.stallTimer = setTimeout(() => {
      if (this.lastChunkTime !== null) {
        const elapsed = Date.now() - this.lastChunkTime;
        if (elapsed >= this.thresholdMs) {
          this.onStall(elapsed);
          // Continue checking for additional stalls
          this.scheduleStallCheck();
        }
      }
    }, this.thresholdMs);
  }

  private clearTimer(): void {
    if (this.stallTimer) {
      clearTimeout(this.stallTimer);
      this.stallTimer = null;
    }
  }
}
