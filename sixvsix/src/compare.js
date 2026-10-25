// Phase 2: a team against a whole opponent pool, and paired comparisons.
//
// runPool plays one team against every team of an OpponentPool (one Simulation Job per opponent, the same number of
// battles each, the allocation written down) and adds them up. comparePool runs two versions of a team (two builds
// of one member, two spreads, two policies) against the same pool with the SAME seeds: battle i against opponent k
// uses identical battle and policy seeds in both arms. Once the teams differ the battles diverge, so the pairing
// removes only part of the noise; the statistics treat each pair honestly (McNemar's exact test on the pairs where
// exactly one arm won, and a paired interval on the difference).

import { makeJob, prepareJob, runTrial, finishJob } from './batch.js';
import { wilson } from './stats.js';
import { now, shortHash, stableStringify } from './util.js';

const r3 = (x) => Math.round(x * 1000) / 1000;

/** The jobs for one team against every team in a pool (same ruleset, lens, seed and n for each). */
export function poolJobs({ team, profile, pool, ruleset, n = 20, seed = 'pool', opponentProfile, record, pairing = 'mirrored' }) {
  return pool.members.map((opp) => makeJob({
    id: `job:${team.id}:vs:${opp.id}:${shortHash(String(seed))}`,
    label: `${team.name} vs ${opp.name}`,
    ruleset, n, seed: `${seed}|${opp.id}`, pairing, lens: pool.lens,
    a: { team, profile }, b: { team: opp, profile: opponentProfile(opp) },
    record: { logs: 'none', decisions: 'none', input_logs: 'none', analysis: true, ...(record || {}) },
  }));
}

/** Run a team against a pool. Returns per-opponent results and the pooled totals. */
export function runPool(args, { onProgress, platform = 'unknown', keepResults = false } = {}) {
  const t0 = now();
  const jobs = poolJobs(args);
  const total = jobs.reduce((t, j) => t + j.trials.n, 0);
  let done = 0;
  const per = jobs.map((job) => {
    const prepared = prepareJob(job);
    const rows = [];
    for (let i = 0; i < job.trials.n; i++) {
      rows.push(runTrial(prepared, i));
      done++;
      if (onProgress) onProgress(done, total);
    }
    const result = finishJob(prepared, rows, { total_ms: 0, per_battle_ms: {}, platform });
    return { job, result };
  });
  return poolSummary(args, per, { ms: Math.round(now() - t0), platform, keepResults });
}

function poolSummary(args, per, { ms, platform, keepResults }) {
  const rows = per.map(({ job, result }) => ({
    opponent: job.b.team.id, name: job.b.team.name, n: result.n, won: result.won, lost: result.lost, drew: result.drew,
    win_rate: result.summary.win_rate, win_rate_95: result.summary.win_rate_95, turns: result.summary.turns.mean,
    left_when_won: result.summary.left_a_when_won, failures: result.failures.length,
  }));
  const n = rows.reduce((t, r) => t + r.n, 0), won = rows.reduce((t, r) => t + r.won, 0);
  const lost = rows.reduce((t, r) => t + r.lost, 0), drew = rows.reduce((t, r) => t + r.drew, 0);
  const [lo, hi] = wilson(won, n);
  // each member's contribution, pooled over every battle against every opponent
  const members = new Map();
  for (const { result } of per) {
    for (const m of result.summary.members.a) {
      const x = members.get(m.name) || { name: m.name, slot: m.slot, battles: 0, kos: 0, fainted: 0, appeared: 0, dealt: 0 };
      x.battles += result.n; x.kos += m.kos_per_battle * result.n; x.fainted += m.fainted_rate * result.n;
      x.appeared += m.appeared * result.n; x.dealt += m.damage_dealt_per_battle * result.n;
      members.set(m.name, x);
    }
  }
  return {
    kind: 'PoolResult', team: args.team.id, team_version: args.team.version, agent: args.profile.agent,
    pool: args.pool.id, ruleset: typeof args.ruleset === 'string' ? args.ruleset : args.ruleset.id, seed: String(args.seed),
    allocation: `${rows.length} opponents × ${rows[0]?.n ?? 0} battles each`,
    n, won, lost, drew, win_rate: r3(n ? won / n : 0), win_rate_95: [r3(lo), r3(hi)],
    per_opponent: rows,
    members: [...members.values()].sort((a, b) => a.slot - b.slot).map((x) => ({
      name: x.name, appeared: r3(x.appeared / x.battles), kos_per_battle: r3(x.kos / x.battles),
      fainted_rate: r3(x.fainted / x.battles), damage_dealt_per_battle: Math.round((10 * x.dealt) / x.battles) / 10,
    })),
    weakest: [...rows].sort((a, b) => a.win_rate - b.win_rate).slice(0, 3).map((r) => r.opponent),
    failures: rows.reduce((t, r) => t + r.failures, 0),
    timing: { total_ms: ms, platform },
    fingerprint: shortHash(stableStringify(per.map(({ result }) => result.battles.map((b) => [b.seed, b.winner, b.turns, b.hash])))),
    ...(keepResults ? { results: per.map((p) => p.result) } : {}),
  };
}

