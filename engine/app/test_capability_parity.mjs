// The browser's capability assessments (web/34_capability.html) against capability/assess.py: world readiness,
// cartridge readiness, lock-and-optimise, comparisons and facility assessments, on a fixed grid of your teams,
// scenarios, kits, previews and staff plans, value for value.
// Run: python3 -I app/capability_pack.py --parity /tmp/cap.json && node app/test_capability_parity.mjs /tmp/cap.json
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const py = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const part = (f) => fs.readFileSync(path.join(HERE, 'web', f), 'utf8').replace(/^<script>/, '').replace(/<\/script>\s*$/, '');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(part('34_capability.html') + '\nthis.Cap = Cap;', ctx);
const Cap = ctx.Cap.init(JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'capability.json'), 'utf8')));

const norm = (x) => JSON.parse(JSON.stringify(x));
function diff(a, b, at) {
  if (a === b) return null;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return at + ': ' + JSON.stringify(a).slice(0, 160) + ' != ' + JSON.stringify(b).slice(0, 160);
  if (Array.isArray(a) !== Array.isArray(b)) return at + ': array vs object';
  if (Array.isArray(a)) {
    if (a.length !== b.length) return at + ': length ' + a.length + ' != ' + b.length;
    for (let i = 0; i < a.length; i++) { const d = diff(a[i], b[i], at + '[' + i + ']'); if (d) return d; }
    return null;
  }
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  if (ka.join() !== kb.join()) return at + ': keys ' + ka.join(',') + ' != ' + kb.join(',');
  for (const k of ka) { const d = diff(a[k], b[k], at + '.' + k); if (d) return d; }
  return null;
}
const run = {
  world: (g, sc, m, kit, pv) => Cap.worldReport(g, sc, m, kit, pv),
  cartridge: (g, m, moves) => Cap.cartridgeReport(g, m, moves),
  recommend: (g, sc, m, kit, pv, pool) => Cap.recommend(g, sc, m, kit, pv, pool),
  compare: (g, sc, a, b) => Cap.compare(g, sc, a, b),
  facility: (f, staff, pool, pv) => Cap.facilityReport(f, staff, pool, pv),
  compare_staff: (f, a, b, pv) => Cap.compareStaff(f, a, b, pv),
};
const fails = [];
const counts = {};
for (const c of py.cases) {
  counts[c.fn] = (counts[c.fn] || 0) + 1;
  const got = norm(run[c.fn](...c.args));
  const d = diff(got, c.want, c.fn);
  if (d) fails.push(d + '  (args ' + JSON.stringify(c.args).slice(0, 120) + ')');
}
console.log(fails.length ? 'FAIL ' + fails.length + '/' + py.cases.length + '\n' + fails.slice(0, 8).join('\n')
  : 'ok: ' + py.cases.length + ' capability assessments identical (' + Object.entries(counts).map(([k, v]) => v + ' ' + k).join(', ') + ')');
process.exit(fails.length ? 1 : 0);
