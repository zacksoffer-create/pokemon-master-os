import { describe, expect, it } from 'vitest';
import { Grid, History, addNote, cycleSwipeDir, moveNotes, removeNotes, setHoldEnd, setType } from '../../src/app/editor/editorModel';
import type { Note } from '../../src/core/types';

const beats = Array.from({ length: 16 }, (_, i) => 1000 + i * 500);
const grid = new Grid(beats, 4, 0);

describe('editor grid', () => {
  it('snaps to beats and subdivisions, and passes through when free', () => {
    expect(grid.snap(1240, 1)).toBe(1000);
    expect(grid.snap(1260, 1)).toBe(1500);
    expect(grid.snap(1130, 4)).toBe(1125);
    expect(grid.snap(1170, 3)).toBe(1167);
    expect(grid.snap(1234.6, 0)).toBe(1235);
    // Extrapolates beyond the detected beats.
    expect(grid.snap(400, 1)).toBe(500);
  });
  it('lists bar, beat and subdivision lines', () => {
    const lines = grid.lines(1000, 3000, 2);
    expect(lines.filter((l) => l.level === 0).map((l) => l.t)).toEqual([1000, 3000]);
    expect(lines.filter((l) => l.level === 1).length).toBe(3);
    expect(lines.filter((l) => l.level === 2).length).toBe(4);
  });
});

describe('editor operations', () => {
  const base: Note[] = [
    { id: 1, t: 1000, lane: 0, type: 'tap' },
    { id: 2, t: 1500, lane: 1, type: 'hold', end: 2000 },
  ];
  it('adds notes with fresh ids and replaces an exact duplicate slot', () => {
    const { notes, id } = addNote(base, 1005, 0, 'tap');
    expect(id).toBe(3);
    expect(notes.length).toBe(2);
    const s = addNote(base, 2500, 2, 'swipe');
    expect(s.notes.find((n) => n.id === s.id)?.dir).toBe('up');
    const h = addNote(base, 3000, 2, 'hold', 3100);
    expect(h.notes.find((n) => n.id === h.id)!.end).toBeGreaterThanOrEqual(3150);
  });
  it('moves notes in time and lane, keeping hold length, clamped to lanes', () => {
    const moved = moveNotes(base, new Set([2]), 250, 5, 3);
    const h = moved.find((n) => n.id === 2)!;
    expect(h.t).toBe(1750);
    expect(h.end).toBe(2250);
    expect(h.lane).toBe(2);
  });
  it('converts types and edits hold ends', () => {
    const asHold = setType(base, new Set([1]), 'hold');
    expect(asHold[0].type).toBe('hold');
    expect(asHold[0].end).toBeGreaterThan(1000);
    const asTap = setType(base, new Set([2]), 'tap');
    expect(asTap[1].end).toBeUndefined();
    expect(setHoldEnd(base, 2, 1550)[1].end).toBe(1650); // minimum hold length
    expect(cycleSwipeDir(setType(base, new Set([1]), 'swipe'), new Set([1]))[0].dir).toBe('right');
    expect(removeNotes(base, new Set([1])).map((n) => n.id)).toEqual([2]);
  });
  it('undo/redo history', () => {
    const h = new History<number>();
    h.push(1);
    h.push(2);
    expect(h.undo(3)).toBe(2);
    expect(h.undo(2)).toBe(1);
    expect(h.undo(1)).toBeNull();
    expect(h.redo(1)).toBe(2);
    h.push(5);
    expect(h.canRedo).toBe(false);
  });
});
