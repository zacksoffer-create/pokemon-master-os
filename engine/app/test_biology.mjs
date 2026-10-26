// Field Biology in the preview build (web/95_biology.html over web/36_ecology.html), in Chromium: the browser's food-web
// analysis and extinction cascade match biology/ecology.py on every web (parity); a curated dossier shows its statements
// with evidence classes and citations; a species without one gets a field guide from its claims; a review is kept in
// the Journal; the landscape draws Johto and Kanto together and each alone (A-66), with Kanto's flagships; every
// dossier has a tile (A-62); an ecosystem's web, its cascade and the Level 3 model run; ecotypes read your Pokémon's
// egg moves; nothing scrolls sideways on a phone.
// Run: python3 -I app/build.py && node app/test_biology.mjs                 (tests/test_engines.py runs it)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
process.on('unhandledRejection', (e) => { console.log('FAIL\n' + String(e && e.stack || e).slice(0, 1500)); process.exit(1); });

const HERE = path.dirname(fileURLToPath(import.meta.url));
let chromium;
try { ({ chromium } = await import('playwright')); } catch (e) {
  try { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); } catch (e2) { console.log('SKIP: Playwright is not installed'); process.exit(0); }
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], fails = [];
page.on('pageerror', (e) => errors.push(String(e.stack || e).slice(0, 600)));
const settle = async (sel, ms = 120000) => { const t = Date.now(); while (Date.now() - t < ms) {
  const st = await page.evaluate((s) => { const p = document.getElementById('page'); if (!p || /^\s*Opening…\s*$/.test(p.innerText)) return 'opening';
    if (s && !document.querySelector(s)) return 'wait'; return 'ok'; }, sel);
  if (st === 'ok') return true; await page.waitForTimeout(150); } return false; };
const go = async (h, sel) => { await page.evaluate((x) => nav(x), h); if (!await settle(sel)) fails.push(h + ': never settled (waiting for ' + sel + ')');
  const n = await page.evaluate(() => [...document.querySelectorAll('#page .notice')].map((x) => x.innerText).join(' | ')); if (n) fails.push(h + ': ' + n.slice(0, 300)); };
const text = (sel = '#page') => page.evaluate((s) => (document.querySelector(s) || {}).innerText || '', sel);
const expect = (what, ok) => { if (!ok) fails.push(what); };
const t0 = Date.now();

await page.goto('file://' + path.join(HERE, 'dist', 'Blackthorn-HQ-preview.html') + '#/');
await settle();
await page.evaluate(() => { Object.keys(localStorage).filter((k) => /^bt-preview-tabs/.test(k)).forEach((k) => localStorage.removeItem(k)); });

// 1. parity: the browser's analysis and cascade against Python's, every web
const parity = await page.evaluate(() => Eco.ready(['biology', 'ecology']).then(() => {
  const E = Eco.D().ecology, bad = [];
  Object.keys(E.webs).forEach((k) => {
    const w = E.webs[k], a = Eco.analyse(w.nodes, w.links), p = w.analysis;
    const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
    ['unfed', 'top', 'missing', 'keystones', 'roles', 'links', 'species', 'connectance'].forEach((f) => { if (!same(a[f], p[f])) bad.push(k + ' ' + f + ': ' + JSON.stringify(a[f]).slice(0, 120) + ' vs ' + JSON.stringify(p[f]).slice(0, 120)); });
    Object.keys(p.tl).forEach((n) => { if (Math.abs(a.tl[n] - p.tl[n]) > 0.011) bad.push(k + ' TL ' + n + ': ' + a.tl[n] + ' vs ' + p.tl[n]); });
  });
  return {webs: Object.keys(E.webs).length, bad: bad.slice(0, 8), n: bad.length};
}));
expect(`the browser's analysis matches Python's on every web (${parity.n} differences: ${parity.bad.join(' | ')})`, parity.n === 0);
console.log(`  parity: ${parity.webs} webs, ${parity.n} differences`);

