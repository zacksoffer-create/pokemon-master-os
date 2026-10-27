/**
 * Maps performance.now() to song time.
 *
 * The audio hardware is the authority: each frame we ask the source which context time is
 * currently *audible* (getOutputTimestamp when available, otherwise currentTime minus the
 * reported latency) and convert it to song time through the playback anchor. Raw readings
 * jitter by a few ms and update in coarse steps, so we keep a linear model
 * `song = base + (perf - basePerf)` and slew it toward the measurements, hard-resyncing on
 * large errors. Visuals and input judgments both read the same model, so they can never
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
const SLEW = 0.12;

export class SongClock {
  private anchorCtx = 0;
  private anchorSong = 0;
  private rate = 1;
  private base = 0;
  private basePerf = 0;
  private synced = false;
  private running = false;
  private frozenAt = 0;

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
    } else {
      this.base += err * SLEW;
    }
    return this.at(perfNow);
  }

  /** Song time at an arbitrary performance timestamp (e.g. a touch event's timeStamp). */
  at(perf: number): number {
    if (!this.running) return this.frozenAt;
    if (!this.synced) return this.measure().song + (perf - this.source.sample().perf) * this.rate;
    return this.base + (perf - this.basePerf) * this.rate;
  }
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
