// The Trainer Library in the preview build (web/89_trainers.html over web/24_library.html), in Chromium, against the
// spec's success criteria (docs/specs/TRAINER_LIBRARY.md; MASTER_PLAN Phase 5): 1 the Gen IV Champion's actual team,
// 2 two versions compared, 3 a reconstruction's research and assumptions, 4 a team as a one-on-one benchmark, 7 a build
// against groups, 8 the rule shown and adjustable (and the Ace collections give the Ace test's own rates), 9 a version of
// your own without touching the original, 10 the same records from the builder, team lab, Battle Lab and the standards.
// Run: python3 -I app/build.py && node app/test_library.mjs                  (tests/test_engines.py runs it)
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
const settle = async (sel, ms = 240000) => { const t = Date.now(); while (Date.now() - t < ms) {
  const st = await page.evaluate((s) => { const p = document.getElementById('page'); if (!p || /^\s*Opening…\s*$/.test(p.innerText)) return 'opening';
    if (s && !document.querySelector(s)) return 'wait'; const r = document.getElementById('bnres'); if (r && /Reading…/.test(r.innerText)) return 'reading'; return 'ok'; }, sel);
  if (st === 'ok') return true; await page.waitForTimeout(150); } return false; };
const go = async (h, sel, notices = false) => { await page.evaluate((x) => nav(x), h); if (!await settle(sel)) fails.push(h + ': never settled (waiting for ' + sel + ')');
  if (notices) return; const n = await page.evaluate(() => [...document.querySelectorAll('#page .notice')].map((x) => x.innerText).join(' | ')); if (n) fails.push(h + ': ' + n.slice(0, 300)); };
const text = () => page.evaluate(() => document.getElementById('page').innerText);
const expect = (what, ok) => { if (!ok) fails.push(what); };
const enc = encodeURIComponent;

await page.goto('file://' + path.join(HERE, 'dist', 'Blackthorn-HQ-preview.html') + '#/');
await settle();
await page.evaluate(() => { Object.keys(localStorage).filter((k) => /^bt-(preview-tabs|draft:variant|lib-groups|bench-last)/.test(k)).forEach((k) => localStorage.removeItem(k)); });

// the directory
await go('#/trainers', '#trf');
expect('the directory lists every trainer', /79 trainers/.test(await text()));
await page.fill('#trf [name=q]', 'cynthia');
await page.waitForTimeout(200);
expect('the search narrows it to Cynthia', /^1 trainer$/.test(await page.evaluate(() => document.getElementById('trn').textContent)));

// 1. an accurate Gen IV Champion profile: the actual team
await go('#/trainer/cynthia', '.card');
let t = await text();
expect('1: Cynthia\'s first battle, from the Platinum cartridge', /Cynthia, Champion \(Platinum, first battle\)/.test(t) && /champion_cynthia\.json/.test(t));
expect('1: her six, with Garchomp her ace at Lv 62 holding a Sitrus Berry', ['Spiritomb', 'Roserade', 'Togekiss', 'Lucario', 'Milotic'].every((s) => t.includes(s)) &&
  /Garchomp\s*ace\s*Lv 62/.test(t) && /Dragon Rush[\s\S]{0,80}Earthquake[\s\S]{0,80}Flamethrower[\s\S]{0,80}Giga Impact[\s\S]{0,120}Sitrus Berry/.test(t));
expect('1: what she knows (AI) reads as competence, not a plan', /Competence \(how well they judge\): avoids moves that would fail, weighs damage, expert judgment/.test(t));
expect('1: each field says what it rests on', /confirmed\s*36/.test(t) && await page.evaluate(() => document.querySelectorAll('.evd.ev-confirmed').length) > 30);

// 2. two versions of the same trainer, compared
await go('#/trainers/compare/' + enc('platinum/cynthia') + '/' + enc('platinum/cynthia-rematch'), '.card');
t = await text();
expect('2: the rematch is 16 levels up and Garchomp trades Flamethrower for Brick Break', /Top level 62 → 78/.test(t) && /Garchomp: level 62 → 78; drops Flamethrower; adds Brick Break/.test(t));

// 3. the research and assumptions behind an anime reconstruction
await go('#/trainer/ash/' + enc('ash/sinnoh'), '.card');
t = await text();
expect('3: Sinnoh Ash shows what it rests on and what was filled in', /Research and assumptions/.test(t) && /confirmed[\s\S]{0,200}on the team in the show/.test(t) &&
  /standardized[\s\S]{0,400}IVs 31 in every stat/.test(t) && /Signature moves/.test(t));

