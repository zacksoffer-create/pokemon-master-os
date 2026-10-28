import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// A music video (H.264 + AAC MP4): only its sound is kept, and it plays like any song.
test('import an MP4 video, keep its sound and play it to the results', async ({ page }) => {
  await page.goto('/#/library');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Import/ }).first().click();
  await (await chooser).setFiles(fileURLToPath(new URL('../fixtures/e2e/neon-clip.mp4', import.meta.url)));
  await expect(page.getByText('ready to play')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByRole('heading', { name: 'Neon Clip' })).toBeVisible();
  await expect(page.getByText(/11[56] BPM/)).toBeVisible();

  // Stored as audio only: well under the video's 354 KB.
  const stored = await page.evaluate(
    () =>
      new Promise<{ size: number; mime: string }>((resolve, reject) => {
        const req = indexedDB.open('pulsefall');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const all = req.result.transaction('audio').objectStore('audio').getAll();
          all.onsuccess = () => {
            const a = all.result[0] as { bytes: ArrayBuffer; mime: string };
            resolve({ size: a.bytes.byteLength, mime: a.mime });
          };
        };
      }),
  );
  expect(stored.mime).toBe('audio/mp4');
  expect(stored.size).toBeLessThan(250_000);

  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: /Watch autoplay/ }).click();
  await expect(page.locator('.results')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.results-label')).toHaveText(/Flawless/);
});
