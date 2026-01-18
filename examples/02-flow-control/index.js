import { FlowController, FlowManager } from 'vocal-stack/flow';

console.log('=== Flow Control Example ===\n');

// Simulate TTS output
const ttsOutput = [];
function mockTTS(text) {
  ttsOutput.push(text);
  console.log(`[TTS] ${text}`);
}

// Example 1: High-level API with filler injection
console.log('Example 1: Automatic filler injection on stalls\n');

async function* slowLLMStream() {
  console.log('[LLM] Starting stream...');

  // Simulate initial stall (800ms delay)
  await new Promise((resolve) => setTimeout(resolve, 800));

  yield 'Hello there! ';
  await new Promise((resolve) => setTimeout(resolve, 50));

  yield 'I was thinking about ';
  await new Promise((resolve) => setTimeout(resolve, 50));

  yield 'your question.';
}

const controller = new FlowController({
  stallThresholdMs: 700,
  enableFillers: true,
  fillerPhrases: ['um', 'let me think', 'hmm'],
  onFillerInjected: (filler) => {
    mockTTS(`[FILLER: ${filler}]`);
  },
});

for await (const chunk of controller.wrap(slowLLMStream())) {
  mockTTS(chunk);
}

const stats = controller.getStats();
console.log('\nFlow Stats:', {
  chunksProcessed: stats.chunksProcessed,
  fillersInjected: stats.fillersInjected,
  stallsDetected: stats.stallsDetected,
  firstChunkTime: `${stats.firstChunkTime}ms`,
});

console.log('\n---\n');

// Example 2: Barge-in (interruption) support
console.log('Example 2: Barge-in interruption\n');

const controller2 = new FlowController();
let chunkCount = 0;

async function* longLLMStream() {
  const chunks = [
    'This is a long response ',
    'that will be interrupted ',
    'in the middle. ',
    'You should not see this part ',
    'because the user will interrupt.',
  ];

  for (const chunk of chunks) {
    yield chunk;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const interruptStream = (async function* () {
  for await (const chunk of controller2.wrap(longLLMStream())) {
    chunkCount++;
    console.log(`[TTS] Chunk ${chunkCount}: ${chunk}`);

    // Simulate user interrupting after 2nd chunk
    if (chunkCount === 2) {
      console.log('\n[USER] *interrupts*\n');
      controller2.interrupt();
    }

    yield chunk;
  }
})();

for await (const _chunk of interruptStream) {
  // Process chunks
}

console.log(`\nTotal chunks sent to TTS: ${chunkCount} (interrupted before completion)`);

console.log('\n---\n');

// Example 3: Low-level event-based API
console.log('Example 3: Low-level FlowManager with events\n');

const manager = new FlowManager({
  stallThresholdMs: 500,
  enableFillers: true,
  fillerPhrases: ['um'],
});

const events = [];

manager.on((event) => {
  events.push(event.type);

  switch (event.type) {
    case 'stall-detected':
      console.log('[EVENT] Stall detected');
      break;
    case 'filler-injected':
      console.log(`[EVENT] Filler injected: "${event.filler}"`);
      mockTTS(`[FILLER: ${event.filler}]`);
      break;
    case 'first-chunk':
      console.log('[EVENT] First chunk received');
      break;
    case 'state-change':
      console.log(`[EVENT] State: ${event.from} → ${event.to}`);
      break;
    case 'chunk-processed':
      mockTTS(event.chunk);
      break;
  }
});

manager.start();

// Simulate stall before first chunk
await new Promise((resolve) => setTimeout(resolve, 600));

// Process chunks manually
const chunks = ['Hello', ' from', ' low-level', ' API!'];
for (const chunk of chunks) {
  manager.processChunk(chunk);
  await new Promise((resolve) => setTimeout(resolve, 50));
}

manager.complete();

console.log('\nEvents captured:', events);

console.log('\n=== Example Complete ===');
