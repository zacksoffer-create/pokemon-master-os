// The team flow as Zack uses it (v2.2 regression): tap an empty tile, pick a species, come back, six times. Each pick
// must add exactly one Pokémon, into its own slot. v2.1 bound the species picker's click to the page container on
// every visit, so the nth pick ran n times: 36 Pokémon for 8 tries, and the copies overwrote each other's slots.
// Run: node engine/app/test_teamflow.mjs (after python3 -I engine/app/build.py)
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
await page.goto('file://' + path.join(HERE, 'dist', 'Blackthorn-HQ-preview.html') + '#/');
await page.evaluate(() => { localStorage.removeItem('bt-preview-tabs'); });
await page.reload();
await until(() => document.querySelector('.jcards'));

const six = ['Pikachu', 'Dragonite', 'Infernape', 'Empoleon', 'Gengar', 'Scizor'];
for (const [i, sp] of six.entries()) {
  await page.evaluate(() => nav('#/team/soulsilver'));
  await until(() => document.querySelector('#tmsix .tile'));
  await page.click(`#tmsix .tile.add[data-slot="${i}"]`);   // the tile itself, as a tap
  await until(() => document.querySelector('.npgrid [data-np]'));
  await page.click(`.npgrid [data-np="${sp}"]`);
  await until((n) => /^#\/pokemon\/me:soulsilver/.test(decodeURIComponent(NAVI.hash)) && Teams.filled(Teams.get('soulsilver')) === n, i + 1, 60000)
    .catch(() => fails.push(`pick ${i + 1} (${sp}): the team didn't reach ${i + 1}`));
}
const got = await page.evaluate(() => ({ slots: Teams.get('soulsilver').slots.map((s) => s && s.species),
  mine: Object.values(S.store.individuals).filter((x) => x.game === 'soulsilver' && x.status !== 'retired').length }));
if (JSON.stringify(got.slots) !== JSON.stringify(six)) fails.push('slots: ' + JSON.stringify(got.slots));
if (got.mine !== 6) fails.push(`six picks made ${got.mine} Pokémon, not 6`);

// an arrow tap moves a Pokémon once, however often the team page has been opened
for (let k = 0; k < 3; k++) { await page.evaluate(() => nav('#/team/soulsilver')); await until(() => document.querySelector('#tmsix .tile[data-go]')); }
await page.click('#tmsix .tile[data-slot="0"] [data-nudge="0:1"]');
await page.waitForTimeout(1600);   // the order saves once the taps settle
const moved = await page.evaluate(() => Teams.get('soulsilver').slots.map((s) => s && s.species));
if (moved[0] !== 'Dragonite' || moved[1] !== 'Pikachu' || moved[2] !== 'Infernape') fails.push('one tap on ▶ moved it ' + JSON.stringify(moved));

// the tidy-up: an extra, never-built Pokémon off the team is offered to set aside, and comes back
await page.evaluate(() => Records.saveIndividual({species: 'Pichu', game: 'soulsilver', gender: 'M', shiny: false, ball: 'Poké Ball', origin: 'added in the app', status: 'working'}));
await page.evaluate(() => Records.saveIndividual({species: 'Pichu', game: 'soulsilver', gender: 'F', shiny: false, ball: 'Poké Ball', origin: 'added in the app', status: 'working'}));
await page.evaluate(() => nav('#/pokemon'));
await until(() => document.querySelector('[data-tidy="soulsilver"]'), null, 30000).catch(() => fails.push('tidy: no offer to set the two spares aside'));
await page.click('[data-tidy="soulsilver"]');
await until(() => Object.values(S.store.individuals).filter((x) => x.game === 'soulsilver' && x.status === 'retired').length === 2, null, 30000).catch(() => fails.push('tidy: the spares weren\'t set aside'));
const after = await page.evaluate(() => ({ team: Teams.filled(Teams.get('soulsilver')), mine: Object.values(S.store.individuals).filter((x) => x.game === 'soulsilver' && x.status !== 'retired').length }));
if (after.team !== 6 || after.mine !== 6) fails.push('tidy touched the team: ' + JSON.stringify(after));
await until(() => document.querySelector('[data-back]'), null, 30000).catch(() => fails.push('tidy: no Bring back'));
await page.evaluate(() => document.querySelector('[data-back]').click());
await until(() => Object.values(S.store.individuals).filter((x) => x.game === 'soulsilver' && x.status === 'retired').length === 1, null, 30000).catch(() => fails.push('tidy: Bring back didn\'t'));

// v2.3 (Zack: "the move sets didn't save ... or they like went away"): the bug's leftovers. A built Typhlosion off the
// team behind an unbuilt copy in its slot, put back with one tap; then a change left unsaved, saved from the team page.
const ids = await page.evaluate(async () => {
  const a = await Records.saveIndividual({species: 'Typhlosion', game: 'heartgold', gender: 'M', shiny: false, ball: 'Love Ball', origin: 'added in the app', status: 'working'});
  const b = await Records.saveBuild({species: 'Typhlosion', game: 'heartgold', generation: 4, ability: 'Blaze', moves: ['Flamethrower', 'Sunny Day', 'Solar Beam', 'Focus Blast'], individual: a.id}, {asNew: true});
  await Records.saveIndividual(Object.assign({}, S.store.individuals[a.id], {build: b.id}));
  const c = await Records.saveIndividual({species: 'Typhlosion', game: 'heartgold', gender: 'M', shiny: false, ball: 'Poké Ball', origin: 'added in the app', status: 'working'});
  await Teams.update('heartgold', (t) => { t.slots[0] = {ind: c.id, species: 'Typhlosion'}; return t; });
  return {built: a.id, copy: c.id};
});
await page.evaluate(() => nav('#/team/heartgold'));
await until(() => document.querySelector('[data-tmfix="swap"]'), null, 30000).catch(() => fails.push('swap: the team page didn\'t offer to put the built Typhlosion back'));
await page.click('[data-tmfix="swap"]');
await until((id) => (Teams.get('heartgold').slots[0] || {}).ind === id, ids.built, 30000).catch(() => fails.push('swap: slot 1 still holds the unbuilt copy'));
await page.evaluate((id) => nav('#/pokemon/' + encodeURIComponent(id)), ids.built);
// v2.4: the opening is the game's own: a HeartGold Love Ball plays Gen IV's, and it finishes
await until(() => document.querySelector('#pbportrait canvas.ibo'), null, 60000).catch(() => fails.push('ball: no opening on the portrait'));
const fx = await page.evaluate(() => (document.querySelector('#pbportrait canvas.ibo') || {dataset: {}}).dataset.scene);
if (fx !== 'g4:love') fails.push('ball: a HeartGold Love Ball should play Gen IV\'s Love Ball opening, got ' + fx);
await until(() => document.querySelector('#pbportrait .inball.opened'), null, 30000).catch(() => fails.push('ball: the opening never finished'));
await page.selectOption('[data-pbmove="3"]', 'Earthquake');
await page.waitForTimeout(400);
await page.evaluate(() => nav('#/team/heartgold'));
await until(() => document.querySelector('[data-tmfix="drafts"]'), null, 30000).catch(() => fails.push('drafts: the team page didn\'t offer to save the unsaved change'));
await page.click('[data-tmfix="drafts"]');
await until((id) => !Records.draft(id) && Records.versions(S.store.individuals[id].build).length === 2, ids.built, 60000).catch(() => fails.push('drafts: Save it now didn\'t save a second version'));
const saved = await page.evaluate((id) => (Records.version(S.store.individuals[id].build, 2) || {}).moves, ids.built);
if (!saved || saved[3] !== 'Earthquake') fails.push('drafts: saved moves ' + JSON.stringify(saved));

// every generation's opening, from the ball pages: Emerald (Gen III), Crystal (Gen II), Platinum (Gen IV)
for (const [hash, scene] of [['#/ball/dive?g=emerald', 'g3:dive'], ['#/ball/poke?g=crystal', 'g2:poke'], ['#/ball/dusk?g=platinum', 'g4:dusk']]) {
  await page.evaluate((h) => nav(h), hash);
  await until(() => document.querySelector('#bopen canvas.ibo, #bopen .inball.opened'), null, 60000).catch(() => fails.push(hash + ': no opening'));
  const got = await page.evaluate(() => { const c = document.querySelector('#bopen canvas.ibo'); return {scene: c && c.dataset.scene, plain: c && c.dataset.plain, words: (document.querySelector('#bopen') || {}).parentNode.innerText}; });
  if (got.scene !== scene) fails.push(hash + ': expected ' + scene + ', got ' + got.scene);
  if (got.plain) fails.push(hash + ': the game\'s pictures didn\'t load (plain fallback)');
  if (/still being read/.test(got.words)) fails.push(hash + ': no description');
}

await browser.close();
if (errors.length) fails.push('page errors: ' + errors.join(' || '));
console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'ok: six taps, six Pokémon in six slots; one arrow tap, one move; spares set aside and brought back; the built one back in its slot; a HeartGold Love Ball opens as Gen IV does; Emerald, Crystal and Platinum openings from the ball pages; an unsaved change saved from the team page');
process.exit(fails.length ? 1 : 0);
