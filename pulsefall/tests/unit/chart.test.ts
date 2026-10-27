import { describe, expect, it } from 'vitest';
import { analyzeAudio } from '../../src/core/analysis/analyze';
import { ChartGenerationError, generateChart } from '../../src/core/chart/generate';
import { STYLES } from '../../src/core/chart/styles';
import { validateChart } from '../../src/core/chart/validate';
import { CHART_STYLES, type AnalysisResult, type Note } from '../../src/core/types';
import { drumLoop, renderEvents, type DrumLoopOptions } from '../fixtures/synthetic';

const cache = new Map<string, { a: AnalysisResult; fx: ReturnType<typeof drumLoop> }>();
function analyzed(opts: DrumLoopOptions) {
  const key = JSON.stringify(opts, (_k, v) => (typeof v === 'function' ? String(v) : v));
  if (!cache.has(key)) {
    const fx = drumLoop(opts);
    cache.set(key, { a: analyzeAudio(fx.signal, fx.sr), fx });
  }
  return cache.get(key)!;
}

/** Structural invariants every playable chart must satisfy. */
function assertPlayable(notes: Note[], laneCount: number, durationMs: number, sameLaneGap = 60) {
  let prevT = -Infinity;
  const lastEnd = new Array(laneCount).fill(-Infinity);
  const lastStart = new Array(laneCount).fill(-Infinity);
  const ids = new Set<number>();
  for (const n of notes) {
    expect(Number.isFinite(n.t)).toBe(true);
    expect(n.t).toBeGreaterThanOrEqual(0);
    expect(n.t).toBeLessThanOrEqual(durationMs);
    expect(n.t).toBeGreaterThanOrEqual(prevT);
    expect(n.lane).toBeGreaterThanOrEqual(0);
    expect(n.lane).toBeLessThan(laneCount);
    expect(ids.has(n.id)).toBe(false);
    ids.add(n.id);
    // No note starts in a lane that is still held, no same-lane crowding.
    expect(n.t).toBeGreaterThan(lastEnd[n.lane]);
    expect(n.t - lastStart[n.lane]).toBeGreaterThanOrEqual(sameLaneGap);
    if (n.type === 'hold') {
      expect(n.end).toBeDefined();
      expect(n.end!).toBeGreaterThan(n.t);
      expect(n.end!).toBeLessThanOrEqual(durationMs);
      lastEnd[n.lane] = n.end!;
    }
    lastStart[n.lane] = n.t;
    prevT = n.t;
  }
  // Chords never exceed two notes and share an exact time.
  const groups = new Map<number, Note[]>();
  for (const n of notes) if (n.group !== undefined) groups.set(n.group, [...(groups.get(n.group) ?? []), n]);
  for (const g of groups.values()) {
    expect(g.length).toBeGreaterThanOrEqual(2);
    expect(g.length).toBeLessThanOrEqual(2);
    expect(new Set(g.map((n) => n.t)).size).toBe(1);
  }
}

const SONGS: [string, DrumLoopOptions][] = [
  ['80 BPM steady', { bpm: 80, bars: 16, pad: true }],
  ['120 BPM steady', { bpm: 120, bars: 24, pad: true }],
  ['160 BPM steady', { bpm: 160, bars: 32 }],
  ['hip-hop 90', { bpm: 90, bars: 16, pattern: 'hiphop' }],
  ['syncopated', { bpm: 105, bars: 16, pattern: 'syncopated' }],
  ['sparse', { bpm: 100, bars: 16, pattern: 'sparse' }],
  ['dense', { bpm: 110, bars: 16, pattern: 'dense' }],
  ['quiet intro', { bpm: 118, bars: 24, quietIntroBars: 4, pad: true }],
  ['dynamics', { bpm: 124, bars: 32, pad: true, barGain: (b: number) => (b < 8 ? 0.3 : b < 24 ? 1 : 0.5) }],
  ['tempo change', { bpm: 96, endBpm: 128, bars: 24 }],
  ['waltz', { bpm: 150, bars: 24, pattern: 'waltz' }],
  ['swing', { bpm: 96, bars: 16, pattern: 'swing' }],
];

describe('generated charts are always playable', () => {
  for (const [name, opts] of SONGS) {
    it(name, () => {
      const { a } = analyzed(opts);
      for (const style of CHART_STYLES) {
        const c = generateChart(a, { style, seed: 42 });
        expect(c.notes.length).toBeGreaterThan(5);
        assertPlayable(c.notes, 3, a.durationMs, Math.min(STYLES[style].sameLaneGapMs, 160) - 1);
        expect(c.warnings).toEqual([]);
      }
    });
  }
});

