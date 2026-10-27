import type { TempoInfo } from '../types';
import { clamp, median } from '../util';

export const MIN_BPM = 50;
export const MAX_BPM = 220;

/**
 * Rhythm-emphasis envelope: the onset curve minus its local (±0.5 s) mean, half-wave
 * rectified and scaled to unit standard deviation. Periodicities in this envelope are
 * what tempo estimation and beat tracking look for.
 */
export function onsetEnvelope(o: Float32Array, fps: number): Float32Array {
  const n = o.length;
  const half = Math.round(0.5 * fps);
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + o[i];
  const env = new Float32Array(n);
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - half);
    const b = Math.min(n, i + half + 1);
    const v = o[i] - (pre[b] - pre[a]) / (b - a);
    env[i] = v > 0 ? v : 0;
    sumSq += env[i] * env[i];
  }
  const std = Math.sqrt(sumSq / Math.max(1, n)) || 1;
  for (let i = 0; i < n; i++) env[i] /= std;
  return env;
}

/** Normalized autocorrelation of env[from, to) for lags 0..maxLag. */
function windowAcf(env: Float32Array, from: number, to: number, maxLag: number, out: Float64Array): void {
  const len = to - from;
  let r0 = 0;
  for (let i = from; i < to; i++) r0 += env[i] * env[i];
  out[0] = 1;
  if (r0 <= 1e-9) {
    out.fill(0, 1);
    return;
  }
  for (let lag = 1; lag <= maxLag; lag++) {
    let s = 0;
    const end = to - lag;
    for (let i = from; i < end; i++) s += env[i] * env[i + lag];
    // Unbiased-ish: compensate for the shrinking overlap.
    out[lag] = (s / r0) * (len / Math.max(1, len - lag));
  }
}

export interface TempoEstimate extends TempoInfo {
  /** Beat period in frames (fractional). */
  period: number;
  /** Per-frame local beat period in frames, following tempo drift/changes. */
  localPeriod: Float32Array;
  /** Fraction of the song whose local tempo agrees with the global estimate (0..1). */
  stability: number;
}

function bpmToLag(bpm: number, fps: number): number {
  return (60 * fps) / bpm;
}
function lagToBpm(lag: number, fps: number): number {
  return (60 * fps) / lag;
}

/** Log-normal tempo prior (preference for 80–160 BPM), as in most beat trackers. */
function prior(bpm: number): number {
  const z = Math.log2(bpm / 118) / 0.85;
  return Math.exp(-0.5 * z * z);
}

