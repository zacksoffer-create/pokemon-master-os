import type { JudgmentCounts, Note, NoteType, SwipeDir } from '../types';
import {
  JUDGMENT_POINTS,
  JUDGMENT_WEIGHT,
  judge,
  multiplierFor,
  starsFor,
  type Judgment,
  type TimingProfile,
} from './timing';

/**
 * The rhythm engine. It knows nothing about audio, rendering or the DOM: callers feed it
 * song times (ms, on the chart's timeline) for presses, releases, swipes and frame updates,
 * and it produces judgments deterministically from those times alone.
 */

export const NoteState = {
  Pending: 0,
  Hit: 1,
  Missed: 2,
  Holding: 3,
  HoldDone: 4,
  HoldBroken: 5,
  Skipped: 6,
  /** A swipe note that has been touched and is waiting for the flick. */
  Arming: 7,
} as const;

export type PointerKey = number | string;

export interface EngineNote {
  id: number;
  t: number;
  end: number;
  lane: number;
  type: NoteType;
  dir?: SwipeDir;
  group?: number;
  state: number;
  judgment: Judgment | null;
  tail: Judgment | null;
  errorMs: number;
  pointer: PointerKey | null;
  pressT: number;
  heldUntil: number;
  judgedAt: number;
  caught: boolean;
}

export type JudgePart = 'tap' | 'head' | 'tail' | 'swipe';

export type EngineEvent =
  | { kind: 'judge'; noteId: number; lane: number; judgment: Judgment; errorMs: number; part: JudgePart; t: number; combo: number }
  | { kind: 'holdStart'; noteId: number; lane: number; t: number }
  | { kind: 'holdEnd'; noteId: number; lane: number; t: number; completed: boolean }
  | { kind: 'comboBreak'; combo: number; t: number }
  | { kind: 'milestone'; combo: number; t: number };

export interface EngineOptions {
  profile: TimingProfile;
  laneCount: number;
  swipeAssist: boolean;
  /** Added to every note time (chart offset + song offset). */
  offsetMs?: number;
  autoplay?: boolean;
}

export interface EngineResult {
  score: number;
  accuracy: number;
  maxCombo: number;
  counts: JudgmentCounts;
  totalJudgments: number;
  judged: number;
  skipped: number;
  fullCombo: boolean;
  allPerfect: boolean;
  stars: number;
  meanErrorMs: number;
  /** Signed timing errors of every timed hit, for the results histogram. */
  errors: number[];
}

/** Extra time a touched swipe note waits for the flick after its window closes. */
const SWIPE_GRACE_MS = 140;
/** Holds released this close to their end still count as completed. */
const HOLD_RELEASE_GRACE_MS = 130;
/** A missed hold head can still be "caught" until this long before its end. */
const HOLD_CATCH_MARGIN_MS = 120;
const SUSTAIN_TICK_MS = 100;
const SUSTAIN_TICK_POINTS = 10;
const MILESTONES = [25, 50, 100, 150, 200, 300, 400, 500, 750, 1000];

export class GameEngine {
  readonly notes: EngineNote[];
  readonly laneCount: number;
  readonly profile: TimingProfile;
  readonly totalJudgments: number;
  readonly lastTime: number;
  swipeAssist: boolean;
  autoplay: boolean;

  score = 0;
  combo = 0;
  maxCombo = 0;
  counts: JudgmentCounts = { perfect: 0, great: 0, good: 0, miss: 0 };
  judged = 0;
  skipped = 0;
  events: EngineEvent[] = [];
  readonly errors: number[] = [];

  private weightSum = 0;
  private cursor = 0;
  private lastUpdate = -Infinity;

