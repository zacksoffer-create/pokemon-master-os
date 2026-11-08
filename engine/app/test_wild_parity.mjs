// The browser's Wild (web/41_wild.html) against Python's wilderness/expedition.py: every place's profile, plans, seeded
// runs and odds for a spread of places, teams and seasons, and the estate's year, number for number.
// Run: python3 -I wilderness/expedition.py --parity py.json && node app/test_wild_parity.mjs py.json
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
vm.runInContext(read('calc.json').code, ctx);
for (const [f, name] of [['27_battle.html', 'Battle'], ['34_capability.html', 'Cap'], ['41_wild.html', 'Wild']]) vm.runInContext(part(f) + `\nthis.${name} = ${name};`, ctx);
ctx.Battle.init(read('battle.json'), ctx.calc);
const Cap = ctx.Cap.init(read('capability.json'));
const Wild = ctx.Wild.init(read('wild.json'), Cap);

function sortKeys(o) { if (Array.isArray(o)) return o.map(sortKeys); if (o && typeof o === 'object') { const r = {}; Object.keys(o).sort().forEach((k) => { r[k] = sortKeys(o[k]); }); return r; } return o; }
const J = (x) => JSON.stringify(sortKeys(x));
let bad = 0, checked = 0;
function same(where, a, b) {
  checked++;
  const A = J(a), B = J(b);
  if (A !== B) { bad++; if (bad <= 20) { let k = 0; while (k < A.length && A[k] === B[k]) k++; console.log('DIFF', where, '\n  py:', B.slice(Math.max(0, k - 160), k + 240), '\n  js:', A.slice(Math.max(0, k - 160), k + 240)); } }
}
const t0 = Date.now();
for (const [pid, p] of Object.entries(py.profiles)) same(`profile ${pid}`, Wild.profile(pid, 'heartgold'), p);
for (const c of py.cases) {
  const pl = Wild.plan('heartgold', c.place, c.members, c.kit, c.season, c.days, c.residents);
  for (const f of Object.keys(c.plan)) same(`${c.place} plan ${f}`, pl[f], c.plan[f]);
  c.runs.forEach((r, i) => same(`${c.place} run ${i + 1}`, Wild.simulate('heartgold', pl, c.members, r.seed), r));
  same(`${c.place} odds`, Wild.odds('heartgold', pl, c.members, 8), c.odds);
}
const E = py.estate;
for (const [s, card] of Object.entries(E.seasons)) same(`season ${s}`, Wild.seasonCard(s, E.household), card);
same('stores', Wild.stores(E.crops, E.household), E.stores[0]);
same('stores 8 plots', Wild.stores(E.crops, E.household, 8), E.stores[1]);
same('day', Wild.day(E.household, E.jobs), E.day);
console.log(py.cases.map((c) => `${c.place} (${c.season}, ${c.days}d): ${c.odds.completed}/${c.odds.runs} completed, ${c.plan.route.by} ${c.plan.route.days}d each way`).join('\n'));
console.log(`${checked - bad}/${checked} checks match Python over ${Object.keys(py.profiles).length} places and ${py.cases.length} expeditions; ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(bad ? 1 : 0);
