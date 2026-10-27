import type { Onset } from '../types';
import { percentile } from '../util';
import type { SpectralFeatures } from './spectrum';

/**
 * Systematic lead of spectral-flux peaks relative to the true attack, in ms.
 * The flux of a centered window rises as soon as the window's leading edge reaches
 * the attack, so raw peaks land slightly early. Measured on synthetic drum fixtures
 * (see tests/unit/analysis.test.ts) and added back to every onset and beat time.
 */
export const ODF_BIAS_MS = 2;

export interface NormalizedOdfs {
  o: Float32Array;
  low: Float32Array;
  mid: Float32Array;
  high: Float32Array;
  /** Frames considered audible (not silence / fade tails). */
  active: Uint8Array;
}

export function activeMask(feat: SpectralFeatures, rangeDb = 50): Uint8Array {
  const mask = new Uint8Array(feat.frames);
  let max = -Infinity;
  for (let i = 0; i < feat.frames; i++) if (feat.energyDb[i] > max) max = feat.energyDb[i];
  const floor = Math.max(max - rangeDb, -70);
  for (let i = 0; i < feat.frames; i++) mask[i] = feat.energyDb[i] > floor ? 1 : 0;
  return mask;
}

/** Scale an onset curve so that its 95th percentile over audible frames is 1. */
export function normalizeCurve(x: Float32Array, active: Uint8Array, floor = 1): Float32Array {
  const vals: number[] = [];
  for (let i = 0; i < x.length; i++) if (active[i]) vals.push(x[i]);
  // The absolute floor keeps tiny fluctuations in a sustained, beatless sound from being
  // blown up into "strong" onsets (real attacks produce flux well above it).
  const p = Math.max(percentile(vals, 0.95), floor);
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = active[i] ? x[i] / p : 0;
  return out;
}

export function normalizeOdfs(feat: SpectralFeatures): NormalizedOdfs {
  const active = activeMask(feat);
  return {
    o: normalizeCurve(feat.odf, active),
    low: normalizeCurve(feat.odfLow, active, 0.25),
    mid: normalizeCurve(feat.odfMid, active, 0.5),
    high: normalizeCurve(feat.odfHigh, active, 0.5),
    active,
  };
}

/**
 * Pulse curve for tempo and beat tracking. The raw flux is dominated by the many
 * high-frequency bands (hi-hats), but listeners anchor the beat on kick and snare,
 * so the bands are balanced after per-band normalization.
 */
export function pulseCurve(norm: NormalizedOdfs): Float32Array {
  const n = norm.o.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = 0.3 * norm.o[i] + 0.4 * norm.low[i] + 0.3 * norm.mid[i] + 0.15 * norm.high[i];
  return out;
}

export interface PeakPickOptions {
  /** Absolute floor on the normalized curve. */
  threshold: number;
  /** Required height above the local average. */
  delta: number;
  /** Minimum spacing between onsets in ms. */
  combineMs: number;
}

const DEFAULT_PICK: PeakPickOptions = { threshold: 0.06, delta: 0.05, combineMs: 35 };

/**
 * Adaptive-threshold peak picking (local maximum within ±30 ms, above a moving average).
 * Returns fractional frame positions (parabolic interpolation) and peak heights.
 */
export function pickPeaks(o: Float32Array, fps: number, opts: Partial<PeakPickOptions> = {}): { frame: number; height: number; index: number }[] {
  const { threshold, delta, combineMs } = { ...DEFAULT_PICK, ...opts };
  const preMax = Math.round(0.03 * fps);
  const postMax = Math.round(0.03 * fps);
  const preAvg = Math.round(0.1 * fps);
  const postAvg = Math.round(0.07 * fps);
  const combine = (combineMs / 1000) * fps;
  const n = o.length;
  // Prefix sums for the moving average.
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + o[i];
  const out: { frame: number; height: number; index: number }[] = [];
  for (let i = 1; i < n - 1; i++) {
    const v = o[i];
    if (v < threshold) continue;
    let isMax = true;
    for (let k = Math.max(0, i - preMax); k <= Math.min(n - 1, i + postMax); k++) {
      if (o[k] > v || (o[k] === v && k < i)) {
        isMax = false;
        break;
      }
    }
    if (!isMax) continue;
    const a = Math.max(0, i - preAvg);
    const b = Math.min(n, i + postAvg + 1);
    const avg = (pre[b] - pre[a]) / (b - a);
    if (v < avg + delta) continue;
    const y0 = o[i - 1];
    const y2 = o[i + 1];
    const denom = y0 - 2 * v + y2;
    const shift = denom < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / denom)) : 0;
    const frame = i + shift;
    const last = out[out.length - 1];
    if (last && frame - last.frame < combine) {
      if (v > last.height) out[out.length - 1] = { frame, height: v, index: i };
      continue;
    }
    out.push({ frame, height: v, index: i });
  }
  return out;
}

function chromaSim(chroma: Float32Array, a: number, b: number): number {
  let s = 0;
  for (let c = 0; c < 12; c++) s += chroma[a * 12 + c] * chroma[b * 12 + c];
  return s;
}

