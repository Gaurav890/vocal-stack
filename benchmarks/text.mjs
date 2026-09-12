import { performance } from 'node:perf_hooks';
import { normalizeForSpeech, SpeechSegmenter } from '../dist/text/index.js';

const iterations = 20_000;
const input =
  'Let me check **that** for you. Read [the guide](https://example.com/guide), then email help@example.com if needed. 👋 ';

for (let index = 0; index < 1_000; index++) normalizeForSpeech(input);

const normalizeStarted = performance.now();
for (let index = 0; index < iterations; index++) normalizeForSpeech(input);
const normalizeDuration = performance.now() - normalizeStarted;

const segmentStarted = performance.now();
for (let index = 0; index < iterations; index++) {
  const segmenter = new SpeechSegmenter();
  segmenter.push(input);
  segmenter.finish();
}
const segmentDuration = performance.now() - segmentStarted;

const operationsPerSecond = (duration) => Math.round((iterations / duration) * 1_000);
process.stdout.write(
  `${[
    `runtime: ${process.version} (${process.platform}/${process.arch})`,
    `iterations: ${iterations}`,
    `normalizeForSpeech: ${operationsPerSecond(normalizeDuration)} ops/s`,
    `SpeechSegmenter: ${operationsPerSecond(segmentDuration)} ops/s`,
  ].join('\n')}\n`
);
