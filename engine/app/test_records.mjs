// Your records' row formats and merge (web/21_records.html) against engine/store/personal.py: the same rows decode to
// the same records in both, and a saved version lays over the starting records the way store/migrate.py merges it.
// Run: python3 -I store/personal.py --fixture /tmp/rec.json && node app/test_records.mjs /tmp/rec.json   (tests run it)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const mem = {};
const ctx = { console, Math, JSON, Object, Array, String, Number, Date, Promise,
  localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } } };
const tabs = {};
ctx.API = { tab: (n) => Promise.resolve((tabs[n] || []).slice()), append: (n, o) => { (tabs[n] = tabs[n] || []).push(JSON.parse(JSON.stringify(o))); return Promise.resolve({ ok: true }); } };
ctx.store = (k, v) => { if (v === undefined) return mem['bt-' + k] ? JSON.parse(mem['bt-' + k]) : null; mem['bt-' + k] = JSON.stringify(v); };
vm.createContext(ctx);
const code = fs.readFileSync(path.join(HERE, 'web', '21_records.html'), 'utf8').replace(/^<script>/, '').replace(/<\/script>\s*$/, '');
vm.runInContext(code + '\nthis.Records = Records;', ctx);
const R = ctx.Records, fails = [];
const same = (what, a, b) => { const x = JSON.stringify(sortKeys(a)), y = JSON.stringify(sortKeys(b)); if (x !== y) fails.push(`${what}\n py: ${y}\n js: ${x}`); };
function sortKeys(o) { if (Array.isArray(o)) return o.map(sortKeys); if (o && typeof o === 'object') { const r = {}; Object.keys(o).sort().forEach((k) => { r[k] = sortKeys(o[k]); }); return r; } return o; }

// 1. formats: what Python writes, the browser reads the same way (and the other way round)
same('build row decodes', R.decBuild(fx.rows.build), fx.decoded.build);
same('individual row decodes', R.decIndividual(fx.rows.individual), fx.decoded.individual);
same('blank spread decodes', R.decBuild(fx.rows.blank_spread), fx.decoded.blank_spread);
same('stats encode', R.encStats({ atk: 252, spe: 252, hp: 4 }), fx.stats.enc);
same('stats decode', R.decStats('4/252/0/0/0/252'), fx.stats.dec);
same('build row round trip', R.encBuild(R.decBuild(fx.rows.build)), fx.rows.build);
same('individual row round trip', R.encIndividual(R.decIndividual(fx.rows.individual)), fx.rows.individual);

// 2. merge: a seed build gets a second version; a new build and individual are added; drafts survive
ctx.S = { store: { builds: { 'yours:heartgold/Tyranitar': { id: 'yours:heartgold/Tyranitar', species: 'Tyranitar', generation: 4, game: 'heartgold', moves: ['Dragon Dance', 'Crunch', 'Earthquake', 'Outrage'], provenance: 'yours', origin: 'canon/builds.json heartgold.Tyranitar' } },
  individuals: { 'me:heartgold/Tyranitar': { id: 'me:heartgold/Tyranitar', species: 'Tyranitar', game: 'heartgold', build: 'yours:heartgold/Tyranitar', ball: 'Poké Ball' } }, teams: {}, versions: {} } };
R.init(ctx.S.store);
await R.load();
if (ctx.S.store.builds['yours:heartgold/Tyranitar'].moves.length !== 4) fails.push('load should publish the merged view as S.store');
const v2 = await R.saveBuild(Object.assign({}, ctx.S.store.builds['yours:heartgold/Tyranitar'], { moves: ['Dragon Dance', 'Stone Edge', 'Earthquake', 'Outrage'] }), { note: 'Stone Edge over Crunch' });
if (v2.v !== 2) fails.push('the second save of a seed build should be v2, got v' + v2.v);
const vs = R.versions('yours:heartgold/Tyranitar');
if (vs.length !== 2 || vs[0].moves[1] !== 'Crunch' || vs[1].moves[1] !== 'Stone Edge') fails.push('versions: ' + JSON.stringify(vs.map((x) => [x.v, x.moves])));
if (R.view().builds['yours:heartgold/Tyranitar'].origin !== 'canon/builds.json heartgold.Tyranitar') fails.push('the current version lost its origin');
const nb = await R.saveBuild({ species: 'Larvitar', game: 'heartgold', generation: 4, moves: ['Dragon Dance'] }, { asNew: true, parent: 'yours:heartgold/Tyranitar@2' });
if (!/^yours:Larvitar-/.test(nb.id) || nb.v !== 1 || nb.parent !== 'yours:heartgold/Tyranitar@2') fails.push('a new build: ' + JSON.stringify(nb));
const ind = await R.saveIndividual({ species: 'Larvitar', game: 'heartgold', build: nb.id, nickname: 'Pebble', shiny: true });
if (!/^me:heartgold\/Larvitar-/.test(ind.id) || !ind.shiny || ind.nickname !== 'Pebble') fails.push('a new individual: ' + JSON.stringify(ind));
await R.saveIndividual(Object.assign({}, R.view().individuals['me:heartgold/Tyranitar'], { nickname: 'Rex' }));
if (R.view().individuals['me:heartgold/Tyranitar'].nickname !== 'Rex' || R.view().individuals['me:heartgold/Tyranitar'].ball !== 'Poké Ball') fails.push('an individual update should keep its other fields');
// a fresh load from the tabs alone gives the same view (the rows are the whole truth)
const again = await R.load(true);
same('reloaded builds', again.builds, R.build(again.live).builds);
if (R.versions('yours:heartgold/Tyranitar').length !== 2) fails.push('versions lost on reload');
R.setDraft('x', { species: 'Snorlax' });
if (!R.draft('x') || R.draft('x').build.species !== 'Snorlax') fails.push('drafts');
R.clearDraft('x'); if (R.draft('x')) fails.push('a cleared draft came back');
const t = await R.saveTeam({ game: 'heartgold', title: 'Winter six', slots: [{ species: 'Tyranitar', from: 'yours:heartgold/Tyranitar@2' }, null] });
if (!R.view().teams[t.id] || R.view().teams[t.id].slots[0].from !== 'yours:heartgold/Tyranitar@2') fails.push('a saved team: ' + JSON.stringify(t));
// 3. the rows Python's snapshot reader gets are exactly what was appended
fs.writeFileSync(process.argv[2].replace(/\.json$/, '') + '.tabs.json', JSON.stringify(tabs));

for (const f of fails) console.log('FAIL', f);
console.log(fails.length ? `${fails.length} failures` : 'records: formats match Python, versions and merges hold');
process.exit(fails.length ? 1 : 0);
