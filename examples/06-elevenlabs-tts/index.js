import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ElevenLabsClient } from 'elevenlabs';
import OpenAI from 'openai';
import { FlowController } from 'vocal-stack/flow';
import { VoiceAuditor } from 'vocal-stack/monitor';
import { SpeechSanitizer } from 'vocal-stack/sanitizer';

// Check for API keys
if (!process.env.ELEVENLABS_API_KEY) {
  console.error('Error: ELEVENLABS_API_KEY environment variable not set');
  console.error('Usage: ELEVENLABS_API_KEY=... OPENAI_API_KEY=... npm start');
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable not set');
  console.error('Usage: ELEVENLABS_API_KEY=... OPENAI_API_KEY=... npm start');
  process.exit(1);
}

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log('=== ElevenLabs TTS Integration Example ===\n');

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
    // In production, send filler to ElevenLabs immediately for lower latency
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

// Helper: Convert text to speech using ElevenLabs
async function sendToElevenLabsTTS(
  text,
  filename = 'output.mp3',
  voiceId = 'pNInz6obpgDQGcFmaJgB'
) {
  try {
    console.log('[TTS] Converting text to speech with ElevenLabs...');

    const audio = await elevenlabs.textToSpeech.convert(voiceId, {
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    });

    // Write audio stream to file
    const writeStream = createWriteStream(filename);
    await pipeline(Readable.from(audio), writeStream);

    console.log(`[TTS] Audio saved to ${filename}`);
  } catch (error) {
    console.error('[TTS] Error:', error.message);
  }
}

// Helper: Stream LLM response
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

// Example 1: Basic pipeline with ElevenLabs
console.log('Example 1: OpenAI GPT-4 → vocal-stack → ElevenLabs TTS\n');

const prompt =
  'Explain what makes a voice sound natural in 2-3 sentences. Use markdown formatting.';

const llmStream = getOpenAIStream(prompt);
const sanitized = sanitizer.sanitizeStream(llmStream);
const controlled = flowController.wrap(sanitized);
const monitored = auditor.track('elevenlabs-request-001', controlled);

let fullText = '';
console.log('[LLM Response]\n');

for await (const chunk of monitored) {
  process.stdout.write(chunk);
  fullText += chunk;
}

console.log('\n\n[PIPELINE] Processing complete!\n');

// Send to ElevenLabs
await sendToElevenLabsTTS(fullText, 'elevenlabs-output.mp3');

// Show statistics
const stats = flowController.getStats();
console.log('\n[FLOW STATS]');
console.log(`  - Chunks processed: ${stats.chunksProcessed}`);
console.log(`  - Fillers injected: ${stats.fillersInjected}`);
console.log(`  - Stalls detected: ${stats.stallsDetected}`);

console.log('\n---\n');

// Example 2: Production-ready ElevenLabs Voice Agent
console.log('Example 2: Production-ready ElevenLabs Voice Agent\n');

class ElevenLabsVoiceAgent {
  constructor(elevenLabsApiKey, openaiApiKey, voiceId = 'pNInz6obpgDQGcFmaJgB') {
    this.elevenlabs = new ElevenLabsClient({ apiKey: elevenLabsApiKey });
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.voiceId = voiceId;

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

  async *streamCompletion(messages) {
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

    const llmStream = this.streamCompletion(messages);
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

  async convertToSpeech(text, outputFile = 'speech.mp3', options = {}) {
    const {
      model = 'eleven_multilingual_v2',
      stability = 0.5,
      similarityBoost = 0.75,
      style = 0.0,
      useSpeakerBoost = true,
    } = options;

    const audio = await this.elevenlabs.textToSpeech.convert(this.voiceId, {
      text,
      model_id: model,
      voice_settings: {
        stability,
        similarity_boost: similarityBoost,
        style,
        use_speaker_boost: useSpeakerBoost,
      },
    });

    const writeStream = createWriteStream(outputFile);
    await pipeline(Readable.from(audio), writeStream);

    return outputFile;
  }

  async listVoices() {
    const voices = await this.elevenlabs.voices.getAll();
    return voices.voices;
  }

  setVoice(voiceId) {
    this.voiceId = voiceId;
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
const agent = new ElevenLabsVoiceAgent(
  process.env.ELEVENLABS_API_KEY,
  process.env.OPENAI_API_KEY,
  'pNInz6obpgDQGcFmaJgB' // Adam voice
);

// List available voices
console.log('[AGENT] Fetching available voices...\n');
const voices = await agent.listVoices();
console.log('Available voices:');
voices.slice(0, 5).forEach((voice) => {
  console.log(`  - ${voice.name} (${voice.voice_id})`);
});
console.log(`  ... and ${voices.length - 5} more\n`);

// Process a request
const messages = [
  {
    role: 'user',
    content: 'Give me a 2-sentence tip for better public speaking.',
  },
];

console.log('[AGENT] Sending request...\n');
const response = await agent.processVoiceRequest('prod-request-001', messages);

console.log('[AGENT] Converting to speech with high quality settings...\n');
await agent.convertToSpeech(response, 'agent-output-elevenlabs.mp3', {
  model: 'eleven_turbo_v2_5', // Faster model
  stability: 0.6,
  similarityBoost: 0.8,
  useSpeakerBoost: true,
});

const agentStats = agent.getStats();
console.log('\n[AGENT] Stats:', agentStats);

console.log('\n=== Example Complete ===');
console.log('\nFiles generated:');
console.log('  - elevenlabs-output.mp3 (Example 1)');
console.log('  - agent-output-elevenlabs.mp3 (Example 2)');
console.log('\nKey features demonstrated:');
console.log('  ✓ OpenAI GPT-4 streaming');
console.log('  ✓ ElevenLabs TTS with custom voice settings');
console.log('  ✓ Markdown sanitization');
console.log('  ✓ Performance tracking');
console.log('  ✓ Production-ready agent class');
console.log('  ✓ Voice listing and selection');
