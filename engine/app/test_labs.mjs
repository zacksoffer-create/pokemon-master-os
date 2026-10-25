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
// a team role set by hand holds in the Pokémon lab and in the team lab
await page.selectOption('[data-ov="ace"]', 'yes');
await page.waitForTimeout(300); await settle('#plout .rrow');
const hand = await page.evaluate(() => ({ chip: /by hand, trial/.test(document.getElementById('plout').innerText), earned: document.getElementById('plearned').innerText }));
if (!hand.chip || !/Ace/.test(hand.earned)) fails.push('override: setting Ace by hand didn\'t show (' + JSON.stringify(hand) + ')');
await go('#/team/heartgold', '.tslots');
const inTeam = await page.evaluate(() => TL.comp.roles.ace.indexOf('Typhlosion') >= 0);
if (!inTeam) fails.push('override: the team lab doesn\'t count Typhlosion as an Ace after setting it by hand');
await page.evaluate(() => store('role-overrides', {}));
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
// your records (Phase 1): a draft survives leaving the page, a save keeps the earlier version, every lab reads the newest
const TY = '#/pokemon/' + encodeURIComponent('me:heartgold/Tyranitar');
await go(TY, '#plout .rrow');
await page.fill('[data-plmove="1"]', 'Stone Edge');
await page.waitForTimeout(700); await settle('#plout .rrow');
await go('#/pokemon', '.pickgrid .pick');
await go(TY, '#plout .rrow');
const kept = await page.evaluate(() => ({ draft: /Unsaved changes/.test(document.getElementById('pldraft').innerText), mv: document.querySelector('[data-plmove="1"]').value }));
if (!kept.draft || kept.mv !== 'Stone Edge') fails.push('draft: the unsaved move didn\'t survive leaving the page ' + JSON.stringify(kept));
await page.evaluate(() => plSave(false));
await page.fill('#askt', 'Stone Edge for coverage');
await page.click('#askf button');
await page.waitForFunction(() => window.PL && PL.rec && PL.rec.v === 2, null, { timeout: 60000 }).catch(() => {});
await settle('#plout .rrow');
const hist = await page.evaluate(() => ({ n: Records.versions(PL.rec.buildId).length, cur: PL.rec.v, mv: PL.base.moves[1], draft: document.getElementById('pldraft').innerText, card: !!document.querySelector('#plhist .card, #plhist [id^="m-"]') }));
if (hist.n !== 2 || hist.cur !== 2 || hist.mv !== 'Stone Edge' || hist.draft) fails.push('save: expected v2 of 2 with Stone Edge and no draft, got ' + JSON.stringify(hist));
const v1 = await page.evaluate(() => Records.version(PL.rec.buildId, 1).moves[1]);
if (v1 !== 'Crunch') fails.push('save: v1 should still have Crunch, has ' + v1);
await page.evaluate(() => store('team-heartgold', null));
await go('#/team/heartgold', '.tslots');
const tmv = await page.evaluate(() => (TL.team.filter((b) => b && b.species === 'Tyranitar')[0] || {}).moves || []);
if (tmv.indexOf('Stone Edge') < 0) fails.push('team lab: Tyranitar should open with its saved v2 moves, has ' + tmv.join(', '));
await page.evaluate(() => tlSaveTeam());
await page.fill('#askt', 'Winter six');
await page.click('#askf button');
await page.waitForFunction(() => Object.keys(S.store.teams).some((k) => S.store.teams[k].title === 'Winter six'), null, { timeout: 20000 }).catch(() => fails.push('team lab: the saved team never appeared in S.store.teams'));
await go('#/field', '#svteam');
const fopts = await page.evaluate(() => [...document.querySelectorAll('#svteam option')].map((o) => o.textContent));
if (!fopts.some((o) => /Saved · Winter six/.test(o))) fails.push('survival: the saved team isn\'t offered (' + fopts.slice(0, 4).join(' | ') + ')');
await go('#/pokemon', '#plnew');
for (const nick of ['Pebble', 'Gravel']) {
  await page.evaluate((n) => plNew('Larvitar', 'heartgold', n), nick);
  await page.waitForFunction((n) => Object.keys(S.store.individuals).some((k) => S.store.individuals[k].nickname === n), nick, { timeout: 20000 }).catch(() => {});
  await settle('#plout .rrow');
}
const larv = await page.evaluate(() => Object.keys(S.store.individuals).filter((k) => S.store.individuals[k].species === 'Larvitar' && S.store.individuals[k].game === 'heartgold'));
if (larv.length < 2) fails.push('new Pokémon: two Larvitar in HeartGold should both exist, have ' + larv.join(', '));
// My World (Phase 3): the collection, a profile, its showcase, an image packet, a picture uploaded and set as the profile picture
await go('#/mine', '.mgrid .mcard');
const nMine = await page.evaluate(() => document.querySelectorAll('.mgrid .mcard').length);
if (nMine < 36) fails.push('your Pokémon: only ' + nMine + ' cards');
await go('#/mon/' + encodeURIComponent('me:heartgold/Tyranitar'), '.mhero');
const prof = await page.evaluate(() => ({ h1: document.querySelector('.mhero h1').innerText, refs: document.querySelectorAll('.mgal figure').length, tools: document.querySelectorAll('.tool').length, v2: /v2/.test(document.getElementById('page').innerText) }));
if (!/Tyranitar/.test(prof.h1) || prof.refs < 2 || prof.tools < 5 || !prof.v2) fails.push('profile: ' + JSON.stringify(prof));
await page.click('#mpack');
const pk = await page.evaluate(() => document.getElementById('pktext').value);
if (!/^1\. Subject: .*Tyranitar/.test(pk) || !/10\. Use:/.test(pk) || !/don't invent a difference/.test(pk)) fails.push('image packet: ' + pk.slice(0, 200));
await page.evaluate(() => closeDrawer());
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEJMDGgASwCAKS1AgFZ0iUJAAAAAElFTkSuQmCC', 'base64');
page.once('dialog', (d) => d.dismiss());
await page.setInputFiles('#mup', { name: 'rex.png', mimeType: 'image/png', buffer: png });
await page.waitForSelector('#askt', { timeout: 10000 }).catch(() => {});
await page.fill('#askt', 'Rex at dawn');
await page.click('#askf button');
await page.waitForFunction(() => { const i = S.store.individuals['me:heartgold/Tyranitar']; return i && i.hero && S.store.artwork[i.hero]; }, null, { timeout: 30000 }).catch(() => fails.push('upload: the picture never became the profile picture'));
await settle('.mhero');
await page.waitForFunction(() => /^data:image/.test(((document.querySelector('.mhero .mart img') || {}).src) || ''), null, { timeout: 10000 }).catch(() => {});
const heroSrc = await page.evaluate(() => (document.querySelector('.mhero .mart img') || {}).src || '');
if (!/^data:image\/jpeg/.test(heroSrc)) fails.push('upload: the profile picture is ' + heroSrc.slice(0, 80));
await go('#/mon/' + encodeURIComponent('me:heartgold/Tyranitar') + '/showcase', '.mhero');
const sc = await page.evaluate(() => ({ edit: !!document.querySelector('#mpack'), up: !!document.querySelector('#mup') }));
if (sc.edit || sc.up) fails.push('showcase: working controls are showing ' + JSON.stringify(sc));
await page.evaluate(() => { localStorage.removeItem('bt-preview-tabs'); localStorage.removeItem('bt-preview-images'); Object.keys(localStorage).filter((k) => /^bt-(draft:|team-)/.test(k)).forEach((k) => localStorage.removeItem(k)); });
await browser.close();
for (const e of errors) fails.push('page error: ' + e);
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
console.log('labs ok: Pokémon lab live edit, compare (' + rows + ' Garchomp builds), team lab (' + team.cands + ' candidates), breeding lab, PKHeX export, saved versions, drafts, saved teams, new Pokémon, profiles, showcase, image packets, picture upload');
