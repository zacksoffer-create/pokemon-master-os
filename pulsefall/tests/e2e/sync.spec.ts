import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// A bot inside the page presses lane keys at the moment each note reaches the hit line
// (according to the game's own clock). If input timestamps, the audio clock and the
// engine agree, nearly every press is judged Perfect.
test('a bot tapping on time is judged Perfect through the real input path', async ({ page }) => {
  await page.goto('/?debug#/library');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Import/ }).first().click();
  await (await chooser).setFiles(fileURLToPath(new URL('../fixtures/e2e/neon-drop.mp3', import.meta.url)));
  await expect(page.getByText('ready to play')).toBeVisible({ timeout: 60_000 });
  await page.keyboard.press('Escape');
  await page.getByRole('radio', { name: /Classic Groove/ }).click();
  await page.locator('.play-cta').click();
  await page.waitForFunction(() => !!(window as unknown as { __pfSession?: unknown }).__pfSession, null, { timeout: 30_000 });

  const stats = await page.evaluate(
    () =>
      new Promise<{ perfect: number; great: number; good: number; miss: number; mean: number; judged: number; total: number }>((resolve) => {
        type N = { t: number; end: number; lane: number; type: string; state: number };
        const s = (window as unknown as { __pfSession: { engine: { notes: N[]; totalJudgments: number; getResult(): { counts: Record<string, number>; meanErrorMs: number; judged: number } }; judgeTimeAt(p: number): number } }).__pfSession;
        const keys = ['KeyF', 'Space', 'KeyJ', 'KeyK'];
        const notes = s.engine.notes;
        let next = 0;
        const releases: { at: number; code: string }[] = [];
        const send = (type: 'keydown' | 'keyup', code: string, shift = false) => window.dispatchEvent(new KeyboardEvent(type, { code, shiftKey: shift, bubbles: true }));
        const loop = () => {
          const now = performance.now();
          const t = s.judgeTimeAt(now);
          while (next < notes.length && notes[next].t <= t) {
            const n = notes[next++];
            const code = keys[n.lane];
            send('keydown', code, n.type === 'swipe');
            releases.push({ at: n.type === 'hold' ? n.end + 10 : t + 40, code });
          }
          for (let i = releases.length - 1; i >= 0; i--) {
            if (releases[i].at <= t) {
              send('keyup', releases[i].code);
              releases.splice(i, 1);
            }
          }
          if (next < notes.length || releases.length) requestAnimationFrame(loop);
          else
            setTimeout(() => {
              const r = s.engine.getResult();
              resolve({ ...(r.counts as { perfect: number; great: number; good: number; miss: number }), mean: r.meanErrorMs, judged: r.judged, total: s.engine.totalJudgments });
            }, 400);
        };
        requestAnimationFrame(loop);
      }),
  );
  console.log('bot result', stats);
  expect(stats.judged).toBe(stats.total);
  expect(stats.miss).toBe(0);
  expect(stats.perfect / stats.judged).toBeGreaterThan(0.95);
  // Pressing on the frame the note crosses the line is late by at most one frame.
  expect(Math.abs(stats.mean)).toBeLessThan(25);
  await expect(page.locator('.results')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.results-label')).toHaveText(/Full Combo|Flawless/);
});
