import type { MeterInfo, Onset, Segment } from '../types';
import { clamp, lowerBound, mean } from '../util';
import { TIMBRE_DIMS, type SpectralFeatures } from './spectrum';

/** Layout of a per-beat feature row. */
export const BEAT_FEATURE_DIMS = 3 + 12 + TIMBRE_DIMS;
export const BF_ENERGY = 0;
export const BF_DENSITY = 1;
export const BF_BRIGHT = 2;
export const BF_CHROMA = 3;
export const BF_TIMBRE = 15;
/** Minimum feature-space distance between neighbouring sections (weighted z-units). */
const SECTION_CONTRAST = 1.2;

/**
 * Average frame features over each beat interval. When there is no beat grid,
 * pseudo-beats every 500 ms are used so structure analysis still works.
 */
export function beatFeatures(feat: SpectralFeatures, o: Float32Array, units: number[], durationMs: number): Float32Array {
  const D = BEAT_FEATURE_DIMS;
  const out = new Float32Array(units.length * D);
  const fps = feat.fps;
  for (let i = 0; i < units.length; i++) {
    const startMs = units[i];
    const endMs = i + 1 < units.length ? units[i + 1] : Math.min(durationMs, startMs + (i > 0 ? units[i] - units[i - 1] : 500));
    const a = clamp(Math.round((startMs / 1000) * fps), 0, feat.frames - 1);
    const b = clamp(Math.round((endMs / 1000) * fps), a + 1, feat.frames);
    const row = i * D;
    let e = 0;
    let dens = 0;
    let br = 0;
    for (let f = a; f < b; f++) {
      e += feat.energyDb[f];
      dens += o[f];
      br += feat.bright[f];
      for (let c = 0; c < 12; c++) out[row + BF_CHROMA + c] += feat.chroma[f * 12 + c];
      for (let c = 0; c < TIMBRE_DIMS; c++) out[row + BF_TIMBRE + c] += feat.timbre[f * TIMBRE_DIMS + c];
    }
    const len = b - a;
    out[row + BF_ENERGY] = e / len;
    out[row + BF_DENSITY] = (dens / len) * fps; // onset mass per second
    out[row + BF_BRIGHT] = br / len;
    let norm = 0;
    for (let c = 0; c < 12; c++) norm += out[row + BF_CHROMA + c] ** 2;
    norm = Math.sqrt(norm) || 1;
    for (let c = 0; c < 12; c++) out[row + BF_CHROMA + c] /= norm;
    for (let c = 0; c < TIMBRE_DIMS; c++) out[row + BF_TIMBRE + c] /= len;
  }
  return out;
}

/** Group beats into bars (or fixed blocks) and return unit start indices into `units`. */
export function barStarts(unitCount: number, meter: MeterInfo | null): number[] {
  const per = meter ? meter.beatsPerBar : 4;
  const phase = meter ? meter.firstDownbeat % per : 0;
  const starts: number[] = [0];
  for (let i = phase === 0 ? per : phase; i < unitCount; i += per) starts.push(i);
  return starts;
}

/**
 * Segment the song with a self-similarity novelty curve over bar-level features, then
 * rate each segment's intensity and give similar-sounding segments the same label.
 */
