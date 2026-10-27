import type { AudioEngine } from '../audio/audioEngine';
import { SongPlayer } from '../audio/songPlayer';
import { GameEngine, type EngineResult } from '../engine/gameEngine';
import { TIMING_PROFILES } from '../engine/timing';
import { InputController } from '../input/inputController';
import { Renderer, approachForSpeed, type FrameState, type Insets } from '../render/renderer';
import type { Chart, Settings, SwipeDir } from '../types';
import { lowerBound } from '../util';
import { heardTime, judgeTime, renderTime, type Offsets } from './offsets';

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
  /** Practice: start here, earlier notes don't count. */
  startAtMs?: number;
  insets: Insets;
  onFinish(result: SessionResult): void;
  onPauseChange(paused: boolean, reason: 'user' | 'hidden' | 'interrupted' | null): void;
  /** Called once the chart is done and only outro music remains (allows skipping). */
  onOutro?(): void;
}

type Phase = 'idle' | 'playing' | 'paused' | 'finished';

const RESUME_REWIND_MS = 1500;
const STALL_FORGIVE_MS = 280;

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
  private outroAnnounced = false;
  private wakeLock: { release(): Promise<void> } | null = null;
  private cleanup: (() => void)[] = [];
  private bannerUntil = 0;
  private bannerText = '';
  private readonly offsets: Offsets;

  constructor(private readonly o: SessionOptions) {
    const s = o.settings;
    const laneCount = o.chart.laneCount;
    this.offsets = { audio: s.audioOffsetMs, input: s.inputOffsetMs, visual: s.visualOffsetMs };
    this.engine = new GameEngine(o.chart.notes, {
      profile: TIMING_PROFILES[s.timingProfile],
      laneCount,
      swipeAssist: s.swipeAssist,
      offsetMs: (o.chart.offsetMs || 0) + (o.songOffsetMs || 0),
      autoplay: o.autoplay,
    });
    if (o.startAtMs) this.engine.startAt(o.startAtMs);
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
    this.player.onEnded = () => this.finish(true);
    this.pressed = new Array(laneCount).fill(false);
    this.held = new Array(laneCount).fill(false);
    this.input = new InputController(o.inputEl, (x) => this.renderer.laneAt(x), laneCount, {
      press: (lane, perf, pointer) => this.onPress(lane, perf, pointer),
      release: (pointer, perf) => this.engine.release(pointer, this.judgeTime(perf)),
      swipe: (pointer, dir, perf) => this.onSwipe(pointer, dir, perf),
    });
    // Lead-in: the first note must be able to travel the whole highway, plus a breath.
    const approach = approachForSpeed(s.noteSpeed);
    const firstNote = this.engine.notes.find((n) => n.t >= (o.startAtMs ?? -Infinity))?.t ?? 0;
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

  skipOutro(): void {
    if (this.phase === 'playing' || this.phase === 'paused') {
      this.player.fadeOut(400);
      this.finish(true);
    }
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

  private loop = (): void => {
    if (this.phase !== 'playing') return;
    const perf = performance.now();
    this.player.tick(perf);
    const judgeT = this.judgeTime(perf);
    // A long gap between frames (stall, backgrounding) is not the player's fault.
    const forgive = perf - this.lastFramePerf > STALL_FORGIVE_MS && judgeT - this.lastJudgeT > STALL_FORGIVE_MS;
    this.engine.update(judgeT, forgive);
    this.lastFramePerf = perf;
    this.lastJudgeT = judgeT;
    this.flushEvents(perf);
    this.drawFrame(perf);
    if (!this.outroAnnounced && this.engine.isFinished(judgeT)) {
      this.outroAnnounced = true;
      const remaining = this.player.durationMs - judgeT;
      if (remaining > 4000) this.o.onOutro?.();
      else if (remaining <= 0) this.finish(true);
    }
    if (this.heardTime(perf) > this.player.durationMs + 400) {
      this.finish(true);
      return;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

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
      progress: this.player.durationMs > 0 ? Math.max(0, heard) / this.player.durationMs : 0,
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
      if (nav.wakeLock && !this.wakeLock) this.wakeLock = await nav.wakeLock.request('screen');
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