  constructor(chartNotes: Note[], opts: EngineOptions) {
    const offset = opts.offsetMs ?? 0;
    this.profile = opts.profile;
    this.laneCount = opts.laneCount;
    this.swipeAssist = opts.swipeAssist;
    this.autoplay = !!opts.autoplay;
    this.notes = chartNotes
      .filter((n) => n.lane >= 0 && n.lane < opts.laneCount && isFinite(n.t))
      .map((n) => ({
        id: n.id,
        t: n.t + offset,
        end: n.type === 'hold' && n.end !== undefined && n.end > n.t ? n.end + offset : n.t + offset,
        lane: n.lane,
        type: n.type === 'hold' && !(n.end !== undefined && n.end > n.t) ? 'tap' : n.type,
        dir: n.dir,
        group: n.group,
        state: NoteState.Pending,
        judgment: null,
        tail: null,
        errorMs: 0,
        pointer: null,
        pressT: 0,
        heldUntil: 0,
        judgedAt: 0,
        caught: false,
      }))
      .sort((a, b) => a.t - b.t || a.lane - b.lane);
    let total = 0;
    let last = 0;
    for (const n of this.notes) {
      total += n.type === 'hold' ? 2 : 1;
      last = Math.max(last, n.end);
    }
    this.totalJudgments = total;
    this.lastTime = last;
  }