export function segmentSong(
  bf: Float32Array,
  units: number[],
  meter: MeterInfo | null,
  onsets: Onset[],
  durationMs: number,
  firstSoundMs: number,
): Segment[] {
  const D = BEAT_FEATURE_DIMS;
  const nUnits = units.length;
  if (nUnits < 2) return [{ startMs: 0, endMs: durationMs, intensity: 0.6, label: 0 }];
  const bars = barStarts(nUnits, meter);
  const nb = bars.length;

  // Bar feature vectors.
  const vecDims = D;
  const bv = new Float32Array(nb * vecDims);
  for (let k = 0; k < nb; k++) {
    const a = bars[k];
    const b = k + 1 < nb ? bars[k + 1] : nUnits;
    for (let u = a; u < b; u++) for (let d = 0; d < D; d++) bv[k * vecDims + d] += bf[u * D + d] / (b - a);
  }
  // Standardize each dimension and weight the groups.
  const weights = new Float32Array(vecDims);
  weights[BF_ENERGY] = 2.2;
  weights[BF_DENSITY] = 1.6;
  weights[BF_BRIGHT] = 1;
  for (let c = 0; c < 12; c++) weights[BF_CHROMA + c] = 0.55;
  for (let c = 0; c < TIMBRE_DIMS; c++) weights[BF_TIMBRE + c] = 0.9;
  for (let d = 0; d < vecDims; d++) {
    let m = 0;
    for (let k = 0; k < nb; k++) m += bv[k * vecDims + d];
    m /= nb;
    let v = 0;
    for (let k = 0; k < nb; k++) v += (bv[k * vecDims + d] - m) ** 2;
    const sd = Math.sqrt(v / nb) || 1;
    for (let k = 0; k < nb; k++) bv[k * vecDims + d] = ((bv[k * vecDims + d] - m) / sd) * weights[d];
  }

  const dist = (i: number, j: number) => {
    let s = 0;
    for (let d = 0; d < vecDims; d++) s += (bv[i * vecDims + d] - bv[j * vecDims + d]) ** 2;
    return Math.sqrt(s);
  };

  let boundaries: number[] = [0];
  if (nb >= 8) {
    // Multi-scale checkerboard novelty on the bar self-similarity matrix: a 2-bar kernel
    // catches short sections (a 4-bar build), a 4-bar kernel catches broad changes.
    const noveltyAt = (K: number) => {
      const out = new Float64Array(nb);
      for (let i = 1; i < nb; i++) {
        let across = 0;
        let na = 0;
        for (let a = Math.max(0, i - K); a < i; a++) {
          for (let b = i; b < Math.min(nb, i + K); b++) {
            const w = Math.exp(-0.5 * (((i - a - 0.5) / K) ** 2 + ((b - i + 0.5) / K) ** 2));
            across += dist(a, b) * w;
            na += w;
          }
        }
        let within = 0;
        let nw = 0;
        for (let a = Math.max(0, i - K); a < i; a++)
          for (let b = Math.max(0, i - K); b < i; b++) {
            within += dist(a, b);
            nw++;
          }
        for (let a = i; a < Math.min(nb, i + K); a++)
          for (let b = i; b < Math.min(nb, i + K); b++) {
            within += dist(a, b);
            nw++;
          }
        out[i] = na > 0 ? across / na - (nw > 0 ? within / nw : 0) : 0;
      }
      // Standardize so the two scales are comparable.
      const vals = Array.from(out).slice(1);
      const mu = mean(vals);
      const sd = Math.sqrt(mean(vals.map((x) => (x - mu) ** 2))) || 1;
      for (let i = 0; i < nb; i++) out[i] = i === 0 ? 0 : (out[i] - mu) / sd;
      return out;
    };
    const n2 = noveltyAt(2);
    const n4 = nb >= 16 ? noveltyAt(4) : n2;
    const novelty = n2.map((v, i) => 0.5 * v + 0.5 * n4[i]);
    const cands: { i: number; v: number }[] = [];
    for (let i = 2; i < nb - 1; i++) {
      let isMax = true;
      for (let k = Math.max(1, i - 1); k <= Math.min(nb - 1, i + 1); k++) if (novelty[k] > novelty[i]) isMax = false;
      if (isMax && novelty[i] > -0.2) cands.push({ i, v: novelty[i] });
    }
    // Contrast between the mean bar vectors on either side of a split.
    const spanMean = (a: number, b: number) => {
      const m = new Float64Array(vecDims);
      for (let k = a; k < b; k++) for (let d = 0; d < vecDims; d++) m[d] += bv[k * vecDims + d] / (b - a);
      return m;
    };
    const contrast = (a: number, mid: number, b: number) => {
      const x = spanMean(a, mid);
      const y = spanMean(mid, b);
      let s2 = 0;
      for (let d = 0; d < vecDims; d++) s2 += (x[d] - y[d]) ** 2;
      return Math.sqrt(s2);
    };
    // Strongest first; keep sections at least 4 bars long, snap to 4-bar phrases when close,
    // and only accept a boundary if the music on either side genuinely differs.
    cands.sort((a, b) => b.v - a.v);
    const chosen: number[] = [];
    for (const c of cands) {
      let idx = c.i;
      const snapped = Math.round(idx / 4) * 4;
      if (Math.abs(snapped - idx) <= 1 && snapped > 0 && snapped < nb) idx = snapped;
      if (!(chosen.every((x) => Math.abs(x - idx) >= 4) && idx >= 2 && nb - idx >= 2)) continue;
      const left = Math.max(0, ...chosen.filter((x) => x < idx));
      const right = Math.min(nb, ...chosen.filter((x) => x > idx));
      const k = 4;
      const ctr = contrast(Math.max(left, idx - k), idx, Math.min(right, idx + k));
      if (ctr >= SECTION_CONTRAST) chosen.push(idx);
    }
    // Top-down refinement: long sections are split at the phrase-aligned point of highest
    // contrast when the halves genuinely differ (catches builds and drops that sit between
    // larger changes and therefore never form a novelty peak).
    const bounds = [0, ...chosen.sort((a, b) => a - b), nb];
    for (let s = 0; s < bounds.length - 1; s++) {
      const a = bounds[s];
      const b = bounds[s + 1];
      if (b - a < 8) continue;
      let best = -1;
      let bestCtr = SECTION_CONTRAST;
      for (let idx = a + 4; idx <= b - 4; idx += 4) {
        const ctr = contrast(Math.max(a, idx - 4), idx, Math.min(b, idx + 4));
        if (ctr > bestCtr) {
          bestCtr = ctr;
          best = idx;
        }
      }
      if (best > 0) {
        bounds.splice(s + 1, 0, best);
        s--; // re-examine the left part
      }
    }
    boundaries = bounds.slice(0, -1);
  }

  // Build segments in ms.
  const strongOnsets = onsets.filter((o) => o.s > 0.3).map((o) => o.t);
  const segs: { startMs: number; endMs: number; loud: number; rate: number; vec: Float32Array }[] = [];
  for (let s = 0; s < boundaries.length; s++) {
    const b0 = boundaries[s];
    const b1 = s + 1 < boundaries.length ? boundaries[s + 1] : nb;
    const u0 = bars[b0];
    const u1 = b1 < nb ? bars[b1] : nUnits;
    const startMs = s === 0 ? 0 : units[u0];
    const endMs = b1 < nb ? units[u1] : durationMs;
    let loud = 0;
    for (let u = u0; u < u1; u++) loud += bf[u * D + BF_ENERGY];
    loud /= Math.max(1, u1 - u0);
    const a = Math.max(startMs, firstSoundMs);
    const span = Math.max(500, endMs - a);
    const rate = (lowerBound(strongOnsets, endMs) - lowerBound(strongOnsets, a)) / (span / 1000);
    const vec = new Float32Array(vecDims);
    for (let k = b0; k < b1; k++) for (let d = 0; d < vecDims; d++) vec[d] += bv[k * vecDims + d] / (b1 - b0);
    segs.push({ startMs, endMs, loud, rate, vec });
  }

  const maxLoud = Math.max(...segs.map((s) => s.loud));
  const maxRate = Math.max(...segs.map((s) => s.rate), 1e-6);
  // Similar segments share a label (leader clustering on timbre + harmony).
  const labels: number[] = [];
  const leaders: number[] = [];
  for (let s = 0; s < segs.length; s++) {
    let label = -1;
    for (let l = 0; l < leaders.length; l++) {
      const a = segs[leaders[l]].vec;
      const b = segs[s].vec;
      let dot = 0;
      let na = 0;
      let nbb = 0;
      for (let d = BF_CHROMA; d < vecDims; d++) {
        dot += a[d] * b[d];
        na += a[d] * a[d];
        nbb += b[d] * b[d];
      }
      const cos = na > 0 && nbb > 0 ? dot / Math.sqrt(na * nbb) : 0;
      if (cos > 0.6) {
        label = l;
        break;
      }
    }
    if (label < 0) {
      leaders.push(s);
      label = leaders.length - 1;
    }
    labels.push(label);
  }

  // Intensity mixes absolute loudness relative to the loudest section, rhythmic activity and
  // the section's loudness rank (so a chorus reads as bigger than its verse even when the
  // mastering squashes them to similar levels).
  const order = segs.map((s, i) => ({ i, loud: s.loud })).sort((x, y) => x.loud - y.loud);
  const rank = new Array(segs.length).fill(1);
  if (segs.length > 1) order.forEach((o, r) => (rank[o.i] = r / (segs.length - 1)));
  return segs.map((s, i) => {
    const rel = clamp(1 + (s.loud - maxLoud) / 10, 0, 1);
    const dens = s.rate / maxRate;
    const intensity = clamp(0.45 * rel + 0.25 * dens + 0.3 * rank[i], 0.08, 1);
    return { startMs: s.startMs, endMs: s.endMs, intensity, label: labels[i] };
  });
}
