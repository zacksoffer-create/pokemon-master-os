// v2 (D-078) in the preview build (app/dist/Blackthorn-HQ-preview.html), from a fresh start: home leads with six blank
// teams; a Pokémon added to HeartGold opens in the builder; its moves come from dropdowns with everything about them;
// the six roles re-read live; a draft survives leaving the page; saves keep every version; a candidate joins the team;
// the tiles reorder and the team keeps its own trainer; every section of the team homepage reads; a swap reads; the
// breeding lab, PKHeX export, the Survival Lab, the profile and a picture upload all work with the new Pokémon.
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
    if (s && !document.querySelector(s)) return 'wait'; if (document.getElementById('pbbusy')) return 'busy';
    return /Reading (it|the six|candidates)/.test(p.innerText) ? 'reading' : 'ok'; }, sel); if (st === 'ok') return true; await page.waitForTimeout(200); } return false; };
const go = async (h, sel, allow) => { await page.evaluate((x) => nav(x), h); if (!await settle(sel)) fails.push(h + ': never settled (waiting for ' + sel + ')');
  const n = await page.evaluate(() => [...document.querySelectorAll('#page .notice')].map((x) => x.innerText).filter(Boolean).join(' | '));
  const bad = n.split(' | ').filter((x) => x && !/Re-reading|v2: each of your six teams/.test(x) && !(allow && allow.test(x)));
  if (bad.length) fails.push(h + ': ' + bad.join(' | ').slice(0, 300)); };
