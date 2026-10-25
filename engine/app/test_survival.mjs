// The Survival Lab, the Homestead and the capabilities in the preview build (web/93_survival.html over
// web/34_capability.html), in Chromium, against the spec's acceptance tests (docs/specs/SURVIVAL_HOMESTEAD_WORLD_CAPABILITY.md
// §19; MASTER_PLAN Phase 7): A capability consistency, B shared builds, C an expedition assessed, D the Glasshouse
// assessed, E canon kept separate, F comparisons without a winner, G one record read everywhere, H a phone.
// Run: python3 -I app/build.py && node app/test_survival.mjs                  (tests/test_engines.py runs it)
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
const settle = async (sel, ms = 180000) => { const t = Date.now(); while (Date.now() - t < ms) {
  const st = await page.evaluate((s) => { const p = document.getElementById('page'); if (!p || /^\s*Opening…\s*$/.test(p.innerText)) return 'opening';
    if (s && !document.querySelector(s)) return 'wait'; return 'ok'; }, sel);
  if (st === 'ok') return true; await page.waitForTimeout(150); } return false; };
const go = async (h, sel) => { await page.evaluate((x) => nav(x), h); if (!await settle(sel)) fails.push(h + ': never settled (waiting for ' + sel + ')');
  const n = await page.evaluate(() => [...document.querySelectorAll('#page .notice')].map((x) => x.innerText).join(' | ')); if (n) fails.push(h + ': ' + n.slice(0, 300)); };
const text = (sel = '#page') => page.evaluate((s) => (document.querySelector(s) || {}).innerText || '', sel);
const expect = (what, ok) => { if (!ok) fails.push(what); };
const pick = async (sel, value) => { await page.selectOption(sel, value); await page.waitForTimeout(250); };

await page.goto('file://' + path.join(HERE, 'dist', 'Blackthorn-HQ-preview.html') + '#/');
await settle();
await page.evaluate(() => { Object.keys(localStorage).filter((k) => /^bt-(preview-tabs|survival|team-)/.test(k)).forEach((k) => localStorage.removeItem(k)); });

// a Scizor of yours with a battle build that doesn't know Cut
await page.evaluate(() => recordsReady());
const scz = await page.evaluate(async () => {
  const ind = await Records.saveIndividual({species: 'Scizor', game: 'heartgold', nickname: 'Pincer', gender: 'M', shiny: false, ball: 'Poké Ball', origin: 'added in the app', status: 'working'});
  const b = await Records.saveBuild({species: 'Scizor', game: 'heartgold', generation: 4, ability: 'Technician', moves: ['Bullet Punch', 'X-Scissor', 'Swords Dance', 'Roost'], individual: ind.id}, {asNew: true});
  const again = await Records.saveIndividual(Object.assign({}, ind, {build: b.id}));
  return {id: again.id, build: b.id};
});
const buildsBefore = await page.evaluate(() => Object.keys(S.store.builds).length);

// C. the HeartGold six against the winter mountain
await go('#/survival', '#svout [data-need]');
await pick('#svteam', 'mine/heartgold');
await pick('#svsc', 'winter-mountain');
let t = await text('#svout');
expect('C: the winter scenario reads critical, important and useful needs', /Critical[\s\S]{0,40}\d\/3/.test(t) && /Important/.test(t) && /Useful/.test(t));
expect('C: identifiable strengths or failure points', /Where it could fail/.test(t) && /(hangs on|nobody and nothing|Every critical need)/.test(t));
expect('C: equipment requirements (kit not packed)', /Kit not packed[\s\S]*Cold-weather clothing/i.test(t));
expect('C: provisions, labelled as a Blackthorn standard', /rations a day[\s\S]{0,300}Blackthorn standard/.test(t));
await page.click('#svopt');
await page.waitForFunction(() => /Recommended ·/.test((document.getElementById('svrec') || {}).innerText || ''), null, { timeout: 60000 }).catch(() => {});
t = await text('#svrec');
expect('C: useful alternatives (lock-and-optimise: Recommended, Potential fits, Everything else)', /Recommended · \d+/i.test(t) && /Potential fits · \d+/i.test(t) && /Everything else · \d+/i.test(t));