  /**
   * Pausing mid-hold: the hold is not broken, it becomes catchable again — pressing its
   * lane while the body is still on screen after resuming picks it back up.
   */
  suspendHolds(): void {
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.state === NoteState.Holding) {
        n.state = NoteState.Missed;
        n.pointer = null;
        n.caught = false;
      } else if (n.state === NoteState.Arming) {
        n.state = NoteState.Pending;
        n.pointer = null;
      }
    }
  }

  /** Practice / preview: everything before `t` is skipped and does not count. */
  startAt(t: number): void {
    for (const n of this.notes) {
      if (n.t < t && n.state === NoteState.Pending) {
        n.state = NoteState.Skipped;
        this.skipped += n.type === 'hold' ? 2 : 1;
      }
    }
    this.advanceCursor();
  }

  get multiplier(): number {
    return multiplierFor(this.combo);
  }

  get accuracy(): number {
    return this.judged === 0 ? 1 : this.weightSum / this.judged;
  }

  /** Fraction of the chart that has been resolved, 0..1. */
  get progress(): number {
    const denom = this.totalJudgments;
    return denom === 0 ? 1 : (this.judged + this.skipped) / denom;
  }

  isFinished(t: number): boolean {
    return this.cursor >= this.notes.length && t >= this.lastTime;
  }

  /** A touch went down in `lane`. Returns the note it engaged, if any. */
  press(lane: number, t: number, pointer: PointerKey): EngineNote | null {
    const { good } = this.profile;
    const notes = this.notes;
    let target: EngineNote | null = null;
    let catchable: EngineNote | null = null;
    for (let i = this.cursor; i < notes.length; i++) {
      const n = notes[i];
      if (n.t - good > t) break;
      if (n.lane !== lane) continue;
      if (n.state === NoteState.Pending && t <= n.t + good) {
        target = n;
        break;
      }
      if (
        !catchable &&
        n.type === 'hold' &&
        n.state === NoteState.Missed &&
        n.tail === null &&
        t > n.t &&
        t < n.end - HOLD_CATCH_MARGIN_MS
      ) {
        catchable = n;
      }
    }
    if (target) {
      const err = t - target.t;
      if (target.type === 'swipe') {
        target.state = NoteState.Arming;
        target.pointer = pointer;
        target.pressT = t;
        return target;
      }
      const j = judge(err, this.profile);
      if (target.type === 'hold') {
        target.state = NoteState.Holding;
        target.pointer = pointer;
        target.heldUntil = Math.max(t, target.t);
        target.judgment = j;
        target.errorMs = err;
        target.judgedAt = t;
        this.apply(j, err, 'head', target, t);
        this.events.push({ kind: 'holdStart', noteId: target.id, lane: target.lane, t });
      } else {
        target.state = NoteState.Hit;
        target.judgment = j;
        target.errorMs = err;
        target.judgedAt = t;
        this.apply(j, err, 'tap', target, t);
        this.advanceCursor();
      }
      return target;
    }
    if (catchable) {
      catchable.state = NoteState.Holding;
      catchable.caught = true;
      catchable.pointer = pointer;
      catchable.heldUntil = t;
      this.events.push({ kind: 'holdStart', noteId: catchable.id, lane: catchable.lane, t });
      return catchable;
    }
    return null;
  }

  /** A flick was recognised for `pointer`. `t` is when the touch began. */
  swipe(pointer: PointerKey, dir: SwipeDir, t: number): boolean {
    const n = this.findBound(pointer, NoteState.Arming);
    if (!n) return false;
    const err = n.pressT - n.t;
    let j = judge(err, this.profile);
    if (!this.swipeAssist && n.dir && dir !== n.dir && j !== 'miss') j = 'good';
    this.resolveSwipe(n, j, err, t);
    return true;
  }

  release(pointer: PointerKey, t: number): void {
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.t - this.profile.good > t) break;
      if (n.pointer !== pointer) continue;
      if (n.state === NoteState.Holding) {
        this.addSustain(n, Math.min(t, n.end));
        const grace = Math.min(HOLD_RELEASE_GRACE_MS, 0.3 * (n.end - n.t));
        if (t >= n.end - grace) this.finishHold(n, true, t);
        else this.finishHold(n, false, t);
      } else if (n.state === NoteState.Arming) {
        const err = n.pressT - n.t;
        if (this.swipeAssist) this.resolveSwipe(n, judge(err, this.profile), err, t);
        // Without assist a lifted finger leaves the note armed until its window closes.
        else n.pointer = null;
      }
    }
    this.advanceCursor();
  }

  /**
   * Advance time. `forgive` marks notes whose window closed during this step as skipped
   * instead of missed (used after a frame stall or an interruption).
   */
  update(t: number, forgive = false): void {
    const { good } = this.profile;
    const notes = this.notes;
    if (this.autoplay) this.runAutoplay(t);
    for (let i = this.cursor; i < notes.length; i++) {
      const n = notes[i];
      if (n.t - good > t) break;
      switch (n.state) {
        case NoteState.Pending:
          if (t > n.t + good) {
            if (forgive) this.skip(n);
            else {
              this.missHead(n, t);
              if (n.type === 'hold' && t > n.end) this.missTail(n, t);
            }
          }
          break;
        case NoteState.Arming:
          if (t > n.t + good + SWIPE_GRACE_MS) {
            const err = n.pressT - n.t;
            if (forgive) this.skip(n);
            else if (this.swipeAssist) this.resolveSwipe(n, judge(err, this.profile), err, t);
            else this.resolveSwipe(n, 'miss', err, t);
          }
          break;
        case NoteState.Holding:
          this.addSustain(n, Math.min(t, n.end));
          if (t >= n.end) this.finishHold(n, true, t);
          break;
        case NoteState.Missed:
          if (n.type === 'hold' && n.tail === null && t > n.end) {
            if (forgive) {
              n.tail = 'miss';
              n.state = NoteState.HoldBroken;
              this.skipped += 1;
            } else this.missTail(n, t);
          }
          break;
      }
    }
    this.lastUpdate = t;
    this.advanceCursor();
  }

  getResult(): EngineResult {
    const meanErrorMs = this.errors.length ? this.errors.reduce((a, b) => a + b, 0) / this.errors.length : 0;
    const accuracy = this.accuracy;
    return {
      score: Math.round(this.score),
      accuracy,
      maxCombo: this.maxCombo,
      counts: { ...this.counts },
      totalJudgments: this.totalJudgments,
      judged: this.judged,
      skipped: this.skipped,
      fullCombo: this.judged > 0 && this.counts.miss === 0,
      allPerfect: this.judged > 0 && this.counts.perfect === this.judged,
      stars: starsFor(accuracy),
      meanErrorMs,
      errors: this.errors.slice(),
    };
  }

  /** Notes currently held or armed (for rendering held lanes). */
  isLaneHeld(lane: number): boolean {
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.t > this.lastUpdate) break;
      if (n.lane === lane && n.state === NoteState.Holding) return true;
    }
    return false;
  }

  drainEvents(): EngineEvent[] {
    if (this.events.length === 0) return EMPTY;
    const out = this.events;
    this.events = [];
    return out;
  }

  // --- internals -------------------------------------------------------------

  private runAutoplay(t: number): void {
    const notes = this.notes;
    for (let i = this.cursor; i < notes.length; i++) {
      const n = notes[i];
      if (n.t > t) break;
      if (n.state !== NoteState.Pending) continue;
      if (n.type === 'swipe') {
        n.pressT = n.t;
        this.resolveSwipe(n, 'perfect', 0, n.t);
      } else if (n.type === 'hold') {
        n.state = NoteState.Holding;
        n.pointer = 'auto';
        n.heldUntil = n.t;
        n.judgment = 'perfect';
        n.judgedAt = n.t;
        this.apply('perfect', 0, 'head', n, n.t);
        this.events.push({ kind: 'holdStart', noteId: n.id, lane: n.lane, t: n.t });
      } else {
        n.state = NoteState.Hit;
        n.judgment = 'perfect';
        n.judgedAt = n.t;
        this.apply('perfect', 0, 'tap', n, n.t);
      }
    }
  }

  private findBound(pointer: PointerKey, state: number): EngineNote | null {
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.pointer === pointer && n.state === state) return n;
      if (n.t - this.profile.good > this.lastUpdate + 1000) break;
    }
    return null;
  }

  private resolveSwipe(n: EngineNote, j: Judgment, err: number, t: number): void {
    n.state = j === 'miss' ? NoteState.Missed : NoteState.Hit;
    n.judgment = j;
    n.errorMs = err;
    n.judgedAt = t;
    n.pointer = null;
    this.apply(j, err, 'swipe', n, t);
  }

  private missHead(n: EngineNote, t: number): void {
    n.state = NoteState.Missed;
    n.judgment = 'miss';
    n.judgedAt = t;
    this.apply('miss', 0, n.type === 'hold' ? 'head' : n.type === 'swipe' ? 'swipe' : 'tap', n, t);
  }

  private missTail(n: EngineNote, t: number): void {
    n.tail = 'miss';
    n.state = NoteState.HoldBroken;
    this.apply('miss', 0, 'tail', n, t);
  }

  private skip(n: EngineNote): void {
    n.state = NoteState.Skipped;
    this.skipped += n.type === 'hold' ? 2 : 1;
  }

  private addSustain(n: EngineNote, upTo: number): void {
    if (upTo <= n.heldUntil) return;
    const before = Math.floor((n.heldUntil - n.t) / SUSTAIN_TICK_MS);
    const after = Math.floor((upTo - n.t) / SUSTAIN_TICK_MS);
    if (after > before) this.score += (after - before) * SUSTAIN_TICK_POINTS * this.multiplier;
    n.heldUntil = upTo;
  }

  private finishHold(n: EngineNote, completed: boolean, t: number): void {
    n.state = completed ? NoteState.HoldDone : NoteState.HoldBroken;
    n.tail = completed ? 'perfect' : 'miss';
    n.pointer = null;
    this.apply(n.tail, 0, 'tail', n, t);
    this.events.push({ kind: 'holdEnd', noteId: n.id, lane: n.lane, t, completed });
  }

  private apply(j: Judgment, err: number, part: JudgePart, n: EngineNote, t: number): void {
    this.counts[j]++;
    this.judged++;
    this.weightSum += JUDGMENT_WEIGHT[j];
    if (j === 'miss') {
      if (this.combo > 0) this.events.push({ kind: 'comboBreak', combo: this.combo, t });
      this.combo = 0;
    } else {
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.score += JUDGMENT_POINTS[j] * multiplierFor(this.combo);
      if (part !== 'tail') this.errors.push(err);
      if (MILESTONES.includes(this.combo)) this.events.push({ kind: 'milestone', combo: this.combo, t });
    }
    this.events.push({ kind: 'judge', noteId: n.id, lane: n.lane, judgment: j, errorMs: err, part, t, combo: this.combo });
  }

  private advanceCursor(): void {
    const notes = this.notes;
    while (this.cursor < notes.length && isResolved(notes[this.cursor])) this.cursor++;
  }
}

const EMPTY: EngineEvent[] = [];

function isResolved(n: EngineNote): boolean {
  switch (n.state) {
    case NoteState.Hit:
    case NoteState.HoldDone:
    case NoteState.HoldBroken:
    case NoteState.Skipped:
      return true;
    case NoteState.Missed:
      return n.type !== 'hold' || n.tail !== null;
    default:
      return false;
  }
}
