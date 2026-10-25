// The 6v6 Lab in Chromium (Playwright): the page opens on the recorded run with no errors; "Run it here" plays the
// default league on Web Workers and must land on exactly the battles Node played (the fingerprint); a battle opens
// turn by turn and "Try from here" plays it on; Build A vs Build B and the build editor work; at phone width the page
// never scrolls sideways. Writes screenshots to results/browser/. Run: node browser/build.mjs && node browser/test-lab.mjs
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'results', 'browser');
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch (e) {
  console.log('SKIP: Playwright is not installed'); process.exit(0);
}
fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => {
  const file = path.join(DIST, path.basename(req.url.split('?')[0]));
  if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/lab.html`;
const expected = JSON.parse(fs.readFileSync(path.join(DIST, 'lab.json'), 'utf8')).fingerprints;
const browser = await chromium.launch();
const failures = [], notes = [];
const check = (ok, what) => { (ok ? notes : failures).push(what); console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); };

async function open(context) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  await page.goto(url);
  await page.waitForSelector('.headline');
  return { page, errors };
}
const runAndWait = async (page, timeout = 240000) => {
  await page.click('#go');
  await page.waitForFunction(() => /^Done in|failed|Stopped/.test(document.getElementById('status').textContent), null, { timeout });
  return page.textContent('#status');
};

// ---- desktop ------------------------------------------------------------------------------------------------------
const desk = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const PHONE_W = 390;
{
  const { page, errors } = await open(desk);
  check(await page.isVisible('.recorded'), 'opens on the recorded Node run');
  await page.screenshot({ path: path.join(OUT, 'lab-desktop.png'), fullPage: false });
  const status = await runAndWait(page);
  check(/^Done in/.test(status), `league runs here: ${status}`);
  const meta = await page.textContent('#panel-result .runhead');
  check(meta.includes('the same battles as the recorded Node run'), `same battles as Node (${expected['me/heartgold'].fingerprint}): ${meta.match(/fingerprint [0-9a-f]+|NOT[^)]*\)/)?.[0]}`);
  // a battle, turn by turn, and trying another call
  await page.click('[data-battle]');
  await page.waitForSelector('#panel-battle .turn');
  check((await page.$$('#panel-battle .turn')).length > 3, 'a battle opens turn by turn');
  check((await page.$$('#panel-battle .opt .why')).length > 0, 'decisions show their options and reasons');
  await page.screenshot({ path: path.join(OUT, 'lab-battle.png') });
  const tryBtn = await page.$('[data-try]');
  await tryBtn.click();
  const at = await tryBtn.getAttribute('data-try');
  await page.waitForFunction((k) => /From turn/.test(document.getElementById('coach-' + k).textContent), at, { timeout: 120000 });
  check(true, `try from here: ${(await page.textContent(`#coach-${at} b`)).slice(0, 140)}`);
  // Build A vs Build B: the HG lineup variation, quick
  await page.click('[data-tab="result"]');
  await page.click('[data-q="compare"]');
  await page.click('[data-d="quick"]');
  const cmp = await runAndWait(page);
  check(/^Done in/.test(cmp) && (await page.textContent('#panel-result')).includes('The battles, paired'), `Build A vs Build B: ${cmp}`);
  await page.screenshot({ path: path.join(OUT, 'lab-compare.png'), fullPage: false });
  // the build editor: change a spread, check it, set it up as Build B
  await page.click('[data-q="league"]');
  await page.click('[data-tab="editor"]');
  await page.fill('#ed-ev-hp', '4');
  await page.dispatchEvent('#ed-ev-hp', 'change');
  await page.click('#ed-conv');
  await page.waitForFunction(() => /Conventional spread \(/.test(document.getElementById('ed-opt-note').textContent), null, { timeout: 60000 });
  await page.click('#ed-duel');
  await page.waitForFunction(() => /Duel-model spread \(/.test(document.getElementById('ed-opt-note').textContent), null, { timeout: 60000 });
  await page.click('#ed-check');
  await page.waitForSelector('#ed-verdicts .ok, #ed-verdicts .bad, #ed-verdicts .muted');
  const verdict = await page.textContent('#ed-verdicts');
  check(/Legal|Nothing changed/.test(verdict), `the editor checks an edit: ${verdict.slice(0, 120)}`);
  await page.screenshot({ path: path.join(OUT, 'lab-editor.png') });
  await page.click('[data-tab="how"]');
  check((await page.textContent('#panel-how')).includes('How the trainer agent decides'), 'How it works renders');
  check(errors.length === 0, `no page errors on desktop${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await page.close();
}
await desk.close();

// ---- phone width, light theme ---------------------------------------------------------------------------------------
const phone = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
});
{
  const { page, errors } = await open(phone);
  const wide = async (what) => {
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    check(w <= PHONE_W, `no sideways scroll at phone width (${what}): ${w} ≤ ${PHONE_W}`);
  };
  await wide('the recorded report');
  await page.screenshot({ path: path.join(OUT, 'lab-phone.png'), fullPage: false });
  await page.click('[data-battle]');
  await page.waitForSelector('#panel-battle .turn');
  await wide('a battle');
  await page.screenshot({ path: path.join(OUT, 'lab-phone-battle.png'), fullPage: false });
  await page.click('[data-tab="editor"]');
  await wide('the editor');
  check(errors.length === 0, `no page errors on the phone profile${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await page.close();
}
await phone.close();
await browser.close();
server.close();
console.log(failures.length ? `\n${failures.length} FAILED` : `\nall ${notes.length} checks passed`);
process.exit(failures.length ? 1 : 0);
