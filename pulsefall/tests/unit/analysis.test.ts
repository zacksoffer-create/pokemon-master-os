import { describe, expect, it } from 'vitest';
import { analyzeAudio, AnalysisError } from '../../src/core/analysis/analyze';
import { drumLoop, fMeasure, renderEvents, type DrumLoopOptions } from '../fixtures/synthetic';

function run(opts: DrumLoopOptions) {
  const fx = drumLoop(opts);
  return { fx, a: analyzeAudio(fx.signal, fx.sr) };
}

/** Tempo equal up to the usual octave ambiguity (x2 / x0.5), within 2%. */
function sameTempo(bpm: number, ref: number, allowOctave = false): boolean {
  const ratios = allowOctave ? [1, 2, 0.5] : [1];
  return ratios.some((r) => Math.abs(bpm - ref * r) / (ref * r) < 0.02);
}

describe('onset detection', () => {
  it('finds drum hits within a few ms of the truth', () => {
    const { fx, a } = run({ bpm: 120, bars: 12 });
    const truth = fx.events.filter((e) => e.kind === 'kick' || e.kind === 'snare').map((e) => e.t);
    const strong = a.onsets.filter((o) => o.s > 0.4).map((o) => o.t);
    const fm = fMeasure(strong, truth, 25);
    expect(fm.recall).toBeGreaterThan(0.97);
    const errs = truth.map((t) => Math.min(...a.onsets.map((o) => Math.abs(o.t - t))));
    const mean = errs.reduce((x, y) => x + y, 0) / errs.length;
    expect(mean).toBeLessThan(8);
  });
});

describe('tempo and beat tracking', () => {
  const cases: [string, DrumLoopOptions, boolean][] = [
    ['80 BPM pulse', { bpm: 80, bars: 16 }, false],
    ['120 BPM pulse', { bpm: 120, bars: 20 }, false],
    ['160 BPM pulse', { bpm: 160, bars: 32 }, true],
    ['90 BPM hip-hop with 16th hats', { bpm: 90, bars: 16, pattern: 'hiphop' }, false],
    ['128 BPM four-on-the-floor', { bpm: 128, bars: 24, pattern: 'four' }, false],
    ['105 BPM syncopated kicks', { bpm: 105, bars: 16, pattern: 'syncopated' }, false],
    ['110 BPM dense arrangement', { bpm: 110, bars: 16, pattern: 'dense' }, false],
    ['100 BPM sparse arrangement', { bpm: 100, bars: 16, pattern: 'sparse' }, false],
    ['96 BPM swing', { bpm: 96, bars: 16, pattern: 'swing' }, false],
    ['118 BPM with human timing jitter', { bpm: 118, bars: 20, jitterMs: 12, pad: true }, false],
  ];
  for (const [name, opts, octaveOk] of cases) {
    it(name, () => {
      const { fx, a } = run(opts);
      expect(sameTempo(a.tempo.bpm, opts.bpm, octaveOk)).toBe(true);
      const ref = octaveOk && a.tempo.bpm < opts.bpm * 0.75 ? fx.beats.filter((_, i) => i % 2 === 0) : fx.beats;
      const shifted = octaveOk && a.tempo.bpm < opts.bpm * 0.75 ? [ref, fx.beats.filter((_, i) => i % 2 === 1)] : [ref];
      const best = Math.max(...shifted.map((r) => fMeasure(a.beats, r, 70).f));
      expect(best).toBeGreaterThan(0.95);
      expect(a.beatConfidence).toBeGreaterThan(0.6);
    });
  }

  it('follows a gradual tempo change (100 -> 130 BPM)', () => {
    const { fx, a } = run({ bpm: 100, endBpm: 130, bars: 24 });
    expect(a.tempo.stable).toBe(false);
    expect(fMeasure(a.beats, fx.beats, 70).f).toBeGreaterThan(0.95);
  });

  it('places beats through a quiet intro', () => {
    const { fx, a } = run({ bpm: 120, bars: 20, quietIntroBars: 4, pad: true });
    expect(fMeasure(a.beats, fx.beats, 70).f).toBeGreaterThan(0.95);
    expect(a.segments.length).toBeGreaterThanOrEqual(2);
    expect(a.segments[0].intensity).toBeLessThan(a.segments[a.segments.length - 1].intensity - 0.25);
  });

  it('works on 44.1 kHz input (decimation path)', () => {
    const fx = drumLoop({ bpm: 124, bars: 12, sr: 44100 });
    const a = analyzeAudio(fx.signal, 44100);
    expect(sameTempo(a.tempo.bpm, 124)).toBe(true);
    expect(fMeasure(a.beats, fx.beats, 70).f).toBeGreaterThan(0.95);
  });
});