// 2. home and a curated dossier
await go('#/biology', '.biotile');
expect('the home lists the cohort dossiers', (await page.$$('.biotile')).length >= 127);
// A-62: every dossier has a tile in the groups the pack carries, and the count on the page is the pack's
const home = await page.evaluate(() => { const DS = Eco.D().dossiers, tiles = new Set([...document.querySelectorAll('.biotile b')].map((b) => b.innerText));
  return {n: Object.keys(DS.dossiers).length, groups: Object.keys(DS.cohorts || {}).length, missing: Object.keys(DS.dossiers).filter((k) => !tiles.has(k)),
    kanto: /Viridian Forest/.test(document.getElementById('page').innerText) && /Cinnabar and its seas/.test(document.getElementById('page').innerText)}; });
expect(`at least 127 dossiers, each with a tile (${home.n}; missing ${home.missing.join(', ')})`, home.n >= 127 && !home.missing.length);
expect('the home shows the Kanto dossier groups', home.groups >= 10 && home.kanto);
await go('#/biology/Pineco', '.biost');
const pin = await text();
expect('Pineco\'s dossier shows its sections', /Diet and foraging/i.test(pin) && /At the homestead/i.test(pin) && /Ecotypes/i.test(pin));
expect('statements carry their evidence class and citations', await page.evaluate(() => document.querySelectorAll('#page .biost .chip').length > 20 && document.querySelectorAll('#page .bioev').length > 20));
expect('real-world analogies are labelled as not evidence', /Real-world analogy/i.test(pin));
expect('Pineco is placed in its food webs', /In the food webs/i.test(pin) && /Ilex Forest/.test(pin));
// a review, kept in the Journal
await page.evaluate(() => document.querySelector('.biorv button').click());
await page.waitForTimeout(500);
const rv = await page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('bt-preview-tabs')).Journal || []).filter((r) => r.kind === 'review'); } catch (e) { return []; } });
expect('an agree is a Journal row', rv.length === 1 && rv[0].verdict === 'agree' && rv[0].species === 'Pineco');

// 3. a species without a dossier: the field guide
// v2.1 (A-104): research it, from the dossier: what's open, where to look, a brief, and your findings kept as proposed
await page.waitForFunction(() => document.getElementById('biomine') && !/Reading your Journal/.test(document.getElementById('biomine').innerText), null, { timeout: 60000 }).catch(() => fails.push('research: your findings never loaded'));
const rs = await page.evaluate(() => ({ card: !!document.getElementById('bio-research'), links: document.querySelectorAll('#bio-research a[target=_blank]').length, brief: /Research brief: Pineco/.test(document.getElementById('biobrief').value) && /topic \| the finding/.test(document.getElementById('biobrief').value) }));
if (!rs.card || rs.links < 4 || !rs.brief) fails.push('research: the card ' + JSON.stringify(rs));
await page.selectOption('#bioadd [name=domain]', 'diet'); await page.fill('#bioadd [name=text]', 'A test finding about what Pineco eats.'); await page.click('#bioadd button');
await page.waitForFunction(() => /A test finding about what Pineco eats/.test(document.getElementById('biomine').innerText), null, { timeout: 30000 }).catch(() => fails.push('research: the finding never showed'));
const row = await page.evaluate(() => API.tab('Journal', true).then((r) => r.filter((x) => x.kind === 'research' && x.species === 'Pineco').map((x) => [x.domain, x.status, x.source])));
if (!row.length || row[0][0] !== 'diet' || row[0][1] !== 'proposed') fails.push('research: the Journal row ' + JSON.stringify(row));
await go('#/biology/Lickitung', '.biost');
const hc = await text();
expect('Lickitung gets a machine field guide from its claims', /machine-synthesized/i.test(hc) && /Feeding guild/i.test(hc) && /Every Pokédex entry/i.test(hc));
expect('where it lives is read from every game', await page.evaluate(() => new Promise((r) => setTimeout(() => r(/Every game/i.test(document.getElementById('biorange').innerText)), 1500))));

