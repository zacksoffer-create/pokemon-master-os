// Simulation Jobs in, Simulation Results out. A job fixes everything that is held constant (both teams, both
// policies, the ruleset, the engine version, the lens) and says how the trials vary (seeds, sides). The result has
// the 6v6 seam's shape (docs/design/SIXVSIX_SEAM.md) plus the evidence underneath it: every battle's seeds, outcome,
// log hash and input log, the failures, a summary with its interval, and timing.

import { CONTRACT_VERSION, assertValid } from './contract.js';
import { ENGINE, ENGINE_ID } from './engine-info.js';
import { makeAgent } from './agents/baselines.js';
import { runBattle } from './battle.js';
import { getRuleset } from './rulesets.js';
import { summarize } from './stats.js';
import { validateTeam } from './validate.js';
import { PolicyRNG, battleSeed, now, policySeed, shortHash, stableStringify } from './util.js';

const PAIRINGS = ['mirrored', 'alternate', 'none'];

/** A Simulation Job from its parts, with defaults written out (nothing implicit survives into the record). */
export function makeJob({ id, label, ruleset, a, b, n = 100, seed, pairing = 'mirrored', turnLimit, record, lens, note }) {
  const rs = getRuleset(ruleset);
  return assertValid('SimulationJob', {
    kind: 'SimulationJob',
    id: id || `job:${shortHash(stableStringify({ ruleset: rs.id, a, b, n, seed, pairing }))}`,
    contract: CONTRACT_VERSION,
    engine: { name: ENGINE.name, version: ENGINE.version },
    ruleset: rs,
    a, b,
    trials: { n, seed: String(seed ?? 'blackthorn'), pairing, turn_limit: turnLimit ?? rs.turn_limit },
    record: { logs: 'first', decisions: 'first', input_logs: 'all', analysis: true, ...(record || {}) },
    scenario: { lens: lens || a.team.lens || rs.normalization.lens_default, ...(note ? { note } : {}) },
    ...(label ? { label } : {}),
  });
}

/**
 * A legality report made elsewhere (Node, or the full browser build) for exactly this team version, ruleset and
 * engine. The slim browser build carries no learnset data, so it runs pre-checked jobs this way.
 */
function acceptPrecomputed(job, who, report) {
  const team = job[who].team;
  const problems = [];
  if (!report) problems.push('no report');
  else {
    if (report.team !== team.id || report.team_version !== team.version) problems.push(`it is for ${report.team} v${report.team_version}`);
    if (report.ruleset !== job.ruleset.id) problems.push(`it is for ruleset ${report.ruleset}`);
    if (!String(report.checked_by).includes(`${ENGINE.name} ${ENGINE.version}`)) problems.push(`it was checked by ${report.checked_by}`);
    if (!report.ok) problems.push('it says the team is not legal');
  }
  if (problems.length) throw new Error(`the legality report for ${team.id} can't be used: ${problems.join('; ')}`);
  return { ...report, precomputed: true };
}

/** Check a job and prepare what every trial needs. Throws if the job can't be run as written. */
export function prepareJob(job, { legality: precomputed } = {}) {
  assertValid('SimulationJob', job);
  if (job.engine.name !== ENGINE.name || job.engine.version !== ENGINE.version) {
    throw new Error(`the job was written for ${job.engine.name} ${job.engine.version}; this simulator runs ` +
      `${ENGINE.name} ${ENGINE.version}. Rerun it as a new job rather than mixing engine versions.`);
  }
  if (!PAIRINGS.includes(job.trials.pairing)) throw new Error(`unknown pairing ${job.trials.pairing}`);
  for (const who of ['a', 'b']) {
    assertValid('TeamVersion', job[who].team);
    assertValid('TrainerProfile', job[who].profile);
    if (job[who].profile.information !== 'partial') {
      throw new Error(`${who}'s profile asks for ${job[who].profile.information} information; Phase 1 plays partial only`);
    }
  }
  const legality = precomputed
    ? { a: acceptPrecomputed(job, 'a', precomputed.a), b: acceptPrecomputed(job, 'b', precomputed.b) }
    : { a: validateTeam(job.a.team, job.ruleset), b: validateTeam(job.b.team, job.ruleset) };
  for (const who of ['a', 'b']) {
    if (!legality[who].ok) {
      const lines = legality[who].failed.flatMap((k) => legality[who].verdicts[k].problems.map((p) => `${k}: ${p}`));
      const err = new Error(`${job[who].team.id} is not legal under ${job.ruleset.id}:\n  ${lines.join('\n  ')}`);
      err.legality = legality;
      throw err;
    }
  }
  return { job, legality };
}

