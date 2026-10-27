import { ANALYSIS_VERSION, type AnalysisResult, type MeterInfo, type Onset } from '../types';
import { clamp, median } from '../util';
import { refineBeats, trackBeatFrames } from './beats';
import { estimateMeter } from './meter';
import { detectOnsets, normalizeOdfs, pulseCurve } from './onsets';
import { computeSpectralFeatures, decimate, type SpectralFeatures } from './spectrum';
import { beatFeatures, segmentSong, BEAT_FEATURE_DIMS } from './structure';
import { estimateTempo, onsetEnvelope } from './tempo';

export type AnalysisStage = 'spectrum' | 'onsets' | 'tempo' | 'beats' | 'structure';

export interface AnalyzeOptions {
  onProgress?: (stage: AnalysisStage, fraction: number) => void;
  shouldAbort?: () => boolean;
}

export class AnalysisError extends Error {
  constructor(
    readonly code: 'silent' | 'too-short' | 'no-rhythm' | 'aborted' | 'invalid',
    message: string,
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

const TARGET_RMS = 0.1;

/**
 * Full music analysis of a mono signal. Pure computation (no DOM, no Web Audio), so it
 * runs in a Web Worker in the app and directly in Node for tests.
 */
export function analyzeAudio(input: Float32Array, inputRate: number, opts: AnalyzeOptions = {}): AnalysisResult {
  const progress = opts.onProgress ?? (() => {});
  if (!input || input.length === 0 || !(inputRate > 0)) throw new AnalysisError('invalid', 'No audio samples to analyze.');
  const durationMs = (input.length / inputRate) * 1000;
  if (durationMs < 3000) throw new AnalysisError('too-short', 'This track is shorter than 3 seconds — too short to play.');

  // Work at ~22 kHz: plenty for rhythm, and 4x cheaper than 44.1 kHz stereo.
  const factor = inputRate > 30000 ? Math.round(inputRate / 22050) : 1;
  const signal = factor > 1 ? decimate(input, factor) : Float32Array.from(input);
  const sampleRate = inputRate / factor;

  // Loudness and gain normalization (keeps the log-spectrum scale comparable across files).
  let sumSq = 0;
  let peak = 0;
  for (let i = 0; i < signal.length; i++) {
    const v = signal[i];
    if (!isFinite(v)) signal[i] = 0;
    sumSq += v * v;
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  const rms = Math.sqrt(sumSq / signal.length);
  const loudnessDb = 20 * Math.log10(rms + 1e-12);
  if (peak < 1e-4 || loudnessDb < -70) {
    throw new AnalysisError('silent', 'This file seems to be silent, so there is no rhythm to map.');
  }
  const gain = Math.min(TARGET_RMS / rms, 30);
  for (let i = 0; i < signal.length; i++) signal[i] *= gain;

  const feat = computeSpectralFeatures(signal, sampleRate, {
    onProgress: (f) => progress('spectrum', f),
    shouldAbort: opts.shouldAbort,
  });
  checkAbort(opts);

  progress('onsets', 0);
  const norm = normalizeOdfs(feat);
  const onsets = detectOnsets(feat, norm);
  const { firstSoundMs, lastSoundMs } = soundRange(feat, durationMs);
  progress('onsets', 1);
  checkAbort(opts);

  const notes: string[] = [];
  const strongCount = onsets.filter((o) => o.s > 0.25).length;
  const rhythmic = strongCount >= 8 && lastSoundMs - firstSoundMs > 4000;

  progress('tempo', 0);
  const env = onsetEnvelope(pulseCurve(norm), feat.fps);
  const tempo = estimateTempo(env, feat.fps);
  progress('tempo', 1);
  checkAbort(opts);

  progress('beats', 0);
  let beats: number[] = [];
  let beatConfidence = 0;
  let meter: MeterInfo = { beatsPerBar: 4, firstDownbeat: 0, confidence: 0, subdivision: 'binary' };
  if (rhythmic) {
    const frames = trackBeatFrames(env, tempo.localPeriod);
    const refined = refineBeats(frames, feat.fps, onsets, firstSoundMs, lastSoundMs, tempo.stable);
    beats = extendGrid(refined.beats, firstSoundMs, lastSoundMs);
    const regularity = gridRegularity(beats);
    beatConfidence = beats.length >= 8 ? clamp(0.45 * clamp(refined.matchRate * 1.3, 0, 1) + 0.35 * tempo.confidence + 0.2 * regularity, 0, 1) : 0;
    if (beats.length >= 8) meter = estimateMeter(beats, feat.fps, norm.o, norm.low, feat.chroma, onsets);
    if (beatConfidence < 0.45) notes.push('Loose or changing tempo: notes follow detected hits instead of a strict grid.');
  } else {
    notes.push('Very little rhythmic content was detected.');
  }
  progress('beats', 1);
  checkAbort(opts);

  progress('structure', 0);
  const units = beats.length >= 8 ? beats : pseudoBeats(durationMs);
  const bf = beatFeatures(feat, norm.o, units, durationMs);
  const segments = segmentSong(bf, units, beats.length >= 8 ? meter : null, onsets, durationMs, firstSoundMs);
  progress('structure', 1);

  // Curves for visuals and the editor.
  const energy = new Float32Array(feat.frames);
  let maxDb = -Infinity;
  for (let i = 0; i < feat.frames; i++) maxDb = Math.max(maxDb, feat.energyDb[i]);
  for (let i = 0; i < feat.frames; i++) energy[i] = clamp((feat.energyDb[i] - (maxDb - 36)) / 36, 0, 1);
  const peaks = new Float32Array(feat.frames);
  let maxPk = 0;
  for (let i = 0; i < feat.frames; i++) maxPk = Math.max(maxPk, feat.peaks[i]);
  for (let i = 0; i < feat.frames; i++) peaks[i] = maxPk > 0 ? feat.peaks[i] / maxPk : 0;

  return {
    version: ANALYSIS_VERSION,
    durationMs,
    fps: feat.fps,
    odf: norm.o,
    odfLow: norm.low,
    odfHigh: norm.high,
    energy,
    peaks,
    onsets,
    tempo: { bpm: tempo.bpm, confidence: tempo.confidence, stable: tempo.stable, candidates: tempo.candidates },
    beats,
    beatConfidence,
    meter,
    segments,
    beatFeatures: beats.length >= 8 ? bf : new Float32Array(0),
    beatFeatureDims: BEAT_FEATURE_DIMS,
    firstSoundMs,
    lastSoundMs,
    loudnessDb,
    rhythmic,
    notes,
  };
}

function checkAbort(opts: AnalyzeOptions): void {
  if (opts.shouldAbort?.()) throw new AnalysisError('aborted', 'Analysis was cancelled.');
}

function soundRange(feat: SpectralFeatures, durationMs: number): { firstSoundMs: number; lastSoundMs: number } {
  let maxDb = -Infinity;
  for (let i = 0; i < feat.frames; i++) maxDb = Math.max(maxDb, feat.energyDb[i]);
  const floor = Math.max(maxDb - 40, -65);
  let first = 0;
  while (first < feat.frames && feat.energyDb[first] < floor) first++;
  let last = feat.frames - 1;
  while (last > first && feat.energyDb[last] < floor) last--;
  return {
    firstSoundMs: (first / feat.fps) * 1000,
    lastSoundMs: Math.min(durationMs, (last / feat.fps) * 1000),
  };
}

/** Extend a beat grid backwards/forwards at the edge tempo to cover all audible material. */
function extendGrid(beats: number[], firstSoundMs: number, lastSoundMs: number): number[] {
  if (beats.length < 4) return beats;
  const out = beats.slice();
  const headP = median(out.slice(1, 9).map((b, i) => b - out[i]));
  while (out[0] - headP >= firstSoundMs - headP * 0.4 && out[0] - headP >= 0) out.unshift(out[0] - headP);
  const tail = out.slice(-9);
  const tailP = median(tail.slice(1).map((b, i) => b - tail[i]));
  while (out[out.length - 1] + tailP <= lastSoundMs) out.push(out[out.length - 1] + tailP);
  return out;
}

/** 1 when inter-beat intervals are steady, falling toward 0 as they become erratic. */
function gridRegularity(beats: number[]): number {
  if (beats.length < 4) return 0;
  const ibi = beats.slice(1).map((b, i) => b - beats[i]);
  const med = median(ibi);
  const dev = median(ibi.map((x) => Math.abs(x - med))) / med;
  return clamp(1 - dev * 10, 0, 1);
}

function pseudoBeats(durationMs: number): number[] {
  const out: number[] = [];
  for (let t = 0; t < durationMs; t += 500) out.push(t);
  return out;
}

/** Summary used by the onset list when a caller only needs times (diagnostics/tests). */
export function onsetTimes(onsets: Onset[], minStrength = 0): number[] {
  return onsets.filter((o) => o.s >= minStrength).map((o) => o.t);
}
