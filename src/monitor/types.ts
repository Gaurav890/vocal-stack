/**
 * Configuration for voice auditor
 */
export interface AuditorConfig {
  /**
   * Whether to enable real-time monitoring
   * @default false
   */
  readonly enableRealtime?: boolean;

  /**
   * Callback for real-time metrics
   */
  readonly onMetric?: (metric: VoiceMetric) => void;

  /**
   * Custom tags to attach to metrics
   */
  readonly tags?: Record<string, string>;
}

/**
 * Voice latency metric
 */
export interface VoiceMetric {
  readonly id: string;
  readonly timestamp: number;
  readonly startTime: number;
  readonly firstTokenReceivedTime: number | null;
  readonly lastTokenReceivedTime: number | null;
  readonly completed: boolean;
  readonly metrics: {
    readonly timeToFirstToken: number | null; // ms
    readonly totalDuration: number | null; // ms
    readonly tokenCount: number;
    readonly averageTokenLatency: number | null; // ms
  };
  readonly tags: Record<string, string>;
}

/**
 * Summary statistics
 */
export interface MetricsSummary {
  readonly count: number;
  readonly avgTimeToFirstToken: number;
  readonly avgTotalDuration: number;
  readonly p50TimeToFirstToken: number;
  readonly p95TimeToFirstToken: number;
  readonly p99TimeToFirstToken: number;
  readonly minTimeToFirstToken: number;
  readonly maxTimeToFirstToken: number;
}

/**
 * Export format options
 */
export type ExportFormat = 'json' | 'csv';
