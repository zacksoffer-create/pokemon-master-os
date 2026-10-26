// The Arena in the preview build (web/94_arena.html over web/35_arena.html and the 6v6 engine), in Chromium: the engine
// loads from app data; Play Now plays a match whose numbers match Node's for the same job (the fingerprint); a battle is
// watchable exactly as it went; Legends shows the recorded rankings and plays a best-of-seven; a League plays a season
// with standings, awards and a playoff; the Draft fills six rosters and plays its league; Your trainer saves settings
// that the next match uses; Library.setTeamEngine is registered; a phone-width page doesn't scroll sideways.
// Run: python3 -I app/build.py && node app/test_arena.mjs                  (tests/test_engines.py runs it)
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { seedPage } from './test_seed.mjs';
process.on('unhandledRejection', (e) => { console.log('FAIL\n' + String(e && e.stack || e).slice(0, 1500)); process.exit(1); });

const HERE = path.dirname(fileURLToPath(import.meta.url));
let chromium;
try { ({ chromium } = await import('playwright')); } catch (e) {
  try { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); } catch (e2) { console.log('SKIP: Playwright is not installed'); process.exit(0); }
}
if (!fs.existsSync(path.join(HERE, 'data', 'sixvsix.json'))) { console.log('SKIP: no sixvsix.json (node sixvsix/cli/arena-pack.mjs)'); process.exit(0); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], fails = [];
page.on('pageerror', (e) => errors.push(String(e.stack || e).slice(0, 600)));
const settle = async (sel, ms = 240000) => { const t = Date.now(); while (Date.now() - t < ms) {
  const st = await page.evaluate((s) => { const p = document.getElementById('page'); if (!p || /^\s*Opening…\s*$/.test(p.innerText)) return 'opening';
    if (s && !document.querySelector(s)) return 'wait'; return 'ok'; }, sel);
  if (st === 'ok') return true; await page.waitForTimeout(200); } return false; };
const go = async (h, sel) => { await page.evaluate((x) => nav(x), h); if (!await settle(sel)) fails.push(h + ': never settled (waiting for ' + sel + ')');
  const n = await page.evaluate(() => [...document.querySelectorAll('#page .notice')].map((x) => x.innerText).filter((x) => !/v2: each of your six teams/.test(x)).join(' | ')); if (n) fails.push(h + ': ' + n.slice(0, 300)); };
const text = (sel = '#page') => page.evaluate((s) => (document.querySelector(s) || {}).innerText || '', sel);
const expect = (what, ok) => { if (!ok) fails.push(what); };
const waitFor = async (fn, ms = 300000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(300); } return false; };

await page.goto('file://' + path.join(HERE, 'dist', 'Blackthorn-HQ-preview.html') + '#/');
await settle();
await page.evaluate(() => { Object.keys(localStorage).filter((k) => /^bt-(preview-tabs|arena|league|trainer)/.test(k)).forEach((k) => localStorage.removeItem(k)); });
// v2 (D-078): a fresh start has no teams of yours, so the test seeds two (test_seed.mjs); Platinum's trainer coaches all-out
await seedPage(page, ['heartgold', 'platinum'], { platinum: { style: 'allout', params: { aggression: 80, risk: 60, switching: 35, preservation: 30, patience: 35 } } });
await settle();

// 1. Play Now: your HeartGold team against Cynthia (rematch), 10 battles
const t0 = Date.now();
await go('#/arena?a=mine:journey:heartgold&b=lib:platinum/cynthia-rematch&n=10', '#arrun');
expect('Library.setTeamEngine is registered', await page.evaluate(() => typeof Library.teamEngine() === 'function'));
await page.click('#arrun');
expect('the match finished', await waitFor(() => !!document.querySelector('#arout .kpis')));
const m = await page.evaluate(() => { const k = Object.keys(window).length; const x = Arena.X(); const keys = []; return null; });
const result = await page.evaluate(() => { const r = document.querySelector('#arout').innerText; return r; });
expect('the result shows a win rate, a record and contributions', /A wins/.test(result) && /Record/.test(result) && /What A's Pokémon did/i.test(result));
const fp = await page.evaluate(() => Arena.match('mine:journey:heartgold', 'lib:platinum/cynthia-rematch', {n: 10}).then((mm) => ({fp: Arena.X().fingerprint(mm.result), won: mm.result.won, n: mm.result.n, platform: mm.result.timing.platform,
  job: {ruleset: mm.task.job.ruleset, seed: mm.task.job.trials.seed, a: mm.task.job.a, b: mm.task.job.b}})));
console.log(`  match: ${fp.won}/${fp.n} on ${fp.platform} (${((Date.now() - t0) / 1000).toFixed(1)} s), fingerprint ${fp.fp}`);
fs.writeFileSync(path.join(HERE, 'dist', 'arena-fingerprint.json'), JSON.stringify({fp: fp.fp, won: fp.won, n: fp.n, platform: fp.platform}));
// the same job in Node must give the same battles (your team as the page made it; Cynthia from the library in Node)
const node = await import(path.resolve(HERE, '../../sixvsix/src/index.js'));
const lib = node.withGen4(JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'library.json'), 'utf8')));
const B = node.teamFromLibrary(lib, 'platinum/cynthia-rematch', { lens: 'standardized' });
expect('the page fielded Cynthia exactly as Node does', JSON.stringify(fp.job.b.team) === JSON.stringify(B));
const nodeJob = node.makeJob({ id: 'x', label: 'x', ruleset: fp.job.ruleset, n: 10, seed: fp.job.seed, pairing: 'mirrored', lens: 'standardized',
  a: fp.job.a, b: { team: B, profile: fp.job.b.profile },
  record: { logs: 'none', decisions: 'none', input_logs: 'none', analysis: true } });