/**
 * Follow the band group that carried the onset until its level falls 9 dB under the
 * attack peak, the harmony changes, or the group is struck again.
 */
function groupSustain(feat: SpectralFeatures, norm: NormalizedOdfs, i: number, g: number, maxLook: number): number {
  const frames = feat.frames;
  const groupOdf = g === 0 ? norm.low : g === 1 ? norm.mid : norm.high;
  let peakDb = -Infinity;
  for (let k = i; k <= Math.min(frames - 1, i + 5); k++) peakDb = Math.max(peakDb, feat.bandDb[k * 3 + g]);
  const ref = Math.min(frames - 1, i + 3);
  let j = i + 1;
  for (; j < Math.min(frames, i + maxLook); j++) {
    if (feat.bandDb[j * 3 + g] < peakDb - 9) break;
    if (j > i + 6) {
      const sim = chromaSim(feat.chroma, ref, j);
      if (sim < 0.7) break;
      if (groupOdf[j] > 0.8 && sim < 0.9) break;
    }
  }
  return ((j - i) / feat.fps) * 1000;
}

/**
 * A pitched note or chord that *starts* at this onset (the harmony or mid-band level
 * changes here) and then rings: measured by how long the pitch-class profile stays put
 * while mid-band energy holds up. Deliberately conservative — in dense mixes it misses
 * some long notes rather than inventing holds where nothing sustains.
 */
function tonalSustain(feat: SpectralFeatures, norm: NormalizedOdfs, i: number, maxLook: number): number {
  const frames = feat.frames;
  if (i < 4 || i + 8 >= frames) return 0;
  const ref = new Float32Array(12);
  const before = new Float32Array(12);
  for (let k = i + 2; k <= i + 5; k++) for (let c = 0; c < 12; c++) ref[c] += feat.chroma[k * 12 + c];
  for (let k = i - 4; k <= i - 1; k++) for (let c = 0; c < 12; c++) before[c] += feat.chroma[k * 12 + c];
  const unit = (v: Float32Array) => {
    let n = 0;
    for (let c = 0; c < 12; c++) n += v[c] * v[c];
    n = Math.sqrt(n) || 1;
    for (let c = 0; c < 12; c++) v[c] /= n;
    return v;
  };
  unit(ref);
  unit(before);
  let mx = 0;
  let sum = 0;
  for (let c = 0; c < 12; c++) {
    mx = Math.max(mx, ref[c]);
    sum += ref[c];
  }
  if (mx / (sum / 12) < 2.2) return 0;
  let same = 0;
  for (let c = 0; c < 12; c++) same += ref[c] * before[c];
  const midBefore = (feat.bandDb[(i - 3) * 3 + 1] + feat.bandDb[(i - 2) * 3 + 1]) / 2;
  let midPeak = -Infinity;
  for (let k = i; k <= i + 5; k++) midPeak = Math.max(midPeak, feat.bandDb[k * 3 + 1]);
  if (same > 0.85 && midPeak - midBefore < 3) return 0;
  let j = i + 6;
  for (; j < Math.min(frames, i + maxLook); j++) {
    if (feat.bandDb[j * 3 + 1] < midPeak - 10) break;
    let sim = 0;
    for (let c = 0; c < 12; c++) sim += ref[c] * feat.chroma[j * 12 + c];
    if (sim < 0.8) break;
    if (norm.mid[j] > 0.7 && sim < 0.9) break;
  }
  return ((j - i) / feat.fps) * 1000;
}

/**
 * Detect onsets and describe each one: strength, band profile, brightness and how long
 * the sound it starts is sustained (used to justify hold notes).
 */
export function detectOnsets(feat: SpectralFeatures, norm: NormalizedOdfs): Onset[] {
  const { fps, frames } = feat;
  const peaks = pickPeaks(norm.o, fps);
  const onsets: Onset[] = [];
  const maxLook = Math.round(4 * fps);
  for (const p of peaks) {
    const i = p.index;
    let low = 0;
    let mid = 0;
    let high = 0;
    for (let k = Math.max(0, i - 1); k <= Math.min(frames - 1, i + 1); k++) {
      low = Math.max(low, norm.low[k]);
      mid = Math.max(mid, norm.mid[k]);
      high = Math.max(high, norm.high[k]);
    }
    let br = 0;
    let cnt = 0;
    for (let k = i + 1; k <= Math.min(frames - 1, i + 4); k++) {
      br += feat.bright[k];
      cnt++;
    }
    br = cnt ? br / cnt : feat.bright[i];

    const g = low >= mid && low >= high ? 0 : mid >= high ? 1 : 2;
    const sustain = Math.max(groupSustain(feat, norm, i, g, maxLook), tonalSustain(feat, norm, i, maxLook));
    onsets.push({
      t: (p.frame / fps) * 1000 + ODF_BIAS_MS,
      s: p.height,
      low,
      mid,
      high,
      bright: br,
      sustain,
    });
  }
  return onsets;
}
