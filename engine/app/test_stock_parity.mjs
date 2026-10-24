// The browser's breeding stock (web/23_stock.html: hatch order, recipes, lineage, verdict, catalogue) against Python's
// breeding/stock.py, case by case, over the same data pack (app/data/breeding.json).
// Run: python3 -I breeding/stock.py --parity py.json && node app/test_stock_parity.mjs py.json
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const py = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const part = (f) => fs.readFileSync(path.join(HERE, 'web', f), 'utf8').replace(/^<script>/, '').replace(/<\/script>\s*$/, '');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(part('23_stock.html') + '\nthis.Stock = Stock;', ctx);
const S = ctx.Stock.init(JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'breeding.json'), 'utf8')));

function sortKeys(o) { if (Array.isArray(o)) return o.map(sortKeys); if (o && typeof o === 'object') { const r = {}; Object.keys(o).sort().forEach((k) => { r[k] = sortKeys(o[k]); }); return r; } return o; }
const J = (x) => JSON.stringify(sortKeys(x));
let bad = 0;
const t0 = Date.now();
const run = {
  plan: (a) => S.planLineage(a[0], a[1], a[2]),
  blueprint: (a) => S.blueprint(a[0], a[1], a[2], a[3] || null),
  explore: (a) => S.explore(a[0], a[1]),
  breedable: (a) => S.breedable(a[0]),
  start_moves: (a) => S.startMoves(a[0], a[1]),
};
for (const c of py) {
  let got;
  try { got = run[c.kind](c.args); } catch (e) { got = { error: String(e) }; }
  const A = J(got), B = J(c.result);
  if (A !== B) {
    bad++;
    if (bad <= 12) { let k = 0; while (k < A.length && A[k] === B[k]) k++; console.log('DIFF', c.kind, JSON.stringify(c.args).slice(0, 120), '\n  py:', B.slice(Math.max(0, k - 160), k + 220), '\n  js:', A.slice(Math.max(0, k - 160), k + 220)); }
  }
}
console.log(`${py.length - bad}/${py.length} breeding-stock cases match Python; ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(bad ? 1 : 0);
