import type { TelemetryEvent, TelemetrySink, VoiceTurnMetrics } from './types';

export function exportTelemetryJson(metrics: readonly VoiceTurnMetrics[]): string {
  return JSON.stringify({ version: 2, metrics }, null, 2);
}

export function exportTelemetryJsonl(metrics: readonly VoiceTurnMetrics[]): string {
  return metrics.map((metric) => JSON.stringify(metric)).join('\n');
}

export class MemoryTelemetrySink implements TelemetrySink {
  private readonly events: TelemetryEvent[] = [];

  record(event: TelemetryEvent): void {
    this.events.push(event);
  }

  getEvents(): readonly TelemetryEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events.length = 0;
  }
}
