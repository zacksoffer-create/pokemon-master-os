// The browser's five team roles (v2) and build names (web/28_teamroles.html, on top of 25_scout and 27_battle with
// @smogon/calc in the page) against Python's trainers/team_roles.py, build by build, number for number.
// Run: python3 -I trainers/team_roles.py --parity py.json [ids] && node app/test_roles4_parity.mjs py.json
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
vm.runInContext(part('25_scout.html') + '\nthis.Scout = Scout;', ctx);
vm.runInContext(part('27_battle.html') + '\nthis.Battle = Battle;', ctx);
vm.runInContext(part('28_teamroles.html') + '\nthis.TeamRoles = TeamRoles;', ctx);
const Scout = ctx.Scout.init(read('scout.json'));
ctx.Battle.init(read('battle.json'), ctx.calc);
const pack = read('roles4.json');
if (py.overrides) pack.config.overrides = py.overrides;   // the same hand overrides on both sides
ctx.TeamRoles.init(pack, Scout || ctx.Scout, ctx.Battle);

const J = (x) => JSON.stringify(x);
let bad = 0, checked = 0;
function same(where, a, b) {
  checked++;
  if (J(a) !== J(b)) {
    bad++;
    if (bad <= 30) { const A = J(a), B = J(b); let k = 0; while (k < A.length && A[k] === B[k]) k++;
      console.log('DIFF', where, '\n  py:', B.slice(Math.max(0, k - 150), k + 250), '\n  js:', A.slice(Math.max(0, k - 150), k + 250)); }
  }
}
const t0 = Date.now();
const js = ctx.TeamRoles.readMany(py.builds.map((x) => ({ build: x.build, game: x.game })));
for (const [id, p] of Object.entries(py.reads)) {
  const r = js[id];
  if (!r) { same(id + ' missing', null, true); continue; }
  for (const f of ['species', 'game', 'gen', 'moves', 'filled_moves', 'earned', 'second_layer', 'name', 'facts', 'evidence']) same(`${id} ${f}`, r[f], p[f]);
  p.roles.forEach((role, i) => same(`${id} role ${role.role}`, r.roles[i], role));
}
console.log(`${checked - bad}/${checked} checks match Python over ${Object.keys(py.reads).length} builds; ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(bad ? 1 : 0);