// A. Scizor's manipulation is read by the Survival Lab and the Homestead; it never grants Cut
await pick('#svsc', 'dense-forest');
await pick('[data-sv="5"]', 'ind:' + scz.id);
t = await text('#svout');
const manip = await page.evaluate(() => (document.querySelector('[data-need="manipulation"]') || {}).innerText || '');
expect('A: the Survival Lab reads Pincer\'s manipulation from its Pokédex text (' + manip.slice(0, 160) + ')', /Pincer[\s\S]{0,80}(biology|inferred)[\s\S]{0,40}Pokédex/.test(manip));
const cut = await page.evaluate(() => [...document.querySelectorAll('#svout table.t tr')].map((r) => r.innerText).filter((x) => /^Cut/.test(x))[0] || '');
expect('A: cartridge readiness: Cut is not covered by a Scizor that doesn\'t know it (' + cut.slice(0, 120) + ')', /If taught|Gap/.test(cut) && !/Covered/.test(cut));
expect('A: and says why: only game mechanics count there', /Only game mechanics count here/.test(t));
await go('#/facility/workshop', '[data-req="hands"]');
const hands = await page.evaluate(() => (document.querySelector('[data-req="hands"]') || {}).textContent || '');
expect('A: the Homestead\'s Workshop reads the same record (' + hands.slice(0, 200) + ')', /Pincer[\s\S]{0,80}Pokédex/.test(hands));

