// The browser's recognition (web/29_recognition.html: tags, badges, archetypes, qualifications) against Python's
// trainers/recognition.py, build by build, over the same stored team-role reads (app/data/roles4.json).
// Run: python3 -I trainers/recognition.py --parity py.json [ids] && node app/test_recognition_parity.mjs py.json
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
vm.runInContext(part('29_recognition.html') + '\nthis.Recognize = Recognize;', ctx);
const Scout = ctx.Scout.init(read('scout.json'));
ctx.Battle.init(read('battle.json'), ctx.calc);
ctx.Recognize.init(JSON.parse(fs.readFileSync(path.join(HERE, '..', 'trainers', 'recognition.json'), 'utf8')), Scout || ctx.Scout, ctx.Battle);
const pack = read('roles4.json');

function sortKeys(o) { if (Array.isArray(o)) return o.map(sortKeys); if (o && typeof o === 'object') { const r = {}; Object.keys(o).sort().forEach((k) => { r[k] = sortKeys(o[k]); }); return r; } return o; }
const J = (x) => JSON.stringify(sortKeys(x));
let bad = 0, checked = 0;
function same(where, a, b) {
  checked++;
  const A = J(a), B = J(b);
  if (A !== B) {
    bad++;
    if (bad <= 25) { let k = 0; while (k < A.length && A[k] === B[k]) k++; console.log('DIFF', where, '\n  py:', B.slice(Math.max(0, k - 160), k + 240), '\n  js:', A.slice(Math.max(0, k - 160), k + 240)); }
  }
}
const t0 = Date.now();
for (const x of py) {
  const r = ctx.Recognize.read(x.build, x.read || pack.reads[x.read_id]);
  for (const f of ['stats', 'speed', 'badges', 'tags', 'qualifications', 'archetype', 'types', 'version']) same(`${x.read_id} ${f}`, r[f], x.recognition[f]);
  same(`${x.read_id} summary`, ctx.Recognize.summary(r), x.summary);
}
console.log(`${checked - bad}/${checked} checks match Python over ${py.length} builds; ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(bad ? 1 : 0);