/** P(X <= k) for X ~ Binomial(n, 1/2), in log space so thousands of pairs don't overflow. */
function binomTail(k, n) {
  let logC = 0, p = 0;
  const half = n * Math.log(2);
  for (let i = 0; i <= k; i++) {
    p += Math.exp(logC - half);
    logC += Math.log(n - i) - Math.log(i + 1);
  }
  return p;
}

/** McNemar's exact two-sided p-value from the discordant pairs. */
export function mcnemar(b, c) {
  const n = b + c;
  if (!n) return 1;
  return Math.min(1, 2 * binomTail(Math.min(b, c), n));
}

/** The one-line reading of a comparison: which arm won more, or how big a difference could still go unseen. */
export function comparisonReading({ x, y, xr, yr, N, p, unseen, alpha = 0.05 }) {
  const pct = (r) => `${Math.round(100 * r)}%`;
  if (p < alpha) {
    const [winner, wr, lr] = yr > xr ? [y, yr, xr] : [x, xr, yr];
    return `${winner} won more: ${pct(wr)} against ${pct(lr)} over ${N} paired battles ` +
      `(McNemar ${p < 0.0001 ? 'p < 0.0001' : `p = ${p.toFixed(4)}`}).`;
  }
  return `No difference shows up over ${N} paired battles (${pct(xr)} and ${pct(yr)}, McNemar p = ${p.toFixed(2)}). ` +
    `A real difference smaller than about ${Math.max(1, Math.round(100 * unseen))} points would need more battles to show.`;
}

/**
 * Two versions of a team against the same pool, with the same seeds. `x` and `y` are {team, profile, label}.
 * Returns each arm's pooled result, the paired table, McNemar's p, the paired difference with a 95% interval, and a
 * plain reading. Pairs are battle-for-battle (same opponent, same seeds).
 */
export function comparePool({ x, y, pool, ruleset, n = 20, seed = 'compare', opponentProfile, alpha = 0.05 }, opts = {}) {
  const run = (arm) => {
    const jobs = poolJobs({ team: arm.team, profile: arm.profile, pool, ruleset, n, seed, opponentProfile });
    return jobs.map((job) => { const p = prepareJob(job); return Array.from({ length: job.trials.n }, (_, i) => runTrial(p, i)); });
  };
  const t0 = now();
  const rx = run(x), ry = run(y);
  let both = 0, onlyX = 0, onlyY = 0, neither = 0;
  const diffs = [], margins = [], perOpp = [];
  // margin: share of our team's HP left minus theirs at the end (-1..1); finer-grained than win or loss
  const margin = (b) => (b.hp?.a ?? 0) - (b.hp?.b ?? 0);
  rx.forEach((rowsX, k) => {
    let ox = 0, oy = 0;
    rowsX.forEach((bx, i) => {
      const by = ry[k][i];
      const wx = bx.winner === 'a', wy = by.winner === 'a';
      if (wx && wy) both++; else if (wx) onlyX++; else if (wy) onlyY++; else neither++;
      diffs.push((wy ? 1 : 0) - (wx ? 1 : 0));
      margins.push(margin(by) - margin(bx));
      ox += wx; oy += wy;
    });
    perOpp.push({ opponent: pool.members[k].id, n: rowsX.length, x_won: ox, y_won: oy });
  });
  const N = diffs.length, mean = diffs.reduce((t, d) => t + d, 0) / N;
  const sd = Math.sqrt(diffs.reduce((t, d) => t + (d - mean) ** 2, 0) / Math.max(1, N - 1));
  const half = 1.959963984540054 * sd / Math.sqrt(N);
  const p = mcnemar(onlyX, onlyY);
  const mMean = margins.reduce((t, d) => t + d, 0) / N;
  const mSd = Math.sqrt(margins.reduce((t, d) => t + (d - mMean) ** 2, 0) / Math.max(1, N - 1));
  const mHalf = 1.959963984540054 * mSd / Math.sqrt(N);
  const xr = (both + onlyX) / N, yr = (both + onlyY) / N;
  const reading = comparisonReading({ x: x.label, y: y.label, xr, yr, N, p, unseen: half + Math.abs(mean), alpha });
  return {
    kind: 'Comparison', pool: pool.id, ruleset: typeof ruleset === 'string' ? ruleset : ruleset.id, seed: String(seed), n_per_opponent: n,
    x: { label: x.label, team: x.team.id, agent: x.profile.agent, won: both + onlyX, win_rate: r3(xr) },
    y: { label: y.label, team: y.team.id, agent: y.profile.agent, won: both + onlyY, win_rate: r3(yr) },
    pairs: { n: N, both_won: both, only_x: onlyX, only_y: onlyY, neither },
    difference: { y_minus_x: r3(mean), ci95: [r3(mean - half), r3(mean + half)] },
    margin: { y_minus_x: r3(mMean), ci95: [r3(mMean - mHalf), r3(mMean + mHalf)],
              note: "share of the team's HP left minus the opponent's, at the end of each battle" },
    mcnemar_p: Math.round(p * 1e6) / 1e6,
    significant: p < alpha,
    per_opponent: perOpp,
    reading,
    timing: { total_ms: Math.round(now() - t0), platform: opts.platform || 'unknown' },
  };
}
