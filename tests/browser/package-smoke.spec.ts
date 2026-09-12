import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const source = readFileSync(new URL('../../dist/index.js', import.meta.url), 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

test('primary ESM entry works without Node globals', async ({ page }) => {
  const result = await page.evaluate(async (url) => {
    const library = await import(url);
    const clock = new library.VirtualClock();
    return {
      text: library.normalizeForSpeech('Hello **browser**.'),
      time: clock.monotonicNow(),
      error: (() => {
        try {
          library.normalizeForSpeech('invalid', { maxPendingChars: 1 });
          return null;
        } catch (error) {
          return {
            isPipelineError: error instanceof library.VoicePipelineError,
            code: error.code,
          };
        }
      })(),
    };
  }, moduleUrl);

  expect(result).toEqual({
    text: 'Hello browser.',
    time: 0,
    error: { isPipelineError: true, code: 'VOICE_TEXT_INVALID_CONFIG' },
  });
});
