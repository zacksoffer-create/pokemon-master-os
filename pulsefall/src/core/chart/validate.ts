import type { Note, SwipeDir } from '../types';

export interface ValidateOptions {
  laneCount: number;
  durationMs: number;
  /** Minimum gap between two notes in the same lane. */
  sameLaneGapMs?: number;
  /** Cap on notes in any 1 s window (weakest notes are dropped). */
  maxNps?: number;
  /** Largest chord allowed. Defaults to 2 (two thumbs). */
  maxChord?: number;
  minHoldMs?: number;
}

export interface ValidationReport {
  notes: Note[];
  fixes: string[];
  warnings: string[];
  ok: boolean;
}

const SWIPE_DIRS: SwipeDir[] = ['up', 'left', 'right', 'down'];
const CHORD_EPS_MS = 3;

/**
 * Structural validation with deterministic repairs. Works on any chart — generated,
 * hand-edited or imported — and never mutates its input.
 */
export function validateChart(input: Note[], opts: ValidateOptions): ValidationReport {
  const fixes: string[] = [];
  const warnings: string[] = [];
  const L = opts.laneCount;
  const sameLaneGap = opts.sameLaneGapMs ?? 60;
  const minHold = opts.minHoldMs ?? 150;
  const maxChord = Math.max(1, Math.min(opts.maxChord ?? 2, L));
  const end = opts.durationMs;
  const count = (msg: string) => fixes.push(msg);

  // 1. Malformed values.
  let notes: Note[] = [];
  for (const raw of input) {
    if (!raw || typeof raw.t !== 'number' || !isFinite(raw.t)) {
      count('removed a note with an invalid time');
      continue;
    }
    const n: Note = { ...raw };
    if (!Number.isInteger(n.lane) || n.lane < 0 || n.lane >= L) {
      if (typeof n.lane === 'number' && isFinite(n.lane)) {
        n.lane = Math.max(0, Math.min(L - 1, Math.round(n.lane)));
        count('moved a note into a valid lane');
      } else {
        count('removed a note with an invalid lane');
        continue;
      }
    }
    if (n.type !== 'tap' && n.type !== 'hold' && n.type !== 'swipe') {
      n.type = 'tap';
      count('converted an unknown note type to a tap');
    }
    if (n.t < 0) {
      count('removed a note before the song starts');
      continue;
    }
    if (n.t > end - 20) {
      count('removed a note after the song ends');
      continue;
    }
    if (n.type === 'hold') {
      if (typeof n.end !== 'number' || !isFinite(n.end) || n.end - n.t < minHold) {
        n.type = 'tap';
        delete n.end;
        count('converted a too-short hold to a tap');
      } else if (n.end > end) {
        n.end = end;
        count('trimmed a hold that ran past the end');
      }
    } else delete n.end;
    if (n.type === 'swipe') {
      if (!n.dir || !SWIPE_DIRS.includes(n.dir)) n.dir = 'up';
    } else delete n.dir;
    notes.push(n);
  }

  // 2. Order and duplicates (same lane, practically the same time).
  notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
  const deduped: Note[] = [];
  for (const n of notes) {
    let dup = false;
    for (let k = deduped.length - 1; k >= 0 && n.t - deduped[k].t < CHORD_EPS_MS + 25; k--) {
      if (deduped[k].lane === n.lane) dup = true;
    }
    if (dup) {
      count('removed a duplicate note');
      continue;
    }
    deduped.push(n);
  }
  notes = deduped;

  // 3. Same-lane spacing and hold overlaps. Try moving a conflicting note to a free lane first.
  const lastInLane: (Note | null)[] = new Array(L).fill(null);
  const busyUntil = new Array(L).fill(-Infinity);
  const kept: Note[] = [];
  for (const n of notes) {
    const laneOk = (lane: number) => {
      const prev = lastInLane[lane];
      if (busyUntil[lane] > n.t - 60) return false;
      return !prev || n.t - prev.t >= sameLaneGap;
    };
    if (!laneOk(n.lane)) {
      // Holds that would run into this note get shortened instead, when possible.
      const prev = lastInLane[n.lane];
      if (prev && prev.type === 'hold' && prev.end !== undefined && prev.end > n.t - 60 && n.t - 80 - prev.t >= minHold) {
        prev.end = n.t - 80;
        busyUntil[n.lane] = prev.end;
        count('shortened a hold that overlapped the next note');
      }
    }
    if (!laneOk(n.lane)) {
      const simultaneous = kept.filter((m) => Math.abs(m.t - n.t) <= CHORD_EPS_MS);
      const free = [...Array(L).keys()]
        .filter((l) => l !== n.lane && laneOk(l) && !simultaneous.some((m) => m.lane === l))
        .sort((a, b) => Math.abs(a - n.lane) - Math.abs(b - n.lane));
      if (free.length) {
        n.lane = free[0];
        count('moved a note to avoid a same-lane conflict');
      } else {
        count('removed an unplayable same-lane note');
        continue;
      }
    }
    kept.push(n);
    lastInLane[n.lane] = n;
    if (n.type === 'hold' && n.end !== undefined) busyUntil[n.lane] = n.end;
  }
  notes = kept;

  // 4. Chords: limit size, align times exactly, give them a shared group id, no swipes inside.
  const out: Note[] = [];
  let groupId = 1;
  for (let i = 0; i < notes.length; ) {
    let j = i + 1;
    while (j < notes.length && notes[j].t - notes[i].t <= CHORD_EPS_MS) j++;
    let chord = notes.slice(i, j);
    if (chord.length > maxChord) {
      chord.sort((a, b) => (b.conf ?? 0) - (a.conf ?? 0));
      chord = chord.slice(0, maxChord).sort((a, b) => a.lane - b.lane);
      count('reduced an oversized chord');
    }
    if (chord.length > 1) {
      const g = groupId++;
      for (const n of chord) {
        n.t = chord[0].t;
        n.group = g;
        if (n.type === 'swipe') {
          n.type = 'tap';
          delete n.dir;
          count('turned a swipe inside a chord into a tap');
        }
      }
    } else delete chord[0].group;
    out.push(...chord);
    i = j;
  }
  notes = out;

  // 5. Notes that start while another lane is held in a two-thumb-unfriendly way:
  //    with a hold in the middle lane of a 3-lane chart, both thumbs would be needed.
  if (L === 3) {
    for (const h of notes) {
      if (h.type !== 'hold' || h.lane !== 1 || h.end === undefined) continue;
      const during = notes.filter((m) => m !== h && m.t > h.t + 30 && m.t < h.end!);
      const lanes = new Set(during.map((m) => m.lane));
      if (lanes.has(0) && lanes.has(2)) {
        const cut = during[0].t - 80;
        if (cut - h.t >= minHold) h.end = cut;
        else {
          h.type = 'tap';
          delete h.end;
        }
        count('simplified a middle-lane hold with notes on both sides');
      }
    }
  }

  // 6. Density cap: drop the weakest notes in any over-full one-second window.
  if (opts.maxNps && notes.length) {
    const cap = Math.max(1, Math.floor(opts.maxNps));
    let changed = true;
    let guard = 0;
    while (changed && guard++ < 50) {
      changed = false;
      let a = 0;
      for (let b = 0; b < notes.length; b++) {
        while (notes[b].t - notes[a].t >= 1000) a++;
        // Count events (chords count once).
        const events = new Set<unknown>();
        for (let k = a; k <= b; k++) events.add(notes[k].group !== undefined ? `g${notes[k].group}` : notes[k]);
        if (events.size > cap) {
          let weakest = a;
          for (let k = a; k <= b; k++) if ((notes[k].conf ?? 0.5) < (notes[weakest].conf ?? 0.5)) weakest = k;
          notes.splice(weakest, 1);
          count('thinned an overly dense burst');
          changed = true;
          break;
        }
      }
    }
  }

  // 7. Stable ids: keep existing unique ids, assign new ones where missing or duplicated.
  const seen = new Set<number>();
  let maxId = notes.reduce((m, n) => (Number.isInteger(n.id) && n.id > m ? n.id : m), 0);
  for (const n of notes) {
    if (!Number.isInteger(n.id) || seen.has(n.id)) n.id = ++maxId;
    seen.add(n.id);
  }

  if (input.length > 0 && notes.length === 0) warnings.push('Every note was invalid and had to be removed.');
  return { notes, fixes, warnings, ok: warnings.length === 0 };
}

/** Quick structural check without repairs (used by tests and the editor). */
export function chartProblems(notes: Note[], opts: ValidateOptions): string[] {
  const report = validateChart(notes, opts);
  return report.fixes;
}
