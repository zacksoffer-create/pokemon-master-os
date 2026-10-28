import type { Note, Segment } from '../types';

/** A stretch of a song, in song time (ms). */
export interface PlayRange {
  startMs: number;
  endMs: number;
}

/** The shortest part worth playing. */
export const MIN_PART_MS = 8000;
/** Holds cut by the end of a part become taps when less than this is left of them. */
const MIN_HOLD_MS = 150;
/** A skip lands this long before the next note reaches the line, after its approach. */
const SKIP_RUN_UP_MS = 1800;

/**
 * The chart's notes for part of a song. Notes outside the range are dropped; a hold running
 * past the end is cut there (or becomes a tap if too little of it is left). Ranges are on
 * the song's timeline, so `offsetMs` (chart + song offset) is applied before comparing.
 */
export function notesInRange(notes: Note[], offsetMs: number, startMs?: number, endMs?: number): Note[] {
  if (startMs === undefined && endMs === undefined) return notes;
  const from = (startMs ?? -Infinity) - offsetMs;
  const to = (endMs ?? Infinity) - offsetMs;
  const out: Note[] = [];
  for (const n of notes) {
    if (n.t < from || n.t > to) continue;
    if (n.type === 'hold' && n.end !== undefined && n.end > to) {
      out.push(to - n.t >= MIN_HOLD_MS ? { ...n, end: to } : { ...n, type: 'tap', end: undefined });
    } else out.push(n);
  }
  return out;
}

/** Keeps a range inside the song and at least MIN_PART_MS long (or the whole song if shorter). */
export function clampRange(r: PlayRange, durationMs: number): PlayRange {
  const len = Math.min(durationMs, Math.max(MIN_PART_MS, r.endMs - r.startMs));
  const start = Math.max(0, Math.min(r.startMs, durationMs - len));
  return { startMs: Math.round(start), endMs: Math.round(Math.min(durationMs, Math.max(r.endMs, start + len))) };
}

/** True when a range covers (almost) the whole song, so it isn't really a part. */
export function isWholeSong(r: PlayRange, durationMs: number): boolean {
  return r.startMs <= 500 && r.endMs >= durationMs - 500;
}

/**
 * Short names for a song's sections. Repeated sections share a letter (so a chorus that
 * comes back shows up as the same letter); a quiet first or last section is the intro or
 * outro.
 */
export function sectionNames(segments: Segment[]): string[] {
  if (segments.length === 0) return [];
  const mean = segments.reduce((s, x) => s + x.intensity, 0) / segments.length;
  const letters = new Map<number, string>();
  return segments.map((seg, i) => {
    const quiet = seg.intensity < mean;
    if (segments.length > 2 && i === 0 && quiet) return 'Intro';
    if (segments.length > 2 && i === segments.length - 1 && quiet) return 'Outro';
    let letter = letters.get(seg.label);
    if (!letter) {
      letter = String.fromCharCode(65 + (letters.size % 26));
      letters.set(seg.label, letter);
    }
    return letter;
  });
}

/**
 * Where to jump to skip a long stretch without notes: the next note then arrives after its
 * full approach plus a short run-up. Null when that wouldn't save at least `minSaveMs`.
 * All times are on the same (judgement) timeline.
 */
export function skipTarget(nowMs: number, nextNoteMs: number, approachMs: number, minSaveMs = 2500): number | null {
  const target = nextNoteMs - approachMs - SKIP_RUN_UP_MS;
  return target - nowMs >= minSaveMs ? target : null;
}
