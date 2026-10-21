// The four labs in the preview build (app/dist/Blackthorn-HQ-preview.html): every lab page opens without an error,
// a move changed in the Pokémon lab re-reads the build live (before and after shown), the team lab answers every
// scenario question and lists candidates, the breeding lab opens a line offspring-first, and PKHeX export writes a set.
// Run: python3 -I app/build.py && node app/test_labs.mjs                  (tests/test_engines.py runs it)
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let chromium;
try { ({ chromium } = await import('playwright')); } catch (e) {
  try { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); } catch (e2) { console.log('SKIP: Playwright is not installed'); process.exit(0); }
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], fails = [];
page.on('pageerror', (e) => errors.push(String(e.stack || e).slice(0, 600)));
const settle = async (sel, ms = 240000) => { const t = Date.now(); while (Date.now() - t < ms) {
  const st = await page.evaluate((s) => { const p = document.getElementById('page'); if (!p || /^\s*Opening…\s*$/.test(p.innerText)) return 'opening';
    if (s && !document.querySelector(s)) return 'wait'; if (document.getElementById('plbusy') || document.getElementById('tlbusy')) return 'busy';
    return /Reading (it|the six|candidates)…/.test(p.innerText) ? 'reading' : 'ok'; }, sel); if (st === 'ok') return true; await page.waitForTimeout(200); } return false; };
const go = async (h, sel) => { await page.evaluate((x) => nav(x), h); if (!await settle(sel)) fails.push(h + ': never settled (waiting for ' + sel + ')');
  const n = await page.evaluate(() => [...document.querySelectorAll('#page .notice')].map((x) => x.innerText).join(' | '));
  if (n && !/Re-reading/.test(n)) fails.push(h + ': ' + n.slice(0, 300)); };
await page.goto('file://' + path.join(HERE, 'dist', 'Blackthorn-HQ-preview.html') + '#/');
await settle();
await go('#/pokemon', '.pickgrid .pick');
await go('#/pokemon/' + encodeURIComponent('me:heartgold/Typhlosion'), '#plout .rrow');
const before = await page.evaluate(() => [...document.querySelectorAll('#plout .rrow')].map((r) => r.innerText).join('|'));
await page.fill('[data-plmove="1"]', 'Focus Blast');
await page.waitForTimeout(800);
await settle('#plout .rrow');
const after = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#plout .rrow')].map((r) => r.innerText).join('|'), lines: document.querySelectorAll('#plout .sent.new, #plout .sent.gone').length }));
if (after.rows === before) fails.push('Pokémon lab: changing a move didn\'t change any team role score');
if (!after.lines) fails.push('Pokémon lab: changing a move didn\'t change any scouting line');
await go('#/compare/Garchomp', 'table.t');
const rows = await page.evaluate(() => document.querySelectorAll('#page table.t tr').length - 1);
if (rows < 4) fails.push('compare: only ' + rows + ' Garchomp builds');
await go('#/team/heartgold', '.tslots');
const team = await page.evaluate(() => ({ slots: TL.team.filter(Boolean).length, q: TL.comp.questions.filter((x) => x.ok === null).map((x) => x.id), cands: document.querySelectorAll('#tlclist .cand').length }));
if (team.slots !== 6) fails.push('team lab: the HeartGold default has ' + team.slots + ' members, not 6');
if (team.q.length) fails.push('team lab: unanswered question kinds ' + team.q.join(', '));
if (!team.cands) fails.push('team lab: no candidates');
await go('#/team/crystal', '.tslots');
await go('#/lines', '.pickgrid .pick');
await go('#/lines/mamoswine-ancient-power', '.chain');
await go('#/lines/heartgold-tyranitar', '.chain');
await go('#/pkhex/' + encodeURIComponent('me:heartgold/Typhlosion'), '.paste');
const set = await page.evaluate(() => document.querySelector('.paste').innerText);
if (!/^Typhlosion/.test(set) || !/- Flamethrower/.test(set)) fails.push('PKHeX export: unexpected set ' + set.slice(0, 120));
await browser.close();
for (const e of errors) fails.push('page error: ' + e);
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
console.log('labs ok: Pokémon lab live edit, compare (' + rows + ' Garchomp builds), team lab (' + team.cands + ' candidates), breeding lab, PKHeX export');
