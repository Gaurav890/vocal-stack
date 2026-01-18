import { FlowController } from 'vocal-stack/flow';
import { VoiceAuditor } from 'vocal-stack/monitor';
import { SpeechSanitizer } from 'vocal-stack/sanitizer';

let isRunning = false;

// Mock LLM stream with markdown
async function* mockLLMStream() {
  const response = `## Welcome to vocal-stack!

This is a **powerful** library for _voice AI_ agents.

Check out [our docs](https://github.com/vocal-stack) for more info.

Here's some example code:
\`\`\`javascript
const sanitizer = new SpeechSanitizer();
\`\`\`

Visit https://example.com to learn more!!!`;

  const chunks = response.split(' ');

  // Initial stall (1.5 seconds)
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Stream chunks
  for (let i = 0; i < chunks.length; i++) {
    yield `${chunks[i]} `;
    // Variable delays to simulate real LLM
    const delay = Math.random() * 100 + 50;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

// Activate pipeline step visual
function activateStep(stepId) {
  // Deactivate all
  document.querySelectorAll('.pipeline-step').forEach((el) => {
    el.classList.remove('active');
  });
  // Activate this one
  const step = document.getElementById(stepId);
  if (step) {
    step.classList.add('active');
  }
}

// Start pipeline
window.startPipeline = async () => {
  if (isRunning) return;

  // Reset UI
  const rawOutputEl = document.getElementById('raw-output');
  const cleanOutputEl = document.getElementById('clean-output');
  const statsEl = document.getElementById('stats');
  const startBtn = document.getElementById('start-btn');

  rawOutputEl.innerHTML = '';
  cleanOutputEl.innerHTML = '';
  statsEl.style.display = 'none';
  startBtn.disabled = true;
  isRunning = true;

  // Stats tracking
  let chunksCount = 0;
  let fillersCount = 0;
  let charsRemoved = 0;
  let rawTotalLength = 0;
  let cleanTotalLength = 0;
  const startTime = Date.now();
  let firstChunkTime = null;

  // Setup modules
  activateStep('step-llm');

  // 1. Sanitizer
  const sanitizer = new SpeechSanitizer({
    rules: ['markdown', 'urls', 'code-blocks', 'punctuation'],
  });

  // 2. Flow Controller
  const flowController = new FlowController({
    stallThresholdMs: 1000,
    enableFillers: true,
    fillerPhrases: ['um', 'let me think', 'hmm'],
    onFillerInjected: (filler) => {
      fillersCount++;
      addToOutput(cleanOutputEl, filler, 'filler');
      updateStats();
    },
  });

  // 3. Voice Auditor
  const auditor = new VoiceAuditor({
    enableRealtime: true,
  });

  try {
    // Create pipeline: LLM → Sanitizer → Flow → Monitor
    const llmStream = mockLLMStream();

    // Sanitize
    activateStep('step-sanitizer');
    const sanitized = sanitizer.sanitizeStream(llmStream);

    // Flow control
    activateStep('step-flow');
    const controlled = flowController.wrap(sanitized);

    // Monitor
    activateStep('step-monitor');
    const monitored = auditor.track('demo-pipeline', controlled);

    // Process stream
    for await (const chunk of monitored) {
      if (firstChunkTime === null) {
        firstChunkTime = Date.now() - startTime;
      }

      // Show raw (unsanitized) output
      // We'll simulate this by showing with markdown
      const rawChunk = chunk; // In real scenario, this would be pre-sanitized
      addToOutput(rawOutputEl, rawChunk, 'text');
      rawTotalLength += rawChunk.length;

      // Show cleaned output
      addToOutput(cleanOutputEl, chunk, 'text');
      cleanTotalLength += chunk.length;

      chunksCount++;
      updateStats();
    }

    // Final step - TTS ready
    activateStep('step-tts');

    // Calculate chars removed (approximate)
    charsRemoved = rawTotalLength - cleanTotalLength;

    // Show final stats
    statsEl.style.display = 'grid';
    updateFinalStats();
  } catch (error) {
    console.error('Pipeline error:', error);
  }

  // Re-enable button
  startBtn.disabled = false;
  isRunning = false;

  // Helper functions
  function addToOutput(container, text, type) {
    const span = document.createElement('span');
    span.className = `chunk chunk-${type}`;
    span.textContent = text;
    container.appendChild(span);
  }

  function updateStats() {
    const duration = Date.now() - startTime;
    document.getElementById('stat-duration').textContent = `${duration}ms`;
    document.getElementById('stat-chunks').textContent = chunksCount;
    document.getElementById('stat-fillers').textContent = fillersCount;
    if (firstChunkTime !== null) {
      document.getElementById('stat-ttft').textContent = `${firstChunkTime}ms`;
    }
  }

  function updateFinalStats() {
    updateStats();

    // Calculate reduction
    const reduction = rawTotalLength > 0 ? ((charsRemoved / rawTotalLength) * 100).toFixed(1) : 0;

    document.getElementById('stat-chars-removed').textContent = charsRemoved;
    document.getElementById('stat-reduction').textContent = `${reduction}%`;

    // Get auditor metrics
    const metrics = auditor.getMetrics();
    if (metrics.length > 0) {
      const metric = metrics[0];
      document.getElementById('stat-ttft').textContent = `${metric.metrics.timeToFirstToken}ms`;
      document.getElementById('stat-duration').textContent = `${metric.metrics.totalDuration}ms`;
    }
  }
};

// Initialize
console.log('vocal-stack Full Pipeline Demo loaded!');
console.log('Click "Run Complete Pipeline" to see all modules working together.');
