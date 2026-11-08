// The Wild and the estate in time (v2.7, docs/WILD.md) in the preview, in Chromium: the map coloured by a team's
// readiness, a place's wild Pokémon by window and what its ground calls for, the planner (route, readiness, who'd be
// missed at home, a seeded run, the odds, keeping it), the field log, and the estate's season, stores and day.
// Run: node engine/app/test_wild.mjs (after python3 -I engine/app/build.py)
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
const until = (fn, arg, ms = 90000) => page.waitForFunction(fn, arg, { timeout: ms });
const text = (sel) => page.evaluate((s) => (document.querySelector(s || '#page') || {}).innerText || '', sel);
const open = async (h, probe) => { await page.evaluate((x) => nav(x), h); await until(probe || (() => !/Opening…/.test(document.getElementById('page').innerText)), null, 120000).catch(() => fails.push(h + ': never opened')); };
await page.goto('file://' + path.join(HERE, 'dist', 'Blackthorn-HQ-preview.html') + '#/');
await page.evaluate(() => { localStorage.removeItem('bt-preview-tabs'); localStorage.removeItem('bt-expedition'); localStorage.removeItem('bt-wild-team'); localStorage.removeItem('bt-estate-plots'); });
await page.reload();
await until(() => document.querySelector('.jcards'));

// an empty team: the map shows places only, and says so
await open('#/wild', () => document.querySelector('#wmap svg'));
const empty = await page.evaluate(() => ({ nodes: document.querySelectorAll('#wmap [data-place]').length, text: document.getElementById('page').innerText }));
if (empty.nodes !== 95) fails.push('map: ' + empty.nodes + ' places, not 95');
if (!/team is empty/.test(empty.text)) fails.push('map: no empty-team notice');

// a HeartGold team that can fly, surf, light and keep warm (plausibly)
await page.evaluate(async () => {
  const add = async (sp, moves, ab) => { const a = await Records.saveIndividual({species: sp, game: 'heartgold', gender: 'M', shiny: false, ball: 'Poké Ball', origin: 'added in the app', status: 'working'});
    const b = await Records.saveBuild({species: sp, game: 'heartgold', generation: 4, ability: ab, moves: moves, individual: a.id}, {asNew: true});
    await Records.saveIndividual(Object.assign({}, S.store.individuals[a.id], {build: b.id}));
    await Teams.update('heartgold', (t) => { t.slots[t.slots.indexOf(null)] = {ind: a.id, species: sp}; return t; }); };
  await add('Typhlosion', ['Flamethrower', 'Strength', 'Rock Smash', 'Cut'], 'Blaze');
  await add('Lapras', ['Surf', 'Ice Beam', 'Waterfall', 'Whirlpool'], 'Water Absorb');
  await add('Ampharos', ['Thunderbolt', 'Flash', 'Signal Beam', 'Light Screen'], 'Static');
  await add('Pidgeot', ['Fly', 'Return', 'Roost', 'U-turn'], 'Keen Eye');
});
await open('#/wild?team=heartgold', () => document.querySelector('#wmap svg') && /places ready/.test(document.getElementById('page').innerText));
const tones = await page.evaluate(() => [...document.querySelectorAll('#wmap [data-place] circle:last-of-type')].map((c) => c.getAttribute('fill')).filter((f) => f !== 'var(--text-3)').length);
if (tones < 90) fails.push('map: only ' + tones + ' places coloured for the team');

