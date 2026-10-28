import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

type Session = { judgeTimeAt(p: number): number; engine: { notes: unknown[] } };
const judgeNow = (page: Page) => page.evaluate(() => (window as unknown as { __pfSession: Session }).__pfSession.judgeTimeAt(performance.now()));

// One song with a 12 s quiet intro: skipping it, playing a part, and trimming the song.
test.describe.configure({ mode: 'serial' });
let page: Page;
let fullNotes = 0;

test.beforeAll(async ({ browser }, info) => {
  page = await (await browser.newContext(info.project.use)).newPage();
  await page.goto('/?debug#/library');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Import/ }).first().click();
  await (await chooser).setFiles(fileURLToPath(new URL('../fixtures/e2e/neon-late.mp3', import.meta.url)));
  await expect(page.getByText('ready to play')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByRole('heading', { name: 'Neon Late' })).toBeVisible();
});

test('a long intro can be skipped', async () => {
  await page.locator('.play-cta').click();
  await page.waitForFunction(() => !!(window as unknown as { __pfSession?: unknown }).__pfSession);
  const skip = page.getByRole('button', { name: /Skip intro/ });
  await expect(skip).toBeVisible({ timeout: 5000 });
  fullNotes = await page.evaluate(() => (window as unknown as { __pfSession: Session }).__pfSession.engine.notes.length);
  const before = await judgeNow(page);
  await skip.click();
  await expect(skip).toBeHidden();
  // Landed shortly before the music: well past where we were, before the first note.
  await expect.poll(() => judgeNow(page)).toBeGreaterThan(before + 5000);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Exit' }).click();
  await expect(page.getByRole('heading', { name: 'Neon Late' })).toBeVisible();
});

test('play just part of the song', async () => {
  await page.getByRole('button', { name: 'Play part of the song' }).click();
  await expect(page.locator('.part-track')).toBeVisible();
  await page.getByRole('button', { name: 'Play this part' }).click();
  await page.waitForFunction(() => !!(window as unknown as { __pfSession?: unknown }).__pfSession);
  const partNotes = await page.evaluate(() => (window as unknown as { __pfSession: Session }).__pfSession.engine.notes.length);
  expect(partNotes).toBeGreaterThan(0);
  expect(partNotes).toBeLessThan(fullNotes);
  // Nobody taps, so it ends at the end of the part with a results screen marked as a part.
  await expect(page.locator('.results')).toBeVisible({ timeout: 40_000 });
  await expect(page.locator('.results-foot')).toContainText('part');
  await page.getByRole('button', { name: 'Done' }).click();
});

test('trim the song so every play uses the part', async () => {
  await page.getByRole('button', { name: 'Play part of the song' }).click();
  await page.getByRole('button', { name: 'Always play just this part' }).click();
  await expect(page.getByText(/Trimmed to/)).toBeVisible();
  await expect(page.locator('.trim-note')).toContainText('only');
  await page.reload();
  await expect(page.locator('.trim-note')).toBeVisible();
  // Undo it from the same sheet.
  await page.locator('.trim-note').click();
  await page.getByRole('button', { name: 'Play the whole song again' }).click();
  await expect(page.locator('.trim-note')).toBeHidden();
});
