import { describe, expect, it } from 'vitest';
import { GameEngine, NoteState } from '../../src/core/engine/gameEngine';
import { TIMING_PROFILES, multiplierFor, starsFor } from '../../src/core/engine/timing';
import type { Note } from '../../src/core/types';

const P = TIMING_PROFILES.comfortable;

function tap(id: number, t: number, lane: number): Note {
  return { id, t, lane, type: 'tap' };
}
function hold(id: number, t: number, end: number, lane: number): Note {
  return { id, t, end, lane, type: 'hold' };
}
function swipe(id: number, t: number, lane: number): Note {
  return { id, t, lane, type: 'swipe', dir: 'up' };
}
function engine(notes: Note[], extra: Partial<ConstructorParameters<typeof GameEngine>[1]> = {}) {
  return new GameEngine(notes, { profile: P, laneCount: 3, swipeAssist: true, ...extra });
}

describe('tap judgments', () => {
  it('judges each lane independently and by timing error', () => {
    const e = engine([tap(1, 1000, 0), tap(2, 2000, 1), tap(3, 3000, 2)]);
    expect(e.press(0, 1010, 'a')?.judgment).toBe('perfect');
    expect(e.press(1, 2000 - 100, 'a')?.judgment).toBe('great');
    expect(e.press(2, 3000 + 150, 'a')?.judgment).toBe('good');
    expect(e.counts).toEqual({ perfect: 1, great: 1, good: 1, miss: 0 });
  });

  it('ignores presses in the wrong lane or far from any note without penalty', () => {
    const e = engine([tap(1, 1000, 0)]);
    expect(e.press(1, 1000, 'a')).toBeNull();
    expect(e.press(0, 500, 'a')).toBeNull();
    expect(e.counts.miss).toBe(0);
    expect(e.press(0, 1000, 'a')?.judgment).toBe('perfect');
  });

  it('misses notes once their window has passed and never judges them twice', () => {
    const e = engine([tap(1, 1000, 0), tap(2, 1500, 0)]);
    e.update(1000 + P.good + 1);
    expect(e.counts.miss).toBe(1);
    expect(e.notes[0].state).toBe(NoteState.Missed);
    // A late press now goes to the next note, not the missed one.
    expect(e.press(0, 1500, 'a')?.id).toBe(2);
    e.update(5000);
    expect(e.counts.miss).toBe(1);
    expect(e.judged).toBe(2);
  });

  it('takes the earliest pending note when windows overlap in a lane', () => {
    const e = engine([tap(1, 1000, 1), tap(2, 1120, 1)]);
    expect(e.press(1, 1060, 'a')?.id).toBe(1);
    expect(e.press(1, 1125, 'b')?.id).toBe(2);
  });

  it('handles simultaneous notes with two pointers', () => {
    const e = engine([
      { ...tap(1, 1000, 0), group: 1 },
      { ...tap(2, 1000, 2), group: 1 },
    ]);
    expect(e.press(0, 1005, 'left')?.judgment).toBe('perfect');
    expect(e.press(2, 995, 'right')?.judgment).toBe('perfect');
    expect(e.combo).toBe(2);
  });

  it('applies the chart offset to every note', () => {
    const e = engine([tap(1, 1000, 0)], { offsetMs: 40 });
    expect(e.press(0, 1040, 'a')?.errorMs).toBe(0);
  });
});

describe('combo, multiplier and score', () => {
  it('builds combo, raises the multiplier every 10 and resets on miss', () => {
    const notes = Array.from({ length: 25 }, (_, i) => tap(i, 1000 + i * 300, i % 3));
    const e = engine(notes);
    for (let i = 0; i < 20; i++) e.press(i % 3, 1000 + i * 300, 'a');
    expect(e.combo).toBe(20);
    expect(e.multiplier).toBe(3);
    e.update(1000 + 20 * 300 + P.good + 1); // miss note 20
    expect(e.combo).toBe(0);
    expect(e.maxCombo).toBe(20);
    expect(e.drainEvents().some((ev) => ev.kind === 'comboBreak')).toBe(true);
  });

  it('scores perfects with the multiplier', () => {
    const notes = Array.from({ length: 12 }, (_, i) => tap(i, 1000 + i * 300, 0));
    const e = engine(notes);
    for (let i = 0; i < 12; i++) e.press(0, 1000 + i * 300, 'a');
    // combos 1..9 at x1, 10..12 at x2
    expect(e.score).toBe(9 * 100 + 3 * 200);
    expect(multiplierFor(35)).toBe(4);
    expect(multiplierFor(500)).toBe(4);
  });

  it('reports full combo, all perfect and stars', () => {
    const e = engine([tap(1, 1000, 0), tap(2, 1500, 1)]);
    e.press(0, 1000, 'a');
    e.press(1, 1500, 'a');
    e.update(3000);
    const r = e.getResult();
    expect(r.fullCombo).toBe(true);
    expect(r.allPerfect).toBe(true);
    expect(r.accuracy).toBe(1);
    expect(r.stars).toBe(5);
    expect(e.isFinished(3000)).toBe(true);
    expect(starsFor(0.5)).toBe(1);
  });

  it('tracks mean timing error for calibration hints', () => {
    const e = engine([tap(1, 1000, 0), tap(2, 2000, 0)]);
    e.press(0, 1030, 'a');
    e.press(0, 2010, 'a');
    expect(e.getResult().meanErrorMs).toBeCloseTo(20);
  });
});