await page.goto('file://' + path.join(HERE, 'dist', 'Blackthorn-HQ-preview.html') + '#/');
await page.evaluate(() => { localStorage.removeItem('bt-preview-tabs'); });
await page.reload(); await settle('.jcards');
// a fresh start: six blank teams, nothing of yours
const home = await page.evaluate(() => ({ cards: document.querySelectorAll('.jcards .jcard').length, start: /Start here/.test(document.getElementById('page').innerText), mine: Object.keys(S.store.individuals || {}).length }));
if (home.cards !== 6 || !home.start || home.mine) fails.push('home: expected six blank teams and Start here, got ' + JSON.stringify(home));
await go('#/team/heartgold', '#tmsix');
const empty = await page.evaluate(() => document.querySelectorAll('#tmsix .tile.add').length);
if (empty !== 6) fails.push('team: a blank HeartGold team should have six empty slots, has ' + empty);
// add Typhlosion to slot 1: it opens in the builder
await page.evaluate(() => addPokemon('Typhlosion', 'heartgold', 0));
await page.waitForFunction(() => /^#\/pokemon\/me:heartgold/.test(decodeURIComponent(NAVI.hash)), null, { timeout: 30000 }).catch(() => fails.push('add: the builder never opened'));
await settle('#pbroles .role5');
const id = await page.evaluate(() => PB.id);
const b0 = await page.evaluate(() => ({ roles: [...document.querySelectorAll('#pbroles .role5 b')].map((x) => x.textContent), moves: document.querySelectorAll('[data-pbmove="0"] option').length,
  dex: document.querySelectorAll('.dexblock .dexe').length, team: PB.team }));
if (b0.roles.join() !== 'Ace,Sweeper,Support,Wall,Tank,Pivot') fails.push('builder: the roles are ' + b0.roles.join());
if (b0.moves < 50) fails.push('builder: only ' + b0.moves + ' moves in the dropdown');
if (b0.dex < 3) fails.push('builder: only ' + b0.dex + ' Pokédex entries');
if (!b0.team || b0.team.game !== 'heartgold' || b0.team.slot !== 0) fails.push('builder: it isn\'t on the team in slot 1 ' + JSON.stringify(b0.team));
const rolesBefore = await page.evaluate(() => [...document.querySelectorAll('#pbroles .role5 .num')].map((x) => x.textContent).join('|'));
for (const [i, m] of ['Flamethrower', 'Extrasensory', 'Thunder Punch', 'Earthquake'].entries()) { await page.selectOption(`[data-pbmove="${i}"]`, m); await page.waitForTimeout(120); }
await page.selectOption('[data-pb="nature"]', 'Modest');
await page.click('[data-pbevmax="spa"]'); await page.click('[data-pbevmax="spe"]');
await page.waitForTimeout(800); await settle('#pbroles .role5');
const b1 = await page.evaluate(() => ({ roles: [...document.querySelectorAll('#pbroles .role5 .num')].map((x) => x.textContent).join('|'), info: document.querySelector('[data-pbmx="0"]').innerText,
  nat: document.getElementById('pbnatx').innerText, evs: PB.cur.evs, ab: document.getElementById('pbabx').innerText, badges: document.querySelectorAll('#pbbadges .bfam').length,
  scout: document.querySelectorAll('#pbscout ul.scout').length, wild: document.querySelectorAll('#pbwild .wtag').length }));
if (b1.roles === rolesBefore) fails.push('builder: choosing moves didn\'t change any role score');
if (!/PP/.test(b1.info) || !/Power/.test(b1.info) || !/“/.test(b1.info)) fails.push('builder: the move info lacks PP, power or the game\'s description: ' + b1.info.slice(0, 160));
if (!/Special Attack \+10%/.test(b1.nat) || !/Likes/.test(b1.nat)) fails.push('builder: the nature description is ' + b1.nat);
if (!b1.evs || b1.evs.spa !== 252 || b1.evs.spe !== 252) fails.push('builder: Max EVs gave ' + JSON.stringify(b1.evs));
if (!/Blaze/.test(b1.ab)) fails.push('builder: no ability description');
if (b1.badges !== 6) fails.push('builder: ' + b1.badges + ' badge families, not 6');
if (b1.scout !== 3) fails.push('builder: the scouting report has ' + b1.scout + ' lists');
if (!b1.wild) fails.push('builder: no wilderness tags');
// v2.1: where it came from is a list of the real ways (A-100); the ball is independent (A-101); start from a build, ability first (A-102); the shiny
const v21 = await page.evaluate(() => { const box = document.getElementById('pbin'), o = [...box.querySelectorAll('[data-pborigin] option')].map((x) => x.textContent);
  const at = (sel) => [...box.querySelectorAll('select')].indexOf(box.querySelector(sel));
  return { starter: o.some((x) => /^Your starter as Cyndaquil, then evolved: New Bark Town, Lv 5/.test(x)), egg: o.some((x) => /^Hatched from an egg/.test(x)), set: !!box.querySelector('[data-pb="set"]'),
    abilityFirst: at('[data-pb="ability"]') >= 0 && at('[data-pb="ability"]') < at('[data-pbmove="0"]') && at('[data-pb="set"]') < at('[data-pb="ability"]'), shiny: !!document.querySelector('.pbarts img[alt^="Shiny"]'),
    ball: document.getElementById('pbballfit').innerText }; });
if (!v21.starter || !v21.egg) fails.push('builder: where it came from lacks the starter or the egg ' + JSON.stringify(v21));
if (!v21.set || !v21.abilityFirst) fails.push('builder: Start from a build, then ability, then the moves ' + JSON.stringify(v21));
if (!v21.shiny) fails.push('builder: no shiny artwork under the species');
if (/story choice/i.test(v21.ball)) fails.push('builder: the ball still judges how it was met: ' + v21.ball);
await page.selectOption('[data-pborigin]', String(await page.evaluate(() => PB.origins.findIndex((o) => o.how === 'starter'))));
await page.waitForTimeout(200);
const met = await page.evaluate(() => ({ how: PB.who.met_how, as: PB.who.met_as, at: document.querySelector('[data-who="met_location"]').value, lv: document.querySelector('[data-who="caught_level"]').value }));
if (met.how !== 'starter' || met.as !== 'Cyndaquil' || met.at !== 'New Bark Town' || met.lv !== '5') fails.push('builder: picking the starter fills ' + JSON.stringify(met));
// a draft survives leaving the page, and the team page offers to save it (v2.3)
await go('#/team/heartgold', '#tmsix', /Unsaved changes on Typhlosion/);
if (!await page.evaluate(() => !!document.querySelector('[data-tmfix="drafts"]'))) fails.push('team: no offer to save the unsaved Typhlosion');
await go('#/pokemon/' + encodeURIComponent(id), '#pbroles .role5');
const kept = await page.evaluate(() => ({ draft: /Unsaved changes/.test(document.getElementById('pbdraft').innerText), mv: document.querySelector('[data-pbmove="1"]').value }));
if (!kept.draft || kept.mv !== 'Extrasensory') fails.push('draft: the unsaved build didn\'t survive leaving the page ' + JSON.stringify(kept));
// save, change, save again: two versions, the first kept
await page.click('#pbsave');
await page.waitForFunction(() => { const i = S.store.individuals[PB.id]; return i && i.build && !document.getElementById('pbdraft').innerText; }, null, { timeout: 60000 }).catch(() => fails.push('save: the build never saved'));
await settle('#pbroles .role5');
await page.selectOption('[data-pbmove="1"]', 'Focus Blast'); await page.waitForTimeout(400);
await page.fill('#pbnote', 'Focus Blast for coverage'); await page.click('#pbsave');
await page.waitForFunction(() => { const i = S.store.individuals[PB.id], b = document.getElementById('pbsave'); return i && Records.versions(i.build).length === 2 && b && !b.disabled; }, null, { timeout: 60000 }).catch(() => {});
await settle('#pbroles .role5');
const kept2 = await page.evaluate(() => { const i = S.store.individuals[PB.id]; return {how: i.met_how, as: i.met_as, at: i.met_location, lv: i.caught_level}; });
if (kept2.how !== 'starter' || kept2.as !== 'Cyndaquil' || kept2.at !== 'New Bark Town' || kept2.lv !== 5) fails.push('save: where it came from wasn\'t kept ' + JSON.stringify(kept2));
const hist = await page.evaluate(() => { const i = S.store.individuals[PB.id]; return { n: Records.versions(i.build).length, v1: Records.version(i.build, 1).moves[1], v2: Records.version(i.build, 2).moves[1], note: Records.version(i.build, 2).note }; });
if (hist.n !== 2 || hist.v1 !== 'Extrasensory' || hist.v2 !== 'Focus Blast' || !/coverage/.test(hist.note || '')) fails.push('save: ' + JSON.stringify(hist));
// the team: a candidate joins, the order changes, the team has its own trainer
await go('#/team/heartgold', '#tmsix .tile[data-go]');
await settle('#tmclist .cand');
const cands = await page.evaluate(() => document.querySelectorAll('#tmclist .cand').length);
if (!cands) fails.push('team: no candidates');
await page.evaluate(() => { const k = Object.keys(S.store.builds).filter((x) => S.store.builds[x].species === 'Tyranitar' && (S.store.builds[x].generation || 4) === 4 && S.store.builds[x].provenance !== 'yours')[0]; tmPut(k, 1); });
await page.waitForFunction(() => Teams.filled(Teams.get('heartgold')) === 2, null, { timeout: 60000 }).catch(() => fails.push('team: the Tyranitar candidate never joined'));
await settle('#tmsix .tile[data-go]');
await page.evaluate(() => tmMove(1, 0));
await page.waitForFunction(() => { const s = Teams.get('heartgold').slots; return s[0] && s[0].species === 'Tyranitar'; }, null, { timeout: 30000 }).catch(() => fails.push('team: moving Tyranitar to the front didn\'t save'));
await page.fill('#tmtf [name=name]', 'Zack'); await page.fill('#tmtf [name=philosophy]', 'Nothing you do matters.'); await page.selectOption('#tmtf [name=style]', 'setup');
await page.click('#tmtf button');
await page.waitForFunction(() => Teams.get('heartgold').profile.name === 'Zack', null, { timeout: 30000 }).catch(() => fails.push('trainer: the name never saved'));
await go('#/team/heartgold', '#tmsix .tile[data-go]');
await page.waitForFunction(() => document.querySelector('#tm-scout .scout3') && document.querySelector('#tm-shape .rmatrix'), null, { timeout: 240000 }).catch(() => {});
const sec = await page.evaluate(() => ({ title: document.getElementById('tmtitle').textContent, scout: !!document.querySelector('#tm-scout .scout3'), shape: !!document.querySelector('#tm-shape .rmatrix'),
  shapes: document.querySelectorAll('#tm-shape .shape').length, cover: document.querySelectorAll('#tm-cover .typecell').length, badges: document.querySelectorAll('#tm-ach .gbadge').length,
  swap: !!document.getElementById('tmswf'), style: Teams.get('heartgold').profile.style, first: (document.querySelector('#tmsix .tile[data-go] .nm') || {}).textContent }));
const fam = await page.evaluate(() => ({ rows: document.querySelectorAll('#tm-shape .famrow').length, weather: !!Families.cfg() && !!TM.comp.families.weather }));
if (fam.rows !== 4 || !fam.weather) fails.push('team: the move families card ' + JSON.stringify(fam));
if (sec.title !== 'Zack\'s HeartGold' || !sec.scout || !sec.shape || sec.shapes !== 9 || sec.cover < 30 || sec.badges !== 16 || !sec.swap || sec.style !== 'setup' || sec.first !== 'Tyranitar') fails.push('team sections: ' + JSON.stringify(sec));
await page.selectOption('#tmswf [name=what]', 'nature'); await page.waitForTimeout(200);
await page.click('#tmswgo');
await page.waitForFunction(() => /Its roles/.test((document.getElementById('tmswout') || {}).innerText || ''), null, { timeout: 120000 }).catch(() => fails.push('swap: no read came back'));
// the other teams stay their own
await go('#/team/crystal', '#tmsix');
const crystal = await page.evaluate(() => ({ n: Teams.filled(Teams.get('crystal')), name: Teams.get('crystal').profile.name }));
if (crystal.n !== 0 || crystal.name === 'Zack') fails.push('crystal: it should be blank with its own trainer ' + JSON.stringify(crystal));
await go('#/compare/Garchomp', 'table.t');
const rows = await page.evaluate(() => document.querySelectorAll('#page table.t tr').length - 1);
if (rows < 4) fails.push('compare: only ' + rows + ' Garchomp builds');
await go('#/lines', null);
await go('#/pkhex/' + encodeURIComponent(id), '.paste');
const set = await page.evaluate(() => document.querySelector('.paste').innerText);
if (!/^Typhlosion/.test(set) || !/- Flamethrower/.test(set) || !/Modest Nature/.test(set)) fails.push('PKHeX export: unexpected set ' + set.slice(0, 160));
await go('#/field', '#svteam');
const fopts = await page.evaluate(() => [...document.querySelectorAll('#svteam option')].map((o) => o.textContent));
if (!fopts.some((o) => /Zack's HeartGold team/.test(o))) fails.push('survival: the HeartGold team isn\'t offered (' + fopts.slice(0, 4).join(' | ') + ')');
// your Pokémon and a profile, with a picture upload
await go('#/pokemon', '.pickgrid .pick');
const nMine = await page.evaluate(() => document.querySelectorAll('.pickgrid .pick').length);
if (nMine < 2) fails.push('your Pokémon: only ' + nMine);
await go('#/mon/' + encodeURIComponent(id), '.mhero');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEJMDGgASwCAKS1AgFZ0iUJAAAAAElFTkSuQmCC', 'base64');
page.once('dialog', (d) => d.dismiss());
await page.setInputFiles('#mup', { name: 'ember.png', mimeType: 'image/png', buffer: png });
await page.waitForSelector('#askt', { timeout: 10000 }).catch(() => {});
await page.fill('#askt', 'Ember at dusk');
await page.click('#askf button');
await page.waitForFunction((i) => { const x = S.store.individuals[i]; return x && x.hero && S.store.artwork[x.hero]; }, id, { timeout: 30000 }).catch(() => fails.push('upload: the picture never became the profile picture'));
await page.evaluate(() => { localStorage.removeItem('bt-preview-tabs'); localStorage.removeItem('bt-preview-images'); Object.keys(localStorage).filter((k) => /^bt-(draft:|team-)/.test(k)).forEach((k) => localStorage.removeItem(k)); });
await browser.close();
for (const e of errors) fails.push('page error: ' + e);
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
console.log('labs ok: a fresh start, a Pokémon added and built (roles, move info, nature, EVs, badges, scouting, wilderness), a draft kept, two saved versions, a candidate on the team, reorder, the team\'s own trainer, every team section, a swap, compare (' + rows + ' Garchomp builds), PKHeX, the Survival Lab, your Pokémon, a profile picture');
