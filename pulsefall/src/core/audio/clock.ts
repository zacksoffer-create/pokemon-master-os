/**
 * Maps performance.now() to song time.
 *
 * The audio hardware is the authority: each frame we ask the source which context time is
 * currently *audible* (getOutputTimestamp when available, otherwise currentTime minus the
 * reported latency) and convert it to song time through the playback anchor. Raw readings
 * jitter by a few ms and update in coarse steps, so we keep a linear model
 * `song = base + (perf - basePerf)` and nudge it toward the median of the recent errors,
 * a fraction of a millisecond per frame, so the steps of the hardware clock never show up as
 * judder; larger errors are corrected faster and very large ones by a hard resync. Visuals and input judgments both read the same model, so they can never
 * disagree, and a dropped frame never causes drift (time comes from the model, not frames).
 */

export interface AudibleTimeSample {
  /** Context time (seconds) of the sample being heard at `perf`. */
  ctxTime: number;
  /** performance.now() timestamp (ms) of that reading. */
  perf: number;
}

export interface AudibleTimeSource {
  sample(): AudibleTimeSample;
}

export const HARD_RESYNC_MS = 45;
/** Errors up to this size are reading noise: corrected gently, at most FINE_STEP_MS a frame. */
const FINE_BAND_MS = 8;
const FINE_GAIN = 0.04;
const FINE_STEP_MS = 0.6;
/** Real shifts (an audio hiccup) between that and a hard resync are caught up quickly. */
const FAST_GAIN = 0.2;
const FAST_STEP_MS = 3;
/** Recent errors the correction looks at (median), about 150 ms at 60 fps. */
const ERR_WINDOW = 9;

export class SongClock {
  private anchorCtx = 0;
  private anchorSong = 0;
  private rate = 1;
  private base = 0;
  private basePerf = 0;
  private synced = false;
  private running = false;
  private frozenAt = 0;
  private errs = new Float64Array(ERR_WINDOW);
  private sorted = new Float64Array(ERR_WINDOW);
  private nErr = 0;

  constructor(private readonly source: AudibleTimeSource) {}

  /** Song position `songMs` will be audible at context time `ctxTime`. */
  start(ctxTime: number, songMs: number, rate = 1): void {
    this.anchorCtx = ctxTime;
    this.anchorSong = songMs;
    this.rate = rate;
    this.synced = false;
    this.running = true;
  }

  /** Stop advancing; `now()` keeps returning this position. */
  freeze(songMs: number): void {
    this.running = false;
    this.frozenAt = songMs;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Raw (unsmoothed) audible song time from a fresh hardware reading. */
  measure(): { perf: number; song: number } {
    const s = this.source.sample();
    return { perf: s.perf, song: this.anchorSong + (s.ctxTime - this.anchorCtx) * 1000 * this.rate };
  }

  /** Call once per frame. Returns the smoothed song time at `perfNow`. */
  update(perfNow: number): number {
    if (!this.running) return this.frozenAt;
    const m = this.measure();
    const predicted = this.base + (m.perf - this.basePerf) * this.rate;
    const err = m.song - predicted;
    if (!this.synced || Math.abs(err) > HARD_RESYNC_MS) {
      this.base = m.song;
      this.basePerf = m.perf;
      this.synced = true;
      this.nErr = 0;
    } else {
      const e = this.medianError(err);
      this.base +=
        Math.abs(e) > FINE_BAND_MS ? clampAbs(e * FAST_GAIN, FAST_STEP_MS) : clampAbs(e * FINE_GAIN, FINE_STEP_MS);
    }
    return this.at(perfNow);
  }

  /** Adds `err` to the recent errors and returns their median (no allocation). */
  private medianError(err: number): number {
    this.errs[this.nErr % ERR_WINDOW] = err;
    this.nErr++;
    const n = Math.min(this.nErr, ERR_WINDOW);
    const s = this.sorted;
    for (let i = 0; i < n; i++) {
      const v = this.errs[i];
      let j = i - 1;
      while (j >= 0 && s[j] > v) {
        s[j + 1] = s[j];
        j--;
      }
      s[j + 1] = v;
    }
    return s[n >> 1];
  }

  /** Song time at an arbitrary performance timestamp (e.g. a touch event's timeStamp). */
  at(perf: number): number {
    if (!this.running) return this.frozenAt;
    if (!this.synced) return this.measure().song + (perf - this.source.sample().perf) * this.rate;
    return this.base + (perf - this.basePerf) * this.rate;
  }
}

function clampAbs(v: number, max: number): number {
  return v > max ? max : v < -max ? -max : v;
}

/** Audible-time source backed by a Web Audio context. */
export class WebAudioTimeSource implements AudibleTimeSource {
  private useTimestamp: boolean;

  constructor(private readonly ctx: AudioContext) {
    this.useTimestamp = typeof ctx.getOutputTimestamp === 'function';
  }

  sample(): AudibleTimeSample {
    const now = performance.now();
    if (this.useTimestamp) {
      const ts = this.ctx.getOutputTimestamp();
      const ctxTime = ts.contextTime ?? 0;
      const perf = ts.performanceTime ?? 0;
      // Some engines report zeros before output starts or stale values; fall back then.
      if (ctxTime > 0 && perf > 0 && Math.abs(now - perf) < 500) return { ctxTime, perf };
    }
    const latency = (this.ctx.baseLatency || 0) + (this.ctx.outputLatency || 0);
    return { ctxTime: this.ctx.currentTime - latency, perf: now };
  }
}

/**
 * Event timestamps are performance.now()-based in modern browsers, but very old WebKit used
 * epoch milliseconds. Normalize so input timing never silently breaks.
 */
export function eventPerfTime(ev: { timeStamp: number }): number {
  const now = performance.now();
  const ts = ev.timeStamp;
  if (!(ts > 0) || ts > now + 50 || now - ts > 1000) return now;
  return ts;
}
