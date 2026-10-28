import type { AudioEngine } from '../audio/audioEngine';
import { SongPlayer } from '../audio/songPlayer';
import { GameEngine, type EngineResult } from '../engine/gameEngine';
import { TIMING_PROFILES } from '../engine/timing';
import { InputController } from '../input/inputController';
import { Renderer, approachForSpeed, type FrameState, type Insets } from '../render/renderer';
import type { Chart, Settings, SwipeDir } from '../types';
import { lowerBound } from '../util';
import { heardTime, judgeTime, renderTime, type Offsets } from './offsets';
import { notesInRange, skipTarget } from './part';

export interface SessionVisuals {
  energy: Float32Array;
  fps: number;
  beats: number[];
}

export interface SessionResult {
  engine: EngineResult;
  completed: boolean;
}

export interface SessionOptions {
  canvas: HTMLCanvasElement;
  inputEl: HTMLElement;
  audio: AudioEngine;
  buffer: AudioBuffer;
  chart: Chart;
  title: string;
  subtitle: string;
  settings: Settings;
  /** Song-specific offset (ms) on top of the chart's own offset. */
  songOffsetMs?: number;
  visuals?: SessionVisuals;
  autoplay?: boolean;
  /** Play only part of the song (song time, ms): notes outside it are left out. */
  startAtMs?: number;
  endAtMs?: number;
  insets: Insets;
  onFinish(result: SessionResult): void;
  onPauseChange(paused: boolean, reason: 'user' | 'hidden' | 'interrupted' | null): void;
  /** A long stretch without notes lies ahead (or null when that's over): offer skip(). */
  onSkipChange?(kind: SkipKind | null): void;
}

/** What skip() would skip: the run-up to the first note, a gap between notes, or the outro. */
export type SkipKind = 'intro' | 'gap' | 'outro';

type Phase = 'idle' | 'playing' | 'paused' | 'finished';

const RESUME_REWIND_MS = 1500;
const STALL_FORGIVE_MS = 280;
/** How long after the song (or the last note) the run may continue so late hits still count. */
const END_GRACE_MS = 600;
/** Offer a skip when the next note is at least this far away… */
const SKIP_SHOW_MS = 7000;
/** …and stop offering it once it's this close. */
const SKIP_HIDE_MS = 4500;

/**
 * One play-through. Owns the frame loop and wires clock -> engine -> renderer, with input
 * events judged against the same clock. Latency offsets are applied only via ./offsets.
 */
export class GameSession {
  readonly engine: GameEngine;
  readonly renderer: Renderer;
  private player: SongPlayer;
  private input: InputController;
  private phase: Phase = 'idle';
  private raf = 0;
  private startPos = 0;
  private lastFramePerf = 0;
  private lastJudgeT = -Infinity;
  private pressed: boolean[];
  private held: boolean[];
  private beatIdx = 0;
  private skipKind: SkipKind | null = null;
  private nextIdx = 0;
  private endFaded = false;
  private readonly startMs: number;
  private readonly endMs: number;
  private readonly approachMs: number;
  private wakeLock: { release(): Promise<void> } | null = null;
  private cleanup: (() => void)[] = [];
  private bannerUntil = 0;
  private bannerText = '';
  private readonly offsets: Offsets;

