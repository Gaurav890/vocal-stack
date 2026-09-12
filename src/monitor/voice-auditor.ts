import { MonitorError } from '../errors';
import { exportToCsv, exportToJson } from './exporters';
import { MetricsCollector } from './metrics-collector';
import type { AuditorConfig, ExportFormat, MetricsSummary, VoiceMetric } from './types';

/**
 * Voice latency auditor and profiler.
 * @deprecated Use TelemetrySink and VoiceTurn.recordStage() from vocal-stack/telemetry and /turn.
 */
export class VoiceAuditor {
  private readonly config: Required<AuditorConfig>;
  private readonly collector: MetricsCollector;
  private activeMetrics = new Map<string, VoiceMetric>();
  private activeMonotonicStarts = new Map<string, number>();

  constructor(config: AuditorConfig = {}) {
    this.config = {
      enableRealtime: config.enableRealtime ?? false,
      onMetric: config.onMetric ?? (() => {}),
      tags: config.tags ?? {},
    };
    this.collector = new MetricsCollector();
  }

  /**
   * Start tracking a new voice interaction
   */
  startTracking(id: string, tags?: Record<string, string>): VoiceMetric {
    if (this.activeMetrics.has(id)) {
      throw new MonitorError(`Metric with id ${id} is already being tracked`);
    }

    const metric: VoiceMetric = {
      id,
      timestamp: Date.now(),
      startTime: Date.now(),
      firstTokenReceivedTime: null,
      lastTokenReceivedTime: null,
      completed: false,
      metrics: {
        timeToFirstToken: null,
        totalDuration: null,
        chunkCount: 0,
        tokenCount: 0,
        averageTokenLatency: null,
      },
      tags: { ...this.config.tags, ...tags },
    };

    this.activeMetrics.set(id, metric);
    this.activeMonotonicStarts.set(id, globalThis.performance?.now() ?? Date.now());
    return metric;
  }

  /** Record the first arbitrary source chunk. */
  recordFirstToken(id: string): void {
    const metric = this.activeMetrics.get(id);
    if (!metric) {
      throw new MonitorError(`No active metric found for id ${id}`);
    }

    if (metric.firstTokenReceivedTime === null) {
      const now = Date.now();
      const monotonicNow = globalThis.performance?.now() ?? now;
      const started = this.activeMonotonicStarts.get(id) ?? monotonicNow;
      const updated: VoiceMetric = {
        ...metric,
        firstTokenReceivedTime: now,
        metrics: {
          ...metric.metrics,
          timeToFirstToken: monotonicNow - started,
          chunkCount: 1,
          tokenCount: 1,
        },
      };
      this.activeMetrics.set(id, updated);

      if (this.config.enableRealtime) {
        this.config.onMetric(updated);
      }
    }
  }

  /** Record another arbitrary source chunk. */
  recordToken(id: string): void {
    const metric = this.activeMetrics.get(id);
    if (!metric) {
      throw new MonitorError(`No active metric found for id ${id}`);
    }

    const updated: VoiceMetric = {
      ...metric,
      lastTokenReceivedTime: Date.now(),
      metrics: {
        ...metric.metrics,
        chunkCount: (metric.metrics.chunkCount ?? metric.metrics.tokenCount) + 1,
        tokenCount: metric.metrics.tokenCount + 1,
      },
    };
    this.activeMetrics.set(id, updated);
  }

  /**
   * Complete tracking for a voice interaction
   */
  completeTracking(id: string): VoiceMetric {
    const metric = this.activeMetrics.get(id);
    if (!metric) {
      throw new MonitorError(`No active metric found for id ${id}`);
    }

    const monotonicNow = globalThis.performance?.now() ?? Date.now();
    const totalDuration = monotonicNow - (this.activeMonotonicStarts.get(id) ?? monotonicNow);
    const avgLatency =
      metric.metrics.tokenCount > 0 ? totalDuration / metric.metrics.tokenCount : null;

    const completed: VoiceMetric = {
      ...metric,
      completed: true,
      outcome: 'completed',
      metrics: {
        ...metric.metrics,
        totalDuration,
        averageTokenLatency: avgLatency,
      },
    };

    this.activeMetrics.delete(id);
    this.activeMonotonicStarts.delete(id);
    this.collector.addMetric(completed);

    if (this.config.enableRealtime) {
      this.config.onMetric(completed);
    }

    return completed;
  }

  /**
   * Wrap an async iterable with automatic tracking
   */
  async *track(
    id: string,
    input: AsyncIterable<string>,
    tags?: Record<string, string>
  ): AsyncIterable<string> {
    this.startTracking(id, tags);

    let firstChunk = true;
    try {
      for await (const chunk of input) {
        if (firstChunk) {
          this.recordFirstToken(id);
          firstChunk = false;
        } else {
          this.recordToken(id);
        }
        yield chunk;
      }
      this.completeTracking(id);
    } catch (error) {
      this.failTracking(id);
      throw error;
    }
  }

  private failTracking(id: string): VoiceMetric {
    const metric = this.activeMetrics.get(id);
    if (!metric) throw new MonitorError(`No active metric found for id ${id}`);

    const monotonicNow = globalThis.performance?.now() ?? Date.now();
    const totalDuration = monotonicNow - (this.activeMonotonicStarts.get(id) ?? monotonicNow);
    const failed: VoiceMetric = {
      ...metric,
      completed: false,
      outcome: 'failed',
      metrics: {
        ...metric.metrics,
        totalDuration,
        averageTokenLatency:
          metric.metrics.tokenCount > 0 ? totalDuration / metric.metrics.tokenCount : null,
      },
    };
    this.activeMetrics.delete(id);
    this.activeMonotonicStarts.delete(id);
    this.collector.addMetric(failed);
    if (this.config.enableRealtime) this.config.onMetric(failed);
    return failed;
  }

  /**
   * Get all collected metrics
   */
  getMetrics(): readonly VoiceMetric[] {
    return this.collector.getMetrics();
  }

  /**
   * Get summary statistics
   */
  getSummary(): MetricsSummary {
    return this.collector.getSummary();
  }

  /**
   * Export metrics in specified format
   */
  export(format: ExportFormat): string {
    const metrics = this.collector.getMetrics();

    switch (format) {
      case 'json':
        return exportToJson(metrics);
      case 'csv':
        return exportToCsv(metrics);
      default:
        throw new MonitorError(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Clear all collected metrics
   */
  clear(): void {
    this.activeMetrics.clear();
    this.activeMonotonicStarts.clear();
    this.collector.clear();
  }
}