// 4. a trainer's team as a one-on-one benchmark
await go('#/bench?ind=' + enc('me:heartgold/Crobat') + '&v=' + enc('platinum/cynthia'), '#bnres .card');
t = await text();
expect('4: Crobat against Cynthia\'s six, as encountered (Lv 62)', /Beats \d of 6/.test(t) && /As encountered/i.test(t) && /Lv 62/.test(t));

// 7 and 8. against groups, with the rule shown; the Ace collections are the Ace test
await go('#/bench?ind=' + enc('me:heartgold/Crobat') + '&c=ace-champion-gen4', '#bnres .card');
t = await text();
expect('7/8: Crobat beats 18 of the 24 Gen 4 Champion Pokémon, as the Ace test reads (75%)', /Beats 18 of 24 \(75%\)/.test(t) && /clears the 70% bar/.test(t));
expect('8: the rule and the group\'s version are on the page', /The rule[\s\S]{0,200}a draw isn't a win[\s\S]{0,200}at least 70%/.test(t) && /@e92ef83e \(as published\)/.test(t));
await page.evaluate(() => { const r = document.querySelector('#bnf [name=thr]'); r.value = '0.8'; r.dispatchEvent(new Event('input', {bubbles: true})); });
await page.waitForTimeout(200);
t = await text();
expect('8: raising the bar to 80% changes the verdict and the version, not the fights', /short of the 80% bar/.test(t) && /Beats 18 of 24/.test(t) && /adjusted: published @e92ef83e/.test(t));
const ace = await page.evaluate(() => {   // every Ace collection reproduces the stored reads' rates (a few builds per generation)
  const out = [], picks = {2: 'me:crystal/Feraligatr', 3: 'me:emerald/Swampert', 4: 'me:platinum/Garchomp'};
  Object.keys(picks).forEach((g) => {
    const read = S.r4.reads[picks[g]], a = read.roles.filter((r) => r.role === 'ace')[0].numbers, ind = S.store.individuals[picks[g]];
    const b = Object.assign(indBuild(ind), {game: ind.game, generation: +g});
    const e4 = Library.run(b, Library.collection('ace-elite-four-gen' + g).members, 'standardized', 0.8), ch = Library.run(b, Library.collection('ace-champion-gen' + g).members, 'standardized', 0.7);
    out.push([picks[g], e4.rate, a.elite_four_rate, e4.n, a.elite_four_n, ch.rate, a.champion_rate, ch.n, a.champion_n]);
  });
  return out;
});
ace.forEach((r) => expect('8: ' + r[0] + ' reads the Ace test\'s own rates (' + JSON.stringify(r) + ')', r[1] === r[2] && r[3] === r[4] && r[5] === r[6] && r[7] === r[8]));
const stamps = await page.evaluate(() => Library.collections().filter((c) => Library.stamp(c.members, c.rule.threshold, c.lens) !== c.version).map((c) => c.id));
expect('8: every collection\'s version stamp matches trainers/catalog.py (' + stamps.join(', ') + ')', !stamps.length);
// your own group, kept in this browser
await go('#/bench?ind=' + enc('me:platinum/Garchomp') + '&c=platinum-gym', '#bnres .card');
expect('7: Garchomp against the Platinum Gym Leaders as encountered, at each leader\'s top level', /Byron, Gym Leader[\s\S]{0,40}Lv 41/.test(await text()));
await page.fill('#bgq', 'Platinum, rematch');
await page.evaluate(() => { [...document.querySelectorAll('#bgl input')].filter((x) => x.closest('label').style.display !== 'none').slice(0, 3).forEach((x) => { x.checked = true; }); });
await page.fill('#bgn', 'Test group');
await page.click('#bgs');
await page.waitForFunction(() => /c=mine%3A/.test(NAVI.hash) && /Test group/.test(document.querySelector('#bnf [name=target]').selectedOptions[0].textContent), null, { timeout: 60000 }).catch(() => {});
await settle('#bnres .card');
t = await text();
expect('7: your group runs, with its own version', /Test group/.test(await page.evaluate(() => document.querySelector('#bnf [name=target]').selectedOptions[0].textContent)) && /Beats \d+ of \d+/.test(t) && /measured against @[0-9a-f]{8}/.test(t));

// 9. an optimized version of your own; the original is untouched
const before = await page.evaluate(() => JSON.stringify(Library.version('platinum/cynthia').party));
await go('#/trainers/variant/' + enc('platinum/cynthia'), '#vform');
await page.click('#vopt');
await page.waitForTimeout(400);
t = await text();
expect('9: optimizing fills the strongest sets at Lv 100 and says what changes', /Cynthia, optimized/.test(await page.evaluate(() => document.querySelector('#vform [name=title]').value)) && /What changes[\s\S]*level 62 → 100/.test(t) && /hypothetical/.test(t));
await page.click('#vsave');
await page.waitForFunction(() => /^#\/trainer\/cynthia\/team/.test(NAVI.hash), null, { timeout: 60000 }).catch(() => {});
await settle('.card');
t = await text();
const vid = await page.evaluate(() => decodeURIComponent(NAVI.hash.split('/').pop()));
expect('9: the version saves under Cynthia as yours (' + vid + ')', /^team:/.test(vid) && /Your versions/.test(t) && /Made from[\s\S]{0,80}Cynthia, Champion \(Platinum, first battle\); the original is unchanged/.test(t));
expect('9: the original is untouched', before === await page.evaluate(() => JSON.stringify(Library.version('platinum/cynthia').party)));
expect('9: kept fields keep the game\'s evidence, changed ones are your hypothesis', await page.evaluate((id) => { const e = Library.version(id).evidence; return e[0].species[0] === 'confirmed' && e[0].moves[0] === 'hypothetical' && e[0].level[0] === 'hypothetical'; }, vid));

// 10. the same records everywhere
expect('10: the team lab can open it (My Teams)', await page.evaluate((id) => savedTeams('platinum').some((x) => x.id === id && x.trainer === 'cynthia'), vid));
await go('#/bench?ind=' + enc('me:platinum/Garchomp') + '&v=' + enc(vid), '#bnres .card');
expect('10: it benchmarks like any version', /Cynthia, optimized \(yours\)/.test(await text()) && /Beats \d of 6/.test(await text()));
await go('#/pokemon/' + enc('me:platinum/Garchomp'), '#plname', true);
expect('10: the Studio offers the benchmark', await page.evaluate(() => !![...document.querySelectorAll('#page a')].find((a) => /^#\/bench\?ind=/.test(a.getAttribute('href')) && /Benchmark it/.test(a.textContent))));
await go('#/scouting/cynthia-champion-platinum', '.card', true);
await page.evaluate(() => nav([...document.querySelectorAll('#page a')].find((a) => /In the Trainer Library/.test(a.textContent)).getAttribute('href')));
await page.waitForFunction(() => NAVI.hash === '#/trainer/cynthia/platinum%2Fcynthia', null, { timeout: 30000 }).catch(() => {});
expect('10: a scouting report opens its trainer (' + await page.evaluate(() => NAVI.hash) + ')', await page.evaluate(() => NAVI.hash) === '#/trainer/cynthia/platinum%2Fcynthia');
await go('#/trainers/find?game=heartgold&opp=' + enc('Champion Lance (rematch)'), null);
await page.waitForFunction(() => /^#\/trainer\/lance\//.test(NAVI.hash), null, { timeout: 30000 }).catch(() => {});
expect('10: a Battle Lab opponent opens its trainer (' + await page.evaluate(() => NAVI.hash) + ')', await page.evaluate(() => NAVI.hash) === '#/trainer/lance/heartgold%2Flance-rematch');
await go('#/standards', '#trybar');
await page.evaluate(() => { const r = document.querySelector('#trybar [name=e4]'); r.value = '0.95'; r.dispatchEvent(new Event('input', {bubbles: true})); });
await page.waitForTimeout(200);
t = await text();
const m = t.match(/(\d+) of (\d+) stored builds clear these bars[^;]*; at the published bars, (\d+)/);
expect('8/10: the standards page tries a stricter Ace bar (' + (m && m[0]) + ')', m && +m[1] < +m[3] && /Would fall short/.test(t));

// the assumptions register: every call made while building, reviewable in Your calls
await go('#/calls', '#assumptions', true);
t = await text();
expect('the register lists every assumption with where to see it', /assumptions i made/i.test(t) && (t.match(/A-\d\d · /g) || []).length >= 27 && /See it: Make a version of Cynthia/.test(t));
await page.evaluate(() => { const c = document.getElementById('call-A-19'); [...c.querySelectorAll('.opt')].find((b) => b.textContent === 'Keep').click(); [...c.querySelectorAll('button')].find((b) => /Record my call/.test(b.textContent)).click(); });
await page.waitForFunction(() => { const c = document.getElementById('call-A-19'); return c && /kept/.test(c.querySelector('.hd').innerText); }, null, { timeout: 30000 }).catch(() => {});
expect('keeping an assumption records it', await page.evaluate(() => { const c = document.getElementById('call-A-19'); return !!c && /kept/.test(c.querySelector('.hd').innerText); }));

await browser.close();
if (errors.length) fails.push('page errors: ' + errors.join(' || '));
console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'ok: the Trainer Library meets the spec\'s criteria 1-4 and 7-10 in the browser');
process.exit(fails.length ? 1 : 0);