/** Which side A plays, the pair index and the battle seed for trial i. */
export function trialPlan(job, i) {
  const { seed, pairing } = job.trials;
  if (pairing === 'mirrored') return { pair: i >> 1, aSide: i % 2 === 0 ? 'p1' : 'p2', seed: battleSeed(seed, i >> 1) };
  if (pairing === 'alternate') return { pair: null, aSide: i % 2 === 0 ? 'p1' : 'p2', seed: battleSeed(seed, `alt${i}`) };
  return { pair: null, aSide: 'p1', seed: battleSeed(seed, `one${i}`) };
}

/** Run trial i of a prepared job. */
export function runTrial(prepared, i) {
  const { job } = prepared;
  const plan = trialPlan(job, i);
  const who = { [plan.aSide]: 'a', [plan.aSide === 'p1' ? 'p2' : 'p1']: 'b' };
  const keep = (what) => job.record[what] === 'all' || (job.record[what] === 'first' && i === 0);
  const seeds = { a: policySeed(job.trials.seed, i, 'a'), b: policySeed(job.trials.seed, i, 'b') };
  const sides = {};
  for (const s of ['p1', 'p2']) {
    const w = who[s];
    sides[s] = {
      name: `${w.toUpperCase()} · ${job[w].team.name}`.slice(0, 40),
      team: job[w].team,
      agent: makeAgent(job[w].profile, { team: job[w].team }),
      rng: new PolicyRNG(seeds[w]),
    };
  }
  const r = runBattle({
    formatid: job.ruleset.battle_format, seed: plan.seed, sides, turnLimit: job.trials.turn_limit,
    record: { log: keep('logs'), decisions: keep('decisions'), analysis: job.record.analysis !== false },
  });
  const row = {
    i, pair: plan.pair, a_side: plan.aSide, seed: plan.seed, policy_seeds: seeds,
    winner: r.winner ? who[r.winner] : 'draw', end: r.end, turns: r.turns,
    left: { a: r.left[plan.aSide], b: r.left[plan.aSide === 'p1' ? 'p2' : 'p1'] },
    hp: { a: r.hp[plan.aSide], b: r.hp[plan.aSide === 'p1' ? 'p2' : 'p1'] },
    hash: r.hash, ms: r.ms, decisions: r.counts.decisions, unavailable: r.counts.unavailable, invalid: r.counts.invalid,
  };
  if (r.error) row.error = r.error;
  if (r.members) {
    row.members = { a: r.members[plan.aSide], b: r.members[plan.aSide === 'p1' ? 'p2' : 'p1'] };
    row.kos = r.members.kos.map((k) => ({ ...k, side: who[k.side] }));
  }
  if (keep('input_logs') || r.error) row.input_log = r.inputLog;
  if (r.log) row.log = r.log;
  if (r.decisions) row.decision_log = r.decisions.map((d) => ({ ...d, side: who[d.side] }));
  return row;
}

function heldConstant(job) {
  const t = (w) => `${w.toUpperCase()}: ${job[w].team.id} v${job[w].team.version} (every field of all ` +
    `${job[w].team.members.length} builds), played by ${job[w].profile.agent}`;
  return [t('a'), t('b'), `ruleset ${job.ruleset.id} v${job.ruleset.version}`, `lens ${job.scenario.lens}`,
          `engine ${ENGINE.name} ${ENGINE.version}`, 'lead order (each team leads with its first member)'];
}

