import { describe, expect, it } from 'vitest';
import { SongClock, HARD_RESYNC_MS, type AudibleTimeSource } from '../../src/core/audio/clock';
import { calibrate, heardTime, judgeTime, renderTime } from '../../src/core/game/offsets';
import { mulberry32 } from '../../src/core/util';

/** A fake audio device: true audible ctx time = perf/1000 - latency, read with jitter and coarse steps. */
class FakeSource implements AudibleTimeSource {
  perf = 0;
  latency = 0.02;
  jitterMs = 3;
  quantumMs = 10.7; // reading updates in ~512-frame steps
  drift = 1; // ratio of audio clock to performance clock
  private rnd = mulberry32(3);
  sample() {
    const stepped = Math.floor(this.perf / this.quantumMs) * this.quantumMs;
    const ctx = (stepped * this.drift) / 1000 - this.latency + ((this.rnd() * 2 - 1) * this.jitterMs) / 1000;
    return { ctxTime: ctx, perf: this.perf };
  }
  trueSong(anchorCtx: number, anchorSong: number) {
    return anchorSong + ((this.perf * this.drift) / 1000 - this.latency - anchorCtx) * 1000;
  }
}

describe('SongClock', () => {
  it('tracks the audible position smoothly without drifting over a long song', () => {
    const src = new FakeSource();
    const clock = new SongClock(src);
    clock.start(0.1, 0);
    let maxErr = 0;
    let maxStep = 0;
    let prev = -Infinity;
    for (let f = 0; f < 60 * 60 * 8; f++) {
      src.perf = 16.67 * f;
      const t = clock.update(src.perf);
      if (f > 30) maxErr = Math.max(maxErr, Math.abs(t - src.trueSong(0.1, 0)));
      if (f > 30) maxStep = Math.max(maxStep, Math.abs(t - prev - 16.67));
      prev = t;
    }
    expect(maxErr).toBeLessThan(12);
    expect(maxStep).toBeLessThan(0.5); // no visible judder from coarse readings
  });

  it('stays smooth on a very coarse clock (1024-frame audio buffers)', () => {
    const src = new FakeSource();
    src.quantumMs = 23.2;
    const clock = new SongClock(src);
    clock.start(0, 0);
    let maxStep = 0;
    let prev = -Infinity;
    for (let f = 0; f < 60 * 120; f++) {
      src.perf = 16.67 * f;
      const t = clock.update(src.perf);
      if (f > 60) maxStep = Math.max(maxStep, Math.abs(t - prev - 16.67));
      prev = t;
    }
    expect(maxStep).toBeLessThan(0.6);
  });

  it('catches up quickly with a real shift that is too small for a hard resync', () => {
    const src = new FakeSource();
    src.jitterMs = 0;
    const clock = new SongClock(src);
    clock.start(0, 0);
    for (let f = 0; f < 600; f++) {
      src.perf = 16.67 * f;
      clock.update(src.perf);
    }
    const before = clock.update(src.perf) - src.trueSong(0, 0);
    src.latency += 0.03; // the output path suddenly adds 30 ms
    let frames = 0;
    for (; frames < 120; frames++) {
      src.perf += 16.67;
      if (Math.abs(clock.update(src.perf) - src.trueSong(0, 0) - before) < 5) break;
    }
    expect(frames).toBeLessThan(30);
  });

  it('follows an audio clock that runs slightly fast or slow (no accumulated drift)', () => {
    const src = new FakeSource();
    src.drift = 1.0008; // 0.08% fast: ~0.5 s per 10 minutes if uncorrected
    const clock = new SongClock(src);
    clock.start(0, 0);
    for (let f = 0; f < 60 * 600; f++) {
      src.perf = 16.67 * f;
      clock.update(src.perf);
    }
    expect(Math.abs(clock.update(src.perf) - src.trueSong(0, 0))).toBeLessThan(12);
  });

  it('survives frame drops: position depends on time, not frame count', () => {
    const src = new FakeSource();
    const clock = new SongClock(src);
    clock.start(0, 1000);
    for (let f = 0; f < 120; f++) {
      src.perf = 16.67 * f;
      clock.update(src.perf);
    }
    src.perf += 500; // a half-second stall
    const t = clock.update(src.perf);
    expect(Math.abs(t - src.trueSong(0, 1000))).toBeLessThan(HARD_RESYNC_MS);
  });

  it('re-anchors after a seek and freezes while paused', () => {
    const src = new FakeSource();
    src.jitterMs = 0;
    const clock = new SongClock(src);
    clock.start(0, 0);
    src.perf = 1000;
    clock.update(src.perf);
    clock.freeze(5000);
    src.perf = 9000;
    expect(clock.update(src.perf)).toBe(5000);
    expect(clock.at(src.perf + 500)).toBe(5000);
    clock.start(9, 30000); // new source node: song 30 s plays at ctx 9 s
    src.perf = 9500;
    const t = clock.update(src.perf);
    expect(Math.abs(t - src.trueSong(9, 30000))).toBeLessThan(15);
  });

  it('maps event timestamps between frames consistently with the frame model', () => {
    const src = new FakeSource();
    src.jitterMs = 0;
    const clock = new SongClock(src);
    clock.start(0, 0);
    for (let f = 0; f < 200; f++) {
      src.perf = 16.67 * f;
      clock.update(src.perf);
    }
    const a = clock.at(src.perf - 5);
    const b = clock.at(src.perf);
    expect(b - a).toBeCloseTo(5, 5);
  });
});

describe('latency offsets', () => {
  const o = { audio: 40, input: 15, visual: -10 };
  it('applies each offset exactly once in each path', () => {
    expect(heardTime(1000, o)).toBe(960);
    expect(judgeTime(1000, o)).toBe(945);
    expect(renderTime(1000, o)).toBe(950);
    // Judging depends on audio + input only, rendering on audio + visual only.
    expect(judgeTime(1000, { ...o, visual: 999 })).toBe(945);
    expect(renderTime(1000, { ...o, input: 999 })).toBe(950);
  });
  it('a player who taps exactly on the heard beat is judged perfect after calibration', () => {
    // Device: 60 ms unreported output latency, 20 ms input latency.
    const raw = (heardBeat: number) => heardBeat + 60; // clock reads 60 ms ahead of what is heard
    const tapRaw = (heardBeat: number) => raw(heardBeat) + 20; // tap arrives 20 ms after
    const cal = calibrate([80, 82, 78, 81, 79, 80, 300], [20, 21, 19, 20, 22], { audio: 0, input: 0, visual: 0 });
    expect(cal.offsets.audio).toBe(60);
    expect(cal.offsets.input).toBe(20);
    expect(judgeTime(tapRaw(5000), cal.offsets)).toBe(5000);
  });
  it('audio-only calibration keeps the input offset', () => {
    const cal = calibrate([50, 52, 48, 50], null, { audio: 0, input: 10, visual: 5 });
    expect(cal.offsets).toEqual({ audio: 40, input: 10, visual: 5 });
  });
});
