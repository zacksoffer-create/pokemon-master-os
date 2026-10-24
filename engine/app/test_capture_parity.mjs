// The browser's catch calculator (web/33_capture.html) against equipment/capture.py: every throw in a fixed grid across
// the five games, all 25 balls, levels, HP, status and situations, number for number (the chance and its steps).
// Run: python3 -I equipment/capture.py --parity /tmp/cap.json && node app/test_capture_parity.mjs /tmp/cap.json
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const py = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const part = (f) => fs.readFileSync(path.join(HERE, 'web', f), 'utf8').replace(/^<script>/, '').replace(/<\/script>\s*$/, '');
const ctx = {GAME_NAME: {}, console};
vm.createContext(ctx);
vm.runInContext(part('33_capture.html') + '\nthis.Gear = Gear;', ctx);
const G = ctx.Gear;
G.init(JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'equipment.json'), 'utf8')));
const bad = [];
for (const c of py.cases) {
  const [game, name, ball, level, pct, status, ci] = c.case;
  const got = JSON.parse(JSON.stringify(G.chance(game, ball, G.flat(name, game), level, pct, status, py.ctxs[ci])));
  for (const k of Object.keys(c.want)) if (JSON.stringify(got[k]) !== JSON.stringify(c.want[k])) { bad.push(JSON.stringify(c.case) + ' ' + k + ': js ' + JSON.stringify(got[k]) + ' py ' + JSON.stringify(c.want[k])); break; }
}
console.log(bad.length ? 'FAIL ' + bad.length + ' of ' + py.cases.length + '\n' + bad.slice(0, 15).join('\n') : 'ok: ' + py.cases.length + ' throws match Python');
process.exit(bad.length ? 1 : 0);