function varied(job) {
  const out = ['battle RNG (damage rolls, accuracy, critical hits, secondary effects, speed ties)',
               'policy RNG (tie-breaks; every choice for a random agent)'];
  if (job.trials.pairing !== 'none') out.push('sides: A plays p1 in even battles and p2 in odd ones');
  if (job.trials.pairing === 'mirrored') out.push('each pair of battles shares one battle seed with the sides swapped');
  const noGender = [...job.a.team.members, ...job.b.team.members].filter((m) => !m.gender).length;
  if (noGender) out.push(`genders not on record (${noGender} Pokémon): Showdown draws them from the battle seed`);
  return out;
}

/** The finished Simulation Result. */
export function finishJob(prepared, rows, timing) {
  const { job, legality } = prepared;
  const summary = summarize(rows);
  const failures = rows.filter((b) => b.end === 'error' || b.end === 'stalled' || b.invalid > 0)
    .map((b) => ({ i: b.i, end: b.end, invalid: b.invalid, error: b.error, input_log: b.input_log }));
  const levels = [...new Set([...job.a.team.members, ...job.b.team.members].map((m) => m.level))];
  return assertValid('SimulationResult', {
    kind: 'SimulationResult',
    engine: ENGINE_ID,
    format: `gen4 singles, ${job.a.team.members.length}v${job.b.team.members.length}, ` +
      (levels.length === 1 ? `level ${levels[0]}` : `levels ${Math.min(...levels)}-${Math.max(...levels)}`) +
      ` (${job.ruleset.name})`,
    a: job.a.team.id, b: job.b.team.id,
    lens: job.scenario.lens,
    held_constant: heldConstant(job),
    varied: varied(job),
    seed: job.trials.seed,
    n: rows.length,
    won: summary.won, lost: summary.lost, drew: summary.drew,
    battles: rows,
    made_at: new Date().toISOString(),
    evidence_class: 'simulated',
    job: {
      id: job.id, label: job.label, contract: job.contract, ruleset: `${job.ruleset.id} v${job.ruleset.version}`,
      a: { team: job.a.team.id, team_version: job.a.team.version, profile: job.a.profile.id, agent: job.a.profile.agent },
      b: { team: job.b.team.id, team_version: job.b.team.version, profile: job.b.profile.id, agent: job.b.profile.agent },
      trials: job.trials, legality,
    },
    summary,
    failures,
    timing,
  });
}

/** Everything that must match when a job is rerun (excludes made_at and timing). */
export function fingerprint(result) {
  return shortHash(stableStringify(result.battles.map((b) => [b.i, b.seed, b.policy_seeds, b.winner, b.end, b.turns, b.hash])));
}

function timingOf(rows, t0, platform) {
  const ms = rows.map((b) => b.ms).sort((x, y) => x - y);
  return {
    total_ms: Math.round(now() - t0),
    per_battle_ms: { mean: Math.round((10 * ms.reduce((s, x) => s + x, 0)) / (ms.length || 1)) / 10,
                     median: ms[ms.length >> 1] ?? 0, max: ms[ms.length - 1] ?? 0 },
    platform,
  };
}

/** Run a whole job synchronously (Node, or a Web Worker). */
export function runJobSync(job, { onProgress, platform = 'unknown', legality } = {}) {
  const t0 = now();
  const prepared = prepareJob(job, { legality });
  const rows = [];
  for (let i = 0; i < job.trials.n; i++) {
    rows.push(runTrial(prepared, i));
    if (onProgress) onProgress(i + 1, job.trials.n, rows[i]);
  }
  return finishJob(prepared, rows, timingOf(rows, t0, platform));
}

/** Run a job without freezing a page: yields to the event loop every `yieldEvery` battles. */
export async function runJob(job, { onProgress, platform = 'unknown', yieldEvery = 1, shouldStop, legality } = {}) {
  const t0 = now();
  const prepared = prepareJob(job, { legality });
  const rows = [];
  for (let i = 0; i < job.trials.n; i++) {
    if (shouldStop?.()) break;
    rows.push(runTrial(prepared, i));
    if (onProgress) onProgress(i + 1, job.trials.n, rows[i]);
    if ((i + 1) % yieldEvery === 0) await new Promise((r) => setTimeout(r, 0));
  }
  return finishJob(prepared, rows, timingOf(rows, t0, platform));
}
