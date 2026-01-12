import { SpeechSanitizer } from 'vocal-stack/sanitizer';
import { FlowController } from 'vocal-stack/flow';
import { VoiceAuditor } from 'vocal-stack/monitor';

console.log('=== Full Pipeline Example ===\n');

// Mock TTS provider
class MockTTSProvider {
  constructor() {
    this.chunks = [];
  }

  async send(text) {
    this.chunks.push(text);
    console.log(`[TTS] "${text}"`);
    // Simulate TTS processing time
    await new Promise(resolve => setTimeout(resolve, 30));
  }

  getOutput() {
    return this.chunks.join('');
  }

  clear() {
    this.chunks = [];
  }
}

// Mock LLM stream with realistic output
async function* mockLLMResponse() {
  console.log('[LLM] Starting response generation...\n');

  // Initial delay (thinking time)
  await new Promise(resolve => setTimeout(resolve, 750));

  const response = `# Understanding Voice AI

Here's what you need to know about voice agents:

1. **Text Sanitization**: Remove markdown and URLs like https://example.com
2. **Flow Control**: Handle latency with natural fillers
3. **Monitoring**: Track performance metrics

Check out \`vocal-stack\` for more info!

\`\`\`javascript
const result = await processVoice();
\`\`\`

This makes building voice agents **much easier**!`;

  // Stream in realistic chunks
  const words = response.split(' ');
  for (let i = 0; i < words.length; i++) {
    yield words[i] + ' ';
    // Variable chunk delays to simulate real LLM
    const delay = Math.random() * 60 + 20;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

// Example 1: Complete composable pipeline
console.log('Example 1: Full composable pipeline\n');
console.log('Pipeline: LLM → Sanitizer → Flow Control → Monitor → TTS\n');

const tts = new MockTTSProvider();

// Setup all three modules
const sanitizer = new SpeechSanitizer({
  rules: ['markdown', 'urls', 'code-blocks', 'punctuation'],
});

const flowController = new FlowController({
  stallThresholdMs: 700,
  enableFillers: true,
  fillerPhrases: ['um', 'let me think', 'hmm'],
  onFillerInjected: (filler) => {
    tts.send(`[FILLER: ${filler}]`);
  },
});

const auditor = new VoiceAuditor({
  enableRealtime: true,
  onMetric: (metric) => {
    console.log(`\n[MONITOR] Performance metrics:`);
    console.log(`  - TTFT: ${metric.metrics.timeToFirstToken}ms`);
    console.log(`  - Duration: ${metric.metrics.totalDuration}ms`);
    console.log(`  - Tokens: ${metric.metrics.tokenCount}`);
    console.log(`  - Avg latency: ${metric.metrics.averageTokenLatency.toFixed(2)}ms/token`);
  },
});

// Compose the pipeline
async function processVoiceStream(llmStream, requestId) {
  const sanitized = sanitizer.sanitizeStream(llmStream);
  const controlled = flowController.wrap(sanitized);
  const monitored = auditor.track(requestId, controlled);

  for await (const chunk of monitored) {
    if (chunk.trim()) {
      await tts.send(chunk);
    }
  }
}

// Process first request
await processVoiceStream(mockLLMResponse(), 'voice-request-001');

console.log('\n--- Flow Control Stats ---');
const flowStats = flowController.getStats();
console.log(`Chunks processed: ${flowStats.chunksProcessed}`);
console.log(`Fillers injected: ${flowStats.fillersInjected}`);
console.log(`Stalls detected: ${flowStats.stallsDetected}`);
console.log(`First chunk time: ${flowStats.firstChunkTime}ms`);

console.log('\n--- Final TTS Output (cleaned) ---');
console.log(tts.getOutput());

console.log('\n---\n');

// Example 2: Side-by-side comparison
console.log('Example 2: With vs Without vocal-stack\n');

// Without vocal-stack (raw LLM output)
async function* rawLLMStream() {
  await new Promise(resolve => setTimeout(resolve, 800));
  const chunks = ['# Hello\n\n', '**bold** text ', 'and https://example.com'];
  for (const chunk of chunks) {
    yield chunk;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

console.log('WITHOUT vocal-stack:');
console.log('Problems:');
console.log('  ✗ Awkward 800ms silence (no filler)');
console.log('  ✗ Markdown symbols spoken aloud');
console.log('  ✗ URLs sent to TTS');
console.log('  ✗ No performance tracking\n');

let rawOutput = '';
for await (const chunk of rawLLMStream()) {
  rawOutput += chunk;
}
console.log(`Raw output: "${rawOutput}"\n`);

// With vocal-stack
const tts2 = new MockTTSProvider();
const sanitizer2 = new SpeechSanitizer();
const flowController2 = new FlowController({
  stallThresholdMs: 700,
  enableFillers: true,
  fillerPhrases: ['um'],
  onFillerInjected: (filler) => tts2.send(`[${filler}]`),
});
const auditor2 = new VoiceAuditor();

console.log('WITH vocal-stack:');
console.log('Benefits:');
console.log('  ✓ Natural filler during stall');
console.log('  ✓ Clean text for TTS');
console.log('  ✓ URLs removed');
console.log('  ✓ Performance tracked\n');

const pipeline = auditor2.track(
  'comparison-test',
  flowController2.wrap(sanitizer2.sanitizeStream(rawLLMStream()))
);

for await (const chunk of pipeline) {
  if (chunk.trim()) {
    await tts2.send(chunk);
  }
}

console.log(`\nCleaned output: "${tts2.getOutput()}"`);

const metric = auditor2.getMetrics()[0];
console.log(`\nTracked metrics: TTFT=${metric.metrics.timeToFirstToken}ms, Duration=${metric.metrics.totalDuration}ms`);

console.log('\n---\n');

// Example 3: Production-ready pattern
console.log('Example 3: Production-ready pattern\n');

class VoiceAgent {
  constructor() {
    this.sanitizer = new SpeechSanitizer({
      rules: ['markdown', 'urls', 'code-blocks'],
    });

    this.flowController = new FlowController({
      stallThresholdMs: 700,
      enableFillers: true,
      onFillerInjected: (filler) => this.handleFiller(filler),
    });

    this.auditor = new VoiceAuditor({
      enableRealtime: true,
      onMetric: (metric) => this.logMetric(metric),
    });

    this.tts = new MockTTSProvider();
  }

  handleFiller(filler) {
    console.log(`[AGENT] Injecting filler: "${filler}"`);
    this.tts.send(filler);
  }

  logMetric(metric) {
    console.log(`[AGENT] Request ${metric.id} completed in ${metric.metrics.totalDuration}ms`);
  }

  async processRequest(requestId, llmStream) {
    console.log(`[AGENT] Processing request: ${requestId}`);

    const pipeline = this.auditor.track(
      requestId,
      this.flowController.wrap(this.sanitizer.sanitizeStream(llmStream))
    );

    for await (const chunk of pipeline) {
      if (chunk.trim()) {
        await this.tts.send(chunk);
      }
    }

    return this.tts.getOutput();
  }

  interrupt() {
    console.log('[AGENT] Interrupting...');
    this.flowController.interrupt();
  }

  getStats() {
    return {
      flow: this.flowController.getStats(),
      monitoring: this.auditor.getSummary(),
    };
  }

  exportMetrics(format = 'json') {
    return this.auditor.export(format);
  }
}

// Use the agent
const agent = new VoiceAgent();

async function* productionLLMStream() {
  await new Promise(resolve => setTimeout(resolve, 750));
  const chunks = ['Hello! ', 'I can help ', 'with that.'];
  for (const chunk of chunks) {
    yield chunk;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

await agent.processRequest('prod-request-001', productionLLMStream());

console.log('\n[AGENT] Stats:', agent.getStats());

console.log('\n=== Example Complete ===');
console.log('\nKey Takeaways:');
console.log('  1. All three modules work seamlessly together');
console.log('  2. Composable pipeline: Sanitizer → Flow → Monitor');
console.log('  3. Each module is optional (use what you need)');
console.log('  4. Easy to wrap in a production-ready class');
