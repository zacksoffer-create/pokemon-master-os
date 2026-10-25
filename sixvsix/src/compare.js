// Phase 2: a team against a whole pool, and paired comparisons.
//
// runPool plays one team against every team of an OpponentPool (one Simulation Job per opponent, the same number of
// battles each, the allocation written down) and adds them up. comparePool runs two versions of a team (two builds
// of one member, two spreads, two policies) against the same pool with the SAME seeds: battle i against opponent k
// uses identical battle and policy seeds in both arms. Once the teams differ the battles diverge, so the pairing
// removes only part of the noise; the statistics treat each pair honestly (McNemar's exact test on the pairs where
// exactly one arm won, and a paired interval on the difference).
//
// Each has a version that runs here and now (runPool, comparePool) and one that takes a runner (runner.js) and can
// spread the battles over workers (runPoolWith, comparePoolWith); both give identical results.

import { makeJob, finishJob } from './batch.js';
import { syncRunner } from './runner.js';
import { wilson } from './stats.js';
import { now, shortHash, stableStringify } from './util.js';

const r3 = (x) => Math.round(x * 1000) / 1000;
const Z = 1.959963984540054;

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

/** A Pool Result from each opponent's finished trials: [{prepared, rows}], in pool order. */
export function poolResult(args, perJob, { ms = 0, platform = 'unknown', keepResults = false } = {}) {
  const per = perJob.map(({ prepared, rows }) => ({ job: prepared.job, result: finishJob(prepared, rows, { total_ms: 0, per_battle_ms: {}, platform }) }));
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

/** Run a team against a pool, here and now. Returns per-opponent results and the pooled totals. */
export function runPool(args, { platform = 'unknown', keepResults = false } = {}) {
  const t0 = now();
  const per = syncRunner().runNow(poolJobs(args).map((job) => ({ job })));
  return poolResult(args, per, { ms: Math.round(now() - t0), platform, keepResults });
}

/** The same, on a runner (possibly a pool of workers). */
export async function runPoolWith(runner, args, { platform = 'unknown', keepResults = false, onProgress } = {}) {
  const t0 = now();
  const per = await runner.run(poolJobs(args).map((job) => ({ job })), { onProgress });
  return poolResult(args, per, { ms: Math.round(now() - t0), platform: runner.size > 1 ? `${platform} · ${runner.size} ${runner.kind}` : platform, keepResults });
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

const meanCI = (xs) => {
  const N = xs.length, mean = xs.reduce((t, d) => t + d, 0) / (N || 1);
  const sd = Math.sqrt(xs.reduce((t, d) => t + (d - mean) ** 2, 0) / Math.max(1, N - 1));
  return { mean, half: (Z * sd) / Math.sqrt(N || 1) };
};

/**
 * The comparison of two arms from their rows: rowsX[k] and rowsY[k] are the battles against opponent k, battle for
 * battle on the same seeds.
 */
export function comparisonFrom({ x, y, pool, ruleset, seed, alpha = 0.05 }, rowsX, rowsY, timing = {}) {
  let both = 0, onlyX = 0, onlyY = 0, neither = 0;
  const diffs = [], margins = [], perOpp = [];
  // margin: share of our team's HP left minus theirs at the end (-1..1); finer-grained than win or loss
  const margin = (b) => (b.hp?.a ?? 0) - (b.hp?.b ?? 0);
  rowsX.forEach((rx, k) => {
    let ox = 0, oy = 0;
    rx.forEach((bx, i) => {
      const by = rowsY[k][i];
      const wx = bx.winner === 'a', wy = by.winner === 'a';
      if (wx && wy) both++; else if (wx) onlyX++; else if (wy) onlyY++; else neither++;
      diffs.push((wy ? 1 : 0) - (wx ? 1 : 0));
      margins.push(margin(by) - margin(bx));
      ox += wx; oy += wy;
    });
    perOpp.push({ opponent: pool.members[k].id, name: pool.members[k].name, n: rx.length, x_won: ox, y_won: oy });
  });
  const N = diffs.length;
  const d = meanCI(diffs), m = meanCI(margins);
  const p = mcnemar(onlyX, onlyY);
  const xr = (both + onlyX) / N, yr = (both + onlyY) / N;
  return {
    kind: 'Comparison', pool: pool.id, ruleset: typeof ruleset === 'string' ? ruleset : ruleset.id, seed: String(seed),
    n_per_opponent: rowsX[0]?.length ?? 0,
    x: { label: x.label, team: x.team.id, agent: x.profile.agent, won: both + onlyX, win_rate: r3(xr) },
    y: { label: y.label, team: y.team.id, agent: y.profile.agent, won: both + onlyY, win_rate: r3(yr) },
    pairs: { n: N, both_won: both, only_x: onlyX, only_y: onlyY, neither },
    difference: { y_minus_x: r3(d.mean), ci95: [r3(d.mean - d.half), r3(d.mean + d.half)] },
    margin: { y_minus_x: r3(m.mean), ci95: [r3(m.mean - m.half), r3(m.mean + m.half)],
              note: "share of the team's HP left minus the opponent's, at the end of each battle" },
    mcnemar_p: Math.round(p * 1e6) / 1e6,
    significant: p < alpha,
    per_opponent: perOpp,
    reading: comparisonReading({ x: x.label, y: y.label, xr, yr, N, p, unseen: d.half + Math.abs(d.mean), alpha }),
    timing,
  };
}

const armJobs = (args, arm, n) => poolJobs({ team: arm.team, profile: arm.profile, pool: args.pool, ruleset: args.ruleset,
                                              n, seed: args.seed ?? 'compare', opponentProfile: args.opponentProfile });

/**
 * Two versions of a team against the same pool, with the same seeds, here and now. `x` and `y` are
 * {team, profile, label}. Returns each arm's pooled result, the paired table, McNemar's p, the paired difference
 * with a 95% interval, and a plain reading. Pairs are battle-for-battle (same opponent, same seeds).
 */
export function comparePool(args, opts = {}) {
  const t0 = now();
  const n = args.n ?? 20, runner = syncRunner();
  const rx = runner.runNow(armJobs(args, args.x, n).map((job) => ({ job }))).map((r) => r.rows);
  const ry = runner.runNow(armJobs(args, args.y, n).map((job) => ({ job }))).map((r) => r.rows);
  return comparisonFrom({ ...args, seed: args.seed ?? 'compare' }, rx, ry, { total_ms: Math.round(now() - t0), platform: opts.platform || 'unknown' });
}

/**
 * The same on a runner, with an option to keep going until the answer is clear. With `adaptive: {start, max}`,
 * it plays `start` battles per opponent per arm, then more in steps of `start`, up to `max`, stopping early only when
 * the answer is already clear: a difference at p < 0.01 (stricter than the final 0.05, because it looks more than
 * once), or a win-rate interval inside ±3 points (no difference worth finding). The record says how many it played
 * and why it stopped.
 */
export async function comparePoolWith(runner, args, { platform = 'unknown', onProgress, adaptive, keepRows = false } = {}) {
  const t0 = now();
  const max = adaptive ? adaptive.max : (args.n ?? 20);
  const step = adaptive ? adaptive.start : max;
  const jobsX = armJobs(args, args.x, max), jobsY = armJobs(args, args.y, max);
  const rx = jobsX.map(() => []), ry = jobsY.map(() => []);
  let played = 0, stop = null, result = null;
  const total = 2 * jobsX.length * max;
  while (played < max) {
    const to = Math.min(max, played + step);
    const indices = Array.from({ length: to - played }, (_, i) => played + i);
    const tasks = [...jobsX, ...jobsY].map((job) => ({ job, indices }));
    const done0 = 2 * jobsX.length * played;
    const out = await runner.run(tasks, { onProgress: onProgress && ((d) => onProgress(done0 + d, total)) });
    out.forEach((r, t) => (t < jobsX.length ? rx[t] : ry[t - jobsX.length]).push(...r.rows));
    played = to;
    result = comparisonFrom({ ...args, seed: args.seed ?? 'compare' }, rx, ry, {});
    if (!adaptive || played >= max) break;
    if (result.mcnemar_p < 0.01) { stop = 'a clear difference (p < 0.01) before the maximum'; break; }
    const [lo, hi] = result.difference.ci95;
    if (lo > -0.03 && hi < 0.03) { stop = 'no difference worth finding: the interval is inside ±3 points'; break; }
  }
  result.timing = { total_ms: Math.round(now() - t0), platform: runner.size > 1 ? `${platform} · ${runner.size} ${runner.kind}` : platform };
  if (adaptive) {
    result.adaptive = { start: adaptive.start, max, played_per_opponent: played,
                        stopped: stop || (played >= max ? 'reached the maximum' : 'done') };
  }
  if (keepRows) Object.defineProperty(result, 'rows', { value: { x: rx, y: ry }, enumerable: false });
  return result;
}
