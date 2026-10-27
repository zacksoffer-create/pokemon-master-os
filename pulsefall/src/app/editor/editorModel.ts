import type { Note, NoteType } from '../../core/types';
import { lowerBound } from '../../core/util';

/** Snap divisions per beat; 0 = free placement. */
export type Snap = 0 | 1 | 2 | 3 | 4 | 6 | 8;

/**
 * Pure editing operations on a note list, kept separate from the view so they are easy to
 * test. Every operation returns a new array (the undo stack stores snapshots).
 */
export class Grid {
  constructor(
    readonly beats: number[],
    readonly beatsPerBar: number,
    readonly firstDownbeat: number,
  ) {}

  /** Nearest grid time to t for a given snap. */
  snap(t: number, snap: Snap): number {
    const b = this.beats;
    if (!snap || b.length < 2) return Math.round(t);
    let i = lowerBound(b, t) - 1;
    if (i < 0) i = 0;
    if (i >= b.length - 1) i = b.length - 2;
    const a = b[i];
    const period = b[i + 1] - a;
    // Extrapolate outside the detected range.
    const rel = (t - a) / period;
    const k = Math.round(rel * snap);
    return Math.round(a + (k / snap) * period);
  }

  /** Grid lines between t0 and t1: { t, level } with 0 = bar, 1 = beat, 2 = subdivision. */
  lines(t0: number, t1: number, snap: Snap): { t: number; level: number; bar: number }[] {
    const out: { t: number; level: number; bar: number }[] = [];
    const b = this.beats;
    if (b.length < 2) return out;
    const from = Math.max(0, lowerBound(b, t0) - 1);
    for (let i = from; i < b.length - 1 && b[i] <= t1; i++) {
      const rel = i - this.firstDownbeat;
      const isBar = ((rel % this.beatsPerBar) + this.beatsPerBar) % this.beatsPerBar === 0;
      const bar = Math.floor(rel / this.beatsPerBar) + 1;
      if (b[i] >= t0) out.push({ t: b[i], level: isBar ? 0 : 1, bar });
      const div = snap || 1;
      for (let k = 1; k < div; k++) {
        const t = b[i] + ((b[i + 1] - b[i]) * k) / div;
        if (t >= t0 && t <= t1) out.push({ t, level: 2, bar });
      }
    }
    return out;
  }
}

export function nextId(notes: Note[]): number {
  return notes.reduce((m, n) => Math.max(m, n.id), 0) + 1;
}

export function sortNotes(notes: Note[]): Note[] {
  return notes.slice().sort((a, b) => a.t - b.t || a.lane - b.lane);
}

export function addNote(notes: Note[], t: number, lane: number, type: NoteType, end?: number): { notes: Note[]; id: number } {
  // Replace a note already in that exact slot rather than stacking duplicates.
  const rest = notes.filter((n) => !(n.lane === lane && Math.abs(n.t - t) < 20));
  const id = nextId(notes);
  const note: Note = { id, t, lane, type };
  if (type === 'hold') note.end = Math.max(t + 150, end ?? t + 500);
  if (type === 'swipe') note.dir = 'up';
  return { notes: sortNotes([...rest, note]), id };
}

export function removeNotes(notes: Note[], ids: Set<number>): Note[] {
  return notes.filter((n) => !ids.has(n.id));
}

export function moveNotes(notes: Note[], ids: Set<number>, dt: number, dLane: number, laneCount: number): Note[] {
  return sortNotes(
    notes.map((n) => {
      if (!ids.has(n.id)) return n;
      const lane = Math.max(0, Math.min(laneCount - 1, n.lane + dLane));
      const t = Math.max(0, n.t + dt);
      return { ...n, t, lane, end: n.end !== undefined ? n.end + (t - n.t) : undefined };
    }),
  );
}

export function setType(notes: Note[], ids: Set<number>, type: NoteType, defaultHoldMs = 500): Note[] {
  return notes.map((n) => {
    if (!ids.has(n.id)) return n;
    const out: Note = { id: n.id, t: n.t, lane: n.lane, type, conf: n.conf };
    if (type === 'hold') out.end = n.end && n.end > n.t + 150 ? n.end : n.t + defaultHoldMs;
    if (type === 'swipe') out.dir = n.dir ?? 'up';
    return out;
  });
}

export function setHoldEnd(notes: Note[], id: number, end: number): Note[] {
  return notes.map((n) => (n.id === id && n.type === 'hold' ? { ...n, end: Math.max(n.t + 150, end) } : n));
}

export function cycleSwipeDir(notes: Note[], ids: Set<number>): Note[] {
  const order = ['up', 'right', 'down', 'left'] as const;
  return notes.map((n) => (ids.has(n.id) && n.type === 'swipe' ? { ...n, dir: order[(order.indexOf(n.dir ?? 'up') + 1) % 4] } : n));
}

/** Snapshot-based undo history with a size cap. */
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  constructor(private limit = 200) {}
  push(state: T): void {
    this.past.push(state);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undo(current: T): T | null {
    const prev = this.past.pop();
    if (prev === undefined) return null;
    this.future.push(current);
    return prev;
  }
  redo(current: T): T | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push(current);
    return next;
  }
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
}
