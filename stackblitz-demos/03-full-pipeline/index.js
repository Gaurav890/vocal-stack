import { createVoicePipeline } from 'vocal-stack/turn';

let isRunning = false;

const response = `## Welcome to vocal-stack v2!

This is a **provider-neutral** reliability layer for custom voice pipelines.

Read [the migration guide](https://github.com/gaurav890/vocal-stack) for details.

\`\`\`ts
const turn = pipeline.startTurn({ id, source });
\`\`\`

Your listener should hear clean, segmented text—not URLs or code.`;

function activateStep(stepId) {
  for (const element of document.querySelectorAll('.pipeline-step')) {
    element.classList.remove('active');
  }
  document.getElementById(stepId)?.classList.add('active');
}

function addToOutput(container, text, type) {
  const span = document.createElement('span');
  span.className = `chunk chunk-${type}`;
  span.textContent = text;
  container.appendChild(span);
}

window.startPipeline = async () => {
  if (isRunning) return;
  isRunning = true;

  const rawOutput = document.getElementById('raw-output');
  const speechOutput = document.getElementById('clean-output');
  const stats = document.getElementById('stats');
  const startButton = document.getElementById('start-btn');
  rawOutput.textContent = '';
  speechOutput.textContent = '';
  stats.style.display = 'none';
  startButton.disabled = true;

  let cueRequests = 0;
  const pipeline = createVoicePipeline({
    text: { minChars: 24, targetChars: 80, maxChars: 160, maxWaitMs: 250 },
    stallCues: { enabled: true, delayMs: 700, text: 'One moment.' },
  });

  let turn;
  const source = async function* (signal) {
    activateStep('step-llm');
    turn.recordStage({ stage: 'llm', phase: 'start' });
    await new Promise((resolve) => setTimeout(resolve, 900));

    let first = true;
    for (const delta of response.match(/.{1,14}/gs) ?? []) {
      if (signal.aborted) return;
      if (first) {
        turn.recordStage({ stage: 'llm', phase: 'first-output' });
        first = false;
      }
      addToOutput(rawOutput, delta, 'text');
      yield delta;
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    turn.recordStage({ stage: 'llm', phase: 'end' });
  };

  turn = pipeline.startTurn({ id: 'browser-demo', source });
  try {
    for await (const event of turn.events) {
      if (event.type === 'stall.cue.requested') {
        cueRequests++;
        addToOutput(speechOutput, event.text, 'filler');
      }
      if (event.type === 'speech.segment') {
        activateStep('step-sanitizer');
        await new Promise((resolve) => setTimeout(resolve, 80));
        activateStep('step-flow');
        addToOutput(speechOutput, event.segment.text, 'text');
        turn.acknowledgePlayback({
          segmentId: event.segment.id,
          charactersPlayed: Array.from(event.segment.text).length,
          audioMs: 80,
        });
      }
    }

    activateStep('step-monitor');
    const result = await turn.result;
    activateStep('step-tts');
    const metrics = result.metrics;
    document.getElementById('stat-ttft').textContent =
      `${Math.round(metrics.timeToFirstInputDeltaMs ?? 0)}ms`;
    document.getElementById('stat-duration').textContent =
      `${Math.round(metrics.totalDurationMs)}ms`;
    document.getElementById('stat-chunks').textContent = metrics.chunkCount;
    document.getElementById('stat-fillers').textContent = cueRequests;
    document.getElementById('stat-chars-removed').textContent =
      response.length - result.heardText.length;
    document.getElementById('stat-reduction').textContent =
      `${Math.round((1 - result.heardText.length / response.length) * 100)}%`;
    stats.style.display = 'grid';
  } catch (error) {
    console.error('Pipeline error:', error);
  } finally {
    startButton.disabled = false;
    isRunning = false;
  }
};

console.log('vocal-stack v2 reliability demo loaded');
