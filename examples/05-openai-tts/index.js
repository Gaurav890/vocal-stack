import { writeFile } from 'node:fs/promises';
import OpenAI from 'openai';
import { FlowController } from 'vocal-stack/flow';
import { VoiceAuditor } from 'vocal-stack/monitor';
import { SpeechSanitizer } from 'vocal-stack/sanitizer';

// Check for API key
if (!process.env.OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable not set');
  console.error('Usage: OPENAI_API_KEY=sk-... npm start');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log('=== OpenAI TTS Integration Example ===\n');

// Setup vocal-stack components
const sanitizer = new SpeechSanitizer({
  rules: ['markdown', 'urls', 'code-blocks'],
});

const flowController = new FlowController({
  stallThresholdMs: 1000,
  enableFillers: true,
  fillerPhrases: ['um', 'let me think', 'hmm'],
  onFillerInjected: async (filler) => {
    console.log(`[FLOW] Injecting filler: "${filler}"`);
    // In a real app, send filler to TTS immediately
    await sendToOpenAITTS(filler, 'filler.mp3');
  },
});

const auditor = new VoiceAuditor({
  enableRealtime: true,
  onMetric: (metric) => {
    console.log(`\n[MONITOR] Request ${metric.id}:`);
    console.log(`  - Time to first token: ${metric.metrics.timeToFirstToken}ms`);
    console.log(`  - Total duration: ${metric.metrics.totalDuration}ms`);
    console.log(`  - Tokens processed: ${metric.metrics.tokenCount}`);
  },
});

// Helper: Convert text to speech using OpenAI TTS
async function sendToOpenAITTS(text, filename = 'output.mp3') {
  try {
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    await writeFile(filename, buffer);
    console.log(`[TTS] Audio saved to ${filename}`);
  } catch (error) {
    console.error('[TTS] Error:', error.message);
  }
}

// Example 1: Basic LLM to TTS pipeline
console.log('Example 1: OpenAI Chat Completion → vocal-stack → OpenAI TTS\n');

async function* getOpenAIStream(prompt) {
  console.log('[LLM] Sending prompt to OpenAI...\n');

  const stream = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

const prompt = 'Explain how text-to-speech works in 3 sentences. Use markdown formatting.';

// Process through vocal-stack pipeline
const llmStream = getOpenAIStream(prompt);
const sanitized = sanitizer.sanitizeStream(llmStream);
const controlled = flowController.wrap(sanitized);
const monitored = auditor.track('openai-request-001', controlled);

let fullText = '';
console.log('[LLM Response]\n');

for await (const chunk of monitored) {
  process.stdout.write(chunk);
  fullText += chunk;
}

console.log('\n\n[PIPELINE] Processing complete!\n');

// Send cleaned text to OpenAI TTS
console.log('[TTS] Converting to speech...\n');
await sendToOpenAITTS(fullText, 'openai-output.mp3');

// Show statistics
const stats = flowController.getStats();
console.log('\n[FLOW STATS]');
console.log(`  - Chunks processed: ${stats.chunksProcessed}`);
console.log(`  - Fillers injected: ${stats.fillersInjected}`);
console.log(`  - Stalls detected: ${stats.stallsDetected}`);

const summary = auditor.getSummary();
console.log('\n[MONITORING STATS]');
console.log(`  - Average TTFT: ${summary.avgTimeToFirstToken.toFixed(2)}ms`);
console.log(`  - Average duration: ${summary.avgTotalDuration.toFixed(2)}ms`);

console.log('\n---\n');

// Example 2: Production-ready OpenAI Voice Agent
console.log('Example 2: Production-ready OpenAI Voice Agent\n');

class OpenAIVoiceAgent {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });

    this.sanitizer = new SpeechSanitizer({
      rules: ['markdown', 'urls', 'code-blocks'],
    });

    this.flowController = new FlowController({
      stallThresholdMs: 1000,
      enableFillers: true,
      fillerPhrases: ['um', 'let me think', 'hmm', 'well'],
    });

    this.auditor = new VoiceAuditor({ enableRealtime: true });
  }

  async *streamCompletion(messages, _requestId) {
    const stream = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  async processVoiceRequest(requestId, messages) {
    console.log(`[AGENT] Processing request: ${requestId}`);

    const llmStream = this.streamCompletion(messages, requestId);
    const pipeline = this.auditor.track(
      requestId,
      this.flowController.wrap(this.sanitizer.sanitizeStream(llmStream))
    );

    let fullText = '';

    for await (const chunk of pipeline) {
      if (chunk.trim()) {
        process.stdout.write(chunk);
        fullText += chunk;
      }
    }

    console.log('\n');
    return fullText;
  }

  async convertToSpeech(text, outputFile = 'speech.mp3') {
    const mp3 = await this.openai.audio.speech.create({
      model: 'tts-1-hd', // Higher quality
      voice: 'nova',
      input: text,
      speed: 1.0,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    await writeFile(outputFile, buffer);

    return outputFile;
  }

  getStats() {
    return {
      flow: this.flowController.getStats(),
      monitoring: this.auditor.getSummary(),
    };
  }

  interrupt() {
    this.flowController.interrupt();
  }
}

// Use the agent
const agent = new OpenAIVoiceAgent(process.env.OPENAI_API_KEY);

const messages = [
  {
    role: 'user',
    content: 'Tell me a short fun fact about AI. Keep it under 30 words.',
  },
];

console.log('[AGENT] Sending request...\n');
const response = await agent.processVoiceRequest('prod-request-001', messages);

console.log('[AGENT] Converting to speech...\n');
await agent.convertToSpeech(response, 'agent-output.mp3');

const agentStats = agent.getStats();
console.log('[AGENT] Stats:', agentStats);

console.log('\n=== Example Complete ===');
console.log('\nFiles generated:');
console.log('  - openai-output.mp3 (Example 1)');
console.log('  - agent-output.mp3 (Example 2)');
console.log('\nKey features demonstrated:');
console.log('  ✓ OpenAI Chat Completion streaming');
console.log('  ✓ Markdown sanitization');
console.log('  ✓ OpenAI TTS integration');
console.log('  ✓ Performance tracking');
console.log('  ✓ Production-ready agent class');
