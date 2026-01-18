import { describe, expect, it } from 'vitest';
import { type FlowEvent, FlowManager } from '../../src/flow';
import { VoiceAuditor } from '../../src/monitor';
import { SpeechSanitizer } from '../../src/sanitizer';
import { MockTTSProvider, createMockStream } from '../helpers';

describe('Integration: Advanced Flow Control', () => {
  it('should use low-level FlowManager with event handling', async () => {
    const manager = new FlowManager({
      stallThresholdMs: 50,
      enableFillers: true,
      fillerPhrases: ['um'],
    });

    const tts = new MockTTSProvider();
    const events: FlowEvent[] = [];

    manager.on((event) => {
      events.push(event);

      // Send fillers to TTS
      if (event.type === 'filler-injected') {
        tts.send(event.filler);
      }
    });

    manager.start();

    // Simulate stall before first chunk
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Process chunks
    const chunks = ['Hello', 'World'];
    for (const chunk of chunks) {
      manager.processChunk(chunk);
      await tts.send(chunk);
    }

    manager.complete();

    // Verify events
    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('stall-detected');
    expect(eventTypes).toContain('filler-injected');
    expect(eventTypes).toContain('first-chunk');
    expect(eventTypes).toContain('chunk-processed');
    expect(eventTypes).toContain('completed');

    // Verify TTS received filler + chunks
    const ttsText = tts.getText();
    expect(ttsText).toContain('um'); // Filler
    expect(ttsText).toContain('Hello');
    expect(ttsText).toContain('World');
  });

  it('should handle complex barge-in with buffer inspection', async () => {
    const manager = new FlowManager({ bufferSize: 5 });
    const tts = new MockTTSProvider();

    manager.on(async (event) => {
      if (event.type === 'chunk-processed') {
        await tts.send(event.chunk);
      }
    });

    manager.start();

    // Send several chunks
    const chunks = ['one', 'two', 'three', 'four', 'five'];
    for (const chunk of chunks) {
      manager.processChunk(chunk);
      // Wait for TTS to process
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Check buffer before interrupt
    const buffered = manager.getBufferedChunks();
    expect(buffered.length).toBe(5);

    // Interrupt (barge-in)
    manager.interrupt();
    tts.interrupt();

    // Buffer should be cleared
    expect(manager.getBufferedChunks()).toEqual([]);

    manager.complete();

    // TTS should have received all chunks before interrupt
    expect(tts.getCount()).toBe(5);
  });

  it('should integrate FlowManager with Sanitizer and Monitor', async () => {
    const sanitizer = new SpeechSanitizer({ rules: ['markdown'] });
    const manager = new FlowManager({ stallThresholdMs: 1000 });
    const auditor = new VoiceAuditor();
    const tts = new MockTTSProvider();

    // Track state changes (subscribe BEFORE start to catch first transition)
    const states: string[] = [];
    manager.on((event) => {
      if (event.type === 'state-change') {
        states.push(`${event.from}→${event.to}`);
      }
    });

    // Start tracking
    auditor.startTracking('advanced-test');
    manager.start();

    // Process markdown text through sanitizer
    const chunks = ['# Hello', '\n\n', '**World**'];
    let processedCount = 0;
    for (const chunk of chunks) {
      const sanitized = sanitizer.sanitize(chunk);
      if (sanitized) {
        manager.processChunk(sanitized);
        auditor.recordToken('advanced-test');
        await tts.send(sanitized);
        processedCount++;
      }
    }

    manager.complete();
    const metric = auditor.completeTracking('advanced-test');

    // Verify state transitions
    // Note: idle→waiting happens during start(), listener is set up after
    expect(states).toContain('waiting→speaking');
    expect(states).toContain('speaking→idle');

    // Verify sanitization (no markdown in TTS)
    const ttsText = tts.getText();
    expect(ttsText).not.toContain('#');
    expect(ttsText).not.toContain('**');

    // Verify monitoring (only non-empty chunks after sanitization)
    expect(metric.metrics.tokenCount).toBe(processedCount);
    expect(metric.metrics.totalDuration).toBeGreaterThanOrEqual(0);
  });

  it('should handle multiple sequential flows', async () => {
    const auditor = new VoiceAuditor();
    const tts = new MockTTSProvider();

    // First conversation
    {
      const manager = new FlowManager();
      const sanitizer = new SpeechSanitizer();

      auditor.startTracking('conv-1');
      manager.start();

      const chunks = ['Hello from', 'conversation', 'one'];
      for (const chunk of chunks) {
        const cleaned = sanitizer.sanitize(chunk);
        manager.processChunk(cleaned);
        auditor.recordToken('conv-1');
        await tts.send(cleaned);
      }

      manager.complete();
      auditor.completeTracking('conv-1');
    }

    tts.clear();

    // Second conversation
    {
      const manager = new FlowManager();
      const sanitizer = new SpeechSanitizer();

      auditor.startTracking('conv-2');
      manager.start();

      const chunks = ['Hello from', 'conversation', 'two'];
      for (const chunk of chunks) {
        const cleaned = sanitizer.sanitize(chunk);
        manager.processChunk(cleaned);
        auditor.recordToken('conv-2');
        await tts.send(cleaned);
      }

      manager.complete();
      auditor.completeTracking('conv-2');
    }

    // Verify both tracked
    const summary = auditor.getSummary();
    expect(summary.count).toBe(2);

    const metrics = auditor.getMetrics();
    const metric1 = metrics.find((m) => m.id === 'conv-1');
    const metric2 = metrics.find((m) => m.id === 'conv-2');

    expect(metric1?.metrics.tokenCount).toBe(3);
    expect(metric2?.metrics.tokenCount).toBe(3);
  });

  it('should coordinate sanitizer streaming with flow events', async () => {
    const sanitizer = new SpeechSanitizer({ rules: ['urls', 'code-blocks'] });
    const manager = new FlowManager({ stallThresholdMs: 1000 });
    const tts = new MockTTSProvider();

    let firstChunkReceived = false;

    manager.on((event) => {
      if (event.type === 'first-chunk') {
        firstChunkReceived = true;
      }
      if (event.type === 'chunk-processed') {
        tts.send(event.chunk);
      }
    });

    manager.start();

    // Mock LLM stream with code blocks and URLs
    const inputText = 'Check https://example.com and ```code block``` for details';
    const stream = createMockStream(inputText.split(' '), 5);

    for await (const chunk of sanitizer.sanitizeStream(stream)) {
      if (chunk.trim()) {
        manager.processChunk(chunk);
      }
    }

    manager.complete();

    expect(firstChunkReceived).toBe(true);

    // Verify sanitization (no URLs or code blocks in TTS)
    const ttsText = tts.getText();
    expect(ttsText).not.toContain('https://');
    expect(ttsText).not.toContain('```');
  });
});
