// The 6v6 Lab from the command line: the same experiments as the Lab page, on every core of this machine.
//   node cli/lab.mjs list
//   node cli/lab.mjs league      <team> <pool>            [--opponents game|blackthorn|aggressive|cautious|sharp|sloppy] [--ours style] [--n 20]
//   node cli/lab.mjs compare     <team> <other team> <pool> [--adaptive 10,40]
//   node cli/lab.mjs matrix      <team,team,...> <pool>   [--styles game,blackthorn,aggressive,cautious]
//   node cli/lab.mjs leads       <team> <pool>
//   node cli/lab.mjs styles      <team> <pool>            [--styles blackthorn,cautious,aggressive,sharp]
//   node cli/lab.mjs sensitivity <team> <pool>
//   node cli/lab.mjs battle      <team> <pool> <opponent> <i>     one battle, turn by turn, with every decision's reasons
//   any experiment: --json file (the whole record) --md file (the report) --workers k --seed s
// Teams and pools are keys in fixtures/lab/pack.json (list shows them).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runExperiment, battle } from '../src/experiments.js';
import { renderExperiment } from '../src/render.js';
import { replayText } from '../src/replay.js';
import { nodeRunner } from '../src/runner-node.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/lab/pack.json'), 'utf8'));
const argv = process.argv.slice(2);
const flags = {}, pos = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) flags[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  else pos.push(argv[i]);
}
const [kind, ...rest] = pos;

if (!kind || kind === 'list') {
  console.log('Your teams:'); for (const t of pack.team_list) console.log(`  ${t.key.padEnd(30)} ${t.name}`);
  console.log('\nPools:'); for (const [k, p] of Object.entries(pack.pools)) console.log(`  ${k.padEnd(30)} ${p.name} (${p.members.length} teams)`);
  console.log('\nHow opponents (and your trainer) can play:'); for (const [k, v] of Object.entries(pack.interpretations)) console.log(`  ${k.padEnd(12)} ${v.label}: ${v.note}`);
  process.exit(0);
}

const num = (k, d) => (flags[k] != null ? Number(flags[k]) : d);
const common = { interpretation: flags.opponents || 'blackthorn', ours: flags.ours || 'blackthorn', ...(flags.seed ? { seed: flags.seed } : {}) };
let spec;
if (kind === 'league') spec = { kind, team: rest[0], pool: rest[1], n: num('n', 20), ...common };
else if (kind === 'compare') {
  spec = { kind, team: rest[0], y: rest[1], pool: rest[2], n: num('n', 20), ...common };
  if (flags.adaptive) { const [a, b] = String(flags.adaptive === true ? '10,40' : flags.adaptive).split(',').map(Number); spec.adaptive = { start: a, max: b }; }
} else if (kind === 'matrix') spec = { kind, teams: rest[0].split(','), pool: rest[1], n: num('n', 12), interpretations: String(flags.styles || 'game,blackthorn,aggressive,cautious').split(','), ...common };
else if (kind === 'leads' || kind === 'sensitivity') spec = { kind, team: rest[0], pool: rest[1], n: num('n', 12), ...common };
else if (kind === 'styles') spec = { kind, team: rest[0], pool: rest[1], n: num('n', 12), styles: String(flags.styles || 'blackthorn,cautious,aggressive,sharp').split(','), ...common };
else if (kind === 'battle') {
  const s = { kind: 'league', team: rest[0], pool: rest[1], n: num('n', 20), ...common };
  const one = battle(pack, s, rest[2], Number(rest[3] || 0));
  console.log(replayText(one.row, { label: { a: 'YOU', b: 'THEM' }, options: Number(flags.options || 3) }));
  process.exit(0);
} else { console.error(`unknown command ${kind}; try: node cli/lab.mjs list`); process.exit(1); }

const runner = nodeRunner({ workers: flags.workers != null ? Number(flags.workers) : undefined });
const t0 = Date.now();
let last = 0;
try {
  const x = await runExperiment(runner, pack, spec, { onProgress: (d, t) => { if (Date.now() - last > 1000) { last = Date.now(); process.stderr.write(`\r  ${d}/${t} battles`); } } });
  process.stderr.write(`\r  done in ${((Date.now() - t0) / 1000).toFixed(1)} s on ${runner.size} ${runner.kind}\n`);
  const md = renderExperiment(x);
  console.log(md);
  if (flags.json) fs.writeFileSync(flags.json, JSON.stringify(x, null, 1) + '\n');
  if (flags.md) fs.writeFileSync(flags.md, md + '\n');
} finally { runner.close(); }
