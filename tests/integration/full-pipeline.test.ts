import { describe, expect, it } from 'vitest';
import { FlowController } from '../../src/flow';
import { VoiceAuditor } from '../../src/monitor';
import { SpeechSanitizer } from '../../src/sanitizer';
import { createMockLLMStream, createStallStream } from '../helpers';

describe('Integration: Full Pipeline', () => {
  it('should compose Sanitizer → Flow → Monitor', async () => {
    // Setup
    const sanitizer = new SpeechSanitizer({
      rules: ['markdown', 'urls', 'code-blocks'],
    });

    const flowController = new FlowController({
      stallThresholdMs: 1000,
      enableFillers: false,
    });

    const auditor = new VoiceAuditor();

    // Mock LLM output with markdown
    const llmText = '# Hello\n\nHere is a [link](https://example.com) and some **bold** text.';

    // Process: LLM → Sanitize → Flow Control → Monitor
    const sanitized = sanitizer.sanitizeStream(createMockLLMStream(llmText, { chunkSize: 10 }));
    const controlled = flowController.wrap(sanitized);
    const monitored = auditor.track('test-request', controlled);

    const result: string[] = [];
    for await (const chunk of monitored) {
      result.push(chunk);
    }

    // Verify sanitization (markdown removed)
    const finalText = result.join('');
    expect(finalText).not.toContain('#');
    expect(finalText).not.toContain('[link]');
    expect(finalText).not.toContain('**');
    expect(finalText).toContain('Hello');

    // Verify flow control stats
    const flowStats = flowController.getStats();
    expect(flowStats.chunksProcessed).toBeGreaterThan(0);
    expect(flowStats.firstChunkTime).toBeGreaterThanOrEqual(0);

    // Verify monitoring stats
    const monitorStats = auditor.getSummary();
    expect(monitorStats.count).toBe(1);
    expect(monitorStats.avgTimeToFirstToken).toBeGreaterThanOrEqual(0);
  });

  it('should handle stalls with filler injection', async () => {
    const flowController = new FlowController({
      stallThresholdMs: 50,
      enableFillers: true,
      fillerPhrases: ['um'],
      onFillerInjected: (filler) => {
        expect(filler).toBe('um');
      },
    });

    const auditor = new VoiceAuditor();

    // Create stream with stall before first chunk
    const chunks = ['Hello', 'World'];
    const stalledStream = createStallStream(chunks, [0], 1000);

    const controlled = flowController.wrap(stalledStream);
    const monitored = auditor.track('stall-test', controlled);

    const result: string[] = [];
    for await (const chunk of monitored) {
      result.push(chunk);
    }

    expect(result).toEqual(['Hello', 'World']);

    // Verify filler was injected
    const flowStats = flowController.getStats();
    expect(flowStats.fillersInjected).toBeGreaterThan(0);
    expect(flowStats.stallsDetected).toBeGreaterThan(0);
  });

  it('should handle barge-in interruption', async () => {
    const flowController = new FlowController();
    const auditor = new VoiceAuditor();

    async function* mockStream() {
      yield 'First chunk';
      yield 'Second chunk';
      flowController.interrupt(); // Simulate barge-in
      yield 'Third chunk'; // Should not be processed
      yield 'Fourth chunk';
    }

    const controlled = flowController.wrap(mockStream());
    const monitored = auditor.track('interrupt-test', controlled);

    const result: string[] = [];
    for await (const chunk of monitored) {
      result.push(chunk);
    }

    // Only first two chunks should be processed
    expect(result).toEqual(['First chunk', 'Second chunk']);

    // Buffer should be cleared after interrupt
    expect(flowController.getBufferedChunks()).toEqual([]);

    // Verify monitoring tracked the interruption
    const metrics = auditor.getMetrics();
    const metric = metrics.find((m) => m.id === 'interrupt-test');
    expect(metric).toBeDefined();
    expect(metric?.metrics.tokenCount).toBe(2);
  });

  it('should track performance metrics end-to-end', async () => {
    const sanitizer = new SpeechSanitizer({
      rules: ['markdown', 'punctuation'],
    });

    const flowController = new FlowController({
      stallThresholdMs: 1000,
    });

    const auditor = new VoiceAuditor({ enableRealtime: true });

    const text = '## Testing Performance\n\nThis is a test with some **bold** content.';
    const stream = createMockLLMStream(text, {
      chunkSize: 8,
      initialDelayMs: 10,
      chunkDelayMs: 5,
    });

    const pipeline = auditor.track(
      'perf-test',
      flowController.wrap(sanitizer.sanitizeStream(stream))
    );

    const chunks: string[] = [];
    for await (const chunk of pipeline) {
      chunks.push(chunk);
    }

    // Verify complete pipeline
    expect(chunks.length).toBeGreaterThan(0);

    // Verify flow stats
    const flowStats = flowController.getStats();
    expect(flowStats.chunksProcessed).toBe(chunks.length);
    expect(flowStats.totalDurationMs).toBeGreaterThan(0);

    // Verify monitoring
    const metrics = auditor.getMetrics();
    const metric = metrics.find((m) => m.id === 'perf-test');
    expect(metric?.metrics.timeToFirstToken).toBeGreaterThanOrEqual(0);
    expect(metric?.metrics.totalDuration).toBeGreaterThanOrEqual(0);
    expect(metric?.metrics.tokenCount).toBe(chunks.length);
  });

  it('should handle errors gracefully', async () => {
    const sanitizer = new SpeechSanitizer();
    const flowController = new FlowController();

    async function* errorStream() {
      yield 'chunk1';
      throw new Error('Stream error');
    }

    const pipeline = flowController.wrap(sanitizer.sanitizeStream(errorStream()));

    await expect(async () => {
      for await (const _chunk of pipeline) {
        // Process
      }
    }).rejects.toThrow('Flow control error');
  });

  it('should export monitoring data with sanitized content', async () => {
    const sanitizer = new SpeechSanitizer({ rules: ['urls'] });
    const flowController = new FlowController();
    const auditor = new VoiceAuditor();

    const text = 'Check out https://example.com for more info';
    const stream = createMockLLMStream(text, { chunkSize: 10 });

    const pipeline = auditor.track(
      'export-test',
      flowController.wrap(sanitizer.sanitizeStream(stream))
    );

    for await (const _chunk of pipeline) {
      // Process
    }

    // Export metrics as JSON
    const jsonExport = auditor.export('json');
    expect(jsonExport).toContain('export-test');
    expect(jsonExport).toContain('timeToFirstToken');

    // Export as CSV
    const csvExport = auditor.export('csv');
    expect(csvExport).toContain('id,');
    expect(csvExport).toContain('timeToFirstToken');
    expect(csvExport).toContain('export-test');
  });
});