const nodeFp = node.fingerprint(node.runJobSync(nodeJob));
expect(`the browser played Node's battles (browser ${fp.fp}, Node ${nodeFp})`, nodeFp === fp.fp);

// a battle, watched
await page.evaluate(() => document.querySelector('#arout button.btn.sm').click());
expect('the replay shows turns and decisions with reasons', await waitFor(() => /Turn 1/.test(document.getElementById('din').innerText) && document.querySelectorAll('#din .ardec').length > 3, 60000));
await page.evaluate(() => closeDrawer());
// the result was kept in the Arena tab
expect('the match was kept in the Arena tab', await waitFor(() => { try { return (JSON.parse(localStorage.getItem('bt-preview-tabs')).Arena || []).some((r) => r.kind === 'match'); } catch (e) { return false; } }, 20000));

// 2. Legends: the recorded rankings and a best-of-three
await go('#/legends', '#lgrun');
const lg = await text();
expect('Legends lists the power rankings', /Power rankings/.test(lg) && /Cynthia/.test(lg) && /Lance/.test(lg));
await page.selectOption('#lgbest', '3');
await page.click('#lgrun');
expect('a series is played to a winner', await waitFor(() => /win the series/.test(document.getElementById('lgout').innerText), 120000));

// 3. A league: four teams, four battles a pairing, standings, awards and a playoff
await go('#/leagues', '#lgplay');
await page.evaluate(() => { document.querySelectorAll('.lgpick').forEach((c) => { c.checked = ['mine:journey:heartgold', 'mine:journey:platinum', 'lib:platinum/cynthia-rematch', 'lib:heartgold/red'].indexOf(c.value) >= 0; }); lgCount(); });
await page.selectOption('#lgn', '4');
await page.click('#lgplay');
expect('the season finished with standings', await waitFor(() => /Standings/.test(document.getElementById('lgout').innerText), 300000));
const st = await text('#lgout');
expect('awards and leaders are shown', /MVP/i.test(st) && /League leaders/i.test(st) && /Head to head/.test(st));
await page.evaluate(() => lgPlayoffs());
expect('the playoffs crowned a champion', await waitFor(() => /champions/i.test((document.getElementById('lgpo') || {}).innerText || ''), 300000));

// 4. The draft: six rosters, then a league
await go('#/draft', '#drstart');
await page.click('#drstart');
for (let k = 0; k < 6; k++) {
  const ok = await page.evaluate(() => { const b = document.querySelector('#drboard button.btn.sm'); if (!b) return false; b.click(); return true; });
  if (!ok) break;
  await page.waitForTimeout(150);
}
const rosters = await page.evaluate(() => DR.gms.map((g) => g.roster.length));
expect(`every roster has six (${rosters.join(',')})`, rosters.length === 6 && rosters.every((n) => n === 6));
const species = await page.evaluate(() => DR.gms.flatMap((g) => g.roster.map((c) => c.species)));
expect('no Pokémon was drafted twice', new Set(species).size === species.length);
await page.evaluate(() => drLeague());
expect('the draft league finished', await waitFor(() => /Standings/.test((document.getElementById('drout') || {}).innerText || ''), 300000));

// 5. each team's own trainer reaches its battles (v2); the default coach settings save
const used = await page.evaluate(() => Arena.ready().then(() => { const s = Arena.side('mine:journey:platinum'); return Arena.profileFor(s, 'blackthorn').params.aggression; }));
expect(`a team's own trainer reaches its battles (aggression ${used})`, used === 80);
await go('#/trainer', '#trsave');
await page.selectOption('#trphil', 'allout');
await page.click('#trsave');
expect('the default coach settings are kept', await page.evaluate(() => (store('trainer') || {}).philosophy === 'allout'));
expect('traits name the style', /Run-and-gun/.test(await text('#trtraits')));

// 6. the seam's result shape
const seam = await page.evaluate(() => Library.teamEngine()('journey:platinum', 'heartgold/red', {n: 2}).then((r) => ({kind: r.kind, a: r.a, b: r.b, n: r.n, cls: r.evidence_class})));
expect('the seam returns a Simulation Result', seam.kind === 'SimulationResult' && seam.n === 2 && seam.cls === 'simulated');

// 6b. criterion 6 on a trainer's profile: their decisions by kind
const tend = await page.evaluate(() => Arena.tendencies('lib:heartgold/karen-rematch', {n: 2}).then((t) => t.counts));
expect(`a trainer's decisions are read by kind (${JSON.stringify(tend)})`, tend.decisions > 10 && tend.attack + tend['switch'] + tend.status + tend.setup + tend.heal === tend.decisions);

// 7. a phone
await page.setViewportSize({ width: 390, height: 844 });
for (const h of ['#/arena', '#/legends', '#/leagues', '#/trainer']) {
  await go(h, '#page .card');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(h + ' scrolls sideways at phone width', !wide);
}

await browser.close();
if (errors.length) fails.push('page errors: ' + errors.slice(0, 3).join(' || '));
if (fails.length) { console.log('FAIL\n  ' + fails.join('\n  ')); process.exit(1); }
console.log(`OK: the Arena (play now matches Node, replay, legends, a league with playoffs, the draft, your trainer, the seam, phone) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
