import type { VoiceMetric } from '../types';

/**
 * Export metrics to CSV format
 */
export function exportToCsv(metrics: readonly VoiceMetric[]): string {
  const headers = [
    'id',
    'timestamp',
    'completed',
    'timeToFirstToken',
    'totalDuration',
    'tokenCount',
    'averageTokenLatency',
    'tags',
  ];

  const rows = metrics.map((m) => [
    m.id,
    m.timestamp.toString(),
    m.completed.toString(),
    m.metrics.timeToFirstToken?.toString() ?? '',
    m.metrics.totalDuration?.toString() ?? '',
    m.metrics.tokenCount.toString(),
    m.metrics.averageTokenLatency?.toString() ?? '',
    JSON.stringify(m.tags),
  ]);

  const csvLines = [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((cell) => {
          // Escape commas and quotes in cell values
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(',')
    ),
  ];

  return csvLines.join('\n');
}
