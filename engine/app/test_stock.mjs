// The breeding-stock pages in the preview build (web/88_stock.html over web/23_stock.html), in Chromium: the spec's
// four questions answer (what a line can start with, how to make an exact set, what makes two sets different, what a
// set might suggest), a blueprint saves and versions, a hatch is recorded and keeps its moves, the Mamoswine line reads
// Ancient Power's other routes (B27), and Crystal's Swinub has no Mamoswine (B26). What a set might suggest is read by
// fixed rules (A-09): fixed sets below are held to their sentences, and the live page reads again as a set is edited.
// Run: python3 -I app/build.py && node app/test_stock.mjs                  (tests/test_engines.py runs it)
import fs from 'node:fs';
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
    if (s && !document.querySelector(s)) return 'wait'; const r = document.getElementById('stres'); if (r && /^\s*Reading…\s*$/.test(r.innerText)) return 'reading'; return 'ok'; }, sel);
  if (st === 'ok') return true; await page.waitForTimeout(150); } return false; };
const go = async (h, sel, notices = false) => { await page.evaluate((x) => nav(x), h); if (!await settle(sel)) fails.push(h + ': never settled (waiting for ' + sel + ')');
  if (!notices) { const n = await page.evaluate(() => [...document.querySelectorAll('#page .notice')].map((x) => x.innerText).join(' | ')); if (n) fails.push(h + ': ' + n.slice(0, 300)); } };
const text = () => page.evaluate(() => document.getElementById('page').innerText);
const expect = (what, ok) => { if (!ok) fails.push(what); };

// fixed facts for the reading (stockInterpret), shaped as stockEvidence gathers them from the card's evidence
const FN = {ambush: ['Ambush strike', 'strikes before the other can act: a sit-and-wait or burst hunter'], pursuit: ['Pursuit', 'runs down what flees: a chaser'],
  cold: ['Cold', 'a cold-adapted lineage'], lithic: ['Rock and soil', 'rock, sand and soil: a digging or cliff lineage'], shadow: ['Darkness', 'a nocturnal lineage: works in the dark'],
  mind: ['Mind', 'a psychic lineage: foresight and the mind'], display: ['Power display', 'builds itself up before it commits: display, dominance, a dance'],
  trick: ['Deception', 'confuses, mimics and misdirects'], brawn: ['Brawn', 'fights up close with strength'], paralytic: ['Paralysis', 'immobilises prey or attackers']};
const fx = (o) => Object.assign({game: 'heartgold', title: 'HeartGold', gen: 4, possible: true, obtainable: true, scope: 'this game', obtainable_why: 'every parent and move is found in heartgold',
  defaults: [], slots: [], ability: null, ability_field: [], weather: [], evolution: [], canon: {dex: null, dexg: null, hab: null, lore: []}, own: {}, nature: null, ivs: null,
  purpose: '', lineage: null, ecotypes: [], fn: FN, caps: {cold_source: 'Cold source', weather_handling: 'Weather handling', cold_tolerance: 'Cold tolerance', climbing: 'Climbing'}, read_moves: true}, o);
const sl = (move, how, cat, bp, fns, more) => Object.assign({move, how, type: null, cat, bp, fns, field: [], uses: []}, more || {});
const ICE_TUSK = {name: 'Ice-tusk line', moves: ['Ancient Power', 'Icicle Spear'], conf: 'low', src: 'dossier', of: 'Swinub',
  reading: 'Ancient Power is what a Piloswine needs to become Mamoswine, and Icicle Spear matches the adult\'s ice tusks. A lineage on its way to the ice-age giant.'};