describe('hold notes', () => {
  it('completes when held to the end', () => {
    const e = engine([hold(1, 1000, 2000, 1)]);
    e.press(1, 1000, 'p');
    e.update(1500);
    expect(e.notes[0].state).toBe(NoteState.Holding);
    e.update(2000);
    expect(e.notes[0].state).toBe(NoteState.HoldDone);
    expect(e.counts.perfect).toBe(2);
    expect(e.score).toBeGreaterThan(200); // head + tail + sustain ticks
  });

  it('accepts a release just before the end', () => {
    const e = engine([hold(1, 1000, 2000, 1)]);
    e.press(1, 1000, 'p');
    e.update(1900);
    e.release('p', 1950);
    expect(e.notes[0].state).toBe(NoteState.HoldDone);
  });

  it('breaks when released early', () => {
    const e = engine([hold(1, 1000, 2000, 1)]);
    e.press(1, 1000, 'p');
    e.release('p', 1400);
    expect(e.notes[0].state).toBe(NoteState.HoldBroken);
    expect(e.counts.miss).toBe(1);
    expect(e.combo).toBe(0);
  });

  it('only the bound pointer can release a hold', () => {
    const e = engine([hold(1, 1000, 2000, 1), tap(2, 1500, 0)]);
    e.press(1, 1000, 'p1');
    e.press(0, 1500, 'p2');
    e.release('p2', 1520);
    expect(e.notes.find((n) => n.id === 1)!.state).toBe(NoteState.Holding);
    e.update(2100);
    expect(e.notes.find((n) => n.id === 1)!.state).toBe(NoteState.HoldDone);
  });

  it('a missed head can be caught to save the tail', () => {
    const e = engine([hold(1, 1000, 3000, 2)]);
    e.update(1000 + P.good + 10);
    expect(e.counts.miss).toBe(1);
    expect(e.press(2, 1500, 'p')?.caught).toBe(true);
    e.update(3000);
    expect(e.notes[0].tail).toBe('perfect');
    expect(e.counts.miss).toBe(1);
  });

  it('an uncaught hold costs head and tail', () => {
    const e = engine([hold(1, 1000, 3000, 2)]);
    e.update(3100);
    expect(e.counts.miss).toBe(2);
    expect(e.isFinished(3100)).toBe(true);
  });
});

describe('swipe notes', () => {
  it('judges a flick by the time the touch began', () => {
    const e = engine([swipe(1, 1000, 1)]);
    e.press(1, 1020, 'p');
    expect(e.notes[0].state).toBe(NoteState.Arming);
    expect(e.swipe('p', 'up', 1080)).toBe(true);
    expect(e.notes[0].judgment).toBe('perfect');
  });

  it('with assist, a plain tap counts', () => {
    const e = engine([swipe(1, 1000, 1)]);
    e.press(1, 1000, 'p');
    e.release('p', 1050);
    expect(e.notes[0].judgment).toBe('perfect');
  });

  it('without assist, a plain tap misses once the window closes', () => {
    const e = engine([swipe(1, 1000, 1)], { swipeAssist: false });
    e.press(1, 1000, 'p');
    e.release('p', 1050);
    e.update(1000 + P.good + 200);
    expect(e.notes[0].judgment).toBe('miss');
  });

  it('without assist, the wrong direction is downgraded', () => {
    const e = engine([swipe(1, 1000, 1)], { swipeAssist: false });
    e.press(1, 1000, 'p');
    e.swipe('p', 'left', 1040);
    expect(e.notes[0].judgment).toBe('good');
  });
});

describe('time control', () => {
  it('autoplay clears a chart perfectly', () => {
    const notes = [tap(1, 500, 0), hold(2, 1000, 1600, 1), swipe(3, 2000, 2), tap(4, 2000, 0)];
    const e = engine(notes, { autoplay: true });
    for (let t = 0; t <= 3000; t += 16) e.update(t);
    const r = e.getResult();
    expect(r.allPerfect).toBe(true);
    expect(r.judged).toBe(e.totalJudgments);
  });

  it('startAt skips earlier notes without counting them', () => {
    const e = engine([tap(1, 500, 0), tap(2, 1500, 0)]);
    e.startAt(1000);
    e.press(0, 1500, 'p');
    e.update(3000);
    const r = e.getResult();
    expect(r.counts.miss).toBe(0);
    expect(r.skipped).toBe(1);
    expect(r.fullCombo).toBe(true);
  });

  it('forgives notes that passed during a stall', () => {
    const e = engine([tap(1, 1000, 0), tap(2, 1100, 1), tap(3, 4000, 2)]);
    e.update(900);
    e.update(2500, true);
    expect(e.counts.miss).toBe(0);
    expect(e.skipped).toBe(2);
    e.press(2, 4000, 'p');
    expect(e.getResult().fullCombo).toBe(true);
  });

  it('frame-rate independence: judgments depend only on supplied times', () => {
    const notes = Array.from({ length: 30 }, (_, i) => tap(i, 1000 + i * 250, i % 3));
    const run = (step: number) => {
      const e = engine(notes);
      let next = 0;
      for (let t = 0; t < 10000; t += step) {
        while (next < notes.length && notes[next].t + 20 <= t) {
          e.press(notes[next].lane, notes[next].t + 20, 'p');
          next++;
        }
        e.update(t);
      }
      return e.getResult();
    };
    expect(run(7)).toEqual(run(33));
  });
});
