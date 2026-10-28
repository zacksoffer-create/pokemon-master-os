import { describe, expect, it } from 'vitest';
import { clampRange, isWholeSong, notesInRange, sectionNames, skipTarget } from '../../src/core/game/part';
import type { Note, Segment } from '../../src/core/types';

const tap = (id: number, t: number, lane = 0): Note => ({ id, t, lane, type: 'tap' });
const hold = (id: number, t: number, end: number, lane = 0): Note => ({ id, t, end, lane, type: 'hold' });
const seg = (startMs: number, endMs: number, intensity: number, label: number): Segment => ({ startMs, endMs, intensity, label });

describe('notesInRange', () => {
  const notes = [tap(1, 1000), tap(2, 5000), hold(3, 9000, 12000), hold(4, 9900, 11000, 1), tap(5, 15000)];

  it('keeps the whole chart without a range', () => {
    expect(notesInRange(notes, 0)).toBe(notes);
  });

  it('drops notes outside the part and cuts holds at its end', () => {
    const out = notesInRange(notes, 0, 4000, 10000);
    expect(out.map((n) => n.id)).toEqual([2, 3, 4]);
    expect(out[1]).toMatchObject({ type: 'hold', end: 10000 });
    // Only 100 ms of hold 4 is left: it becomes a tap.
    expect(out[2]).toMatchObject({ type: 'tap', end: undefined });
  });

  it('compares on the song timeline (chart offset applied)', () => {
    // With +500 ms offset, the note at chart 5000 is heard at 5500.
    expect(notesInRange(notes, 500, 5200, 6000).map((n) => n.id)).toEqual([2]);
    expect(notesInRange(notes, 500, 5600, 6000)).toEqual([]);
  });

  it('does not touch the original notes', () => {
    notesInRange(notes, 0, 0, 10000);
    expect(notes[2]).toMatchObject({ end: 12000 });
  });
});

describe('ranges', () => {
  it('keeps a part inside the song and long enough to play', () => {
    expect(clampRange({ startMs: -500, endMs: 3000 }, 60000)).toEqual({ startMs: 0, endMs: 8000 });
    expect(clampRange({ startMs: 58000, endMs: 70000 }, 60000)).toEqual({ startMs: 48000, endMs: 60000 });
    expect(clampRange({ startMs: 57000, endMs: 59000 }, 60000)).toEqual({ startMs: 52000, endMs: 60000 });
    expect(clampRange({ startMs: 10000, endMs: 30000 }, 60000)).toEqual({ startMs: 10000, endMs: 30000 });
    expect(clampRange({ startMs: 0, endMs: 2000 }, 5000)).toEqual({ startMs: 0, endMs: 5000 });
  });

  it('knows a whole-song range', () => {
    expect(isWholeSong({ startMs: 0, endMs: 60000 }, 60000)).toBe(true);
    expect(isWholeSong({ startMs: 0, endMs: 50000 }, 60000)).toBe(false);
  });
});

describe('sectionNames', () => {
  it('names a quiet start and end and gives repeats the same letter', () => {
    const segs = [seg(0, 10, 0.2, 0), seg(10, 20, 0.6, 1), seg(20, 30, 0.9, 2), seg(30, 40, 0.6, 1), seg(40, 50, 0.9, 2), seg(50, 60, 0.1, 3)];
    expect(sectionNames(segs)).toEqual(['Intro', 'A', 'B', 'A', 'B', 'Outro']);
  });

  it('does not call a loud opening an intro', () => {
    expect(sectionNames([seg(0, 10, 0.9, 0), seg(10, 20, 0.2, 1), seg(20, 30, 0.9, 0)])).toEqual(['A', 'B', 'A']);
  });
});

describe('skipTarget', () => {
  it('lands with the full approach plus a run-up before the next note', () => {
    expect(skipTarget(0, 20000, 1500)).toBe(20000 - 1500 - 1800);
  });
  it('declines when it would barely save anything', () => {
    expect(skipTarget(15000, 20000, 1500)).toBeNull();
  });
});
