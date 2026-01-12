import { CustomVoiceAgent } from './agent.js';
import OpenAI from 'openai';
import { writeFile } from 'fs/promises';

// Check for API key
if (!process.env.OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable not set');
  console.error('Usage: OPENAI_API_KEY=sk-... npm start');
  process.exit(1);
}

console.log('=== Custom Voice Agent Example ===\n');

// Example 1: Basic usage with event listeners
console.log('Example 1: Basic conversational agent\n');

const agent = new CustomVoiceAgent({
  openaiApiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4-turbo',
  systemPrompt: 'You are a friendly and concise voice assistant. Keep responses under 50 words.',
  enableFillers: true,
  enableMonitoring: true,
});

// Setup event listeners
agent.on('request-start', (data) => {
  console.log(`\n[AGENT] Processing: "${data.message}"`);
});

agent.on('chunk', (data) => {
  process.stdout.write(data.chunk);
});

agent.on('filler-injected', (data) => {
  console.log(`\n[FILLER] "${data.filler}"`);
});

agent.on('request-complete', (data) => {
  console.log(`\n\n[AGENT] Complete (${data.chunks.length} chunks)\n`);
});

agent.on('metric', (metric) => {
  console.log(`[METRIC] TTFT: ${metric.metrics.timeToFirstToken}ms, Duration: ${metric.metrics.totalDuration}ms`);
});

agent.on('error', (data) => {
  console.error('[ERROR]', data.error.message);
});

// Have a conversation
console.log('[USER] "Hello! What can you help me with?"');
await agent.chat('Hello! What can you help me with?');

console.log('[USER] "Tell me a quick fact about AI."');
await agent.chat('Tell me a quick fact about AI.');

console.log('[USER] "That\'s interesting! Can you elaborate?"');
await agent.chat("That's interesting! Can you elaborate?");

// Show conversation history
console.log('\n--- Conversation History ---');
const history = agent.getHistory();
history.forEach((msg, i) => {
  console.log(`${i + 1}. [${msg.role.toUpperCase()}] ${msg.content.substring(0, 60)}${msg.content.length > 60 ? '...' : ''}`);
});

// Show statistics
console.log('\n--- Statistics ---');
const stats = agent.getStats();
console.log('Flow:', stats.flow);
console.log('Monitoring:', stats.monitoring);
console.log('Conversation:', stats.conversation);

console.log('\n---\n');

// Example 2: With custom TTS provider
console.log('Example 2: Agent with OpenAI TTS integration\n');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const audioChunks = [];

// Custom TTS provider function
async function ttsProvider(text) {
  try {
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    audioChunks.push(buffer);
    console.log(`[TTS] Generated audio for: "${text.substring(0, 30)}..."`);
  } catch (error) {
    console.error('[TTS] Error:', error.message);
  }
}

const agent2 = new CustomVoiceAgent({
  openaiApiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4-turbo',
  systemPrompt: 'You are a helpful assistant. Be concise.',
  ttsProvider,
  enableFillers: false, // Disable fillers for this example
});

agent2.on('chunk', (data) => {
  process.stdout.write(data.chunk);
});

console.log('[USER] "Explain quantum computing in one sentence."\n');
const response = await agent2.chat('Explain quantum computing in one sentence.');

// Save combined audio
if (audioChunks.length > 0) {
  const combinedAudio = Buffer.concat(audioChunks);
  await writeFile('conversation-audio.mp3', combinedAudio);
  console.log('\n[TTS] Saved audio to conversation-audio.mp3');
}

console.log('\n---\n');

// Example 3: Barge-in (interruption) handling
console.log('Example 3: Barge-in interruption\n');

const agent3 = new CustomVoiceAgent({
  openaiApiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4-turbo',
  systemPrompt: 'You are a verbose assistant. Give long, detailed responses.',
});

agent3.on('chunk', (data) => {
  process.stdout.write(data.chunk);
});

agent3.on('interrupted', () => {
  console.log('\n\n[SYSTEM] User interrupted the agent');
});

// Start a long response
const chatPromise = agent3.chat('Tell me everything you know about the history of computers.');

// Simulate user interrupting after 1 second
setTimeout(() => {
  console.log('\n[USER] *interrupts*');
  agent3.interrupt();
}, 1000);

try {
  await chatPromise;
} catch (error) {
  console.log('[SYSTEM] Request was interrupted');
}

console.log('\n---\n');

// Example 4: Multi-turn conversation with context
console.log('Example 4: Context-aware conversation\n');

const agent4 = new CustomVoiceAgent({
  openaiApiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4-turbo',
  systemPrompt: 'You are a knowledgeable tutor. Remember the conversation context.',
  maxHistoryLength: 10,
});

agent4.on('chunk', (data) => {
  process.stdout.write(data.chunk);
});

console.log('[USER] "What is Python?"');
await agent4.chat('What is Python?');

console.log('\n\n[USER] "What are its main use cases?"');
await agent4.chat('What are its main use cases?');

console.log('\n\n[USER] "How does it compare to JavaScript?"');
await agent4.chat('How does it compare to JavaScript?');

console.log('\n\n[USER] "Which one should I learn first?"');
await agent4.chat('Which one should I learn first?');

console.log('\n\n--- Final Statistics ---');
const finalStats = agent4.getStats();
console.log(`Total messages in history: ${finalStats.conversation.messagesInHistory}`);
console.log(`Average TTFT: ${finalStats.monitoring?.avgTimeToFirstToken.toFixed(2)}ms`);
console.log(`Fillers injected: ${finalStats.flow.fillersInjected}`);

// Export metrics
console.log('\n--- Exporting Metrics ---');
const metricsJson = agent4.exportMetrics('json');
await writeFile('metrics.json', metricsJson);
console.log('Saved metrics to metrics.json');

const metricsCsv = agent4.exportMetrics('csv');
await writeFile('metrics.csv', metricsCsv);
console.log('Saved metrics to metrics.csv');

console.log('\n=== Example Complete ===');
console.log('\nKey Features Demonstrated:');
console.log('  ✓ Multi-turn conversations with context');
console.log('  ✓ Event-driven architecture');
console.log('  ✓ Custom TTS provider integration');
console.log('  ✓ Barge-in interruption support');
console.log('  ✓ Conversation history management');
console.log('  ✓ Performance monitoring and export');
console.log('  ✓ Error handling');
console.log('\nFiles Generated:');
console.log('  - conversation-audio.mp3');
console.log('  - metrics.json');
console.log('  - metrics.csv');
