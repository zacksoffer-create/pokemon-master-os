// Run a Simulation Job and record it.
//   node cli/run.mjs <preset | job.json> [--n 100] [--seed s] [--out results/<name>]
//   node cli/run.mjs all             every preset in cli/presets.mjs
// Writes result.json (the whole Simulation Result, every battle's seeds and input log), summary.json (the result
// without the battles), battle-0.txt (the first battle, readable) and decisions-0.json (its decision trace).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runJobSync, fingerprint } from '../src/index.js';
import { PRESETS } from './presets.mjs';
import { prettyLog } from './pretty.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const what = args[0];
if (!what) {
  console.log('usage: node cli/run.mjs <preset | job.json | all> [--n N] [--seed S] [--out DIR]\npresets:', Object.keys(PRESETS).join(', '));
  process.exit(1);
}

function record(name, job) {
  if (opt('n')) job.trials.n = Number(opt('n'));
  if (opt('seed')) job.trials.seed = opt('seed');
  const platform = `node ${process.version} · ${os.cpus()[0]?.model?.trim() || os.arch()} · ${os.platform()}`;
  const result = runJobSync(job, { platform });
  const out = path.resolve(opt('out') || path.join(ROOT, 'results', name));
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result) + '\n');
  const { battles, ...summary } = result;
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ ...summary, fingerprint: fingerprint(result) }, null, 1) + '\n');
  const b0 = battles[0];
  const labels = b0.a_side === 'p1' ? { p1: 'A', p2: 'B' } : { p1: 'B', p2: 'A' };
  if (b0.log) {
    const head = `${job.label || job.id}\nbattle 0 · seed ${b0.seed} · A plays ${b0.a_side} · A = ${job.a.team.name} (${job.a.profile.agent}), ` +
      `B = ${job.b.team.name} (${job.b.profile.agent})\n`;
    fs.writeFileSync(path.join(out, 'battle-0.txt'), head + prettyLog(b0.log, labels) + '\n');
  }
  if (b0.decision_log) fs.writeFileSync(path.join(out, 'decisions-0.json'), JSON.stringify(b0.decision_log, null, 1) + '\n');
  const s = result.summary;
  console.log(`${name}: ${s.reading}`);
  console.log(`  ${result.n} battles in ${result.timing.total_ms} ms (${result.timing.per_battle_ms.mean} ms each), ` +
    `${result.failures.length} failures, fingerprint ${fingerprint(result)} → ${path.relative(process.cwd(), out)}`);
  return result;
}

if (what === 'all') for (const [name, make] of Object.entries(PRESETS)) record(name, make());
else if (PRESETS[what]) record(what, PRESETS[what]());
else record(path.basename(what, '.json'), JSON.parse(fs.readFileSync(what, 'utf8')));
