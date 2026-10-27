import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/e2e/${name}`, import.meta.url));

async function importFile(page: Page, file: string) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Import/ }).first().click();
  await (await chooser).setFiles(fixture(file));
}

// One continuous session, like a real player: later steps rely on songs imported earlier.
test.describe.configure({ mode: 'serial' });
let context: BrowserContext;
let page: Page;
test.beforeAll(async ({ browser }, info) => {
  context = await browser.newContext(info.project.use);
  page = await context.newPage();
});
test.afterAll(async () => {
  await context.close();
});

test('home screen renders the core actions', async () => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Import song/ })).toBeVisible();
  await expect(page.getByText('Neon Overture')).toBeVisible();
  // No horizontal overflow on a phone-sized viewport.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('import an MP3, analyze it automatically, and play it to the results', async () => {
  await page.goto('/#/library');
  await importFile(page, 'neon-drop.mp3');
  await expect(page.getByText('Importing')).toBeVisible();
  await expect(page.getByText('ready to play')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByRole('heading', { name: 'Neon Drop' })).toBeVisible();
  await expect(page.getByText('Pulsefall Lab')).toBeVisible();
  // Detected tempo of the demo excerpt (116 BPM).
  await expect(page.getByText(/11[56] BPM/)).toBeVisible();
  // Every style has a chart.
  for (const s of ['Relaxed', 'Classic Groove', 'Full Rhythm', 'Advanced']) await expect(page.getByRole('radio', { name: new RegExp(s) })).toBeVisible();

  // Watch the chart play itself to the end.
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: /Watch autoplay/ }).click();
  await expect(page.locator('canvas.game-canvas')).toBeVisible();
  await expect(page.locator('.results')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.results-label')).toHaveText(/Flawless/);
  await expect(page.locator('.results')).toContainText('autoplay');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { name: 'Neon Drop' })).toBeVisible();
  await expect(page.getByText('Recent plays')).toBeVisible();
});

test('the library persists across reloads and finds songs by search', async () => {
  await page.goto('/#/library');
  await expect(page.getByText('Neon Drop')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Neon Drop')).toBeVisible();
  await page.getByLabel('Search library').fill('zzz');
  await expect(page.getByText('No songs match.')).toBeVisible();
  await page.getByLabel('Search library').fill('drop');
  await expect(page.getByText('Neon Drop')).toBeVisible();
});

test('import an M4A and detect the duplicate on re-import', async () => {
  await page.goto('/#/library');
  await importFile(page, 'neon-verse.m4a');
  await expect(page.getByText('ready to play')).toBeVisible({ timeout: 60_000 });
  await page.keyboard.press('Escape');
  await page.goto('/#/library');
  await importFile(page, 'neon-verse.m4a');
  await expect(page.getByText('Already in your library')).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press('Escape');
});

test('a file that is not audio fails with a helpful message and the library is intact', async () => {
  await page.goto('/#/library');
  await importFile(page, 'not-audio.mp3');
  await expect(page.getByText(/couldn.t be decoded|doesn.t recognize/)).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press('Escape');
  await page.goto('/#/library');
  await expect(page.getByText('Neon Drop')).toBeVisible();
  await expect(page.getByText('Neon Verse')).toBeVisible();
});

test('play with the keyboard, pause, resume and exit', async () => {
  await page.goto('/#/library');
  await page.getByText('Neon Drop').click();
  await page.getByRole('radio', { name: /Relaxed/ }).click();
  await page.locator('.play-cta').click();
  await expect(page.locator('canvas.game-canvas')).toBeVisible();
  await page.waitForTimeout(3500);
  for (const key of ['KeyF', 'Space', 'KeyJ', 'KeyF', 'Space', 'KeyJ']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(180);
  }
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeHidden();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Exit' }).click();
  await expect(page.getByRole('heading', { name: 'Neon Drop' })).toBeVisible();
});

test('a reload while in the game returns to the song instead of a broken screen', async () => {
  await page.goto('/#/library');
  await page.getByText('Neon Drop').click();
  const url = page.url().replace('#/song/', '#/play/');
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Neon Drop' })).toBeVisible();
});

test('edit a chart, save it as a separate version', async () => {
  await page.goto('/#/library');
  await page.getByText('Neon Drop').click();
  await page.getByRole('radio', { name: /Classic Groove/ }).click();
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: /Edit chart/ }).click();
  const canvas = page.locator('canvas.editor-canvas');
  await expect(canvas).toBeVisible();
  const before = await page.locator('.editor-title span').textContent();
  const box = (await canvas.boundingBox())!;
  // Tap in the middle lane a little above the playhead to add a note.
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await expect(page.locator('.editor-title span')).not.toHaveText(before ?? '');
  await expect(page.locator('.editor-title span')).toContainText('unsaved');
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('button', { name: 'Redo' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/Chart saved|Saved/)).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('radio', { name: 'My edit' })).toBeVisible();
});

test('settings persist and the sync check opens', async () => {
  await page.goto('/#/settings');
  const speed = page.getByLabel('Note speed');
  await speed.fill('8');
  await page.getByRole('radio', { name: 'Strict' }).click();
  await page.reload();
  await expect(page.getByLabel('Note speed')).toHaveValue('8');
  await expect(page.getByRole('radio', { name: 'Strict' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: /Run sync check/ }).click();
  await expect(page.getByRole('heading', { name: /Line up the beat/ })).toBeVisible();
});

test('delete a song', async () => {
  await page.goto('/#/library');
  await page.getByText('Neon Verse').click();
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: /Delete song/ }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('Song deleted')).toBeVisible();
  await expect(page.getByText('Neon Verse')).toBeHidden();
  await expect(page.getByText('Neon Drop')).toBeVisible();
});
