import { RealFFT, hannWindow } from './fft';

/**
 * Frame-level features computed in a single STFT pass:
 *  - SuperFlux-style onset detection functions (overall and per band),
 *  - loudness and peak envelopes,
 *  - spectral brightness, chroma and a compact timbre descriptor.
 */
export interface SpectralFeatures {
  sampleRate: number;
  hop: number;
  fps: number;
  frames: number;
  /** Raw (unnormalized) onset detection functions. */
  odf: Float32Array;
  odfLow: Float32Array;
  odfMid: Float32Array;
  odfHigh: Float32Array;
  /** Frame RMS in dBFS. */
  energyDb: Float32Array;
  /** Peak |sample| per hop. */
  peaks: Float32Array;
  /** Log energy per band group (low/mid/high), interleaved frames x 3. */
  bandDb: Float32Array;
  /** 0..1 spectral centroid on the log-frequency axis. */
  bright: Float32Array;
  /** frames x 12, L2-normalized pitch-class profile. */
  chroma: Float32Array;
  /** frames x TIMBRE_DIMS cepstral-style descriptor. */
  timbre: Float32Array;
}

export const TIMBRE_DIMS = 8;
export const LOW_SPLIT_HZ = 180;
export const HIGH_SPLIT_HZ = 2600;

interface Filterbank {
  /** Per band: first bin, weights. */
  start: Int32Array;
  weights: Float32Array[];
  centers: Float32Array;
}

/** Logarithmically spaced triangular filters, merging bands narrower than one FFT bin. */
function logFilterbank(fftSize: number, sr: number, fmin: number, fmax: number, perOctave: number): Filterbank {
  const binHz = sr / fftSize;
  const nBins = fftSize / 2 + 1;
  const octaves = Math.log2(fmax / fmin);
  const count = Math.floor(octaves * perOctave) + 1;
  const centersHz: number[] = [];
  for (let i = 0; i < count; i++) centersHz.push(fmin * Math.pow(2, i / perOctave));
  // Convert to bins and keep unique, strictly increasing integer centers.
  const bins: number[] = [];
  for (const f of centersHz) {
    const b = Math.round(f / binHz);
    if (b >= 1 && b < nBins - 1 && (bins.length === 0 || b > bins[bins.length - 1])) bins.push(b);
  }
  const start: number[] = [];
  const weights: Float32Array[] = [];
  const centers: number[] = [];
  for (let i = 1; i < bins.length - 1; i++) {
    const lo = bins[i - 1];
    const c = bins[i];
    const hi = bins[i + 1];
    const w = new Float32Array(hi - lo + 1);
    for (let b = lo; b <= hi; b++) {
      w[b - lo] = b <= c ? (b - lo + 1) / (c - lo + 1) : (hi - b + 1) / (hi - c + 1);
    }
    // Normalize area so wide high bands do not dominate.
    let sum = 0;
    for (let k = 0; k < w.length; k++) sum += w[k];
    for (let k = 0; k < w.length; k++) w[k] /= sum;
    start.push(lo);
    weights.push(w);
    centers.push(c * binHz);
  }
  return { start: Int32Array.from(start), weights, centers: Float32Array.from(centers) };
}

export interface SpectrumOptions {
  onProgress?: (fraction: number) => void;
  /** Return true to abort (checked periodically). */
  shouldAbort?: () => boolean;
}

