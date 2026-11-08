// The organism (v2.8, docs/ORGANISM.md) in the preview, in Chromium: an individual's page in the wild (its species
// as an animal, how it came by each move, its ability read as biology, its nature's flavours, its characteristic,
// where it was born, its body in the conditions), the link from the builder, the planner's team in the wild, and the
// camp's lines in a run's field journal.
// Run: node engine/app/test_organism.mjs (after python3 -I engine/app/build.py)
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
const need = (where, body, words) => { for (const w of words) if (body.toLowerCase().indexOf(w.toLowerCase()) < 0) fails.push(where + ': no "' + w + '"'); };   // eyebrows are upper-cased on screen
await page.goto('file://' + path.join(HERE, 'dist', 'Blackthorn-HQ-preview.html') + '#/');
await page.evaluate(() => { ['bt-preview-tabs', 'bt-expedition', 'bt-wild-team', 'bt-estate-plots'].forEach((k) => localStorage.removeItem(k)); });
await page.reload();
await until(() => document.querySelector('.jcards'));

// a HeartGold team with histories: a Lapras met in Union Cave, a Pidgeot that came as a starter's companion, a hatched Dratini line
const ids = await page.evaluate(async () => {
  const add = async (sp, moves, ab, extra, build) => { const a = await Records.saveIndividual(Object.assign({species: sp, game: 'heartgold', gender: 'M', shiny: false, ball: 'Poké Ball', origin: 'added in the app', status: 'working'}, extra));
    const b = await Records.saveBuild(Object.assign({species: sp, game: 'heartgold', generation: 4, ability: ab, moves: moves, individual: a.id}, build || {}), {asNew: true});
    await Records.saveIndividual(Object.assign({}, S.store.individuals[a.id], {build: b.id}));
    await Teams.update('heartgold', (t) => { t.slots[t.slots.indexOf(null)] = {ind: a.id, species: sp}; return t; });
    return a.id; };
  return {
    typhlosion: await add('Typhlosion', ['Flamethrower', 'Strength', 'Rock Smash', 'Cut'], 'Blaze', {met_how: 'starter'}),
    lapras: await add('Lapras', ['Surf', 'Ice Beam', 'Sing', 'Waterfall'], 'Water Absorb', {met_how: 'encounter', met_location: 'Union Cave (B2F)'},
      {nature: 'Calm', ivs: {hp: 31, atk: 12, def: 25, spa: 28, spd: 30, spe: 20}}),
    pidgeot: await add('Pidgeot', ['Fly', 'Return', 'Roost', 'U-turn'], 'Keen Eye', {met_how: 'wild', met_location: 'Route 29'}, {nature: 'Jolly'}),
    dragonite: await add('Dragonite', ['Outrage', 'Extreme Speed', 'Surf', 'Fly'], 'Inner Focus', {met_how: 'hatched', hatch_moves: ['Extreme Speed']}),
  };
});

// Lapras in the wild: the animal, then its own story
await open('#/pokemon/' + ids.lapras + '/wild', () => /in the wild/i.test(document.getElementById('page').innerText) && document.querySelector('.orgmoves'));
const lap = await text();
need('Lapras page', lap, ['Lapras in the wild', 'The animal', 'Its body', 'What it eats', 'Water', 'taught with HM03', 'grew into it (level 32)', 'Water travel · the game',
  'Water Absorb', 'As biology', 'likes bitter', 'Takes plenty of siestas', 'Union Cave', 'grew up at Union Cave (cave)', 'The conditions, on its body', 'at home in it', 'rations a day']);
// Dragonite: hatched with Extreme Speed, and the cold is hard on it
await open('#/pokemon/' + ids.dragonite + '/wild', () => document.querySelector('.orgmoves'));
const dra = await text();
need('Dragonite page', dra, ['hatched with it', 'hatched knowing it', 'hard on it', 'heat source']);
// Pidgeot: Keen Eye read as biology counts toward scouting, as plausible
await open('#/pokemon/' + ids.pidgeot + '/wild', () => document.querySelector('.orgmoves'));
need('Pidgeot page', await text(), ['Keen Eye', 'As biology', 'plausible', 'lives in', 'Its day']);

// the builder links to the page
await open('#/pokemon/' + ids.lapras, () => document.querySelector('#pbwild .wtag, #pbwild .tiny'));
await until(() => !!document.querySelector('a[href$="/wild"]'), null, 30000).catch(() => fails.push('builder: no link to the page in the wild'));

// the planner: the team in the wild at Ice Path in winter, and the camp in the run
await open('#/expedition?place=ice-path&team=heartgold&season=winter&days=3', () => document.querySelector('#exrun'));
const plan = await text('#exout');
need('planner', plan, ['The team in the wild', 'feels the cold', 'at home in the cold', 'Night watch', 'rations a day']);
await page.click('#exrun');
await until(() => document.querySelectorAll('#exjournal .exday').length >= 3);
const j = await text('#exjournal');
need('journal', j, ['At home in the cold', 'feels the cold']);
const campLines = await page.evaluate(() => document.querySelectorAll('#exjournal .exev.camp').length);
const teamCard = await page.$('[data-mod="m-the-team-in-the-wild"]');
if (teamCard) await teamCard.screenshot({ path: path.join(HERE, 'dist', 'shot-organism-team.png') });
const day1 = await page.$('#exjournal .exday');
if (day1) await day1.screenshot({ path: path.join(HERE, 'dist', 'shot-organism-camp.png') });
if (campLines < 6) fails.push('journal: only ' + campLines + ' camp lines');

await open('#/pokemon/' + ids.lapras + '/wild', () => document.querySelector('.orgmoves'));
await page.screenshot({ path: path.join(HERE, 'dist', 'shot-organism.png'), fullPage: true });
await browser.close();
if (errors.length) fails.push('page errors: ' + errors.join(' | '));
console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'OK: an individual in the wild (species, moves and how it learned them, ability as biology, nature, characteristic, origin, body), the builder link, the team in the wild and the camp in the run');
process.exit(fails.length ? 1 : 0);