  constructor(private readonly o: SessionOptions) {
    const s = o.settings;
    const laneCount = o.chart.laneCount;
    this.offsets = { audio: s.audioOffsetMs, input: s.inputOffsetMs, visual: s.visualOffsetMs };
    const offsetMs = (o.chart.offsetMs || 0) + (o.songOffsetMs || 0);
    this.engine = new GameEngine(notesInRange(o.chart.notes, offsetMs, o.startAtMs, o.endAtMs), {
      profile: TIMING_PROFILES[s.timingProfile],
      laneCount,
      swipeAssist: s.swipeAssist,
      offsetMs,
      autoplay: o.autoplay,
    });
    this.renderer = new Renderer(o.canvas, {
      laneCount,
      theme: s.theme,
      noteStyle: s.noteStyle,
      perspective: s.perspective,
      reducedEffects: s.reducedEffects,
      musicReactive: s.musicReactive,
      highwayWidth: s.highwayWidth,
      approachMs: approachForSpeed(s.noteSpeed),
      showTimingIndicator: s.showTimingIndicator,
      showFps: s.showFps,
    });
    this.renderer.setInsets(o.insets);
    this.renderer.resize();
    this.player = new SongPlayer(o.audio, o.buffer);
    this.startMs = Math.max(0, o.startAtMs ?? 0);
    this.endMs = Math.min(this.player.durationMs, o.endAtMs ?? Infinity);
    // The buffer ends a little before its end is heard; the loop decides when the run is over.
    this.pressed = new Array(laneCount).fill(false);
    this.held = new Array(laneCount).fill(false);
    this.input = new InputController(o.inputEl, (x) => this.renderer.laneAt(x), laneCount, {
      press: (lane, perf, pointer) => this.onPress(lane, perf, pointer),
      release: (pointer, perf) => this.engine.release(pointer, this.judgeTime(perf)),
      swipe: (pointer, dir, perf) => this.onSwipe(pointer, dir, perf),
    });
    // Lead-in: the first note must be able to travel the whole highway, plus a breath.
    const approach = approachForSpeed(s.noteSpeed);
    this.approachMs = approach;
    const firstNote = this.engine.notes.find((n) => n.t >= (o.startAtMs ?? -Infinity))?.t ?? Infinity;
    const from = o.startAtMs !== undefined ? Math.max(0, o.startAtMs - 2500) : 0;
    this.startPos = Math.min(from, firstNote - approach - 1200);
  }

  get isPaused(): boolean {
    return this.phase === 'paused';
  }

  /** Must be called from a user gesture (it unlocks audio on iOS). */
  start(): void {
    void this.o.audio.unlock();
    this.input.attach();
    this.listen();
    void this.requestWakeLock();
    this.player.play(this.startPos, 0, this.startPos > 0 ? 400 : 0);
    this.phase = 'playing';
    this.lastFramePerf = performance.now();
    this.loop();
  }

