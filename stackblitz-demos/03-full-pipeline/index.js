import { countSpeechCharacters } from 'vocal-stack/text';
import { createVoicePipeline } from 'vocal-stack/turn';

let isRunning = false;
let activeTurn;
let interruptRequested = false;

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

function setStatus(message, tone = 'idle') {
  const status = document.getElementById('run-status');
  status.textContent = message;
  status.dataset.tone = tone;
}

function showResult(result) {
  const metrics = result.metrics;
  document.getElementById('stat-outcome').textContent = result.outcome;
  document.getElementById('stat-generated').textContent = metrics.generatedCharacters;
  document.getElementById('stat-heard').textContent = metrics.acknowledgedCharacters;
  document.getElementById('stat-ttft').textContent =
    metrics.timeToFirstInputDeltaMs === undefined
      ? '—'
      : `${Math.round(metrics.timeToFirstInputDeltaMs)}ms`;
  document.getElementById('stat-segments').textContent = metrics.segmentCount;
  document.getElementById('stat-cues').textContent = metrics.cueRequests;
  document.getElementById('heard-output').textContent =
    result.heardText || 'Nothing was confirmed as played.';
  document.getElementById('stats').style.display = 'grid';

  if (result.outcome === 'completed') {
    setStatus('Turn completed. Every emitted segment was acknowledged.', 'completed');
  } else if (result.outcome === 'interrupted') {
    setStatus(
      'Turn interrupted immediately. Only acknowledged playback counts as heard.',
      'interrupted'
    );
  } else {
    setStatus(`Turn failed: ${result.error?.code ?? 'unknown error'}`, 'failed');
  }
}

window.interruptPipeline = () => {
  if (!activeTurn || interruptRequested) return;
  interruptRequested = true;
  document.getElementById('interrupt-btn').disabled = true;
  setStatus('Barge-in requested. Settling the local turn…', 'interrupted');
  activeTurn.interrupt({ reason: 'demo barge-in' });
};

window.startPipeline = async () => {
  if (isRunning) return;
  isRunning = true;

  const rawOutput = document.getElementById('raw-output');
  const speechOutput = document.getElementById('clean-output');
  const heardOutput = document.getElementById('heard-output');
  const stats = document.getElementById('stats');
  const startButton = document.getElementById('start-btn');
  const interruptButton = document.getElementById('interrupt-btn');
  rawOutput.textContent = '';
  speechOutput.textContent = '';
  heardOutput.textContent = 'Waiting for playback acknowledgements…';
  stats.style.display = 'none';
  startButton.disabled = true;
  interruptButton.disabled = false;
  interruptRequested = false;
  setStatus('Waiting for the first model delta. You can interrupt now.', 'running');

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
      setStatus('Streaming model deltas. Interrupt to simulate barge-in.', 'running');
      addToOutput(rawOutput, delta, 'text');
      yield delta;
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    if (!signal.aborted) turn.recordStage({ stage: 'llm', phase: 'end' });
  };

  turn = pipeline.startTurn({ id: 'browser-demo', source });
  activeTurn = turn;
  try {
    for await (const event of turn.events) {
      if (event.type === 'stall.cue.requested') {
        addToOutput(speechOutput, event.text, 'filler');
      }
      if (event.type === 'speech.segment') {
        activateStep('step-sanitizer');
        await new Promise((resolve) => setTimeout(resolve, 80));
        activateStep('step-flow');
        addToOutput(speechOutput, event.segment.text, 'text');
        setStatus('Acknowledging simulated playback. Interrupt to stop the turn.', 'running');
        await new Promise((resolve) => setTimeout(resolve, 80));
        if (interruptRequested) continue;
        turn.acknowledgePlayback({
          segmentId: event.segment.id,
          charactersPlayed: countSpeechCharacters(event.segment.text),
          audioMs: 80,
        });
      }
    }

    activateStep('step-monitor');
    const result = await turn.result;
    activateStep('step-tts');
    showResult(result);
  } catch (error) {
    console.error('Pipeline error:', error);
    setStatus(`Demo error: ${error instanceof Error ? error.message : String(error)}`, 'failed');
  } finally {
    activeTurn = undefined;
    interruptRequested = false;
    startButton.disabled = false;
    interruptButton.disabled = true;
    isRunning = false;
  }
};

console.log('vocal-stack v2 reliability demo loaded');
