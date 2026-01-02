import type { VoiceMetric } from '../types';

/**
 * Export metrics to JSON format
 */
export function exportToJson(metrics: readonly VoiceMetric[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      count: metrics.length,
      metrics: metrics.map((m) => ({
        id: m.id,
        timestamp: m.timestamp,
        completed: m.completed,
        timeToFirstToken: m.metrics.timeToFirstToken,
        totalDuration: m.metrics.totalDuration,
        tokenCount: m.metrics.tokenCount,
        averageTokenLatency: m.metrics.averageTokenLatency,
        tags: m.tags,
      })),
    },
    null,
    2
  );
}