  pause(reason: 'user' | 'hidden' | 'interrupted' = 'user'): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.player.pause();
    this.engine.suspendHolds();
    this.input.clearAll();
    this.input.enabled = false;
    cancelAnimationFrame(this.raf);
    this.drawFrame(performance.now());
    void this.releaseWakeLock();
    this.o.onPauseChange(true, reason);
  }

  /** Resume from a user gesture. Rewinds a little so the player can find the beat again. */
  resume(): void {
    if (this.phase !== 'paused') return;
    void this.o.audio.unlock();
    const paused = this.player.position();
    const from = Math.max(this.startPos, paused - RESUME_REWIND_MS);
    this.player.play(from, 0);
    this.phase = 'playing';
    this.input.enabled = true;
    this.lastFramePerf = performance.now();
    this.lastJudgeT = -Infinity;
    this.bannerText = 'GO!';
    this.bannerUntil = performance.now() + 700;
    void this.requestWakeLock();
    this.o.onPauseChange(false, null);
    this.loop();
  }

  /** Skip what onSkipChange offered: jump ahead to just before the next note, or end the outro. */
  skip(): void {
    if (this.phase !== 'playing' || !this.skipKind) return;
    if (this.skipKind === 'outro') {
      this.player.fadeOut(400);
      this.finish(true);
      return;
    }
    const perf = performance.now();
    const judgeT = this.judgeTime(perf);
    const next = this.engine.notes[this.nextIdx];
    const target = next ? skipTarget(judgeT, next.t, this.approachMs, 0) : null;
    if (target === null) return;
    // Same jump on the raw song timeline (offsets are constant).
    this.player.play(this.player.position(perf) + (target - judgeT), 0, 250);
    this.lastJudgeT = -Infinity;
    this.setSkip(null);
  }

  /** Back-compat name for skipping the outro. */
  skipOutro(): void {
    if (this.skipKind === 'outro') this.skip();
  }

  /** Stop everything and detach (leaving the game screen). */
  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.player.stop();
    this.input.detach();
    for (const fn of this.cleanup) fn();
    this.cleanup = [];
    void this.releaseWakeLock();
    this.phase = 'finished';
  }

  resize(insets?: Insets): void {
    if (insets) this.renderer.setInsets(insets);
    this.renderer.resize();
    if (this.phase === 'paused') this.drawFrame(performance.now());
  }

  // --- internals -------------------------------------------------------------

  /** Gameplay (judgment) time at a performance timestamp — used by tests and tooling. */
  judgeTimeAt(perf: number): number {
    return this.judgeTime(perf);
  }

  private heardTime(perf: number): number {
    return heardTime(this.player.position(perf), this.offsets);
  }

  private judgeTime(perf: number): number {
    return judgeTime(this.player.position(perf), this.offsets);
  }

  private onPress(lane: number, perf: number, pointer: string): void {
    if (this.phase !== 'playing' || this.engine.autoplay) return;
    this.renderer.press(lane);
    const n = this.engine.press(lane, this.judgeTime(perf), pointer);
    const hs = this.o.settings.hitSound;
    if (n && hs !== 'off' && n.type !== 'swipe') this.o.audio.play(hs === 'snap' ? 'snap' : 'tick');
    this.flushEvents(perf);
  }

  private onSwipe(pointer: string, dir: SwipeDir, startPerf: number): void {
    if (this.phase !== 'playing' || this.engine.autoplay) return;
    if (this.engine.swipe(pointer, dir, this.judgeTime(startPerf)) && this.o.settings.hitSound !== 'off') {
      this.o.audio.play('swipe');
    }
    this.flushEvents(performance.now());
  }

  private loop = (frameTime?: number): void => {
    if (this.phase !== 'playing') return;
    const now = performance.now();
    // Draw for the frame's own (vsync-aligned) timestamp rather than whenever this callback
    // happened to run, so notes advance by the same distance every frame.
    const perf = frameTime !== undefined && frameTime <= now + 1 && now - frameTime < 50 ? frameTime : now;
    this.player.tick(perf);
    const judgeT = this.judgeTime(now);
    // A long gap between frames (stall, backgrounding) is not the player's fault.
    const forgive = perf - this.lastFramePerf > STALL_FORGIVE_MS && judgeT - this.lastJudgeT > STALL_FORGIVE_MS;
    this.engine.update(judgeT, forgive);
    this.lastFramePerf = perf;
    this.lastJudgeT = judgeT;
    this.flushEvents(perf);
    this.drawFrame(perf);
    this.updateSkip(judgeT);
    // A part ends with a short fade instead of a hard cut.
    const heard = this.heardTime(perf);
    if (!this.endFaded && this.endMs < this.player.durationMs && heard >= this.endMs - 250) {
      this.endFaded = true;
      this.player.fadeOut(600);
    }
    // Over once every note is resolved and the music has been heard to the end, or once even
    // the latest possible hit on the last note is out of reach.
    const allResolved = this.engine.isFinished(judgeT) && heard >= this.endMs;
    if (allResolved || judgeT > Math.max(this.endMs, this.engine.lastTime) + END_GRACE_MS) {
      this.finish(true);
      return;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  /** Tracks whether a long note-free stretch lies ahead (with hysteresis, so it doesn't flicker). */
  private updateSkip(judgeT: number): void {
    const notes = this.engine.notes;
    if (this.nextIdx > 0 && notes[this.nextIdx - 1].t > judgeT) this.nextIdx = 0; // rewound
    while (this.nextIdx < notes.length && notes[this.nextIdx].t <= judgeT) this.nextIdx++;
    const next = notes[this.nextIdx];
    let kind: SkipKind | null = null;
    if (!next) {
      if (this.engine.isFinished(judgeT) && this.endMs - judgeT > SKIP_HIDE_MS) kind = 'outro';
    } else {
      const gap = next.t - judgeT;
      const keep = this.skipKind !== null && this.skipKind !== 'outro' && gap > SKIP_HIDE_MS;
      if ((gap > SKIP_SHOW_MS || keep) && skipTarget(judgeT, next.t, this.approachMs) !== null) {
        kind = this.nextIdx === 0 && this.startMs === 0 ? 'intro' : 'gap';
      }
    }
    if (kind !== this.skipKind) this.setSkip(kind);
  }

  private setSkip(kind: SkipKind | null): void {
    this.skipKind = kind;
    this.o.onSkipChange?.(kind);
  }

  private flushEvents(perf: number): void {
    for (const ev of this.engine.drainEvents()) {
      switch (ev.kind) {
        case 'judge':
          this.renderer.judgment(ev.lane, ev.judgment, ev.errorMs, perf, ev.part);
          break;
        case 'milestone':
          this.renderer.milestone(ev.combo, perf);
          if (this.o.settings.hitSound !== 'off') this.o.audio.play('milestone', { gain: 0.8 });
          break;
        default:
          break;
      }
    }
  }

  private drawFrame(perf: number): void {
    const heard = this.heardTime(perf);
    const t = renderTime(this.player.position(perf), this.offsets);
    const v = this.o.visuals;
    let energy = 0;
    let pulse = 0;
    if (v) {
      const i = Math.round((heard / 1000) * v.fps);
      energy = i >= 0 && i < v.energy.length ? v.energy[i] : 0;
      if (v.beats.length) {
        if (this.beatIdx > 0 && v.beats[this.beatIdx - 1] > heard) this.beatIdx = lowerBound(v.beats, heard);
        while (this.beatIdx < v.beats.length && v.beats[this.beatIdx] <= heard) this.beatIdx++;
        const last = v.beats[this.beatIdx - 1];
        if (last !== undefined) pulse = Math.exp(-(heard - last) / 140);
      }
    }
    this.input.pressedLanes(this.pressed);
    for (let l = 0; l < this.held.length; l++) this.held[l] = this.engine.isLaneHeld(l);
    let banner: string | undefined;
    if (perf < this.bannerUntil) banner = this.bannerText;
    else if (heard < 0 && this.phase === 'playing') banner = heard < -900 ? 'READY' : 'GO!';
    const st: FrameState = {
      t,
      notes: this.engine.notes,
      pressed: this.pressed,
      held: this.held,
      score: this.engine.score,
      combo: this.engine.combo,
      multiplier: this.engine.multiplier,
      accuracy: this.engine.accuracy,
      progress: this.endMs > this.startMs ? Math.max(0, heard - this.startMs) / (this.endMs - this.startMs) : 0,
      title: this.o.title,
      subtitle: this.o.subtitle,
      energy,
      beatPulse: pulse,
      banner,
      autoplay: this.engine.autoplay,
    };
    this.renderer.draw(st, perf);
  }

  private finish(completed: boolean): void {
    if (this.phase === 'finished') return;
    this.phase = 'finished';
    cancelAnimationFrame(this.raf);
    // Resolve everything still open at the true end of the song.
    this.engine.update(Math.max(this.engine.lastTime + 1000, this.judgeTime(performance.now())));
    this.input.detach();
    void this.releaseWakeLock();
    this.o.onFinish({ engine: this.engine.getResult(), completed });
  }

  private listen(): void {
    const onVis = () => {
      if (document.hidden) this.pause('hidden');
    };
    const onPageHide = () => this.pause('hidden');
    const onBlur = () => {
      // Desktop: losing focus is not an interruption, but iOS sends blur on calls/Siri.
      if (/iPhone|iPad|iPod/.test(navigator.userAgent)) this.pause('interrupted');
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('blur', onBlur);
    const offState = this.o.audio.onStateChange((state) => {
      if (state !== 'running') this.pause('interrupted');
    });
    const media = navigator.mediaDevices;
    const onDevice = () => this.pause('interrupted');
    media?.addEventListener?.('devicechange', onDevice);
    this.cleanup.push(() => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('blur', onBlur);
      offState();
      media?.removeEventListener?.('devicechange', onDevice);
    });
  }

  private async requestWakeLock(): Promise<void> {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
      if (!nav.wakeLock || this.wakeLock) return;
      const lock = await nav.wakeLock.request('screen');
      // Paused, finished or torn down while the request was pending: don't keep the screen on.
      if (this.phase !== 'playing' || this.wakeLock) void lock.release().catch(() => undefined);
      else this.wakeLock = lock;
    } catch {
      /* not available or denied: harmless */
    }
  }

  private async releaseWakeLock(): Promise<void> {
    const w = this.wakeLock;
    this.wakeLock = null;
    try {
      await w?.release();
    } catch {
      /* ignore */
    }
  }
}