export function computeSpectralFeatures(signal: Float32Array, sampleRate: number, opts: SpectrumOptions = {}): SpectralFeatures {
  const hop = Math.round(sampleRate / 100);
  const fps = sampleRate / hop;
  const fftSize = sampleRate > 30000 ? 2048 : 1024;
  const halfWin = fftSize / 2;
  const nBins = fftSize / 2 + 1;
  const frames = Math.floor(signal.length / hop) + 1;
  const win = hannWindow(fftSize);
  const winSum = fftSize / 2;
  const fft = new RealFFT(fftSize);
  const fb = logFilterbank(fftSize, sampleRate, 30, Math.min(11000, sampleRate / 2 - 200), 12);
  const nBands = fb.start.length;

  // Band group membership.
  const group = new Uint8Array(nBands);
  for (let b = 0; b < nBands; b++) group[b] = fb.centers[b] < LOW_SPLIT_HZ ? 0 : fb.centers[b] < HIGH_SPLIT_HZ ? 1 : 2;

  // Chroma map for bins between 90 Hz and 5 kHz.
  const binHz = sampleRate / fftSize;
  const chromaBin = new Int8Array(nBins).fill(-1);
  for (let k = 1; k < nBins; k++) {
    const f = k * binHz;
    if (f < 90 || f > 5000) continue;
    const midi = 69 + 12 * Math.log2(f / 440);
    chromaBin[k] = ((Math.round(midi) % 12) + 12) % 12;
  }

  // DCT-II basis for the timbre descriptor (coefficients 1..TIMBRE_DIMS).
  const dct = new Float32Array(TIMBRE_DIMS * nBands);
  for (let c = 0; c < TIMBRE_DIMS; c++) {
    for (let b = 0; b < nBands; b++) dct[c * nBands + b] = Math.cos((Math.PI * (c + 1) * (b + 0.5)) / nBands);
  }

  const odf = new Float32Array(frames);
  const odfLow = new Float32Array(frames);
  const odfMid = new Float32Array(frames);
  const odfHigh = new Float32Array(frames);
  const energyDb = new Float32Array(frames);
  const peaks = new Float32Array(frames);
  const bandDb = new Float32Array(frames * 3);
  const bright = new Float32Array(frames);
  const chroma = new Float32Array(frames * 12);
  const timbre = new Float32Array(frames * TIMBRE_DIMS);

  const frame = new Float32Array(fftSize);
  const mags = new Float32Array(nBins);
  // Ring of the last 3 log-filterbank frames for the SuperFlux difference (lag 2).
  const LAG = 2;
  const hist: Float32Array[] = [new Float32Array(nBands), new Float32Array(nBands), new Float32Array(nBands)];
  const maxed = new Float32Array(nBands);
  const LOG_SCALE = 300;
  const groupE = new Float64Array(3);

  for (let i = 0; i < frames; i++) {
    const center = i * hop;
    const start = center - halfWin;
    let sumSq = 0;
    for (let n = 0; n < fftSize; n++) {
      const idx = start + n;
      const s = idx >= 0 && idx < signal.length ? signal[idx] : 0;
      sumSq += s * s;
      frame[n] = s * win[n];
    }
    energyDb[i] = 10 * Math.log10(sumSq / fftSize + 1e-12);
    let pk = 0;
    const pEnd = Math.min(signal.length, center + hop);
    for (let idx = Math.max(0, center); idx < pEnd; idx++) {
      const a = Math.abs(signal[idx]);
      if (a > pk) pk = a;
    }
    peaks[i] = pk;

    fft.magnitudes(frame, mags);
    const cur = hist[i % 3];
    groupE[0] = groupE[1] = groupE[2] = 0;
    let centroidNum = 0;
    let centroidDen = 0;
    for (let b = 0; b < nBands; b++) {
      const w = fb.weights[b];
      const s0 = fb.start[b];
      let acc = 0;
      for (let k = 0; k < w.length; k++) acc += mags[s0 + k] * w[k];
      acc /= winSum;
      groupE[group[b]] += acc * acc;
      const lv = Math.log10(1 + LOG_SCALE * acc);
      cur[b] = lv;
      centroidNum += lv * b;
      centroidDen += lv;
    }
    bright[i] = centroidDen > 1e-6 ? centroidNum / centroidDen / (nBands - 1) : 0;
    for (let g = 0; g < 3; g++) bandDb[i * 3 + g] = 10 * Math.log10(groupE[g] + 1e-12);

    // SuperFlux: compare against a frequency-max-filtered frame LAG frames back.
    if (i >= LAG) {
      const prev = hist[(i - LAG) % 3];
      for (let b = 0; b < nBands; b++) {
        let m = prev[b];
        if (b > 0 && prev[b - 1] > m) m = prev[b - 1];
        if (b < nBands - 1 && prev[b + 1] > m) m = prev[b + 1];
        maxed[b] = m;
      }
      let total = 0;
      let lo = 0;
      let mid = 0;
      let hi = 0;
      for (let b = 0; b < nBands; b++) {
        const d = cur[b] - maxed[b];
        if (d > 0) {
          total += d;
          const g = group[b];
          if (g === 0) lo += d;
          else if (g === 1) mid += d;
          else hi += d;
        }
      }
      odf[i] = total;
      odfLow[i] = lo;
      odfMid[i] = mid;
      odfHigh[i] = hi;
    }

    // Chroma (energy-weighted, L2 normalized).
    const cOff = i * 12;
    for (let k = 1; k < nBins; k++) {
      const pc = chromaBin[k];
      if (pc >= 0) chroma[cOff + pc] += mags[k] * mags[k];
    }
    let norm = 0;
    for (let c = 0; c < 12; c++) {
      chroma[cOff + c] = Math.sqrt(chroma[cOff + c]);
      norm += chroma[cOff + c] * chroma[cOff + c];
    }
    norm = Math.sqrt(norm);
    if (norm > 1e-9) for (let c = 0; c < 12; c++) chroma[cOff + c] /= norm;

    const tOff = i * TIMBRE_DIMS;
    for (let c = 0; c < TIMBRE_DIMS; c++) {
      let acc = 0;
      const base = c * nBands;
      for (let b = 0; b < nBands; b++) acc += dct[base + b] * cur[b];
      timbre[tOff + c] = acc / nBands;
    }

    if ((i & 2047) === 0) {
      opts.onProgress?.(i / frames);
      if (opts.shouldAbort?.()) throw new Error('aborted');
    }
  }
  opts.onProgress?.(1);
  return { sampleRate, hop, fps, frames, odf, odfLow, odfMid, odfHigh, energyDb, peaks, bandDb, bright, chroma, timbre };
}

/** Integer-factor decimation with a windowed-sinc lowpass (used when input is > 30 kHz). */
export function decimate(signal: Float32Array, factor: number): Float32Array {
  if (factor <= 1) return signal;
  const taps = 16 * factor + 1;
  const h = new Float32Array(taps);
  const fc = 0.45 / factor;
  const mid = (taps - 1) / 2;
  let sum = 0;
  for (let i = 0; i < taps; i++) {
    const x = i - mid;
    const sinc = x === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x);
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (taps - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (taps - 1));
    h[i] = sinc * w;
    sum += h[i];
  }
  for (let i = 0; i < taps; i++) h[i] /= sum;
  const outLen = Math.floor(signal.length / factor);
  const out = new Float32Array(outLen);
  for (let o = 0; o < outLen; o++) {
    const c = o * factor;
    let acc = 0;
    for (let k = 0; k < taps; k++) {
      const idx = c + k - mid;
      if (idx >= 0 && idx < signal.length) acc += signal[idx] * h[k];
    }
    out[o] = acc;
  }
  return out;
}
