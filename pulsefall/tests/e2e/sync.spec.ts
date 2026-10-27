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

// The sync check with a bot that taps exactly on each click and flash (by the metronome's
// own clock): both offsets should come out near zero, and stopping the live check must
// actually stop it.
test('the sync check measures, saves and previews offsets', async ({ page }) => {
  await page.goto('/?debug#/calibrate');
  type Cal = () => { at(p: number): number } | null;
  const tapAlong = (count: number) =>
    page.evaluate(
      (count) =>
        new Promise<number>((resolve, reject) => {
          const cal = (window as unknown as { __pfCal: Cal }).__pfCal;
          let k = 4; // skip the count-in
          let sent = 0;
          const started = performance.now();
          const loop = () => {
            const clock = cal();
            if (clock && clock.at(performance.now()) >= k * 600) {
              window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
              k++;
              sent++;
            }
            if (sent >= count) resolve(sent);
            else if (performance.now() - started > 30_000) reject(new Error('metronome never started'));
            else requestAnimationFrame(loop);
          };
          requestAnimationFrame(loop);
        }),
      count,
    );

  await page.getByRole('button', { name: 'Start' }).click();
  await tapAlong(16);
  await page.getByRole('button', { name: 'Start part 2' }).click();
  await tapAlong(12);
  await expect(page.getByRole('heading', { name: 'Your device' })).toBeVisible();
  const offsets = await page.locator('.cal-results b').allInnerTexts();
  const [audioMs, inputMs] = offsets.map((t) => parseInt(t, 10));
  console.log('calibration offsets', offsets);
  expect(Math.abs(audioMs)).toBeLessThanOrEqual(25);
  expect(Math.abs(inputMs)).toBeLessThanOrEqual(25);

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByRole('button', { name: 'Play check' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __pfCal: Cal }).__pfCal())).toBeNull();
});
