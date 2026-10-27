// Synthetic music fixtures with exact ground truth, for analysis and chart-generation tests.
import { mulberry32 } from '../../src/core/util';

export type SynthKind = 'kick' | 'snare' | 'hat' | 'pad' | 'bass' | 'click';
export interface SynthEvent {
  t: number;
  kind: SynthKind;
  vel: number;
  dur?: number;
  midi?: number;
}
export interface Fixture {
  sr: number;
  signal: Float32Array;
  events: SynthEvent[];
  beats: number[];
  downbeats: number[];
  bpm: number;
  durationMs: number;
}

export type PatternName = 'backbeat' | 'four' | 'hiphop' | 'sparse' | 'dense' | 'syncopated' | 'waltz' | 'swing';

interface Step {
  kind: SynthKind;
  pos: number; // position in beats within the bar
  vel: number;
}

function pattern(name: PatternName): { beatsPerBar: number; steps: Step[] } {
  const s = (kind: SynthKind, pos: number, vel = 1): Step => ({ kind, pos, vel });
  const eighths = (bpb: number, vel = 0.5) => Array.from({ length: bpb * 2 }, (_, i) => s('hat', i / 2, i % 2 ? vel * 0.8 : vel));
  switch (name) {
    case 'backbeat':
      return { beatsPerBar: 4, steps: [s('kick', 0), s('kick', 2), s('kick', 2.5, 0.7), s('snare', 1), s('snare', 3), ...eighths(4)] };
    case 'four':
      return { beatsPerBar: 4, steps: [s('kick', 0), s('kick', 1), s('kick', 2), s('kick', 3), s('snare', 1, 0.8), s('snare', 3, 0.8), s('hat', 0.5, 0.7), s('hat', 1.5, 0.7), s('hat', 2.5, 0.7), s('hat', 3.5, 0.7)] };
    case 'hiphop':
      return {
        beatsPerBar: 4,
        steps: [s('kick', 0), s('kick', 1.75, 0.8), s('kick', 2.5, 0.9), s('snare', 1), s('snare', 3), ...Array.from({ length: 16 }, (_, i) => s('hat', i / 4, i % 2 ? 0.25 : 0.45))],
      };
    case 'sparse':
      return { beatsPerBar: 4, steps: [s('kick', 0), s('snare', 2, 0.8)] };
    case 'dense':
      return {
        beatsPerBar: 4,
        steps: [s('kick', 0), s('kick', 0.75, 0.7), s('kick', 1.5, 0.8), s('kick', 2), s('kick', 2.75, 0.7), s('snare', 1), s('snare', 3), s('snare', 3.75, 0.5), ...Array.from({ length: 16 }, (_, i) => s('hat', i / 4, 0.4))],
      };
    case 'syncopated':
      return { beatsPerBar: 4, steps: [s('kick', 0), s('kick', 0.75, 0.9), s('kick', 1.5, 0.9), s('kick', 2.5, 0.9), s('snare', 1), s('snare', 3), ...eighths(4, 0.35)] };
    case 'waltz':
      return { beatsPerBar: 3, steps: [s('kick', 0), s('snare', 1, 0.55), s('snare', 2, 0.55), s('hat', 0.5, 0.3), s('hat', 1.5, 0.3), s('hat', 2.5, 0.3)] };
    case 'swing':
      return {
        beatsPerBar: 4,
        steps: [s('kick', 0), s('kick', 2), s('snare', 1), s('snare', 3), ...[0, 1, 2, 3].flatMap((b) => [s('hat', b, 0.5), s('hat', b + 2 / 3, 0.45)])],
      };
  }
}

export interface DrumLoopOptions {
  bpm: number;
  bars: number;
  pattern?: PatternName;
  startMs?: number;
  /** Linear tempo ramp to this BPM by the last bar. */
  endBpm?: number;
  /** Bars at the start with only a soft pad (quiet intro). */
  quietIntroBars?: number;
  /** Per-bar gain multiplier (dynamics), indexed by bar. */
  barGain?: (bar: number) => number;
  /** Add a sustained pad chord under everything. */
  pad?: boolean;
  sr?: number;
  tailMs?: number;
  /** Uniform random timing jitter in ms (human feel). */
  jitterMs?: number;
}

export function drumLoop(opts: DrumLoopOptions): Fixture {
  const sr = opts.sr ?? 22050;
  const pat = pattern(opts.pattern ?? 'backbeat');
  const bpb = pat.beatsPerBar;
  const startMs = opts.startMs ?? 500;
  const totalBeats = opts.bars * bpb;
  const beats: number[] = [];
  let t = startMs;
  for (let b = 0; b <= totalBeats; b++) {
    beats.push(t);
    const frac = totalBeats > 0 ? b / totalBeats : 0;
    const bpm = opts.endBpm ? opts.bpm + (opts.endBpm - opts.bpm) * frac : opts.bpm;
    t += 60000 / bpm;
  }
  const beatTime = (pos: number) => {
    const i = Math.floor(pos);
    const f = pos - i;
    const a = beats[Math.min(i, beats.length - 1)];
    const b = beats[Math.min(i + 1, beats.length - 1)];
    return a + (b - a) * f;
  };
  const rnd = mulberry32(99);
  const events: SynthEvent[] = [];
  const quiet = opts.quietIntroBars ?? 0;
  for (let bar = 0; bar < opts.bars; bar++) {
    const g = opts.barGain ? opts.barGain(bar) : 1;
    if (bar < quiet) {
      events.push({ t: beatTime(bar * bpb), kind: 'pad', vel: 0.35, dur: beatTime((bar + 1) * bpb) - beatTime(bar * bpb), midi: 57 });
      continue;
    }
    for (const st of pat.steps) {
      const jitter = opts.jitterMs ? (rnd() * 2 - 1) * opts.jitterMs : 0;
      events.push({ t: beatTime(bar * bpb + st.pos) + jitter, kind: st.kind, vel: st.vel * g });
    }
    if (bar % 2 === 0) events.push({ t: beatTime(bar * bpb), kind: 'bass', vel: 0.6 * g, dur: 400, midi: 45 });
    if (opts.pad) events.push({ t: beatTime(bar * bpb), kind: 'pad', vel: 0.25 * g, dur: beatTime((bar + 1) * bpb) - beatTime(bar * bpb), midi: 57 + ((bar % 4) * 5) % 12 });
  }
  events.sort((a, b) => a.t - b.t);
  const durationMs = beats[beats.length - 1] + (opts.tailMs ?? 1500);
  const signal = renderEvents(events, durationMs, sr);
  const downbeats = beats.filter((_, i) => i % bpb === 0 && i < totalBeats);
  return { sr, signal, events, beats: beats.slice(0, totalBeats), downbeats, bpm: opts.bpm, durationMs };
}

