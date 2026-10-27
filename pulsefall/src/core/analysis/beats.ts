import type { Onset } from '../types';
import { clamp, lowerBound, median } from '../util';
import { ODF_BIAS_MS } from './onsets';

/**
 * Dynamic-programming beat tracker (Ellis 2007), extended with a per-frame target
 * period so it can follow tempo drift and tempo changes. Returns beat frame indices.
 */
export function trackBeatFrames(env: Float32Array, localPeriod: Float32Array, tightness = 120): number[] {
  const n = env.length;
  if (n < 4) return [];
  // Smooth the envelope with a narrow Gaussian scaled to the period (as in Ellis/librosa).
  const local = new Float32Array(n);
  const p0 = localPeriod[0] || 50;
  const radius = Math.max(1, Math.round(p0 / 8));
  const kernel: number[] = [];
  for (let k = -radius; k <= radius; k++) kernel.push(Math.exp(-0.5 * Math.pow((k * 32) / p0, 2)));
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = -radius; k <= radius; k++) {
      const j = i + k;
      if (j >= 0 && j < n) s += env[j] * kernel[k + radius];
    }
    local[i] = s;
  }

  const cum = new Float64Array(n);
  const back = new Int32Array(n).fill(-1);
  for (let t = 0; t < n; t++) {
    const P = localPeriod[t];
    const from = Math.max(0, Math.round(t - 2 * P));
    const to = Math.round(t - P / 2);
    let best = -Infinity;
    let arg = -1;
    for (let tau = from; tau <= to; tau++) {
      const d = Math.log((t - tau) / P);
      const v = cum[tau] - tightness * d * d;
      if (v > best) {
        best = v;
        arg = tau;
      }
    }
    if (arg >= 0 && best > 0) {
      cum[t] = local[t] + best;
      back[t] = arg;
    } else {
      cum[t] = local[t];
    }
  }

  // Last beat: the final local maximum of the cumulative score that is reasonably strong.
  const maxima: number[] = [];
  for (let t = 1; t < n - 1; t++) if (cum[t] > cum[t - 1] && cum[t] >= cum[t + 1]) maxima.push(t);
  if (maxima.length === 0) return [];
  const medMax = median(maxima.map((t) => cum[t]));
  let last = maxima[maxima.length - 1];
  for (let k = maxima.length - 1; k >= 0; k--) {
    if (cum[maxima[k]] > 0.5 * medMax) {
      last = maxima[k];
      break;
    }
  }
  const beats: number[] = [];
  for (let t = last; t >= 0; t = back[t]) {
    beats.push(t);
    if (back[t] < 0) break;
  }
  return beats.reverse();
}

/**
 * Turn raw beat frames into a clean beat grid in ms:
 *  - drop beats outside the audible range,
 *  - smooth timing jitter with a robust local linear fit,
 *  - align the grid phase to nearby detected onsets.
 */
export function refineBeats(
  frames: number[],
  fps: number,
  onsets: Onset[],
  firstSoundMs: number,
  lastSoundMs: number,
  stable: boolean,
): { beats: number[]; matchRate: number } {
  let beats = frames.map((f) => (f / fps) * 1000 + ODF_BIAS_MS);
  if (beats.length < 4) return { beats, matchRate: 0 };
  const period = median(beats.slice(1).map((b, i) => b - beats[i]));
  beats = beats.filter((b) => b >= firstSoundMs - period * 0.6 && b <= lastSoundMs + period * 0.25);
  if (beats.length < 4) return { beats, matchRate: 0 };

  // Local linear regression over ±W beats (index -> time), with one outlier-rejection pass.
  const W = stable ? 8 : 3;
  const smoothed = beats.map((_, i) => {
    const a = Math.max(0, i - W);
    const b = Math.min(beats.length - 1, i + W);
    let pts: { x: number; y: number }[] = [];
    for (let k = a; k <= b; k++) pts.push({ x: k, y: beats[k] });
    let fit = linfit(pts);
    pts = pts.filter((p) => Math.abs(p.y - (fit.a + fit.b * p.x)) < 0.12 * period);
    if (pts.length >= 3) fit = linfit(pts);
    const y = fit.a + fit.b * i;
    // Never move a beat by more than 15% of a period.
    return clamp(y, beats[i] - 0.15 * period, beats[i] + 0.15 * period);
  });

  // Phase alignment: median offset to strong onsets within ±60 ms.
  const strong = onsets.filter((o) => o.s >= 0.35).map((o) => o.t);
  const offsets: number[] = [];
  for (const b of smoothed) {
    const j = lowerBound(strong, b - 60);
    let bestD = Infinity;
    for (let k = j; k < strong.length && strong[k] <= b + 60; k++) {
      const d = strong[k] - b;
      if (Math.abs(d) < Math.abs(bestD)) bestD = d;
    }
    if (bestD !== Infinity) offsets.push(bestD);
  }
  const matchRate = offsets.length / smoothed.length;
  const shift = offsets.length >= Math.max(4, smoothed.length * 0.25) ? median(offsets) : 0;
  return { beats: smoothed.map((b) => b + shift), matchRate };
}

function linfit(pts: { x: number; y: number }[]): { a: number; b: number } {
  const n = pts.length;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    sxy += p.x * p.y;
  }
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-9) return { a: sy / n, b: 0 };
  const b = (n * sxy - sx * sy) / den;
  return { a: (sy - b * sx) / n, b };
}

/** Fill a constant-tempo grid from an explicit BPM and first beat (manual override). */
export function gridFromTempo(bpm: number, firstBeatMs: number, durationMs: number): number[] {
  const period = 60000 / bpm;
  const beats: number[] = [];
  let t = firstBeatMs;
  while (t - period >= 0) t -= period;
  for (; t <= durationMs; t += period) beats.push(t);
  return beats;
}