export function estimateTempo(env: Float32Array, fps: number): TempoEstimate {
  const n = env.length;
  const minLag = Math.floor(bpmToLag(MAX_BPM, fps));
  const maxLag = Math.ceil(bpmToLag(MIN_BPM, fps));
  const acfMax = Math.min(4 * maxLag, Math.max(maxLag + 1, n - 1));
  const winLen = Math.min(n, Math.round(12 * fps));
  const winHop = Math.max(1, Math.round(4 * fps));

  // Average windowed autocorrelations (a tempogram collapsed over time).
  const acc = new Float64Array(acfMax + 1);
  const tmp = new Float64Array(acfMax + 1);
  const windows: { center: number; acf: Float64Array }[] = [];
  let count = 0;
  for (let start = 0; start < n; start += winHop) {
    const end = Math.min(n, start + winLen);
    if (end - start < winLen * 0.6 && start > 0) break;
    tmp.fill(0);
    windowAcf(env, start, end, Math.min(acfMax, end - start - 1), tmp);
    let energy = 0;
    for (let i = start; i < end; i++) energy += env[i];
    // Skip silent windows; they carry no tempo evidence.
    if (energy > 1e-6 * (end - start)) {
      for (let l = 0; l <= acfMax; l++) acc[l] += tmp[l];
      windows.push({ center: (start + end) / 2, acf: Float64Array.from(tmp) });
      count++;
    }
    if (end >= n) break;
  }
  if (count === 0) {
    return {
      bpm: 120,
      confidence: 0,
      stable: false,
      candidates: [],
      period: bpmToLag(120, fps),
      localPeriod: new Float32Array(n).fill(bpmToLag(120, fps)),
      stability: 0,
    };
  }
  for (let l = 0; l <= acfMax; l++) acc[l] /= count;

  // Harmonic-enhanced pulse score: a true beat period also shows periodicity at 2x and 4x.
  const at = (lag: number) => {
    if (lag > acfMax) return 0;
    const i = Math.floor(lag);
    const f = lag - i;
    return i + 1 <= acfMax ? acc[i] * (1 - f) + acc[i + 1] * f : acc[i];
  };
  // Max of the ACF over the lags a multiple k*l can map to (l is an integer lag, so the
  // true period is within ±0.5 frame and its k-th multiple within ±k/2 frames).
  const atMultiple = (l: number, k: number) => {
    let m = -Infinity;
    const lo = Math.floor(k * (l - 0.5));
    const hi = Math.ceil(k * (l + 0.5));
    for (let x = lo; x <= hi; x++) if (x <= acfMax && acc[x] > m) m = acc[x];
    return m === -Infinity ? 0 : m;
  };
  const score = new Float64Array(maxLag + 2);
  for (let l = minLag; l <= maxLag; l++) {
    // Beat, two-beat and bar (3 or 4 beat) periodicities all support a beat period.
    const bar = Math.max(atMultiple(l, 3), atMultiple(l, 4));
    score[l] = Math.max(0, at(l)) + 0.5 * Math.max(0, atMultiple(l, 2)) + 0.5 * Math.max(0, bar);
  }

  // Local maxima weighted by the prior.
  const cands: { lag: number; raw: number; weighted: number }[] = [];
  for (let l = minLag + 1; l < maxLag; l++) {
    if (score[l] >= score[l - 1] && score[l] > score[l + 1]) {
      const y0 = score[l - 1];
      const y1 = score[l];
      const y2 = score[l + 1];
      const d = y0 - 2 * y1 + y2;
      const lag = d < 0 ? l + clamp((0.5 * (y0 - y2)) / d, -0.5, 0.5) : l;
      const bpm = lagToBpm(lag, fps);
      cands.push({ lag, raw: y1, weighted: y1 * prior(bpm) });
    }
  }
  cands.sort((a, b) => b.weighted - a.weighted);
  const best = cands[0] ?? { lag: bpmToLag(120, fps), raw: 0, weighted: 0 };

  // Confidence: how far the winning peak stands above the typical score.
  const vals: number[] = [];
  for (let l = minLag; l <= maxLag; l++) vals.push(score[l]);
  const med = median(vals);
  const mx = Math.max(...vals);
  const contrast = mx > 1e-9 ? (best.raw - med) / mx : 0;
  // Periodicity strength: plain ACF height at the period (1 = perfectly periodic).
  const strength = clamp(at(best.lag), 0, 1);
  let confidence = clamp(0.55 * clamp(contrast * 1.6, 0, 1) + 0.45 * clamp(strength * 1.4, 0, 1), 0, 1);

  // Local tempo curve: a smoothed path through the windowed autocorrelations (dynamic
  // programming), pulled toward the global period and penalized for jumps, so swing and
  // syncopation cannot drag it onto a different metrical level while genuine tempo
  // changes (accelerandos, live drift) are still followed.
  const P = best.lag;
  const lo = Math.max(minLag, Math.floor(P * 0.75));
  const hi = Math.min(acfMax, Math.ceil(P * 1.33));
  const nl = hi - lo + 1;
  const W = windows.length;
  const PULL = 0.6;
  const SMOOTH = 4;
  const cost = new Float64Array(W * nl);
  const from = new Int32Array(W * nl);
  // Per-window pulse score with the same harmonic support as the global estimate (a
  // sparse kick-snare beat is periodic at 2 and 4 beats even when weak at 1).
  const winMultiple = (acf: Float64Array, l: number, k: number) => {
    let m = 0;
    for (let x = Math.floor(k * (l - 0.5)); x <= Math.ceil(k * (l + 0.5)); x++) if (x <= acfMax && acf[x] > m) m = acf[x];
    return m;
  };
  const wscore = new Float64Array(nl);
  for (let w = 0; w < W; w++) {
    const acf = windows[w].acf;
    let mx = 1e-9;
    for (let j = 0; j < nl; j++) {
      const l = lo + j;
      wscore[j] = Math.max(0, acf[l]) + 0.5 * winMultiple(acf, l, 2) + 0.5 * Math.max(winMultiple(acf, l, 3), winMultiple(acf, l, 4));
      mx = Math.max(mx, wscore[j]);
    }
    for (let j = 0; j < nl; j++) {
      const lag = lo + j;
      const local = -wscore[j] / mx + PULL * Math.abs(Math.log(lag / P));
      if (w === 0) {
        cost[j] = local;
        continue;
      }
      let bestC = Infinity;
      let arg = 0;
      for (let k = 0; k < nl; k++) {
        const c = cost[(w - 1) * nl + k] + SMOOTH * Math.abs(Math.log((lo + j) / (lo + k)));
        if (c < bestC) {
          bestC = c;
          arg = k;
        }
      }
      cost[w * nl + j] = local + bestC;
      from[w * nl + j] = arg;
    }
  }
  const localLags: { center: number; lag: number }[] = new Array(W);
  if (W > 0) {
    let j = 0;
    for (let k = 1; k < nl; k++) if (cost[(W - 1) * nl + k] < cost[(W - 1) * nl + j]) j = k;
    for (let w = W - 1; w >= 0; w--) {
      localLags[w] = { center: windows[w].center, lag: lo + j };
      j = from[w * nl + j];
    }
  }
  let agree = 0;
  for (const x of localLags) if (Math.abs(x.lag - P) / P < 0.04) agree++;
  const stability = W ? agree / W : 0;
  const stable = stability >= 0.8;
  if (!stable) confidence *= 0.6 + 0.4 * stability;

  const localPeriod = new Float32Array(n);
  if (stable || localLags.length < 2) localPeriod.fill(P);
  else {
    const sm = localLags;
    let k = 0;
    for (let i = 0; i < n; i++) {
      while (k < sm.length - 2 && i > sm[k + 1].center) k++;
      const a = sm[k];
      const b = sm[Math.min(sm.length - 1, k + 1)];
      const f = b.center === a.center ? 0 : clamp((i - a.center) / (b.center - a.center), 0, 1);
      localPeriod[i] = a.lag + (b.lag - a.lag) * f;
    }
  }

  const top = cands.slice(0, 5);
  const topScore = top[0]?.weighted || 1;
  return {
    bpm: lagToBpm(P, fps),
    confidence,
    stable,
    candidates: top.map((c) => ({ bpm: lagToBpm(c.lag, fps), score: c.weighted / topScore })),
    period: P,
    localPeriod,
    stability,
  };
}