export function renderEvents(events: SynthEvent[], durationMs: number, sr: number, seed = 7): Float32Array {
  const out = new Float32Array(Math.ceil((durationMs / 1000) * sr));
  const rnd = mulberry32(seed);
  for (const e of events) {
    const start = Math.round((e.t / 1000) * sr);
    switch (e.kind) {
      case 'kick': {
        const len = Math.round(0.25 * sr);
        let phase = 0;
        for (let i = 0; i < len && start + i < out.length; i++) {
          const tt = i / sr;
          const f = 50 + 90 * Math.exp(-tt * 30);
          phase += (2 * Math.PI * f) / sr;
          const env = Math.exp(-tt * 14);
          const click = i < 0.003 * sr ? (rnd() * 2 - 1) * 0.3 * (1 - i / (0.003 * sr)) : 0;
          if (start + i >= 0) out[start + i] += e.vel * (0.9 * Math.sin(phase) * env + click);
        }
        break;
      }
      case 'snare': {
        const len = Math.round(0.2 * sr);
        let prev = 0;
        let phase = 0;
        for (let i = 0; i < len && start + i < out.length; i++) {
          const tt = i / sr;
          const n = rnd() * 2 - 1;
          const hp = n - prev;
          prev = n;
          phase += (2 * Math.PI * 190) / sr;
          const v = 0.45 * hp * Math.exp(-tt * 22) + 0.35 * Math.sin(phase) * Math.exp(-tt * 35);
          if (start + i >= 0) out[start + i] += e.vel * v;
        }
        break;
      }
      case 'hat': {
        const len = Math.round(0.05 * sr);
        let p1 = 0;
        let p2 = 0;
        for (let i = 0; i < len && start + i < out.length; i++) {
          const n = rnd() * 2 - 1;
          const h1 = n - p1;
          const h2 = h1 - p2;
          p1 = n;
          p2 = h1;
          if (start + i >= 0) out[start + i] += e.vel * 0.22 * h2 * Math.exp((-i / sr) * 70);
        }
        break;
      }
      case 'click': {
        const len = Math.round(0.02 * sr);
        for (let i = 0; i < len && start + i < out.length; i++) {
          if (start + i >= 0) out[start + i] += e.vel * Math.sin((2 * Math.PI * 1500 * i) / sr) * Math.exp((-i / sr) * 200);
        }
        break;
      }
      case 'bass':
      case 'pad': {
        const dur = ((e.dur ?? 400) / 1000) * sr;
        const base = 440 * Math.pow(2, ((e.midi ?? 45) - 69) / 12);
        const freqs = e.kind === 'pad' ? [base, base * 1.26, base * 1.5] : [base, base * 2, base * 3];
        const amps = e.kind === 'pad' ? [0.2, 0.15, 0.15] : [0.5, 0.25, 0.12];
        for (let i = 0; i < dur && start + i < out.length; i++) {
          const tt = i / sr;
          const env = e.kind === 'pad' ? Math.min(1, tt / 0.3) * Math.min(1, (dur - i) / (0.2 * sr)) : Math.exp(-tt * 4);
          let v = 0;
          for (let k = 0; k < freqs.length; k++) v += amps[k] * Math.sin(2 * Math.PI * freqs[k] * tt);
          if (start + i >= 0) out[start + i] += e.vel * env * v;
        }
        break;
      }
    }
  }
  // Light noise floor so "silence" is realistic.
  for (let i = 0; i < out.length; i++) out[i] += (rnd() * 2 - 1) * 1e-5;
  return out;
}

/** F-measure of detected vs reference times with a ±tol ms window (one-to-one matching). */
export function fMeasure(detected: number[], reference: number[], tol = 70): { f: number; precision: number; recall: number } {
  const used = new Uint8Array(detected.length);
  let hits = 0;
  for (const r of reference) {
    let best = -1;
    let bestD = tol + 1;
    for (let i = 0; i < detected.length; i++) {
      if (used[i]) continue;
      const d = Math.abs(detected[i] - r);
      if (d <= tol && d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      used[best] = 1;
      hits++;
    }
  }
  const precision = detected.length ? hits / detected.length : 0;
  const recall = reference.length ? hits / reference.length : 0;
  const f = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { f, precision, recall };
}