describe('meter and feel', () => {
  it('detects three-beat meter', () => {
    const { a } = run({ bpm: 150, bars: 24, pattern: 'waltz' });
    expect(a.meter.beatsPerBar).toBe(3);
  });
  it('finds the downbeat of a 4/4 groove', () => {
    const { fx, a } = run({ bpm: 120, bars: 20 });
    const firstDown = a.beats[a.meter.firstDownbeat];
    expect(fx.downbeats.some((d) => Math.abs(d - firstDown) < 40)).toBe(true);
  });
  it('recognises swing as a ternary subdivision', () => {
    expect(run({ bpm: 96, bars: 16, pattern: 'swing' }).a.meter.subdivision).toBe('ternary');
    expect(run({ bpm: 96, bars: 16, pattern: 'backbeat' }).a.meter.subdivision).toBe('binary');
  });
});

describe('structure', () => {
  it('rates a loud section above a quiet one', () => {
    const { a } = run({ bpm: 120, bars: 32, pad: true, barGain: (b) => (b < 12 ? 0.25 : 1) });
    const early = a.segments.find((s) => s.startMs <= 10000 && s.endMs > 10000);
    const late = a.segments[a.segments.length - 1];
    expect(early).toBeDefined();
    expect(late.intensity).toBeGreaterThan(early!.intensity);
  });
});

describe('failure handling', () => {
  it('rejects silence instead of inventing rhythm', () => {
    const silent = new Float32Array(22050 * 10);
    expect(() => analyzeAudio(silent, 22050)).toThrowError(AnalysisError);
    try {
      analyzeAudio(silent, 22050);
    } catch (e) {
      expect((e as AnalysisError).code).toBe('silent');
    }
  });
  it('rejects clips that are too short', () => {
    expect(() => analyzeAudio(new Float32Array(22050), 22050)).toThrowError(/too short/);
  });
  it('flags a sustained drone as non-rhythmic', () => {
    const sig = renderEvents([{ t: 0, kind: 'pad', vel: 0.6, dur: 9500, midi: 57 }], 10000, 22050);
    const a = analyzeAudio(sig, 22050);
    expect(a.rhythmic).toBe(false);
    expect(a.beats.length).toBe(0);
  });
  it('survives NaN samples and invalid input', () => {
    const fx = drumLoop({ bpm: 120, bars: 6 });
    for (let i = 1000; i < 1200; i++) fx.signal[i] = NaN;
    expect(() => analyzeAudio(fx.signal, fx.sr)).not.toThrow();
    expect(() => analyzeAudio(new Float32Array(0), 22050)).toThrowError(AnalysisError);
  });
  it('honours cancellation', () => {
    const fx = drumLoop({ bpm: 120, bars: 8 });
    expect(() => analyzeAudio(fx.signal, fx.sr, { shouldAbort: () => true })).toThrowError(/aborted|cancelled/);
  });
});

describe('performance', () => {
  it('analyzes a 5-minute track in reasonable time', () => {
    const fx = drumLoop({ bpm: 122, bars: 150, pad: true, pattern: 'dense' });
    expect(fx.durationMs).toBeGreaterThan(290000);
    const t0 = performance.now();
    const a = analyzeAudio(fx.signal, fx.sr);
    const ms = performance.now() - t0;
    expect(sameTempo(a.tempo.bpm, 122)).toBe(true);
    expect(ms).toBeLessThan(8000);
  });
});
