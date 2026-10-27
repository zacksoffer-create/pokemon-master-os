// Battle identity (web/37_identity, web/79_archetypes; docs/battle/BATTLE_INTELLIGENCE.md) in the preview, in Chromium:
// the Archetype Atlas lists and filters the library's names and explains one; a Choice Band Scizor in the builder is
// named from its own League fights, and the name and the card follow a move change and an item change.
// Run: node engine/app/test_identity.mjs (after python3 -I engine/app/build.py)
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
const until = (fn, arg, ms = 60000) => page.waitForFunction(fn, arg, { timeout: ms });
const text = (sel) => page.evaluate((s) => (document.querySelector(s || '#page') || {}).innerText || '', sel);
const open = async (h, probe, ms) => { await page.evaluate((x) => nav(x), h); await until(probe || (() => !/Opening…/.test(document.getElementById('page').innerText)), null, ms || 90000).catch(() => fails.push(h + ': never opened')); };
await page.goto('file://' + path.join(HERE, 'dist', 'Blackthorn-HQ-preview.html') + '#/');
await page.evaluate(() => { localStorage.removeItem('bt-preview-tabs'); });
await page.reload();
await until(() => document.querySelector('.jcards'));

// the Atlas: every name the library earns, filterable, each with its own page
await open('#/archetypes', () => document.querySelectorAll('.atlasrow').length > 0, 120000);
const atlas = await page.evaluate(() => ({ rows: document.querySelectorAll('.atlasrow').length, names: [...document.querySelectorAll('.atlasname')].map((e) => e.textContent) }));
if (atlas.rows < 50) fails.push('atlas: only ' + atlas.rows + ' names');
for (const n of atlas.names) if (n.split(/\s+/).length > 4) fails.push('atlas: a name over four words: ' + n);
if (!/The Archetype Atlas/.test(await text())) fails.push('atlas: no title');
if (!/How a name is chosen/i.test(await text()) || !/Can't be measured yet/i.test(await text())) fails.push('atlas: the rules or the pending functions are missing');
await open('#/archetypes?head=pivot', () => document.querySelectorAll('.atlasrow').length > 0);
const piv = await page.evaluate(() => [...document.querySelectorAll('.atlasname')].map((e) => e.textContent));
if (!piv.length || piv.some((n) => !/Pivot$/.test(n))) fails.push('atlas filter: not every name is a Pivot: ' + JSON.stringify(piv.slice(0, 8)));
await open('#/archetypes/' + encodeURIComponent('Rain Sweeper'), () => /Who holds it/.test(document.getElementById('page').innerText));
const rain = await text();
if (!/It sets its own rain/.test(rain)) fails.push('Rain Sweeper: the Rain definition is missing');
if (!/Moves first against 80% of the League/.test(rain)) fails.push('Rain Sweeper: the Sweeper bar should be quoted with its number');

// the builder: Choice Band Scizor, Platinum (the pilot's B001)
const id = await page.evaluate(async () => {
  const a = await Records.saveIndividual({species: 'Scizor', game: 'platinum', gender: 'M', shiny: false, ball: 'Poké Ball', origin: 'added in the app', status: 'working'});
  const b = await Records.saveBuild({species: 'Scizor', game: 'platinum', generation: 4, ability: 'Technician', item: 'Choice Band', nature: 'Adamant',
    evs: {hp: 248, atk: 252, spd: 8}, moves: ['Bullet Punch', 'U-turn', 'Superpower', 'Pursuit'], individual: a.id}, {asNew: true});
  await Records.saveIndividual(Object.assign({}, S.store.individuals[a.id], {build: b.id}));
  return a.id;
});
await open('#/pokemon/' + encodeURIComponent(id), () => document.querySelector('#pbname .archname'), 180000);
const nm = await text('#pbname'), card = await text('#pbident');
if (!/Offensive Priority Pivot/.test(nm)) fails.push('builder: the name should be Offensive Priority Pivot, got ' + nm);
if (!/explains 5 of 6/.test(nm)) fails.push('builder: the name line should say how much it explains: ' + nm);
if (!/The catch\./.test(card) || !/Choice Band locks it into/.test(card)) fails.push('builder: the card should give the Choice lock as the catch');
if (!/Trapping/.test(card) || !/Can't be measured yet/i.test(card)) fails.push('builder: Pursuit should show as a trapping name that can\'t be measured yet');
if (!/All fourteen functions/i.test(card)) fails.push('builder: the functions table is missing');
const rerun = async (fn) => { await page.evaluate(fn); await until(() => PB && PB.ident && PB.ident.evaluated && document.querySelector('#pbname .archname') && !document.getElementById('pbbusy'), null, 180000).catch(() => fails.push('builder: no re-read')); };

// journey 2: Pursuit out, Brick Break in: the trapping name goes, the Speed read stays
const speedBefore = await page.evaluate(() => PB.ident.facts.speed.value);
await rerun(() => { PB.cur.moves[3] = 'Brick Break'; PB.ident = null; pbRun(); });
await until(() => PB.ident && PB.read && PB.read.moves.indexOf('Brick Break') >= 0, null, 180000).catch(() => fails.push('builder: Brick Break never read'));
const after1 = await page.evaluate(() => ({ card: document.getElementById('pbident').innerText, speed: PB.ident.facts.speed.value }));
if (/Trapping/.test(after1.card)) fails.push('journey 2: a trapping name is still on the card without Pursuit');
if (after1.speed !== speedBefore) fails.push('journey 2: the Speed read moved: ' + speedBefore + ' → ' + after1.speed);

// journey 4: Leftovers for the Choice Band: the Choice-lock catch goes
await rerun(() => { PB.cur.item = 'Leftovers'; PB.ident = null; pbRun(); });
await until(() => PB.ident && PB.read && PB.read.moves && PB.cur.item === 'Leftovers', null, 180000);
const after2 = await text('#pbident');
if (/locks it into/.test(after2)) fails.push('journey 4: the Choice lock is still the catch with Leftovers');

await page.screenshot({ path: path.join(HERE, 'dist', 'shot-identity.png'), fullPage: false });
await browser.close();
if (errors.length) fails.push('page errors: ' + errors.join(' | '));
console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'OK: the Atlas, the builder\'s identity, journeys 2 and 4 in the page');
process.exit(fails.length ? 1 : 0);
