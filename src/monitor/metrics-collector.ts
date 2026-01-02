import type { MetricsSummary, VoiceMetric } from './types';

/**
 * Collects and aggregates metrics
 */
export class MetricsCollector {
  private metrics: VoiceMetric[] = [];

  addMetric(metric: VoiceMetric): void {
    this.metrics.push(metric);
  }

  getMetrics(): readonly VoiceMetric[] {
    return [...this.metrics];
  }

  getSummary(): MetricsSummary {
    if (this.metrics.length === 0) {
      return {
        count: 0,
        avgTimeToFirstToken: 0,
        avgTotalDuration: 0,
        p50TimeToFirstToken: 0,
        p95TimeToFirstToken: 0,
        p99TimeToFirstToken: 0,
        minTimeToFirstToken: 0,
        maxTimeToFirstToken: 0,
      };
    }

    const ttfts = this.metrics
      .map((m) => m.metrics.timeToFirstToken)
      .filter((t): t is number => t !== null)
      .sort((a, b) => a - b);

    const durations = this.metrics
      .map((m) => m.metrics.totalDuration)
      .filter((d): d is number => d !== null);

    const percentile = (arr: number[], p: number): number => {
      if (arr.length === 0) return 0;
      const index = Math.ceil(arr.length * p) - 1;
      return arr[index] ?? 0;
    };

    return {
      count: this.metrics.length,
      avgTimeToFirstToken: ttfts.reduce((a, b) => a + b, 0) / ttfts.length || 0,
      avgTotalDuration: durations.reduce((a, b) => a + b, 0) / durations.length || 0,
      p50TimeToFirstToken: percentile(ttfts, 0.5),
      p95TimeToFirstToken: percentile(ttfts, 0.95),
      p99TimeToFirstToken: percentile(ttfts, 0.99),
      minTimeToFirstToken: ttfts.length > 0 ? Math.min(...ttfts) : 0,
      maxTimeToFirstToken: ttfts.length > 0 ? Math.max(...ttfts) : 0,
    };
  }

  clear(): void {
    this.metrics = [];
  }
}
