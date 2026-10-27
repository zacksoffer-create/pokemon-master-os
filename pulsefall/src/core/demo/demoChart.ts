import { validateChart } from '../chart/validate';
import type { Note, SwipeDir } from '../types';
import { DEMO_BPM, demoDurationMs } from './demoSong';

/**
 * A hand-authored chart for the demo track, written against the score rather than
 * detected audio. It shows off every note type: taps, chords on crashes, holds on long
 * melody notes (with taps underneath), swipes into the drop, and a snare-roll build.
 */

const BEAT = 60000 / DEMO_BPM;
const t = (bar: number, beat: number) => 500 + (bar * 4 + beat) * BEAT;

type Step = [beat: number, lane: number, holdBeats?: number];

export function buildDemoChart(): Note[] {
  const notes: Note[] = [];
  let id = 1;
  const tap = (bar: number, beat: number, lane: number) => notes.push({ id: id++, t: Math.round(t(bar, beat)), lane, type: 'tap' });
  const hold = (bar: number, beat: number, lane: number, beats: number) =>
    notes.push({ id: id++, t: Math.round(t(bar, beat)), end: Math.round(t(bar, beat + beats)), lane, type: 'hold' });
  const swipe = (bar: number, beat: number, lane: number, dir: SwipeDir) => notes.push({ id: id++, t: Math.round(t(bar, beat)), lane, type: 'swipe', dir });
  const chord = (bar: number, beat: number, a = 0, b = 2) => {
    tap(bar, beat, a);
    tap(bar, beat, b);
  };
  const steps = (bar: number, list: Step[]) => {
    for (const [beat, lane, hb] of list) {
      if (hb) hold(bar, beat, lane, hb);
      else tap(bar, beat, lane);
    }
  };

  // Intro: ride the pad chords, then a walk-up into the verse.
  hold(0, 0, 0, 3);
  hold(1, 0, 2, 3);
  hold(2, 0, 1, 3);
  steps(3, [[0, 0], [1, 1], [2, 2], [3, 1]]);

  // Verse: kick / bass / clap groove; the second half answers with mirrored lanes.
  for (let bar = 4; bar < 12; bar++) {
    const mirror = bar >= 8;
    const m = (l: number) => (mirror ? 2 - l : l);
    if (bar === 4) chord(bar, 0);
    else tap(bar, 0, m(0));
    if (bar % 2 === 0) tap(bar, 0.75, m(1));
    tap(bar, 1, m(2));
    tap(bar, 2, m(bar % 2 === 0 ? 0 : 1));
    if (bar % 2 === 1) tap(bar, 2.75, m(0));
    tap(bar, 3, m(2));
  }

  // Build: the snare roll speeds up, the chart follows (capped at 8ths), flick into the drop.
  steps(12, [[0, 0], [1, 1], [2, 2], [3, 1]]);
  steps(13, [[0, 0], [0.5, 1], [1, 2], [1.5, 1], [2, 0], [2.5, 1], [3, 2], [3.5, 1]]);
  steps(14, [[0, 0], [0.5, 2], [1, 0], [1.5, 2], [2, 0], [2.5, 2], [3, 0], [3.5, 2]]);
  steps(15, [[0, 1], [0.5, 0], [1, 1], [1.5, 2], [2, 1], [2.5, 0]]);
  swipe(15, 3, 1, 'up');

  // Drop: follow the lead hook. Long notes are holds with the beat tapped underneath.
  const hookA: Step[] = [[0.75, 1], [1.5, 0], [2, 1], [2.5, 2, 1.25]];
  const hookB: Step[] = [[0, 2], [0.75, 1], [1.5, 0], [2, 1, 1.75]];
  const hookC: Step[] = [[0, 2], [0.75, 1], [1.5, 0, 2.25]];
  for (const base of [16, 20]) {
    chord(base, 0);
    steps(base, hookA);
    tap(base, 3, 0);
    steps(base + 1, hookB);
    tap(base + 1, 3, 0);
    tap(base + 2, 0, 2);
    steps(base + 2, hookA);
    tap(base + 2, 3, 0);
    if (base === 16) {
      steps(base + 3, hookC);
      tap(base + 3, 3, 2);
    } else {
      steps(base + 3, [[0, 1], [0.75, 0], [1.5, 1], [2, 2, 1.5]]);
    }
  }

  // Breakdown: two long pad holds with the lonely kick tapped on the other side.
  hold(24, 0, 0, 6);
  tap(25, 0, 2);
  hold(26, 0, 2, 6);
  tap(27, 0, 0);
  swipe(27, 3, 1, 'up');

  // Final chorus: the hook once more, ending on a long high note and a big finish.
  chord(28, 0);
  steps(28, hookA);
  tap(28, 3, 0);
  steps(29, hookB);
  tap(29, 3, 0);
  tap(30, 0, 2);
  steps(30, [[0.75, 1], [1.5, 0], [2, 1], [2.5, 2, 1.25]]);
  tap(30, 3, 0);
  steps(31, [[0, 2], [0.75, 1], [1.5, 2, 2]]);
  tap(31, 2.5, 0);
  chord(32, 0);

  const report = validateChart(notes, { laneCount: 3, durationMs: demoDurationMs(), sameLaneGapMs: 120 });
  return report.notes;
}
