// The browser's organism (web/44_organism.html) against Python's biology/organism.py: every species' sheet, learn
// origins over a spread of species, moves and games, portraits, characteristics, exposure across species, places and
// weather, and camps with their journal lines, value for value.
// Run: python3 -I biology/organism.py --parity py.json && node app/test_organism_parity.mjs py.json
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const py = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const read = (f) => JSON.parse(fs.readFileSync(path.join(HERE, 'data', f), 'utf8'));
const part = (f) => fs.readFileSync(path.join(HERE, 'web', f), 'utf8').replace(/^<script>/, '').replace(/<\/script>\s*$/, '');
const ctx = { S: {}, console, Buffer, numOf: () => null };
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const [f, name] of [['34_capability.html', 'Cap'], ['44_organism.html', 'Organism']]) vm.runInContext(part(f) + `\nthis.${name} = ${name};`, ctx);   // no battle pack: the pages don't load it
const Cap = ctx.Cap.init(read('capability.json'));
const wild = read('wild.json');
const Org = ctx.Organism.init(read('organism.json'), read('breeding.json'), Cap, wild);

function sortKeys(o) { if (Array.isArray(o)) return o.map(sortKeys); if (o && typeof o === 'object') { const r = {}; Object.keys(o).sort().forEach((k) => { r[k] = sortKeys(o[k]); }); return r; } return o; }
const J = (x) => JSON.stringify(sortKeys(x));
let bad = 0, checked = 0;
function same(where, a, b) {
  checked++;
  const A = J(a), B = J(b);
  if (A !== B) { bad++; if (bad <= 20) { let k = 0; while (k < A.length && A[k] === B[k]) k++; console.log('DIFF', where, '\n  py:', B.slice(Math.max(0, k - 160), k + 240), '\n  js:', A.slice(Math.max(0, k - 160), k + 240)); } }
}
const t0 = Date.now();
for (const [nm, sh] of Object.entries(py.sheets)) same(`sheet ${nm}`, Org.sheet(nm), sh);
for (const x of py.learn) same(`learn ${x.species} ${x.move} ${x.game}`, Org.learnOrigin(x.species, x.move, x.game), x.out);
for (const x of py.portraits) same(`portrait ${x.member.species} ${x.game}`, Org.portrait(x.game, x.member, x.build, x.ind), x.out);
for (const x of py.chars) same(`characteristic ${J(x.ivs)}`, Org.characteristic(x.ivs), x.out);
for (const x of py.exposure) same(`exposure ${x.species} ${x.place} ${x.weather}`, Org.exposure('heartgold', x.species, x.ability, wild.places[x.place], x.weather), x.out);
for (const x of py.camps) {
  same(`camp ${x.members[0].species} ${x.place} ${x.weather} [${x.kit}]`, Org.camp('heartgold', x.members, x.kit, wild.places[x.place], x.weather), x.camp);
  same(`camp events ${x.members[0].species} ${x.place} ${x.weather} [${x.kit}]`, Org.campEvents('heartgold', x.members, x.kit, wild.places[x.place], x.weather), x.events);
}
const machines = py.learn.filter((x) => x.out.some((o) => o.how === 'machine')).length, eggs = py.learn.filter((x) => x.out.some((o) => o.how === 'egg')).length;
console.log(`${checked - bad}/${checked} checks match Python: ${Object.keys(py.sheets).length} sheets, ${py.learn.length} learn origins (${machines} by machine, ${eggs} by egg), ` +
  `${py.portraits.length} portraits, ${py.chars.length} characteristics, ${py.exposure.length} exposures, ${py.camps.length} camps; ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(bad ? 1 : 0);
