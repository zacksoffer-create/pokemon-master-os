// The browser's specimen kernel (web/26_specimen.html) against engine/specimen.py: PIDs, natures, genders,
// shininess, Hidden Power, characteristics, stats, the Showdown set and the PKHeX Batch Editor script.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const py = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const atlas = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'atlas.json'), 'utf8'));
const builds = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'builds.json'), 'utf8'));
const scout = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'scout.json'), 'utf8'));
const by = {}; atlas.species.forEach(s => { by[s.name] = s; });
const ctx = { cap: s => s.charAt(0).toUpperCase() + s.slice(1), S: { builds, scoutPack: scout }, dexOf: n => by[n], numOf: n => (by[n] || {}).n, GAME_NAME: {}, console, Math, JSON, Object, Array, String, Number };
vm.createContext(ctx);
const code = fs.readFileSync(path.join(HERE, 'web', '26_specimen.html'), 'utf8').replace(/^<script>/, '').replace(/<\/script>\s*$/, '');
vm.runInContext(code + '\nthis.Specimen = Specimen;', ctx);
let bad = 0, n = 0;
for (const c of py) {
  const card = ctx.Specimen.derive(c.input), want = c.card, where = `${c.input.species} (${c.input.game})`;
  for (const f of ['pid', 'nature', 'nature_effect', 'flavors', 'gender', 'shiny', 'hidden_power', 'stats', 'ability_slot', 'characteristic', 'dvs']) {
    n++; const a = JSON.stringify(card[f]), b = JSON.stringify(want[f]);
    if (a !== b) { bad++; console.log('DIFF', where, f, '\n py:', b, '\n js:', a); }
  }
  for (const [f, a, b] of [['showdown', ctx.Specimen.showdown(c.input, card), c.showdown], ['batch', ctx.Specimen.batch(c.input, card), c.batch]]) {
    n++; if (a !== b) { bad++; console.log('DIFF', where, f, '\n py:', JSON.stringify(b), '\n js:', JSON.stringify(a)); }
  }
}
console.log(`${n - bad} of ${n} match`);
process.exit(bad ? 1 : 0);