// 4. the landscape and an ecosystem
await go('#/ecosystems', '.biomap circle');
// A-66: Johto and Kanto on one map, joined by the Magnet Train and the S.S. Aqua; each region on its own
const regionOf = await page.evaluate(() => { const N = Eco.D().ecology.landscape.nodes, c = {johto: 0, kanto: 0}; Object.keys(N).forEach((k) => { c[N[k].region]++; }); return c; });
expect(`the map draws every place in both regions (${(await page.$$('.biomap circle')).length} of ${regionOf.johto + regionOf.kanto})`, (await page.$$('.biomap circle')).length === regionOf.johto + regionOf.kanto && regionOf.kanto >= 40);
expect('the Magnet Train and the S.S. Aqua are drawn', (await page.$$('.biomap line.e-rail')).length === 1 && (await page.$$('.biomap line.e-ship')).length === 1);
expect('the title names both regions', /Johto and Kanto as a living landscape/.test(await text()));
await go('#/ecosystems?region=kanto', '.biomap circle');
const kt = await text();
expect(`Kanto alone draws Kanto's places (${(await page.$$('.biomap circle')).length})`, (await page.$$('.biomap circle')).length === regionOf.kanto && /Kanto as a living landscape/.test(kt) && /Viridian Forest/.test(kt) && !/Ilex Forest/.test(kt));
await go('#/ecosystems?region=johto', '.biomap circle');
expect('Johto alone draws Johto\'s places', (await page.$$('.biomap circle')).length === regionOf.johto && /Ilex Forest/.test(await text()));
await go('#/ecosystem/viridian-forest', '#ecoweb svg');
const vf = await text();
expect('Viridian Forest, a Kanto flagship, shows its web and community', /flagship ecosystem in Kanto/i.test(vf) && /The community/i.test(vf) && /Pikachu/.test(vf) && /Who eats what/i.test(vf));
await go('#/ecosystem/cinnabar-seas', '#ecoweb svg');
expect('Cinnabar\'s seas carry the volcano\'s heat, from the game\'s own text', await page.evaluate(() => Eco.D().ecology.webs['cinnabar-seas'].nodes.some((n) => n.id === 'geothermal-heat')) && /eruption/.test(await text()));
await go('#/biology/Chansey', '.biost');
expect('a Kanto species says where it lives in Kanto', await page.waitForFunction(() => /In Kanto \(HeartGold\/SoulSilver\)/.test((document.getElementById('biorange') || {}).innerText || ''), null, { timeout: 30000 }).then(() => true, () => false));
await go('#/ecosystem/ilex-forest', '#ecoweb svg');
const il = await text();
expect('Ilex Forest shows its community, links with evidence and its analysis', /The community/i.test(il) && /Who eats what/i.test(il) && /Keystones/i.test(il));
await page.selectOption('#ecorm', 'trees');
await page.click('#ecormb');
const cas = await text('#ecocas');
expect(`removing the trees starves their dependants (${cas.slice(0, 160)})`, /Starved after them/.test(cas) && /Caterpie|Paras|Weedle/.test(cas));
await page.click('#ecorun');
expect('the Level 3 model runs and reports persistence', await page.evaluate(() => new Promise((r) => setTimeout(() => r(!!document.querySelector('#ecochart svg polyline') && /persist/.test(document.getElementById('ecoout').innerText)), 4000))));
const dyn = await page.evaluate(() => { const w = Eco.D().ecology.webs['ilex-forest'], a = Eco.dynamics(w, {}), b = Eco.dynamics(w, {}); return {same: JSON.stringify(a.final) === JSON.stringify(b.final), p: a.persistence, finite: a.final.every((x) => isFinite(x) && x >= 0)}; });
expect(`the model is deterministic and stays finite (persistence ${dyn.p})`, dyn.same && dyn.finite);
await go('#/ecosystem/blackthorn-highlands', '#ecoweb svg');

// 5. ecotypes
await go('#/ecotypes', '.biost');
expect('the ecotypes page lists curated ecotypes', /Curated ecotypes/i.test(await text()));

// 6. a phone
await page.setViewportSize({ width: 390, height: 844 });
for (const h of ['#/biology', '#/biology/Pineco', '#/ecosystems', '#/ecosystems?region=kanto', '#/ecosystem/ilex-forest', '#/ecosystem/viridian-forest', '#/ecotypes']) {
  await go(h, '#page .card');
  expect(h + ' scrolls sideways at phone width', !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)));
}

await browser.close();
if (errors.length) fails.push('page errors: ' + errors.slice(0, 3).join(' || '));
if (fails.length) { console.log('FAIL\n  ' + fails.join('\n  ')); process.exit(1); }
console.log(`OK: Field Biology (parity on every web, a dossier, a field guide, a review, the landscape, a web, its cascade and model, ecotypes, phone) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