describe('musical connection', () => {
  it('places notes on real musical events, not a metronome', () => {
    for (const [, opts] of SONGS.slice(0, 9)) {
      const { a } = analyzed(opts);
      const c = generateChart(a, { style: 'classic', seed: 7 });
      expect(c.musicality.alignment).toBeGreaterThan(0.9);
    }
  });

  it('follows the groove of a syncopated pattern (notes off the beat where the kicks are)', () => {
    const { a, fx } = analyzed({ bpm: 105, bars: 16, pattern: 'syncopated' });
    const c = generateChart(a, { style: 'full', seed: 1 });
    const kicks = fx.events.filter((e) => e.kind === 'kick').map((e) => e.t);
    const offBeatKicks = kicks.filter((k) => !fx.beats.some((b) => Math.abs(b - k) < 30));
    const covered = offBeatKicks.filter((k) => c.notes.some((n) => Math.abs(n.t - k) < 35));
    expect(covered.length / offBeatKicks.length).toBeGreaterThan(0.6);
  });

  it('gets denser as the music gets more intense', () => {
    const { a } = analyzed({ bpm: 124, bars: 32, pad: true, barGain: (b: number) => (b < 8 ? 0.3 : b < 24 ? 1 : 0.5) });
    const c = generateChart(a, { style: 'classic', seed: 3 });
    const quiet = a.segments.reduce((m, s) => (s.intensity < m.intensity ? s : m));
    const loud = a.segments.reduce((m, s) => (s.intensity > m.intensity ? s : m));
    const rate = (s: { startMs: number; endMs: number }) => c.notes.filter((n) => n.t >= s.startMs && n.t < s.endMs).length / ((s.endMs - s.startMs) / 1000);
    expect(rate(loud)).toBeGreaterThan(rate(quiet));
  });

  it('styles are coherent strategies ordered by density', () => {
    const { a } = analyzed({ bpm: 110, bars: 16, pattern: 'dense' });
    const nps = CHART_STYLES.map((style) => generateChart(a, { style, seed: 5 }).stats.nps);
    for (let i = 1; i < nps.length; i++) expect(nps[i]).toBeGreaterThanOrEqual(nps[i - 1]);
    expect(nps[0]).toBeLessThan(nps[3] * 0.6);
    const relaxed = generateChart(a, { style: 'relaxed', seed: 5 });
    expect(relaxed.stats.chords).toBe(0);
    expect(relaxed.stats.swipes).toBe(0);
  });

  it('avoids fast same-lane repeats and keeps lanes balanced', () => {
    for (const [, opts] of SONGS) {
      const { a } = analyzed(opts);
      const c = generateChart(a, { style: 'full', seed: 9 });
      expect(c.musicality.fastJackRate).toBeLessThan(0.05);
      expect(c.musicality.laneBalance).toBeGreaterThan(0.85);
      expect(c.musicality.longestJack).toBeLessThanOrEqual(3);
    }
  });

  it('repeats lane patterns when a section repeats', () => {
    // Verse (loud) - break (quiet) - verse again: the two loud sections should share patterns.
    const { a } = analyzed({ bpm: 120, bars: 36, pad: true, barGain: (b: number) => (b >= 12 && b < 20 ? 0.25 : 1) });
    const c = generateChart(a, { style: 'classic', seed: 11 });
    const loudSegs = a.segments.filter((s) => s.intensity > 0.7);
    expect(loudSegs.length).toBeGreaterThanOrEqual(2);
    // Compare notes at the same position relative to each section start.
    // Anchor on each section's first note (segment boundaries are only bar-accurate);
    // compare single notes (section arrivals may add a chord).
    const anchor = (start: number) => c.notes.find((n) => n.t >= start - 50)!.t;
    const from = (start: number) => c.notes.filter((n) => n.t >= start && n.t < start + 8000 && n.group === undefined);
    const ax = anchor(loudSegs[0].startMs);
    const ay = anchor(loudSegs[1].startMs);
    const x = from(ax);
    const y = from(ay);
    let pairs = 0;
    let same = 0;
    for (const n of x) {
      const m = y.find((k) => Math.abs(k.t - ay - (n.t - ax)) < 40);
      if (!m) continue;
      pairs++;
      if (m.lane === n.lane) same++;
    }
    expect(pairs).toBeGreaterThan(x.length * 0.7);
    expect(same / pairs).toBeGreaterThan(0.75);
  });
});

describe('determinism and variation', () => {
  it('same input and seed reproduce the same chart', () => {
    const { a } = analyzed({ bpm: 120, bars: 24, pad: true });
    const x = generateChart(a, { style: 'classic', seed: 99 });
    const y = generateChart(a, { style: 'classic', seed: 99 });
    expect(y.notes).toEqual(x.notes);
  });
  it('a different variation keeps the rhythm but changes lanes', () => {
    const { a } = analyzed({ bpm: 120, bars: 24, pad: true });
    const x = generateChart(a, { style: 'classic', seed: 99 });
    const y = generateChart(a, { style: 'classic', seed: 99, variation: 1 });
    const times = (c: typeof x) => c.notes.map((n) => n.t);
    expect(times(y)).toEqual(times(x));
    expect(y.notes.map((n) => n.lane)).not.toEqual(x.notes.map((n) => n.lane));
  });
});