// a place: its wild Pokémon by window from the game's tables, what it calls for with its sources
await open('#/wild/ice-path', () => /Who lives here/.test(document.getElementById('page').innerText));
const ice = await text();
for (const s of ['Swinub', 'Golbat', 'Jynx', 'morning', 'night', 'cold tolerance', 'its ice cave · reading', 'no weather reaches it']) if (ice.toLowerCase().indexOf(s.toLowerCase()) < 0) fails.push('Ice Path: no "' + s + '"');   // eyebrows are upper-cased on screen
await open('#/wild/dragons-den', () => /The game's ground/.test(document.getElementById('page').innerText));
if (!/Surf/.test(await text()) || !/the game: surf encounters/i.test(await text())) fails.push('Dragon\'s Den: the Surf evidence from its tables is missing');

// the planner: Mt. Silver in winter, by air, with home cover; a run, the odds, kept
await open('#/expedition?place=mt-silver&team=heartgold&season=winter&days=3', () => document.querySelector('#exrun'));
const plan = await text('#exout'), side = await text('#exside');
if (!/Flown to Indigo Plateau by Pidgeot/.test(plan)) fails.push('planner: the flight to the nearest town is missing: ' + plan.slice(0, 300));
if (!/Cold tolerance/.test(plan) || !/hangs on|only plausible/.test(plan)) fails.push('planner: the failure points are missing');
if (!/Transport/.test(side) || !/only .*Pidgeot/.test(side)) fails.push('planner: Pidgeot away should leave Transport\'s flying uncovered at home: ' + side.slice(0, 300));
await page.click('#exrun');
await until(() => document.querySelectorAll('#exjournal .exday').length >= 3);
const j1 = await text('#exjournal');
if (!/Day 1/.test(j1) || !/a wild /.test(j1) || !/seed 1/.test(j1)) fails.push('run: no field journal');
await page.click('#exrun');
if ((await text('#exjournal')) !== j1) fails.push('run: the same seed told a different story');
await page.click('#exnext');
await until(() => /seed 2/.test(document.getElementById('exjournal').innerText));
await page.click('#exodds');
await until(() => /of 24 runs/.test(document.getElementById('exjournal').innerText));
if (!/Most seen/.test(await text('#exjournal'))) fails.push('odds: no wildlife tally');
await page.click('#exkeep');
await until(() => ((S.L || {}).Journal || []).some((r) => r.kind === 'expedition'), null, 30000).catch(() => fails.push('keep: no Journal row'));
await open('#/fieldlog', () => /Life list/i.test(document.getElementById('page').innerText));
const log = await text();
if (!/Mt\. Silver/.test(log) || !/runs got through/.test(log)) fails.push('field log: the kept expedition is missing');

// the estate in time
await open('#/estate', () => document.querySelector('.lifestrip'));
const strip = await text('.lifestrip');
if (!/in the highlands/i.test(strip) || !/The Glasshouse picks/.test(strip) || !/Mt\. Silver/.test(strip)) fails.push('estate: the strip is incomplete: ' + strip);
await open('#/estate/season?s=winter', () => /The residents outside/i.test(document.getElementById('page').innerText));
if (!/by the hearth until spring/.test(await text())) fails.push('season: Typhlosion (warm) should live by the hearth in winter');
await open('#/estate/stores?plots=2', () => /What the rings pick/i.test(document.getElementById('page').innerText));
const st = await page.evaluate(() => document.getElementById('stplots').value);
if (st !== '2') fails.push('stores: the plots setting did not take');
await open('#/estate/day', () => document.querySelector('.daycols'));
const rest = await page.evaluate(() => [...document.querySelectorAll('.daycol')].map((c) => [...c.querySelectorAll('.dayrow.rest b')].map((b) => b.textContent)));
if (!(rest[2] || []).includes('Pidgeot') || (rest[0] || []).includes('Pidgeot')) fails.push('day: Pidgeot should rest at night only (Pidgey is morning and day in the tables): ' + JSON.stringify(rest));

await page.screenshot({ path: path.join(HERE, 'dist', 'shot-wild.png'), fullPage: false });
await browser.close();
if (errors.length) fails.push('page errors: ' + errors.join(' | '));
console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'OK: the Wild, a place, the planner (run, odds, keep), the field log and the estate in time');
process.exit(fails.length ? 1 : 0);
