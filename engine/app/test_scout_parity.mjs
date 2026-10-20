// The browser's scouting engine (web/25_scout.html) against Python's trainers/report.py, version by version.
// Run: python3 -I <dump> py.json && node app/test_scout_parity.mjs py.json   (tests/test_engines.py does both)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const py = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const pack = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'scout.json'), 'utf8'));
const code = fs.readFileSync(path.join(HERE, 'web', '25_scout.html'), 'utf8').replace(/^<script>/, '').replace(/<\/script>\s*$/, '');
const ctx = { S: {}, console, Math, JSON, Object, Array, String, Number, Error, numOf: () => null };
vm.createContext(ctx);
vm.runInContext(code + '\nthis.Scout = Scout;', ctx);
const Scout = ctx.Scout.init(JSON.parse(JSON.stringify(pack)));
const J = x => JSON.stringify(x);
let bad = 0, checked = 0;
function same(where, a, b) { checked++; if (J(a) !== J(b)) { bad++; if (bad <= 40) { const A = J(a), B = J(b); let k = 0; while (k < A.length && A[k] === B[k]) k++; console.log('DIFF', where, '\n  py:', B.slice(Math.max(0, k - 200), k + 300), '\n  js:', A.slice(Math.max(0, k - 200), k + 300)); } } }
const texts = sec => Object.fromEntries(Object.entries(sec).map(([k, v]) => [k, v.map(p => [p.rule, p.text])]));
for (const [key, p] of Object.entries(py.reports)) {
  const [tid, vid] = key.split('/');
  const r = Scout.report(Scout.version(tid, vid));
  same(key + ' sliders', r.sliders, p.sliders);
  same(key + ' tags', r.tags, p.tags);
  same(key + ' clashes', r.nature_clashes, p.nature_clashes);
  same(key + ' types', r.matrix.types, p.matrix.types);
  r.matrix.rows.forEach((row, i) => {
    const q = p.matrix.rows[i];
    for (const f of ['species', 'types', 'ability', 'level', 'stats', 'bulk', 'cells', 'defaults_used', 'move_basis', 'flags']) same(`${key} row ${i} ${f}`, row[f], q[f]);
  });
  same(key + ' summary', r.matrix.summary, p.matrix.summary);
  same(key + ' plan', texts(r.plan), texts(p.plan));
  same(key + ' plan triggers', Object.values(r.plan).flat().map(x => x.trigger), Object.values(p.plan).flat().map(x => x.trigger));
  const s = r.playsheet, t = p.playsheet;
  same(key + ' career', s.career, t.career);
  same(key + ' roles', s.roles.map(x => [x.species, x.primary, x.secondary, x.also, x.why]), t.roles.map(x => [x.species, x.primary, x.secondary, x.also, x.why]));
  for (const f of ['ace', 'go_to', 'type_read', 'combos', 'signature_moves', 'aggression', 'weather', 'film', 'ladder', 'ladder_lines']) same(`${key} sheet ${f}`, s[f], t[f]);
  same(key + ' sheet text', texts(s.text), texts(t.text));
}
let vn = 0;
for (const v of py.variants || []) {
  vn++;
  const [tid, vid] = v.base.split('/');
  const base = Scout.version(tid, vid), key = 'fuzz' + vn;
  const ver = Object.assign(base, {id: key, title: base.title + ' (variant)', sliders: v.sliders, roles: v.roles, overrides: {}, notes: [], observed: {n: 0},
    team: v.team.map(b => Object.assign({}, b, {_edited: true}))});
  let r;
  try { r = Scout.report(ver, {level: v.level}); } catch (e) { bad++; console.log('ERROR', key, v.base, e.message); continue; }
  const p = v.report, where = `${key} (${v.base})`;
  same(where + ' sliders', r.sliders, p.sliders);
  same(where + ' tags', r.tags, p.tags);
  same(where + ' clashes', r.nature_clashes, p.nature_clashes);
  r.matrix.rows.forEach((row, i) => { const q = p.matrix.rows[i];
    for (const f of ['species', 'types', 'ability', 'level', 'stats', 'bulk', 'cells', 'defaults_used']) same(`${where} row ${i} ${f}`, row[f], q[f]); });
  same(where + ' summary', r.matrix.summary, p.matrix.summary);
  same(where + ' plan', texts(r.plan), texts(p.plan));
  const s = r.playsheet, t = p.playsheet;
  same(where + ' roles', s.roles.map(x => [x.species, x.primary, x.secondary, x.also, x.why]), t.roles.map(x => [x.species, x.primary, x.secondary, x.also, x.why]));
  for (const f of ['ace', 'go_to', 'type_read', 'combos', 'signature_moves', 'aggression', 'weather', 'film', 'ladder_lines']) same(`${where} sheet ${f}`, s[f], t[f]);
  same(where + ' sheet text', texts(s.text), texts(t.text));
}
for (const [key, e] of Object.entries(py.exposure)) {
  if (e.error) continue;
  const [m, th] = key.split('|');
  const x = Scout.exposure(Scout.version(...m.split('/')), Scout.version(...th.split('/')));
  for (const f of ['their_types', 'their_side', 'most_exposed', 'lines']) same(`exposure ${key} ${f}`, x[f], e[f]);
  same(`exposure ${key} rows`, x.rows.map(r => [r.member, r.hits, r.soft_match, r.lines]), e.rows.map(r => [r.member, r.hits, r.soft_match, r.lines]));
}
console.log(`${checked - bad} of ${checked} match`);
process.exit(bad ? 1 : 0);
