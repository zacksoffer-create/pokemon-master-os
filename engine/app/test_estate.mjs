// The Estate (v2.5, docs/ESTATE.md) in the preview, in Chromium: residents from the teams placed by their land, the
// D-033 world records following the new Pokémon, the land meeting jobs, a suggested staff plan, a world record approved
// and withdrawn from a facility page, the Glasshouse tabs on your records, the satellite and the preserve.
// Run: node engine/app/test_estate.mjs (after python3 -I engine/app/build.py)
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
const text = () => page.evaluate(() => document.getElementById('page').innerText);
const open = async (h, probe) => { await page.evaluate((x) => nav(x), h); await until(probe || (() => !/Opening…/.test(document.getElementById('page').innerText)), null, 60000).catch(() => fails.push(h + ': never opened')); };
await page.goto('file://' + path.join(HERE, 'dist', 'Blackthorn-HQ-preview.html') + '#/');
await page.evaluate(() => { localStorage.removeItem('bt-preview-tabs'); localStorage.removeItem('bt-estate-all'); });
await page.reload();
await until(() => document.querySelector('.jcards'));

// nobody on a team: the estate says so, and makes nothing up
await open('#/estate', () => /Blackthorn Estate/.test(document.getElementById('page').innerText));
if (!/Nobody lives on the estate yet/.test(await text())) fails.push('empty: no "nobody lives here yet" notice');

// a HeartGold team, an Emerald Meganium and a Crystal Miltank
const ids = await page.evaluate(async () => {
  const add = async (g, sp) => { const a = await Records.saveIndividual({species: sp, game: g, gender: 'F', shiny: false, ball: 'Poké Ball', origin: 'added in the app', status: 'working'});
    await Teams.update(g, (t) => { t.slots[t.slots.indexOf(null)] = {ind: a.id, species: sp}; return t; }); return a.id; };
  const out = {};
  for (const sp of ['Typhlosion', 'Lapras', 'Tyranitar', 'Magcargo']) out[sp] = await add('heartgold', sp);
  out.Meganium = await add('emerald', 'Meganium'); out.Miltank = await add('crystal', 'Miltank');
  return out;
});
await open('#/estate', () => document.querySelector('#restable tbody tr'));
const est = await page.evaluate(() => ({ rows: document.querySelectorAll('#restable tbody tr').length, pins: document.querySelectorAll('#bigmap [data-place]').length,
  sevii: !!document.querySelector('#bigmap [data-place="sevii"]'), placed: Estate.residents(false).map((r) => [r.species, r.site && r.site.id]),
  world: Estate.world().map((w) => [w.id, w.ind, w.status]) }));
if (est.rows !== 6) fails.push('residents: ' + est.rows + ' rows, not 6');
if (est.pins < 16 || !est.sevii) fails.push('map: ' + est.pins + ' pins, the Sevii Islands ' + (est.sevii ? '' : 'missing'));
const at = Object.fromEntries(est.placed);
if (at.Lapras !== 'S-KANTO' || at.Typhlosion !== 'S-JOHTO' || at.Magcargo !== 'S-JOHTO') fails.push('placement: ' + JSON.stringify(at) + ' (Lapras needs the sea; geothermal ground keeps Magcargo at Blackthorn, A-110)');
const w = Object.fromEntries(est.world.map((x) => [x[0], x]));
if (!w['W-001'] || w['W-001'][1] !== ids.Typhlosion || w['W-001'][2] !== 'approved') fails.push('W-001 should follow your HeartGold Typhlosion: ' + JSON.stringify(w['W-001']));
if (!w['W-016'] || w['W-016'][1] !== ids.Meganium || w['W-016'][2] !== 'proposed') fails.push('W-016 should wait on your Emerald Meganium: ' + JSON.stringify(w['W-016']));
if (w['W-004']) fails.push('W-004 bound with no Mamoswine of yours');

// the Glasshouse's facility page: heat held by Typhlosion (W-001) and met by the land; plant care waits on W-016
await open('#/facility/glasshouse', () => document.querySelector('[data-req="heat"]'));
const gh = await page.evaluate(() => { const r = HS.glasshouse.report, q = (id) => r.requirements.filter((x) => x.id === id)[0];
  return { heat: q('heat').can_staff, land: q('heat').land.map((l) => l.who), plants: q('plants').can_staff, water: q('water').standing }; });
if (gh.heat.indexOf('Typhlosion') < 0) fails.push('heat: Typhlosion (W-001) should hold it, got ' + JSON.stringify(gh.heat));
if (!gh.land.length) fails.push('heat: the geothermal ground should meet it (A-112)');
if (gh.water !== 'equipped') fails.push('water: the river should meet it, got ' + gh.water);
if (gh.plants.length) fails.push('plants: nobody should hold it before W-016 is approved, got ' + JSON.stringify(gh.plants));
await page.click('#fcsuggest');
const plan = await page.evaluate(() => HS.glasshouse.staff);
if (!plan.some((s) => s.need === 'heat' && s.ref === 'ind:' + ids.Typhlosion)) fails.push('suggest: no Typhlosion on heat: ' + JSON.stringify(plan));