// B. the same build in the Studio, the team lab and the benchmarks, no duplicate
await go('#/survival', '#svout [data-need]');
await pick('#svteam', 'mine/heartgold');
await pick('[data-sv="5"]', 'ind:' + scz.id);
const links = await page.evaluate((id) => [...document.querySelectorAll('#svout a')].map((a) => a.getAttribute('href')).filter((h) => h && h.indexOf(encodeURIComponent(id)) >= 0), scz.id);
expect('B: the Survival Lab links Pincer to the Studio and the benchmarks (' + links.join(' ') + ')', links.some((h) => /^#\/pokemon\//.test(h)) && links.some((h) => /^#\/bench\?ind=/.test(h)));
await page.click('#svteamlab');
await settle('#page');
await page.waitForTimeout(800);
const six = await page.evaluate(() => (store('team-heartgold') || []).map((b) => b && b.id));
expect('B: the team lab gets Pincer by its own id, not a copy (' + six.join(',') + ')', six.indexOf(scz.id) >= 0);
await go('#/pokemon/' + encodeURIComponent(scz.id), '#plin');
const studio = await page.evaluate(() => PL && PL.cur && PL.cur.moves);
expect('B: the Studio opens Pincer with the same moves (' + studio + ')', JSON.stringify(studio) === JSON.stringify(['Bullet Punch', 'X-Scissor', 'Swords Dance', 'Roost']));
expect('B: no build was duplicated', await page.evaluate(() => Object.keys(S.store.builds).length) === buildsBefore);

// D. the Glasshouse: climate, horticulture and nursery candidates from shared capabilities and explicit requirements
await go('#/facility/glasshouse', '[data-req="heat"]');
t = await text();
expect('D: the Glasshouse groups its jobs as climate management, horticulture and nursery support', /Climate management/.test(t) && /Horticulture/.test(t) && /Nursery support/.test(t));
const heat = await page.evaluate(() => document.querySelector('[data-req="heat"]').innerText);
expect('D: climate: who can staff the heat (Typhlosion, on your approved W-001)', /Can staff it[\s\S]{0,80}Typhlosion/.test(heat));
const eggs = await page.evaluate(() => document.querySelector('[data-req="eggs"]').innerText);
expect('D: nursery: hires that warm eggs on a game mechanic (Magcargo\'s Flame Body)', /Could be hired[\s\S]{0,120}Magcargo/.test(eggs));
const plants = await page.evaluate(() => document.querySelector('[data-req="plants"]').innerText);
expect('D: horticulture: candidates on other evidence, with their class', /Candidates on other evidence · \d+/.test(plants));

// G. one record, every assessment: previewing W-016 changes the Glasshouse and the Habitats alike
const meg = await page.evaluate(() => Object.keys(S.store.individuals).filter((k) => S.store.individuals[k].species === 'Meganium' && S.store.individuals[k].game === 'emerald')[0]);
expect('G: your Emerald Meganium exists (' + meg + ')', !!meg);
const plantStanding = async (fid, req) => {
  await go('#/facility/' + fid, '[data-req="' + req + '"]');
  await page.selectOption('[data-assign="' + req + '"]', 'ind:' + meg);
  await page.waitForTimeout(300);
  const before = await page.evaluate((r) => document.querySelector('[data-req="' + r + '"] .chip').innerText, req);
  await page.check('[data-fprev="W-016"]');
  await page.waitForTimeout(300);
  const after = await page.evaluate((r) => document.querySelector('[data-req="' + r + '"] .chip').innerText, req);
  return [before, after];
};
const g1 = await plantStanding('glasshouse', 'plants');
const g2 = await plantStanding('habitats', 'plants');
expect('G: the Glasshouse\'s plant care moves with W-016 (' + g1 + ')', g1[0] !== 'Covered' && g1[1] === 'Covered');
expect('G: so does the Habitats\' upkeep, from the same record (' + g2 + ')', g2[0] !== 'Covered' && g2[1] === 'Covered');

// F. two staff plans, and two expedition set-ups, compared without a winner
await go('#/facility/glasshouse', '[data-req="heat"]');
const typh = await page.evaluate(() => Object.keys(S.store.individuals).filter((k) => S.store.individuals[k].species === 'Typhlosion' && S.store.individuals[k].game === 'heartgold')[0]);
await page.selectOption('[data-assign="heat"]', 'ind:' + typh);
await page.waitForTimeout(250);
await page.click('#fckeepb');
await page.waitForTimeout(250);
await page.selectOption('[data-assign="calm"]', 'ind:' + (await page.evaluate(() => Object.keys(S.store.individuals).filter((k) => S.store.individuals[k].species === 'Snorlax')[0])));
await page.waitForTimeout(400);
t = await text('#fccmp');
expect('F: two staff plans compared, the tradeoff named (' + t.slice(0, 160) + ')', /covers .* that the other doesn't|uses more Pokémon/.test(t));
await page.fill('#fctitle', 'Glasshouse test plan');
await page.click('#fcsave');
await page.waitForFunction(() => Object.keys(S.store.teams).some((k) => S.store.teams[k].kind === 'staffing' && S.store.teams[k].facility === 'glasshouse'), null, { timeout: 30000 }).catch(() => {});
expect('F: the staff plan is saved to My Teams as a plan', await page.evaluate(() => Object.keys(S.store.teams).some((k) => S.store.teams[k].kind === 'staffing' && S.store.teams[k].facility === 'glasshouse')));
await go('#/survival', '#svout [data-need]');
await pick('#svteam', 'mine/heartgold');
await pick('#svsc', 'winter-mountain');
await page.click('#svkeepa');
await page.click('#svpackrec');
await page.waitForTimeout(300);
await pick('[data-sv="0"]', 'sp:Magcargo');
await page.click('#svkeepb');
await page.waitForTimeout(400);
t = await text('#svcmp');
expect('F: two set-ups compared, the tradeoffs named, no winner (' + t.slice(0, 200) + ')', /(stronger on|needs more food|more of the field moves|more battle slots|equally)/.test(t) && !/winner|better overall|best/i.test(t));
await page.click('#svsaveplan');
await page.waitForFunction(() => Object.keys(S.store.teams).some((k) => S.store.teams[k].kind === 'expedition'), null, { timeout: 30000 }).catch(() => {});
expect('F: the expedition plan is saved with its scenario and kit', await page.evaluate(() => Object.keys(S.store.teams).some((k) => { const x = S.store.teams[k]; return x.kind === 'expedition' && x.scenario === 'winter-mountain' && /cold-gear/.test(x.kit || ''); })));

// E. canon kept separate: mechanics, biology, equipment and Blackthorn records each say what they are
t = await text('#svout');
expect('E: game mechanics are labelled', /A · game mechanic/.test(t));
expect('E: biology is labelled as inferred', /B · biology · inferred/.test(t));
expect('E: your approved records are labelled Blackthorn', /Blackthorn · approved/.test(t));
expect('E: camp gear is labelled as Blackthorn\'s', /camp gear · Blackthorn/i.test(t));
await pick('#svsc', 'dense-forest');
await page.click('#svpackrec');
await page.waitForTimeout(300);
expect('E: game items are labelled as the game\'s', /game item/i.test(await text('#svout')));
await go('#/capability/manipulation', '#page .card');
t = await text();
expect('E: a capability page keeps its layers apart', /Layer A · the game's mechanics/.test(t) && /Layer B · biology/.test(t) && /Layer C · equipment and training/.test(t));
expect('G: the capability page lists every scenario and facility that reads it', /Who reads it[\s\S]*Workshop/.test(t));
await go('#/mon/' + encodeURIComponent(scz.id), '#page .card');
expect('profile: Pincer\'s capabilities away from battle', /Away from battle[\s\S]{0,3000}Manipulation/i.test(await text()));

// H. a phone
await page.setViewportSize({ width: 390, height: 844 });
for (const h of ['#/survival', '#/homestead', '#/facility/glasshouse', '#/capabilities', '#/capability/heat_source']) {
  await go(h, '.card');
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect('H: ' + h + ' fits a phone (' + over + 'px over)', over <= 2);
}
await browser.close();
if (errors.length) fails.push('page errors: ' + errors.join(' || '));
console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'ok: the Survival Lab and the Homestead meet the spec\'s acceptance tests A-H in the browser');
process.exit(fails.length ? 1 : 0);
