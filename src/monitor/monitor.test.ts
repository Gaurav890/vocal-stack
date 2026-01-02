import { describe, expect, it, vi } from 'vitest';
import { MetricsCollector } from './metrics-collector';
import type { VoiceMetric } from './types';
import { VoiceAuditor } from './voice-auditor';

describe('VoiceAuditor', () => {
  describe('constructor', () => {
    it('should create auditor with default config', () => {
      const auditor = new VoiceAuditor();
      expect(auditor).toBeDefined();
    });

    it('should accept custom config', () => {
      const auditor = new VoiceAuditor({
        enableRealtime: true,
        tags: { env: 'test' },
      });
      expect(auditor).toBeDefined();
    });
  });

  describe('manual tracking', () => {
    it('should start tracking and return initial metric', () => {
      const auditor = new VoiceAuditor();
      const metric = auditor.startTracking('test-1');

      expect(metric.id).toBe('test-1');
      expect(metric.completed).toBe(false);
      expect(metric.metrics.tokenCount).toBe(0);
      expect(metric.metrics.timeToFirstToken).toBeNull();
    });

    it('should throw error when tracking duplicate id', () => {
      const auditor = new VoiceAuditor();
      auditor.startTracking('test-1');

      expect(() => auditor.startTracking('test-1')).toThrow('already being tracked');
    });

    it('should record first token', () => {
      const auditor = new VoiceAuditor();
      auditor.startTracking('test-1');
      auditor.recordFirstToken('test-1');

      const completed = auditor.completeTracking('test-1');
      expect(completed.metrics.timeToFirstToken).toBeGreaterThanOrEqual(0);
      expect(completed.metrics.tokenCount).toBe(1);
    });

    it('should record multiple tokens', () => {
      const auditor = new VoiceAuditor();
      auditor.startTracking('test-1');
      auditor.recordFirstToken('test-1');
      auditor.recordToken('test-1');
      auditor.recordToken('test-1');

      const completed = auditor.completeTracking('test-1');
      expect(completed.metrics.tokenCount).toBe(3);
    });

    it('should complete tracking and calculate metrics', () => {
      const auditor = new VoiceAuditor();
      auditor.startTracking('test-1');
      auditor.recordFirstToken('test-1');
      auditor.recordToken('test-1');

      const completed = auditor.completeTracking('test-1');

      expect(completed.completed).toBe(true);
      expect(completed.metrics.totalDuration).toBeGreaterThanOrEqual(0);
      expect(completed.metrics.averageTokenLatency).toBeGreaterThanOrEqual(0);
    });

    it('should throw error when recording for non-existent id', () => {
      const auditor = new VoiceAuditor();
      expect(() => auditor.recordFirstToken('non-existent')).toThrow('No active metric');
    });

    it('should include custom tags', () => {
      const auditor = new VoiceAuditor({ tags: { env: 'test' } });
      auditor.startTracking('test-1', { user: 'john' });

      const completed = auditor.completeTracking('test-1');
      expect(completed.tags.env).toBe('test');
      expect(completed.tags.user).toBe('john');
    });
  });

  describe('automatic stream tracking', () => {
    it('should track async iterable automatically', async () => {
      const auditor = new VoiceAuditor();

      async function* mockStream() {
        yield 'chunk1';
        yield 'chunk2';
        yield 'chunk3';
      }

      const chunks: string[] = [];
      for await (const chunk of auditor.track('test-1', mockStream())) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['chunk1', 'chunk2', 'chunk3']);

      const metrics = auditor.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0]?.id).toBe('test-1');
      expect(metrics[0]?.metrics.tokenCount).toBe(3);
      expect(metrics[0]?.completed).toBe(true);
    });

    it('should record first token time in stream', async () => {
      const auditor = new VoiceAuditor();

      async function* mockStream() {
        yield 'first';
        yield 'second';
      }

      const chunks: string[] = [];
      for await (const chunk of auditor.track('test-1', mockStream())) {
        chunks.push(chunk);
      }

      const metrics = auditor.getMetrics();
      expect(metrics[0]?.metrics.timeToFirstToken).toBeGreaterThanOrEqual(0);
    });

    it('should complete tracking even if stream throws', async () => {
      const auditor = new VoiceAuditor();

      async function* mockStream() {
        yield 'chunk1';
        throw new Error('Stream error');
      }

      try {
        for await (const _chunk of auditor.track('test-1', mockStream())) {
          // Process chunks
        }
      } catch {
        // Expected error
      }

      const metrics = auditor.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0]?.completed).toBe(true);
    });
  });

  describe('realtime monitoring', () => {
    it('should call onMetric callback when enabled', () => {
      const onMetric = vi.fn();
      const auditor = new VoiceAuditor({
        enableRealtime: true,
        onMetric,
      });

      auditor.startTracking('test-1');
      auditor.recordFirstToken('test-1');
      expect(onMetric).toHaveBeenCalledTimes(1);

      auditor.completeTracking('test-1');
      expect(onMetric).toHaveBeenCalledTimes(2);
    });

    it('should not call onMetric when realtime disabled', () => {
      const onMetric = vi.fn();
      const auditor = new VoiceAuditor({
        enableRealtime: false,
        onMetric,
      });

      auditor.startTracking('test-1');
      auditor.recordFirstToken('test-1');
      auditor.completeTracking('test-1');

      expect(onMetric).not.toHaveBeenCalled();
    });
  });

  describe('metrics collection', () => {
    it('should collect multiple metrics', () => {
      const auditor = new VoiceAuditor();

      auditor.startTracking('test-1');
      auditor.completeTracking('test-1');

      auditor.startTracking('test-2');
      auditor.completeTracking('test-2');

      const metrics = auditor.getMetrics();
      expect(metrics).toHaveLength(2);
    });

    it('should generate summary statistics', () => {
      const auditor = new VoiceAuditor();

      // Create metrics with known values
      auditor.startTracking('test-1');
      auditor.recordFirstToken('test-1');
      auditor.completeTracking('test-1');

      auditor.startTracking('test-2');
      auditor.recordFirstToken('test-2');
      auditor.completeTracking('test-2');

      const summary = auditor.getSummary();
      expect(summary.count).toBe(2);
      expect(summary.avgTimeToFirstToken).toBeGreaterThanOrEqual(0);
      expect(summary.avgTotalDuration).toBeGreaterThanOrEqual(0);
    });

    it('should clear all metrics', () => {
      const auditor = new VoiceAuditor();

      auditor.startTracking('test-1');
      auditor.completeTracking('test-1');

      auditor.clear();

      const metrics = auditor.getMetrics();
      expect(metrics).toHaveLength(0);
    });
  });

  describe('export functionality', () => {
    it('should export to JSON format', () => {
      const auditor = new VoiceAuditor();

      auditor.startTracking('test-1');
      auditor.completeTracking('test-1');

      const json = auditor.export('json');
      expect(json).toContain('"id": "test-1"');
      expect(json).toContain('"exportedAt"');

      const parsed = JSON.parse(json);
      expect(parsed.count).toBe(1);
      expect(parsed.metrics).toHaveLength(1);
    });

    it('should export to CSV format', () => {
      const auditor = new VoiceAuditor();

      auditor.startTracking('test-1');
      auditor.completeTracking('test-1');

      const csv = auditor.export('csv');
      expect(csv).toContain('id,timestamp');
      expect(csv).toContain('test-1');

      const lines = csv.split('\n');
      expect(lines.length).toBeGreaterThan(1); // Header + data
    });

    it('should throw error for unsupported format', () => {
      const auditor = new VoiceAuditor();
      // @ts-expect-error Testing invalid format
      expect(() => auditor.export('xml')).toThrow('Unsupported export format');
    });
  });
});