describe('overrides, lanes and fallbacks', () => {
  it('honours a manual BPM / first-beat override', () => {
    const { a } = analyzed({ bpm: 120, bars: 16 });
    const c = generateChart(a, { style: 'classic', seed: 1, bpmOverride: 120, firstBeatOverrideMs: 500 });
    expect(c.params.mode).toBe('grid');
    expect(c.musicality.alignment).toBeGreaterThan(0.9);
  });
  it('supports four lanes', () => {
    const { a } = analyzed({ bpm: 128, bars: 24, pattern: 'four' });
    const c = generateChart(a, { style: 'advanced', seed: 1, laneCount: 4 });
    assertPlayable(c.notes, 4, a.durationMs);
    expect(new Set(c.notes.map((n) => n.lane)).size).toBe(4);
  });
  it('falls back to onset-following for low-confidence grids and says so', () => {
    const { a } = analyzed({ bpm: 120, bars: 16 });
    const loose = { ...a, beatConfidence: 0.2 };
    const c = generateChart(loose, { style: 'classic', seed: 1 });
    expect(c.params.mode).toBe('free');
    expect(c.approximate).toBe(true);
    assertPlayable(c.notes, 3, a.durationMs);
    expect(c.musicality.alignment).toBeGreaterThan(0.95);
  });
  it('refuses to invent a chart for non-rhythmic audio', () => {
    const sig = renderEvents([{ t: 0, kind: 'pad', vel: 0.6, dur: 9500, midi: 57 }], 10000, 22050);
    const a = analyzeAudio(sig, 22050);
    expect(() => generateChart(a, { style: 'classic', seed: 1 })).toThrowError(ChartGenerationError);
  });
});

describe('validator repairs', () => {
  const base = { laneCount: 3, durationMs: 10000 };
  it('removes invalid, negative and out-of-range notes', () => {
    const r = validateChart(
      [
        { id: 1, t: NaN, lane: 0, type: 'tap' },
        { id: 2, t: -10, lane: 0, type: 'tap' },
        { id: 3, t: 20000, lane: 0, type: 'tap' },
        { id: 4, t: 1000, lane: 7, type: 'tap' },
        { id: 5, t: 2000, lane: 1, type: 'tap' },
      ],
      base,
    );
    expect(r.notes.map((n) => n.id)).toEqual([4, 5]);
    expect(r.notes[0].lane).toBe(2);
    expect(r.fixes.length).toBe(4);
  });
  it('sorts, dedupes and fixes same-lane conflicts', () => {
    const r = validateChart(
      [
        { id: 1, t: 2000, lane: 1, type: 'tap' },
        { id: 2, t: 1000, lane: 0, type: 'tap' },
        { id: 3, t: 1005, lane: 0, type: 'tap' },
        { id: 4, t: 1040, lane: 0, type: 'tap' },
      ],
      { ...base, sameLaneGapMs: 100 },
    );
    expect(r.notes.map((n) => n.t)).toEqual([1000, 1040, 2000]);
    expect(r.notes[1].lane).not.toBe(0);
  });
  it('repairs holds: too short, overlapping, past the end', () => {
    const r = validateChart(
      [
        { id: 1, t: 1000, lane: 0, type: 'hold', end: 1050 },
        { id: 2, t: 2000, lane: 1, type: 'hold', end: 4000 },
        { id: 3, t: 3000, lane: 1, type: 'tap' },
        { id: 4, t: 9000, lane: 2, type: 'hold', end: 12000 },
      ],
      base,
    );
    expect(r.notes[0].type).toBe('tap');
    expect(r.notes[1].end).toBeLessThan(3000);
    expect(r.notes[3].end).toBe(10000);
  });
  it('limits chords to two notes and groups them', () => {
    const r = validateChart(
      [
        { id: 1, t: 1000, lane: 0, type: 'tap', conf: 0.2 },
        { id: 2, t: 1000, lane: 1, type: 'swipe', dir: 'up', conf: 0.9 },
        { id: 3, t: 1000, lane: 2, type: 'tap', conf: 0.8 },
      ],
      base,
    );
    expect(r.notes.length).toBe(2);
    expect(r.notes.every((n) => n.group === r.notes[0].group && n.type === 'tap')).toBe(true);
  });
  it('thins bursts beyond the density cap', () => {
    const burst = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, t: 1000 + i * 40, lane: i % 3, type: 'tap' as const, conf: (i % 5) / 5 }));
    const r = validateChart(burst, { ...base, maxNps: 6, sameLaneGapMs: 60 });
    for (let i = 0; i < r.notes.length; i++) {
      const inWin = r.notes.filter((n) => n.t >= r.notes[i].t && n.t < r.notes[i].t + 1000);
      expect(inWin.length).toBeLessThanOrEqual(6);
    }
  });
  it('assigns unique ids', () => {
    const r = validateChart(
      [
        { id: 3, t: 1000, lane: 0, type: 'tap' },
        { id: 3, t: 2000, lane: 1, type: 'tap' },
      ],
      base,
    );
    expect(new Set(r.notes.map((n) => n.id)).size).toBe(2);
  });
});