const SNEASEL = [sl('Taunt', 'default', 'Status', 0, ['trick']), sl('Ice Shard', 'egg', 'Physical', 40, ['ambush', 'cold']), sl('Pursuit', 'egg', 'Physical', 40, ['pursuit', 'shadow']), sl('Fake Out', 'egg', 'Physical', 40, ['ambush'])];
const FIXTURES = {
  swinub: fx({species: 'Swinub', defaults: ['Tackle', 'Odor Sleuth'],                 // the spec's Example B: Ancient Power, Hail and Snow Cloak
    slots: [sl('Ancient Power', 'egg', 'Special', 60, ['lithic']), sl('Bite', 'egg', 'Physical', 60, ['shadow']), sl('Hail', 'tm', 'Status', 0, [], {uses: ['cold_source', 'weather_handling']}),
      sl('Powder Snow', 'shared', 'Special', 40, ['cold'], {uses: ['cold_source']})],
    ability: 'Snow Cloak', ability_field: ['weather_handling'], weather: [['Hail', 'Snow Cloak']], evolution: [{move: 'Ancient Power', from: 'Piloswine', to: 'Mamoswine'}],
    canon: {dex: 'It rubs its snout on the ground to find and dig up food. It sometimes discovers hot springs.', dexg: 'heartgold', hab: 'cave', lore: [{capability: 'cold_tolerance', source: 'Pokédex (platinum)'}]},
    own: {cold: 'Ice', lithic: 'Ground'}, lineage: {steps: 2, chain: ['Raticate', 'Mamoswine'], line: 'Swinub', inherits: ['Bite'], only: true}, ecotypes: [ICE_TUSK]}),
  icetusk: fx({species: 'Swinub', defaults: ['Tackle', 'Odor Sleuth'], own: {cold: 'Ice', lithic: 'Ground'}, ecotypes: [ICE_TUSK],   // a dossier's ecotype, carried whole
    slots: [sl('Tackle', 'default', 'Physical', 35, ['brawn']), sl('Odor Sleuth', 'default', 'Status', 0, []), sl('Ancient Power', 'egg', 'Special', 60, ['lithic']), sl('Icicle Spear', 'egg', 'Physical', 10, ['cold'])]}),
  cyndaquil: fx({species: 'Cyndaquil', defaults: ['Tackle', 'Leer'], own: {heat: 'Fire'},          // the spec's Example A: an Extrasensory Cyndaquil
    slots: [sl('Tackle', 'default', 'Physical', 35, ['brawn']), sl('Leer', 'default', 'Status', 0, ['trick']), sl('Extrasensory', 'egg', 'Special', 80, ['mind'])]}),
  thin: fx({species: 'Larvitar', defaults: ['Bite', 'Leer'], own: {lithic: 'Rock', shadow: 'Dark'},   // only the egg's own moves, nothing chosen
    slots: [sl('Bite', 'default', 'Physical', 60, ['shadow']), sl('Leer', 'default', 'Status', 0, ['trick'])]}),
  hunter: fx({species: 'Sneasel', slots: SNEASEL, own: {shadow: 'Dark', cold: 'Ice'}, nature: {name: 'Adamant', up: 'atk', down: 'spa', likes: 'spicy'},   // a hunter's kit, bred for battle
    ivs: {hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31}, purpose: 'competitive'}),
  show: fx({species: 'Sneasel', game: 'platinum', title: 'Platinum', slots: SNEASEL, own: {shadow: 'Dark', cold: 'Ice'}, nature: {name: 'Modest', up: 'spa', down: 'atk', likes: 'dry'},   // the rules' ecotype, and a Contest nature
    ecotypes: [{name: 'Ambush runner', moves: ['Fake Out', 'Ice Shard', 'Pursuit'], fns: ['ambush', 'pursuit'], conf: 'low', src: 'machine', of: 'Sneasel'}]}),
  unobtainable: fx({species: 'Larvitar', obtainable: false, scope: null, own: {lithic: 'Rock', shadow: 'Dark'},   // possible, not obtainable; egg moves that point different ways
    slots: [sl('Bite', 'default', 'Physical', 60, ['shadow']), sl('Leer', 'default', 'Status', 0, ['trick']), sl('Dragon Dance', 'egg', 'Status', 0, ['display']), sl('Pursuit', 'egg', 'Physical', 40, ['pursuit', 'shadow'])]}),
  imported: fx({species: 'Phanpy', scope: 'with a transfer', obtainable_why: 'Swinub learns Body Slam in Emerald (Pal Park or the Time Capsule)', own: {lithic: 'Ground'},
    slots: [sl('Odor Sleuth', 'default', 'Status', 0, []), sl('Tackle', 'default', 'Physical', 35, ['brawn']), sl('Body Slam', 'egg', 'Physical', 85, ['paralytic'])]}),
  work: fx({species: 'Geodude', purpose: 'environment', own: {lithic: 'Rock'},                         // a working line, with too little to read in the moves
    slots: [sl('Tackle', 'default', 'Physical', 35, ['brawn']), sl('Defense Curl', 'default', 'Status', 0, ['armour']), sl('Rock Climb', 'tm', 'Physical', 90, ['brawn'], {field: ['climbing']})]}),
  impossible: fx({species: 'Larvitar', possible: false, obtainable: false, scope: null, slots: [sl('Dragon Dance', null, 'Status', 0, ['display'])]})
};
const READS = {   // what each fixed set must read as: the rules that fire, in order, and sentences word for word
  swinub: {line: ['kit', 'lone', 'weather', 'evolution', 'lineage'], choices: ['work'], says: [
    'Hail and Powder Snow are both cold moves: together they could mark a cold-adapted lineage. Ice is its own type, so this would sharpen what every Swinub already is rather than set the line apart.',
    'Hail calls the weather Snow Cloak works in, and its canon puts Swinub in the cold (cold tolerance in its Platinum Pokédex entry): one reading is a set made for a life in hail and snow. The ability isn\'t passed down, so that half of the fit is this individual\'s, not the line\'s.',
    'Every egg of this set hatches knowing Ancient Power, the move a Piloswine needs to become Mamoswine: one reading is a line bred toward Mamoswine.',
    'Its father has to be bred to Bite first, over 2 generations of fathers (Raticate → Mamoswine → Swinub): as a story, a breeding family that carries the Raticate line\'s move down to this egg.']},
  icetusk: {line: ['ecotype'], choices: [], says: ['The Swinub dossier reads Ancient Power and Icicle Spear as an ecotype, the “Ice-tusk line”: “Ancient Power is what a Piloswine needs to become Mamoswine, and Icicle Spear matches the adult\'s ice tusks.” This set carries both.']},
  cyndaquil: {line: ['lone'], choices: [], says: ['One egg move on its own (Extrasensory) reads best as an individual specialization: nothing else in the set points the same way, so it doesn\'t make a lineage.']},
  thin: {line: [], choices: [], thin: 'Too little to read: the set is only the egg\'s own moves at hatch (Bite and Leer), which every Larvitar egg starts with.'},
  hunter: {line: ['kit'], choices: ['battle'], says: [
    'Ice Shard, Pursuit and Fake Out together make a hunter\'s kit (Ice Shard: ambush strike; Pursuit: pursuit; Fake Out: ambush strike): one reading is a line that catches, stops or robs other animals for a living.',
    'Adamant raises Attack, which Ice Shard, Pursuit and Fake Out use, its Attack IV is 31 and you marked it competitive: the choices could mark a line bred for battle, as a physical attacker.']},
  show: {line: ['ecotype'], choices: ['show'], says: [
    'By the ecotype rules, Fake Out, Ice Shard and Pursuit read as an ecotype, the “Ambush runner”: strikes before the other can act: a sit-and-wait or burst hunter, and runs down what flees: a chaser.',
    'Modest lowers Attack, which Ice Shard, Pursuit and Fake Out use, so it doesn\'t serve these attacks. In Platinum a nature also decides the Poffin flavour it likes (Dry, the one that builds Beauty for Super Contests): one reading is a show line.']},
  unobtainable: {line: ['lone', 'origin'], choices: [], says: ['Its egg moves (Dragon Dance and Pursuit) don\'t point the same way by the ecotype rules: read as one individual\'s mix rather than a lineage.']},
  imported: {line: ['lone', 'origin'], choices: [], says: ['Its pedigree needs a transfer from an earlier generation\'s games: Swinub learns Body Slam in Emerald (Pal Park or the Time Capsule). As a story, an imported line.']},
  work: {line: [], choices: ['work'], thin: 'Too little to read in the moves: Rock Climb (father\'s TM) points nowhere on its own by these rules.',
    says: ['Away from battle, Rock Climb (climbing) has a use: one reading is a working line for the homestead\'s jobs, as its purpose says.']},
  impossible: {line: [], choices: [], thin: 'Too little to read: the hatch rules can\'t make this set, so there\'s no line to read yet.'}
};