// approve W-016 from its candidate line, then withdraw it
const btn = await page.$('[data-req="plants"] [data-wr]:has-text("Approve W-016")');
if (!btn) fails.push('approve: no "Approve W-016" on the plant-care job');
else {
  await page.evaluate(() => document.querySelectorAll('[data-req="plants"] details').forEach((d) => { d.open = true; }));
  await btn.click();
  await until(() => document.getElementById('wrform'));
  await page.fill('#wrform textarea', 'it keeps the berry rings');
  await page.click('#wrform .gold');
  await until(() => Estate.world().some((x) => x.id === 'W-016' && x.status === 'approved'), null, 30000).catch(() => fails.push('approve: W-016 never became approved'));
  await until(() => HS.glasshouse.report.requirements.filter((x) => x.id === 'plants')[0].can_staff.indexOf('Meganium') >= 0, null, 30000).catch(() => fails.push('approve: Meganium still can\'t hold plant care'));
  const row = await page.evaluate(() => (JSON.parse(localStorage.getItem('bt-preview-tabs') || '{}').Journal || []).filter((r) => r.kind === 'world-record').pop());
  if (!row || row.id !== 'W-016' || row.text !== 'it keeps the berry rings') fails.push('approve: the Journal row is ' + JSON.stringify(row));
  await until(() => document.querySelector('[data-wd="W-016"]'), null, 30000).catch(() => fails.push('withdraw: no button for W-016'));
  await page.click('[data-wd="W-016"]');
  await until(() => !Estate.world().some((x) => x.id === 'W-016'), null, 30000).catch(() => fails.push('withdraw: W-016 is still there'));
}
// a new record, for a job with no proposal: the next free id
const nid = await page.evaluate(() => Estate.newId());
if (nid !== 'W-018') fails.push('the next world record should be W-018, got ' + nid);

// the Glasshouse tabs, on your records
await open('#/glasshouse/eggs', () => /The schedule/.test(document.getElementById('page').innerText));
const eggs = await page.evaluate(() => Estate.lines().map((l) => l.line));
if (eggs.indexOf('Cyndaquil') < 0 || eggs.indexOf('Larvitar') < 0) fails.push('eggs: the lines should include Cyndaquil and Larvitar, got ' + JSON.stringify(eggs));
await open('#/glasshouse/berries', () => /The crop plan/.test(document.getElementById('page').innerText));
const crops = await page.evaluate(() => Estate.crops().length);
if (crops < 10) fails.push('berries: the medicine crop has ' + crops + ' rows');
if (/HeartGold Tyranitar/.test(await text())) fails.push('berries: the old "Lum held by HeartGold Tyranitar" is still there');
await open('#/glasshouse/nutrition', () => /Feeding programs/.test(document.getElementById('page').innerText));
if (!/W-017/.test(await text())) fails.push('nutrition: W-017 (your Crystal Miltank) should be waiting on you');
await open('#/glasshouse/studbook', () => /Bred at Blackthorn/.test(document.getElementById('page').innerText));
await open('#/glasshouse', () => document.querySelector('#ghplan svg'));
if (/Magcargo · Magma Armor|Mamoswine/.test(await page.evaluate(() => document.querySelector('#ghplan').textContent))) fails.push('glasshouse: the plan still names the old companions as staff');

// the satellite, the preserve, the old homestead link, a place
await open('#/sevii', () => /wild Pokémon/.test(document.getElementById('page').innerText));
const sv = await text();
if (!/Icefall Cave/.test(sv) || !/Lapras/.test(sv)) fails.push('sevii: Icefall Cave and Lapras should be on the page');
await open('#/preserve', () => /Who could be a client/.test(document.getElementById('page').innerText));
await until(() => /Cynthia/.test(document.getElementById('page').innerText), null, 30000).catch(() => fails.push('preserve: Cynthia should be among the possible clients'));
await open('#/homestead', () => /The Blackthorn Estate/.test(document.getElementById('page').innerText));
await open('#/estate/geothermal', () => /Jobs the land meets/.test(document.getElementById('page').innerText));
await open("#/estate/dragon's den", () => document.querySelector('[data-req]'));

await browser.close();
if (errors.length) fails.push('page errors: ' + errors.join(' || '));
console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'ok: residents from the teams, placed by their land; the D-033 records follow the new Pokémon; the land meets heat and water; a suggested plan; W-016 approved and withdrawn as Journal rows; the Glasshouse on your records; the Sevii Islands, the preserve and the old homestead link');
process.exit(fails.length ? 1 : 0);
