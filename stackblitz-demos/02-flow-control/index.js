import { FlowController } from 'vocal-stack/flow';

let isRunning = false;

// Mock LLM stream generator
async function* mockLLMStream(config) {
  const chunks = [
    'Hello there! ',
    'I was thinking about ',
    'your question. ',
    'Let me explain ',
    'how this works. ',
    "It's actually quite ",
    'interesting and ',
    'powerful!',
  ];

  // Initial stall
  if (config.initialStall > 0) {
    await new Promise((resolve) => setTimeout(resolve, config.initialStall));
  }

  // Yield chunks with delays
  for (const chunk of chunks) {
    yield chunk;
    await new Promise((resolve) => setTimeout(resolve, config.chunkDelay));
  }
}

// Start demo
window.startDemo = async () => {
  if (isRunning) return;

  // Reset UI
  const outputEl = document.getElementById('output');
  const timelineEl = document.getElementById('timeline');
  const statsEl = document.getElementById('stats');
  const startBtn = document.getElementById('start-btn');

  outputEl.innerHTML = '';
  timelineEl.innerHTML = '';
  statsEl.style.display = 'none';
  startBtn.disabled = true;
  isRunning = true;

  // Get configuration
  const config = {
    stallThresholdMs: Number.parseInt(document.getElementById('stall-threshold').value),
    enableFillers: document.getElementById('enable-fillers').value === 'true',
    chunkDelay: Number.parseInt(document.getElementById('chunk-delay').value),
    initialStall: Number.parseInt(document.getElementById('initial-stall').value),
  };

  // Stats
  let chunksCount = 0;
  let fillersCount = 0;
  let stallsCount = 0;
  const startTime = Date.now();
  let firstChunkTime = null;

  // Create flow controller
  const controller = new FlowController({
    stallThresholdMs: config.stallThresholdMs,
    enableFillers: config.enableFillers,
    fillerPhrases: ['um', 'let me think', 'hmm', 'well'],
    onFillerInjected: (filler) => {
      fillersCount++;
      addToOutput(filler, 'filler');
      addToTimeline(filler, 'filler');
      updateStats();
    },
  });

  // Track state changes
  let _lastState = 'idle';
  const manager = controller.flowManager;
  manager.on((event) => {
    if (event.type === 'stall-detected') {
      stallsCount++;
      addToTimeline('Stall', 'stall');
      updateStats();
    }
    if (event.type === 'state-change') {
      _lastState = event.to;
    }
  });

  // Mark output as active
  outputEl.classList.add('active');

  // Process stream
  try {
    const stream = mockLLMStream(config);
    const controlled = controller.wrap(stream);

    for await (const chunk of controlled) {
      if (firstChunkTime === null) {
        firstChunkTime = Date.now() - startTime;
      }
      chunksCount++;
      addToOutput(chunk, 'text');
      addToTimeline(`Chunk ${chunksCount}`, 'text');
      updateStats();
    }
  } catch (error) {
    console.error('Demo error:', error);
  }

  // Mark output as inactive
  outputEl.classList.remove('active');

  // Final stats
  statsEl.style.display = 'grid';
  updateStats();

  // Re-enable button
  startBtn.disabled = false;
  isRunning = false;

  // Helper functions
  function addToOutput(text, type) {
    const span = document.createElement('span');
    span.className = `chunk chunk-${type}`;
    span.textContent = text;
    outputEl.appendChild(span);
  }

  function addToTimeline(label, type) {
    const item = document.createElement('div');
    item.className = `timeline-item ${type}`;
    item.textContent = label;
    item.title = label;

    // Set height based on type for visual variety
    if (type === 'text') {
      item.style.height = '40px';
    } else if (type === 'filler') {
      item.style.height = '50px';
    } else if (type === 'stall') {
      item.style.height = '30px';
    }

    timelineEl.appendChild(item);
  }

  function updateStats() {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    document.getElementById('stat-chunks').textContent = chunksCount;
    document.getElementById('stat-fillers').textContent = fillersCount;
    document.getElementById('stat-stalls').textContent = stallsCount;
    document.getElementById('stat-duration').textContent = `${duration}s`;
    document.getElementById('stat-ttft').textContent =
      firstChunkTime !== null ? `${firstChunkTime}ms` : '-';
  }
};

// Initialize
console.log('vocal-stack Flow Control Demo loaded!');
console.log('Configure settings and click "Start Simulation" to begin.');
