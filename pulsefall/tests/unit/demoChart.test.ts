import { describe, expect, it } from 'vitest';
import { validateChart } from '../../src/core/chart/validate';
import { buildDemoChart } from '../../src/core/demo/demoChart';
import { demoDurationMs, demoEvents } from '../../src/core/demo/demoSong';

describe('authored demo chart', () => {
  const notes = buildDemoChart();
  it('is valid as written (the validator has nothing to fix)', () => {
    const r = validateChart(notes, { laneCount: 3, durationMs: demoDurationMs(), sameLaneGapMs: 120 });
    expect(r.fixes).toEqual([]);
    expect(r.notes.length).toBe(notes.length);
  });
  it('shows off every note type', () => {
    expect(notes.some((n) => n.type === 'hold')).toBe(true);
    expect(notes.some((n) => n.type === 'swipe')).toBe(true);
    expect(notes.some((n) => n.group !== undefined)).toBe(true);
  });
  it('every note lands on an audible event of the track', () => {
    const times = demoEvents().map((e) => e.t);
    for (const n of notes) expect(times.some((t) => Math.abs(t - n.t) < 2)).toBe(true);
  });
});
