import type { ChartStats, Note, Onset } from '../types';
import { clamp, lowerBound } from '../util';

export function chartStats(notes: Note[], durationMs: number): ChartStats {
  const sorted = notes.slice().sort((a, b) => a.t - b.t);
  let holds = 0;
  let swipes = 0;
  const groups = new Set<number>();
  for (const n of sorted) {
    if (n.type === 'hold') holds++;
    if (n.type === 'swipe') swipes++;
    if (n.group !== undefined) groups.add(n.group);
  }
  const first = sorted[0]?.t ?? 0;
  const last = sorted.length ? Math.max(...sorted.map((n) => n.end ?? n.t)) : 0;
  const span = Math.max(1000, last - first);
  const nps = sorted.length / (span / 1000);
  let peak = 0;
  let a = 0;
  for (let b = 0; b < sorted.length; b++) {
    while (sorted[b].t - sorted[a].t > 2000) a++;
    peak = Math.max(peak, (b - a + 1) / 2);
  }
  // Rough difficulty: density dominates, bursts, chords and holds add a little.
  const level = clamp(
    Math.round(0.6 + 1.55 * nps + 0.35 * Math.max(0, peak - nps) + (groups.size / Math.max(1, sorted.length)) * 6 + (holds / Math.max(1, sorted.length)) * 3),
    1,
    10,
  );
  return {
    noteCount: sorted.length,
    judgeCount: sorted.length + holds,
    holds,
    swipes,
    chords: groups.size,
    durationMs,
    nps: Math.round(nps * 100) / 100,
    peakNps: Math.round(peak * 100) / 100,
    level,
  };
}

export interface MusicalityReport {
  /** Fraction of notes within 45 ms of a detected onset. */
  alignment: number;
  /** Normalized lane-usage entropy (1 = perfectly balanced). */
  laneBalance: number;
  /** Longest run of consecutive notes in one lane. */
  longestJack: number;
  /** Fraction of consecutive pairs that are fast (<250 ms) same-lane repeats. */
  fastJackRate: number;
  /** Correlation between segment intensity and note density. */
  densityFollowsEnergy: number;
}

export function musicality(
  notes: Note[],
  onsets: Onset[],
  laneCount: number,
  segments: { startMs: number; endMs: number; intensity: number }[],
): MusicalityReport {
  const sorted = notes.slice().sort((a, b) => a.t - b.t || a.lane - b.lane);
  const times = onsets.map((o) => o.t);
  let aligned = 0;
  for (const n of sorted) {
    const i = lowerBound(times, n.t - 45);
    if (i < times.length && times[i] <= n.t + 45) aligned++;
  }
  const counts = new Array(laneCount).fill(0);
  for (const n of sorted) counts[n.lane]++;
  let ent = 0;
  for (const c of counts) {
    const p = c / Math.max(1, sorted.length);
    if (p > 0) ent -= p * Math.log(p);
  }
  // Ignore chords when measuring jacks.
  const singles = sorted.filter((n) => n.group === undefined);
  let longest = singles.length ? 1 : 0;
  let run = 1;
  let fast = 0;
  for (let i = 1; i < singles.length; i++) {
    if (singles[i].lane === singles[i - 1].lane) {
      run++;
      if (singles[i].t - singles[i - 1].t < 250) fast++;
    } else run = 1;
    longest = Math.max(longest, run);
  }
  const xs: number[] = [];
  const ys: number[] = [];
  for (const s of segments) {
    const len = (s.endMs - s.startMs) / 1000;
    if (len < 4) continue;
    xs.push(s.intensity);
    ys.push(sorted.filter((n) => n.t >= s.startMs && n.t < s.endMs).length / len);
  }
  return {
    alignment: sorted.length ? aligned / sorted.length : 0,
    laneBalance: laneCount > 1 ? ent / Math.log(laneCount) : 1,
    longestJack: longest,
    fastJackRate: singles.length > 1 ? fast / (singles.length - 1) : 0,
    densityFollowsEnergy: correlation(xs, ys),
  };
}

function correlation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return 1;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (sxx < 1e-9 || syy < 1e-9) return 1;
  return sxy / Math.sqrt(sxx * syy);
}