await page.goto('file://' + path.join(HERE, 'dist', 'Blackthorn-HQ-preview.html') + '#/');
await settle();
await page.evaluate(() => { Object.keys(localStorage).filter((k) => /^bt-(preview-tabs|draft:stock)/.test(k)).forEach((k) => localStorage.removeItem(k)); });

// 0. what a set might suggest, on fixed sets (A-09): the rules that fire, their sentences, and too little to read
const reads = await page.evaluate((F) => { const o = {_rules: Object.keys(READ_RULES)}; Object.keys(F).forEach((k) => { o[k] = stockInterpret(F[k]); }); return o; }, FIXTURES);
Object.keys(READS).forEach((k) => { const r = reads[k], w = READS[k], all = r.line.concat(r.choices);
  expect(k + ': the rules that fire (' + r.line.map((x) => x.rule) + ' | ' + r.choices.map((x) => x.rule) + ')',
    JSON.stringify(r.line.map((x) => x.rule)) === JSON.stringify(w.line) && JSON.stringify(r.choices.map((x) => x.rule)) === JSON.stringify(w.choices));
  (w.says || []).forEach((x) => expect(k + ': reads "' + x.slice(0, 70) + '…"', all.some((y) => y.text === x)));
  expect(k + ': too little to read (' + r.thin + ')', (r.thin || null) === (w.thin || null));
  expect(k + ': each reading names its rule, its confidence and what it rests on', all.every((x) => reads._rules.indexOf(x.rule) >= 0 && x.conf && x.rests.length));
  expect(k + ': worded as a reading, never as fact', all.every((x) => /could|one reading|\breads?\b|as a story/i.test(x.text)));
});

