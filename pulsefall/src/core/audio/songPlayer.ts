import type { AudioEngine } from './audioEngine';
import type { SongClock } from './clock';

/** Scheduling margin so the first samples are never late on a busy main thread. */
const START_MARGIN_S = 0.08;

/**
 * Plays a decoded song on the shared AudioContext. AudioBufferSourceNodes are one-shot,
 * so every play/seek/resume creates a fresh node; the clock is re-anchored to the exact
 * context time the new node starts at.
 */
export class SongPlayer {
  readonly clock: SongClock;
  readonly durationMs: number;
  onEnded: (() => void) | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private playing = false;

  constructor(
    private readonly engine: AudioEngine,
    private readonly buffer: AudioBuffer,
  ) {
    this.clock = engine.createClock();
    this.durationMs = buffer.duration * 1000;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  /**
   * Start so that song position `fromMs` is heard `leadInMs` from now. Negative positions
   * are allowed (the lead-in before the music starts), the audio then starts at 0.
   */
  play(fromMs: number, leadInMs = 0, fadeInMs = 0): void {
    this.stopSource();
    const ctx = this.engine.ctx!;
    const when = ctx.currentTime + START_MARGIN_S + leadInMs / 1000;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    const gain = ctx.createGain();
    src.connect(gain);
    gain.connect(this.engine.musicBus);
    const audioStart = fromMs >= 0 ? when : when - fromMs / 1000;
    const offset = Math.max(0, fromMs) / 1000;
    if (fadeInMs > 0) {
      gain.gain.setValueAtTime(0, audioStart);
      gain.gain.linearRampToValueAtTime(1, audioStart + fadeInMs / 1000);
    }
    if (offset < this.buffer.duration) src.start(audioStart, offset);
    src.onended = () => {
      if (this.source === src && this.playing) {
        this.playing = false;
        this.onEnded?.();
      }
    };
    this.source = src;
    this.gain = gain;
    this.playing = true;
    this.clock.start(when, fromMs);
  }

  /** Current smoothed song position (ms) at a performance timestamp. */
  position(perf = performance.now()): number {
    return this.clock.at(perf);
  }

  /** Per-frame update of the clock model; returns the song position now. */
  tick(perf = performance.now()): number {
    return this.clock.update(perf);
  }

  pause(): number {
    const pos = this.clock.update(performance.now());
    this.playing = false;
    this.stopSource();
    this.clock.freeze(pos);
    return pos;
  }

  fadeOut(ms: number): void {
    const ctx = this.engine.ctx;
    if (!ctx || !this.gain) return;
    const now = ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);
    this.gain.gain.linearRampToValueAtTime(0, now + ms / 1000);
    const src = this.source;
    if (src) {
      try {
        src.stop(now + ms / 1000 + 0.02);
      } catch {
        /* already stopped */
      }
    }
  }

  stop(): void {
    this.playing = false;
    this.stopSource();
    this.clock.freeze(0);
  }

  private stopSource(): void {
    const src = this.source;
    this.source = null;
    if (src) {
      src.onended = null;
      try {
        src.stop();
      } catch {
        /* not started yet */
      }
      src.disconnect();
    }
    this.gain?.disconnect();
    this.gain = null;
  }
}
