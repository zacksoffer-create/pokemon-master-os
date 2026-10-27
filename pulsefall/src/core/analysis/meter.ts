import type { MeterInfo, Onset } from '../types';
import { clamp, mean } from '../util';

/** Sample a curve at a time (ms) taking the max within ±radius frames. */
export function sampleMax(curve: Float32Array, fps: number, tMs: number, radius = 2): number {
  const c = Math.round((tMs / 1000) * fps);
  let m = 0;
  for (let k = c - radius; k <= c + radius; k++) if (k >= 0 && k < curve.length && curve[k] > m) m = curve[k];
  return m;
}

function cosine(a: Float32Array, ao: number, b: Float32Array, bo: number, dims: number): number {
  let s = 0;
  let na = 0;
  let nb = 0;
  for (let d = 0; d < dims; d++) {
    s += a[ao + d] * b[bo + d];
    na += a[ao + d] * a[ao + d];
    nb += b[bo + d] * b[bo + d];
  }
  return na > 1e-12 && nb > 1e-12 ? s / Math.sqrt(na * nb) : 1;
}

/**
 * Bar length (3 or 4 beats), downbeat phase and binary/ternary subdivision.
 * Downbeats are where low-frequency accents and harmonic changes concentrate.
 */
export function estimateMeter(
  beats: number[],
  fps: number,
  o: Float32Array,
  low: Float32Array,
  chroma: Float32Array,
  onsets: Onset[] = [],
): MeterInfo {
  const nb = beats.length;
  const fallback: MeterInfo = { beatsPerBar: 4, firstDownbeat: 0, confidence: 0, subdivision: 'binary' };
  if (nb < 8) return fallback;

  // Per-beat accent: low-band onset at the beat + harmonic change entering the beat.
  const lowAcc = beats.map((b) => sampleMax(low, fps, b));
  const chromaBeat = new Float32Array(nb * 12);
  for (let i = 0; i < nb; i++) {
    const a = Math.max(0, Math.round((beats[i] / 1000) * fps));
    const e = Math.min(o.length, Math.round(((i + 1 < nb ? beats[i + 1] : beats[i] + 500) / 1000) * fps));
    for (let f = a; f < e; f++) for (let c = 0; c < 12; c++) chromaBeat[i * 12 + c] += chroma[f * 12 + c];
  }
  const change = new Array(nb).fill(0);
  // Harmonic change only counts where the audio is tonal (a peaked pitch-class profile);
  // on drums alone chroma is noise.
  const tonality = new Array(nb).fill(0);
  for (let i = 0; i < nb; i++) {
    let mx = 0;
    let sum = 0;
    for (let c = 0; c < 12; c++) {
      const v = chromaBeat[i * 12 + c];
      sum += v;
      if (v > mx) mx = v;
    }
    tonality[i] = sum > 0 ? clamp((mx / (sum / 12) - 1.6) / 2, 0, 1) : 0;
  }
  for (let i = 1; i < nb; i++) {
    change[i] = (1 - cosine(chromaBeat, i * 12, chromaBeat, (i - 1) * 12, 12)) * Math.min(tonality[i], tonality[i - 1]);
  }
  const normalize = (xs: number[]) => {
    const m = Math.max(...xs, 1e-9);
    return xs.map((x) => x / m);
  };
  const lowN = normalize(lowAcc);
  const chgN = normalize(change);
  const accent = lowN.map((v, i) => 0.55 * v + 0.45 * chgN[i]);
  // Songs usually begin on a downbeat: favour the phase of the first strongly accented beat.
  const firstStrong = onsets.find((o) => o.s > 0.5);
  let firstBeat = -1;
  if (firstStrong) {
    let bestD = Infinity;
    beats.forEach((b, i) => {
      const d = Math.abs(b - firstStrong.t);
      if (d < bestD && d < 80) {
        bestD = d;
        firstBeat = i;
      }
    });
  }

  const evaluate = (m: number) => {
    let best = { phase: 0, score: -Infinity };
    for (let ph = 0; ph < m; ph++) {
      const on: number[] = [];
      const off: number[] = [];
      for (let i = 0; i < nb; i++) ((i - ph) % m === 0 ? on : off).push(accent[i]);
      let s = mean(on) - mean(off);
      if (firstBeat >= 0 && (firstBeat - ph) % m === 0) s += 0.1;
      if (s > best.score) best = { phase: ph, score: s };
    }
    return best;
  };
  const four = evaluate(4);
  const three = evaluate(3);
  // Prefer 4/4 unless triple meter is clearly stronger.
  const useThree = three.score > four.score * 1.35 && three.score > 0.08;
  const chosen = useThree ? three : four;
  const m = useThree ? 3 : 4;
  const confidence = clamp(chosen.score * 2.5, 0, 1);

  // Subdivision: is the space between beats split in two/four (straight) or three (swing/triplets)?
  let binary = 0;
  let ternary = 0;
  for (let i = 0; i + 1 < nb; i++) {
    const a = beats[i];
    const d = beats[i + 1] - a;
    binary += Math.max(sampleMax(o, fps, a + d / 2, 1), sampleMax(o, fps, a + d / 4, 1), sampleMax(o, fps, a + (3 * d) / 4, 1));
    ternary += Math.max(sampleMax(o, fps, a + d / 3, 1), sampleMax(o, fps, a + (2 * d) / 3, 1));
  }
  binary /= nb - 1;
  ternary /= nb - 1;
  const subdivision = ternary > 1.5 * binary && ternary > 0.1 ? 'ternary' : 'binary';
  return { beatsPerBar: m, firstDownbeat: chosen.phase, confidence, subdivision };
}
