// Careers and recognition 2.0 in the preview build (web/96_career.html): an Arena result reaches the player card of
// the Pokémon that played it; badges read by their tier names; a Chronicle chapter is kept in the Journal and shows on
// the timeline; the Hall of Fame ranks your Pokémon from the kept battles; a phone keeps the card on screen.
// Run: python3 -I app/build.py && node app/test_career.mjs                 (tests/test_engines.py runs it)
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
process.on('unhandledRejection', (e) => { console.log('FAIL\n' + String(e && e.stack || e).slice(0, 1500)); process.exit(1); });

const HERE = path.dirname(fileURLToPath(import.meta.url));
let chromium;
try { ({ chromium } = await import('playwright')); } catch (e) {
  try { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); } catch (e2) { console.log('SKIP: Playwright is not installed'); process.exit(0); }
}
if (!fs.existsSync(path.join(HERE, 'data', 'sixvsix.json'))) { console.log('SKIP: no sixvsix.json'); process.exit(0); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], fails = [];
page.on('pageerror', (e) => errors.push(String(e.stack || e).slice(0, 600)));
const settle = async (sel, ms = 180000) => { const t = Date.now(); while (Date.now() - t < ms) {
  const st = await page.evaluate((s) => { const p = document.getElementById('page'); if (!p || /^\s*Opening…\s*$/.test(p.innerText)) return 'opening';
    if (s && !document.querySelector(s)) return 'wait'; return 'ok'; }, sel);
  if (st === 'ok') return true; await page.waitForTimeout(150); } return false; };
const go = async (h, sel) => { await page.evaluate((x) => nav(x), h); if (!await settle(sel)) fails.push(h + ': never settled (waiting for ' + sel + ')'); };
const expect = (what, ok) => { if (!ok) fails.push(what); };
const waitFor = async (fn, ms = 120000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(250); } return false; };
const t0 = Date.now();

await page.goto('file://' + path.join(HERE, 'dist', 'Blackthorn-HQ-preview.html') + '#/');
await settle();
await page.evaluate(() => { Object.keys(localStorage).filter((k) => /^bt-(preview-tabs|arena)/.test(k)).forEach((k) => localStorage.removeItem(k)); });
await page.evaluate(() => recordsReady());
// one of your HeartGold Pokémon that's on the journey six
const ind = await page.evaluate(() => Arena.ready().then(() => { const six = Arena.pack().teams['me/heartgold'].members.map((m) => m.species);
  const x = Object.values(S.store.individuals).filter((i) => i.game === 'heartgold' && six.indexOf(i.species) >= 0)[0]; return x ? {id: x.id, species: x.species} : null; }));
expect('a HeartGold journey Pokémon exists in the record', !!ind);
if (ind) {
  // a kept match, as Play now records it
  await go('#/arena?a=pack:me/heartgold&b=lib:heartgold/red&n=10', '#arrun');
  await page.click('#arrun');
  expect('the match was kept', await waitFor(() => { try { return (JSON.parse(localStorage.getItem('bt-preview-tabs')).Arena || []).length > 0; } catch (e) { return false; } }));
  await go('#/mon/' + encodeURIComponent(ind.id), '#mcareer .pcard');
  const txt = await page.evaluate(() => document.getElementById('mcareer').innerText);
  expect(`its card shows the kept battles (${txt.slice(0, 200).replace(/\n/g, ' ')})`, /\b10\s*battles/i.test(txt));
  expect('the card has a signature title', await page.evaluate(() => (document.querySelector('.pc-title') || {}).innerText.length > 2));
  // a chapter in the Chronicle
  await page.evaluate(() => { window.askText = function (e, t, fn) { fn('Held the line against Red at the summit.'); }; });
  await page.evaluate(() => document.querySelector('#mcareer button.btn.sm').click());
  expect('the chapter shows on its timeline', await waitFor(() => /Held the line against Red/.test(document.getElementById('mcareer').innerText), 20000));
  const j = await page.evaluate(() => (JSON.parse(localStorage.getItem('bt-preview-tabs')).Journal || []).filter((r) => r.kind === 'chronicle'));
  expect('the chapter is a Journal row', j.length === 1);
}
// tier names are on the recognition config
expect('tier names are on the recognition config', await page.evaluate(() => labsReady().then(() => Recognize.config().tier_names && Career.tierName('speed', 'Gold') === 'Blazing')));
await go('#/halloffame', '#page .card');
const hof = await page.evaluate(() => document.getElementById('page').innerText);
expect('the Hall of Fame ranks your Pokémon and the Legends', /Most knockouts a battle/i.test(hof) && /All-time Legends/i.test(hof));
await page.setViewportSize({ width: 390, height: 844 });
if (ind) { await go('#/mon/' + encodeURIComponent(ind.id), '#mcareer .pcard'); expect('the card fits a phone', !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2))); }
await browser.close();
if (errors.length) fails.push('page errors: ' + errors.slice(0, 3).join(' || '));
if (fails.length) { console.log('FAIL\n  ' + fails.join('\n  ')); process.exit(1); }
console.log(`OK: careers (an Arena result on the player card, a title, the Chronicle, tier names, the Hall of Fame, phone) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
