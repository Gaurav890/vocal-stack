import { MonitorError } from '../errors';
import { exportToCsv, exportToJson } from './exporters';
import { MetricsCollector } from './metrics-collector';
import type { AuditorConfig, ExportFormat, MetricsSummary, VoiceMetric } from './types';

/**
 * Voice latency auditor and profiler
 */
export class VoiceAuditor {
  private readonly config: Required<AuditorConfig>;
  private readonly collector: MetricsCollector;
  private activeMetrics = new Map<string, VoiceMetric>();

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
        tokenCount: 0,
        averageTokenLatency: null,
      },
      tags: { ...this.config.tags, ...tags },
    };

    this.activeMetrics.set(id, metric);
    return metric;
  }

  /**
   * Record first token received
   */
  recordFirstToken(id: string): void {
    const metric = this.activeMetrics.get(id);
    if (!metric) {
      throw new MonitorError(`No active metric found for id ${id}`);
    }

    if (metric.firstTokenReceivedTime === null) {
      const updated: VoiceMetric = {
        ...metric,
        firstTokenReceivedTime: Date.now(),
        metrics: {
          ...metric.metrics,
          timeToFirstToken: Date.now() - metric.startTime,
          tokenCount: 1,
        },
      };
      this.activeMetrics.set(id, updated);

      if (this.config.enableRealtime) {
        this.config.onMetric(updated);
      }
    }
  }

  /**
   * Record token received
   */
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

    const lastTime = metric.lastTokenReceivedTime ?? Date.now();
    const totalDuration = lastTime - metric.startTime;
    const avgLatency =
      metric.metrics.tokenCount > 0 ? totalDuration / metric.metrics.tokenCount : null;

    const completed: VoiceMetric = {
      ...metric,
      completed: true,
      metrics: {
        ...metric.metrics,
        totalDuration,
        averageTokenLatency: avgLatency,
      },
    };

    this.activeMetrics.delete(id);
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

    let firstToken = true;
    try {
      for await (const chunk of input) {
        if (firstToken) {
          this.recordFirstToken(id);
          firstToken = false;
        } else {
          this.recordToken(id);
        }
        yield chunk;
      }
    } finally {
      this.completeTracking(id);
    }
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
    this.collector.clear();
  }
}