// 1. what can a line's eggs start with?
await go('#/stock', '#stpick');
expect('the stock page lists its four answers', /Possible/.test(await text()) && /Documented/.test(await text()));
await go('#/stock/heartgold/Tyranitar', '.card');                       // the adult reads what hatches
let t = await text();
expect('Tyranitar opens the Larvitar catalogue', /What a Larvitar egg can start with/.test(t));
expect('the catalogue lists Dragon Dance and its fathers', /Dragon Dance/.test(t) && /Carried together by one father/.test(t));
expect('B27: Outrage is also learnable without breeding', /Outrage[\s\S]{0,400}Also learnable without breeding: the move tutor teaches it \(Tyranitar\)/.test(t));
await go('#/stock/heartgold/Swinub', '.card');
expect('Swinub: Piloswine needs Ancient Power to evolve', /Piloswine evolves into Mamoswine only while it knows Ancient Power/.test(await text()));
await go('#/stock/crystal/Swinub', '.card');
expect('B26: Crystal has no Mamoswine', !/Mamoswine/.test(await text()));

// 2. how do I make this exact set?
await go('#/stock/heartgold/Swinub/design?m=' + ['Ancient Power', 'Hail', 'Bite', 'Powder Snow'].map(encodeURIComponent).join('|'), '#stres .card');
t = await text();
expect('the Swinub set is possible and obtainable', /1 · Possible under the hatch rules[^\n]*\n?[^\n]*Yes/.test(t) && /2 · Obtainable in the generation[\s\S]{0,80}Yes/.test(t));
expect('the egg lists four slots', (t.match(/slot \d/g) || []).length === 4);
expect('the father\'s lineage reads as steps', /The father's lineage/.test(t) && /Breed the last father/.test(t));
expect('A-09: the set is read, by rule, under its evidence', /Interpretation/i.test(t) && /Hail and Powder Snow are both cold moves/.test(t) && !/calls the weather Snow Cloak works in/.test(t));
await page.selectOption('#stform [name=ability]', 'Snow Cloak');
await page.waitForTimeout(500);
t = await text();
expect('what it might suggest: Hail and Snow Cloak, and Ancient Power for Mamoswine', /Hail and Snow Cloak/.test(t) && /Ancient Power is what lets Piloswine become Mamoswine/.test(t));
expect('A-09: the reading follows the edit (Snow Cloak joins Hail)', /Hail calls the weather Snow Cloak works in/.test(t) && /hatches knowing Ancient Power, the move a Piloswine needs to become Mamoswine/.test(t));
const readRows = await page.evaluate(() => [...[...document.querySelectorAll('#stres .card')].pop().querySelectorAll('.biost')].map((r) => r.innerText));
expect('A-09: every reading on the page is marked a hypothesis and says what it rests on (' + readRows.length + ')', readRows.length >= 4 && readRows.every((r) => /hypothesis/.test(r) && /rests on/.test(r)));
await page.fill('#stform [name=name]', 'Cold-adapted test');
await page.fill('#stform [name=labels]', 'hail, test');
await page.click('#stform [data-save=new]');
await settle('#sthatch');
const bpId = await page.evaluate(() => decodeURIComponent((NAVI.hash.match(/#\/stock\/bp\/(.+)$/) || [])[1] || ''));
expect('saving opens the blueprint (' + bpId + ')', /^yours:Swinub-/.test(bpId));
// a second version: Bite becomes Take Down (saved moves are in hatch order, so find Bite's slot)
const biteAt = await page.evaluate(() => [...document.querySelectorAll('#stform [data-mv]')].findIndex((x) => x.value === 'Bite'));
await page.selectOption('#stform [data-mv="' + biteAt + '"]', 'Take Down');
await page.waitForTimeout(400);
await page.click('#stform [data-save=next]');
await page.waitForFunction((id) => Records.versions(id).length === 2 && /Save as v3/.test(document.getElementById('page').innerText), bpId, { timeout: 60000 }).catch(() => {});
await settle('#sthatch');
const nv = await page.evaluate((id) => Records.versions(id).length, bpId);
expect('a save adds a version and keeps the old one (' + nv + ')', nv === 2);
// 3. record a hatch: its hatch moves stay
await page.click('#sthatch');
await settle('.mhero');
t = await text();
expect('the hatched Pokémon shows what it hatched with', /Where it came from/.test(t) && /Hatched with/.test(t) && /Bred to the blueprint/.test(t));
await go('#/stock/bp/' + encodeURIComponent(bpId), '#stres .card');
expect('the blueprint is documented now', /4 · Documented in your collection[\s\S]{0,60}Yes/.test(await text()));

// 4. what makes two sets different?
await go('#/stock/heartgold/Swinub/design?m=' + ['Ancient Power', 'Hail'].map(encodeURIComponent).join('|'), '#stres .card');
await page.click('#stform [data-save=new]');
await settle('#sthatch');
const bp2 = await page.evaluate(() => decodeURIComponent((NAVI.hash.match(/#\/stock\/bp\/(.+)$/) || [])[1] || ''));
await go('#/stock/compare/' + encodeURIComponent(bpId) + '/' + encodeURIComponent(bp2), '.card');
t = await text();
expect('compare names the differences', /What makes these two different/.test(t) && /The (first|second) starts with/.test(t));
await go('#/stock', '#stpick');
expect('your blueprints are listed', /Cold-adapted test/.test(await text()));

// possible is not obtainable
await go('#/stock/heartgold/Larvitar/design?m=' + ['Dragon Dance', 'Pursuit'].map(encodeURIComponent).join('|'), '#stres .card', true);
t = await text();
expect('Dragon Dance with Pursuit: possible, not obtainable', /1 · Possible under the hatch rules[\s\S]{0,60}Yes/.test(t) && /2 · Obtainable in the generation[\s\S]{0,60}No/.test(t));

// what a set might suggest on the page (A-09): the spec's Example A, and a set with too little to read
await go('#/stock/heartgold/Cyndaquil/design?m=Extrasensory', '#stres .card');
expect('Example A: an Extrasensory Cyndaquil reads as an individual specialization', /One egg move on its own \(Extrasensory\) reads best as an individual specialization/.test(await text()));
await go('#/stock/heartgold/Larvitar/design', '#stres .card');
expect('only the egg\'s own moves: too little to read', /Too little to read: the set is only the egg's own moves at hatch \(Bite and Leer\), which every Larvitar egg starts with\./.test(await text()));

// the breeding lab's Mamoswine line reads through the stock engine (B27 included). v2 (D-078): the fresh start hides the
// proposed lines, so the test puts Zack's example back from its archive (engine/store/proposed_lines.json) in this browser
const proposed = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'store', 'proposed_lines.json'), 'utf8')).lines;
await page.evaluate((l) => { S.store.proposed_lines = l; }, proposed);
await go('#/lines/mamoswine-ancient-power', '.card');
t = await text();
expect('the Mamoswine line: Ancient Power is an egg move and also the tutor', /Ancient Power[\s\S]{0,200}egg move[\s\S]{0,300}Also learnable without breeding:[^\n]*tutor/.test(t));
expect('the Mamoswine line: Hail comes from the father\'s TM', /Hail[\s\S]{0,80}father's TM/.test(t));
expect('the Mamoswine line: Piloswine needs Ancient Power', /Piloswine evolves into Mamoswine only while it knows Ancient Power/.test(t));

await browser.close();
if (errors.length) fails.push('page errors: ' + errors.join(' || '));
console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'ok: breeding stock answers the four questions, saves, versions, hatches and compares');
process.exit(fails.length ? 1 : 0);
