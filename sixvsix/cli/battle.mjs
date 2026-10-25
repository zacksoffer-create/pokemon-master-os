// One battle of a preset job, in full: the readable log, every decision with what the agent knew and weighed, the
// knockouts and who gets credit, and a replay from Showdown's input log to show it plays out identically.
//   node cli/battle.mjs [preset] [battle index]       e.g. node cli/battle.mjs heartgold-vs-cynthia 0
import { prepareJob, runTrial, replayBattle } from '../src/index.js';
import { PRESETS } from './presets.mjs';
import { prettyLog } from './pretty.mjs';

const name = process.argv[2] || 'heartgold-vs-cynthia';
const i = Number(process.argv[3] || 0);
if (!PRESETS[name]) { console.log('presets:', Object.keys(PRESETS).join(', ')); process.exit(1); }
const job = PRESETS[name]();
job.record = { ...job.record, logs: 'all', decisions: 'all' };
const b = runTrial(prepareJob(job), i);
const labels = b.a_side === 'p1' ? { p1: 'A', p2: 'B' } : { p1: 'B', p2: 'A' };

console.log(`${job.label}\nbattle ${i} · seed ${b.seed} · A plays ${b.a_side}\n` +
  `A = ${job.a.team.name} (${job.a.profile.agent}) · B = ${job.b.team.name} (${job.b.profile.agent})\n`);
console.log(prettyLog(b.log, labels));
console.log(`\n${b.winner === 'draw' ? 'Draw' : `${b.winner.toUpperCase()} won`} in ${b.turns} turns ` +
  `(${b.left.a} of A's left, ${b.left.b} of B's) · ${b.decisions} decisions, ${b.invalid} invalid, ${b.unavailable} unavailable\n`);

console.log('Decisions (turn · side · choice · what it knew about the foe · options scored):');
for (const d of b.decision_log) {
  const foe = d.knew.foe ? `${d.knew.foe.species} ${d.knew.foe.pct}%` : '—';
  const scored = d.scores ? d.options.map((o, k) => `${o}=${d.scores[k]}`).join(' ') : d.options.join(' ');
  console.log(`  T${String(d.turn).padStart(2)} ${d.side.toUpperCase()} ${d.forced ? 'must send in' : 'chose'} ${d.label.padEnd(14)} vs ${foe.padEnd(18)} [${scored}]`);
}
console.log('\nKnockouts:');
for (const k of b.kos) console.log(`  T${k.turn} ${k.side.toUpperCase()}'s ${k.fainted} — ${k.by ? `by ${k.by}` : 'no one'} (${k.how}${k.move ? `, ${k.move}` : ''})`);
const again = replayBattle(b.input_log);
console.log(`\nReplayed from its input log: ${again.hash === b.hash ? 'identical' : 'DIFFERENT'} (log hash ${b.hash})`);
