import { expect, test } from '@playwright/test';

const demoUrl = 'http://127.0.0.1:4173';

test.beforeEach(async ({ page }) => {
  await page.goto(demoUrl);
});

test('interactive demo completes a turn and reports confirmed playback', async ({ page }) => {
  await page.getByRole('button', { name: 'Run complete turn' }).click();

  await expect(page.locator('#stat-outcome')).toHaveText('completed');
  await expect(page.locator('#run-status')).toContainText('Turn completed');
  await expect(page.locator('#heard-output')).toContainText('Welcome to vocal-stack v2!');
  await expect(page.locator('#heard-output')).not.toContainText('https://');

  const generatedCharacters = Number(await page.locator('#stat-generated').innerText());
  const acknowledgedCharacters = Number(await page.locator('#stat-heard').innerText());
  expect(generatedCharacters).toBeGreaterThan(acknowledgedCharacters);
  expect(acknowledgedCharacters).toBeGreaterThan(0);

  await expect(page.getByRole('button', { name: 'Download trace' })).toBeEnabled();
  await page.getByRole('button', { name: 'Replay last trace' }).click();
  await expect(page.locator('#replay-output')).toContainText('Replay matched');
  await expect(page.locator('#replay-output')).toContainText('0 pending timers');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download trace' }).click();
  const download = await downloadPromise;
  const tracePath = await download.path();
  if (!tracePath) throw new Error('Trace download did not produce a file');
  await page.locator('#trace-file').setInputFiles(tracePath);
  await expect(page.locator('#trace-summary')).toContainText('uploaded trace');
  await expect(page.locator('#replay-output')).toContainText('Trace loaded');
});

test('interactive demo settles promptly when interrupted during model streaming', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Run complete turn' }).click();
  await expect(page.locator('#raw-output')).not.toBeEmpty();
  await page.getByRole('button', { name: 'Interrupt for barge-in' }).click();

  await expect(page.locator('#stat-outcome')).toHaveText('interrupted');
  await expect(page.locator('#run-status')).toContainText('Turn interrupted immediately');

  const generatedCharacters = Number(await page.locator('#stat-generated').innerText());
  const acknowledgedCharacters = Number(await page.locator('#stat-heard').innerText());
  expect(generatedCharacters).toBeGreaterThan(0);
  expect(acknowledgedCharacters).toBeLessThan(generatedCharacters);
});
