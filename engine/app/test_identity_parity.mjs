// The browser's battle identity (web/37_identity.html) against Python's trainers/identity.py, build by build: the browser
// fights each build again (28_teamroles, with @smogon/calc in the page), reads its context and Speed the way the builder
// does, and must name it exactly as Python does, with the same facts, functions, alternatives and near misses.
// Run: python3 -I trainers/identity.py --parity py.json [ids] && node app/test_identity_parity.mjs py.json
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const py = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const read = (f) => JSON.parse(fs.readFileSync(path.join(HERE, 'data', f), 'utf8'));
const engineFile = (f) => JSON.parse(fs.readFileSync(path.join(HERE, '..', 'trainers', f), 'utf8'));
const part = (f) => fs.readFileSync(path.join(HERE, 'web', f), 'utf8').replace(/^<script>/, '').replace(/<\/script>\s*$/, '');
const ctx = { S: {}, console, Buffer, numOf: () => null };
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(read('calc.json').code, ctx);
for (const [f, name] of [['25_scout.html', 'Scout'], ['27_battle.html', 'Battle'], ['28_teamroles.html', 'TeamRoles'],
  ['29_recognition.html', 'Recognize'], ['37_identity.html', 'Identity']]) vm.runInContext(part(f) + `\nthis.${name} = ${name};`, ctx);
const Scout = ctx.Scout.init(read('scout.json')) || ctx.Scout;
ctx.Battle.init(read('battle.json'), ctx.calc);
const pack = read('roles4.json');
pack.config = engineFile('team_roles.json');          // the rules as they stand, not as the last pack was built
ctx.TeamRoles.init(pack, Scout, ctx.Battle);
ctx.Recognize.init(engineFile('recognition.json'), Scout, ctx.Battle);
ctx.Identity.init(engineFile('identity.json'), pack.config, ctx.Battle);

function sortKeys(o) { if (Array.isArray(o)) return o.map(sortKeys); if (o && typeof o === 'object') { const r = {}; Object.keys(o).sort().forEach((k) => { r[k] = sortKeys(o[k]); }); return r; } return o; }
const J = (x) => JSON.stringify(sortKeys(x));
let bad = 0, checked = 0;
function same(where, a, b) {
  checked++;
  const A = J(a), B = J(b);
  if (A !== B) {
    bad++;
    if (bad <= 25) { let k = 0; while (k < A.length && A[k] === B[k]) k++; console.log('DIFF', where, '\n  py:', B.slice(Math.max(0, k - 160), k + 260), '\n  js:', A.slice(Math.max(0, k - 160), k + 260)); }
  }
}
const t0 = Date.now();
const reads = ctx.TeamRoles.readMany(py.builds.map((x) => ({ build: x.build, game: x.game })));
const level = pack.config.level;
for (const x of py.builds) {
  const b = x.build, r = reads[b.id], p = py.decisions[b.id];
  let d;
  if (!r || r.error) d = ctx.Identity.unknown(b.id, b.species, x.game, (r || {}).error || 'no League fights in this read yet');
  else {
    const filled = Object.assign({}, b, { moves: r.moves.slice(), level });
    const c = ctx.Scout.roleContext(filled, x.game, level, null);
    d = ctx.Identity.evaluate(b.id, b.species, x.game, r, c, ctx.Recognize.read(b, r).speed);
  }
  for (const f of Object.keys(p)) same(`${b.id} ${f}`, d[f], p[f]);
  same(`${b.id} keys`, Object.keys(d).sort(), Object.keys(p).sort());
}
const names = py.builds.map((x) => `${x.build.id.replace('pilot:', '')} ${py.decisions[x.build.id].headline ? py.decisions[x.build.id].headline.name : '-'}`);
console.log(names.join('\n'));
console.log(`${checked - bad}/${checked} checks match Python over ${py.builds.length} builds; ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(bad ? 1 : 0);