describe('MetricsCollector', () => {
  it('should add and retrieve metrics', () => {
    const collector = new MetricsCollector();
    const metric: VoiceMetric = {
      id: 'test-1',
      timestamp: Date.now(),
      startTime: Date.now(),
      firstTokenReceivedTime: Date.now(),
      lastTokenReceivedTime: Date.now(),
      completed: true,
      metrics: {
        timeToFirstToken: 100,
        totalDuration: 500,
        tokenCount: 5,
        averageTokenLatency: 100,
      },
      tags: {},
    };

    collector.addMetric(metric);
    const metrics = collector.getMetrics();

    expect(metrics).toHaveLength(1);
    expect(metrics[0]?.id).toBe('test-1');
  });

  it('should calculate summary with empty metrics', () => {
    const collector = new MetricsCollector();
    const summary = collector.getSummary();

    expect(summary.count).toBe(0);
    expect(summary.avgTimeToFirstToken).toBe(0);
  });

  it('should calculate percentiles correctly', () => {
    const collector = new MetricsCollector();

    // Add metrics with known TTFT values: 100, 200, 300, 400, 500
    for (let i = 1; i <= 5; i++) {
      const metric: VoiceMetric = {
        id: `test-${i}`,
        timestamp: Date.now(),
        startTime: Date.now(),
        firstTokenReceivedTime: Date.now(),
        lastTokenReceivedTime: Date.now(),
        completed: true,
        metrics: {
          timeToFirstToken: i * 100,
          totalDuration: i * 200,
          tokenCount: i,
          averageTokenLatency: 100,
        },
        tags: {},
      };
      collector.addMetric(metric);
    }

    const summary = collector.getSummary();
    expect(summary.count).toBe(5);
    expect(summary.avgTimeToFirstToken).toBe(300); // (100+200+300+400+500)/5
    expect(summary.p50TimeToFirstToken).toBe(300); // Median
    expect(summary.minTimeToFirstToken).toBe(100);
    expect(summary.maxTimeToFirstToken).toBe(500);
  });

  it('should clear metrics', () => {
    const collector = new MetricsCollector();
    const metric: VoiceMetric = {
      id: 'test-1',
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
      tags: {},
    };

    collector.addMetric(metric);
    collector.clear();

    const metrics = collector.getMetrics();
    expect(metrics).toHaveLength(0);
  });
});
