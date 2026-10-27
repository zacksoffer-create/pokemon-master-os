import { NoteState, type EngineNote } from '../engine/gameEngine';
import type { Judgment } from '../engine/timing';
import type { NoteStyleId, ThemeId } from '../types';
import { clamp, formatScore } from '../util';
import { buildSprites, type Sprite, type SpriteSet } from './sprites';
import { DISPLAY_FONT, THEMES, laneColors, rgba, shade, type Theme } from './themes';

export interface RenderOptions {
  laneCount: number;
  theme: ThemeId;
  noteStyle: NoteStyleId;
  perspective: boolean;
  reducedEffects: boolean;
  musicReactive: boolean;
  highwayWidth: number;
  approachMs: number;
  showTimingIndicator: boolean;
  showFps: boolean;
}

export interface FrameState {
  /** Song time used for drawing (ms, visual offset applied). */
  t: number;
  notes: EngineNote[];
  pressed: boolean[];
  held: boolean[];
  score: number;
  combo: number;
  multiplier: number;
  accuracy: number;
  progress: number;
  title: string;
  subtitle: string;
  /** 0..1 loudness at the current position, for subtle reactive lighting. */
  energy: number;
  /** 0..1 decaying pulse on each beat. */
  beatPulse: number;
  /** Countdown/overlay text drawn in the middle (e.g. "3", "Ready"). */
  banner?: string;
  autoplay?: boolean;
}

interface Popup {
  text: string;
  color: string;
  born: number;
  sub?: string;
}

interface Burst {
  lane: number;
  born: number;
  gold: boolean;
  big: boolean;
}

/** Safe-area insets in CSS px, read from CSS env() by the host. */
export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const MAX_PARTICLES = 220;
const JUDGE_COLORS: Record<Judgment, string> = {
  perfect: '#fff4c2',
  great: '#7cf3ff',
  good: '#c9a8ff',
  miss: '#ff6b8a',
};
const JUDGE_TEXT: Record<Judgment, string> = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'MISS' };

export function approachForSpeed(speed: number): number {
  return Math.round(2900 * Math.pow(0.86, clamp(speed, 1, 10) - 1));
}

/**
 * Draws the note highway. Positions are a pure function of song time, so a late frame
 * simply draws notes where they should be now — the picture can stutter but never drift.
 */
export class Renderer {
  private g: CanvasRenderingContext2D;
  private dpr = 1;
  private maxDpr = 2;
  private W = 0;
  private H = 0;
  private theme: Theme;
  private colors: string[];
  private sprites!: SpriteSet;
  private bg: Sprite | null = null;
  private insets: Insets = { top: 0, bottom: 0, left: 0, right: 0 };

  // Geometry.
  private cx = 0;
  private hw = 0;
  private laneW = 0;
  private hitY = 0;
  private topY = 0;
  private k = 1.8;
  private topScale = 0.38;
  private noteSize = 40;
  private laneGradients: CanvasGradient[] = [];

  // Effects.
  private popups: Popup[] = [];
  private bursts: Burst[] = [];
  private pressFade: number[] = [];
  private comboBump = 0;
  private lastCombo = 0;
  private banner: { text: string; born: number } | null = null;
  private px = new Float32Array(MAX_PARTICLES);
  private py = new Float32Array(MAX_PARTICLES);
  private pvx = new Float32Array(MAX_PARTICLES);
  private pvy = new Float32Array(MAX_PARTICLES);
  private plife = new Float32Array(MAX_PARTICLES);
  private pmax = new Float32Array(MAX_PARTICLES);
  private psize = new Float32Array(MAX_PARTICLES);
  private psprite = new Int8Array(MAX_PARTICLES);
  private pnext = 0;
  private lastPerf = 0;
  private frameEma = 16.7;
  private slowFrames = 0;
  private fpsText = '';
  private fpsFrames = 0;
  private fpsSince = 0;
  private scoreShown = 0;
  private cursor = 0;
  private maxHoldMs = 0;
  private lastT = -Infinity;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private opts: RenderOptions,
  ) {
    const g = canvas.getContext('2d', { alpha: false, desynchronized: true } as CanvasRenderingContext2DSettings);
    if (!g) throw new Error('Canvas 2D is not available');
    this.g = g;
    this.theme = THEMES[opts.theme];
    this.colors = laneColors(this.theme, opts.laneCount);
    this.pressFade = new Array(opts.laneCount).fill(0);
  }

  setOptions(opts: Partial<RenderOptions>): void {
    this.opts = { ...this.opts, ...opts };
    this.theme = THEMES[this.opts.theme];
    this.colors = laneColors(this.theme, this.opts.laneCount);
    this.layout();
  }

  setInsets(insets: Insets): void {
    this.insets = insets;
    this.layout();
  }

  /** Recompute size, geometry and sprite caches. Call on resize/orientation change. */
  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.W = Math.max(1, rect.width);
    this.H = Math.max(1, rect.height);
    this.dpr = Math.min(this.maxDpr, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.layout();
  }

  private layout(): void {
    const { W, H } = this;
    if (!W || !H) return;
    const L = this.opts.laneCount;
    this.cx = W / 2;
    this.hw = Math.min(W * clamp(this.opts.highwayWidth, 0.7, 1) * 0.98, H * 0.62);
    this.laneW = this.hw / L;
    this.hitY = H - this.insets.bottom - Math.max(86, H * 0.15);
    this.topY = this.insets.top + 64 + H * 0.03;
    this.k = this.opts.perspective ? 1.8 : 0;
    this.topScale = this.opts.perspective ? 0.38 : 1;
    this.noteSize = Math.min(this.laneW * 0.7, 92);
    this.sprites = buildSprites(this.theme, this.colors, this.noteSize * this.dpr, this.opts.noteStyle);
    this.bg = this.buildBackground();
    this.laneGradients = this.colors.map((c) => {
      const gr = this.g.createLinearGradient(0, this.hitY, 0, this.topY + (this.hitY - this.topY) * 0.25);
      gr.addColorStop(0, rgba(c, 0.55));
      gr.addColorStop(1, rgba(c, 0));
      return gr;
    });
  }

  private buildBackground(): Sprite {
    const w = Math.round(this.W * this.dpr);
    const h = Math.round(this.H * this.dpr);
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    g.scale(this.dpr, this.dpr);
    const { W, H, theme } = this;
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, theme.bgTop);
    grad.addColorStop(1, theme.bgBottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    // Horizon haze.
    const haze = g.createRadialGradient(this.cx, this.topY, 0, this.cx, this.topY, W * 0.9);
    haze.addColorStop(0, rgba(theme.lanes[1], 0.16));
    haze.addColorStop(1, rgba(theme.lanes[1], 0));
    g.fillStyle = haze;
    g.fillRect(0, 0, W, H);
    // Perspective floor grid outside the highway (subtle depth cue).
    g.strokeStyle = rgba(theme.lanes[0], 0.07);
    g.lineWidth = 1;
    for (let i = -6; i <= 6; i++) {
      const xb = this.cx + i * (W / 6);
      const xt = this.cx + i * (W / 6) * this.topScale;
      g.beginPath();
      g.moveTo(xb, H);
      g.lineTo(xt, this.topY);
      g.stroke();
    }
    for (let z = 0; z <= 1; z += 0.125) {
      const { y } = this.project(z);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    // Vignette.
    const vig = g.createRadialGradient(this.cx, H * 0.55, Math.min(W, H) * 0.3, this.cx, H * 0.55, Math.max(W, H) * 0.8);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);
    return c;
  }

  /** Perspective: depth z in [0 (hit line), 1 (horizon)] -> screen y and scale. */
  private project(z: number): { y: number; s: number } {
    const k = this.k;
    const gz = k > 0 ? (z * (1 + k)) / (1 + k * z) : z;
    return { y: this.hitY - (this.hitY - this.topY) * gz, s: 1 - (1 - this.topScale) * gz };
  }

  private laneX(lane: number, s: number): number {
    return this.cx + (lane - (this.opts.laneCount - 1) / 2) * this.laneW * s;
  }

  /** Lane for an x coordinate (CSS px). Input zones span the full width for big targets. */
  laneAt(x: number): number {
    const L = this.opts.laneCount;
    const left = this.cx - this.hw / 2;
    // Outside the highway, extend the outer lanes to the screen edges.
    if (x <= left) return 0;
    if (x >= left + this.hw) return L - 1;
    return clamp(Math.floor((x - left) / this.laneW), 0, L - 1);
  }

  get geometry(): { hitY: number; topY: number; width: number; height: number } {
    return { hitY: this.hitY, topY: this.topY, width: this.W, height: this.H };
  }

  // --- effects API -----------------------------------------------------------

  judgment(lane: number, j: Judgment, errorMs: number, perf: number, part: 'tap' | 'head' | 'tail' | 'swipe'): void {
    const sub = this.opts.showTimingIndicator && j !== 'miss' && j !== 'perfect' && part !== 'tail' ? (errorMs < 0 ? 'EARLY' : 'LATE') : undefined;
    this.popups = [{ text: JUDGE_TEXT[j], color: JUDGE_COLORS[j], born: perf, sub }];
    if (j === 'miss') return;
    this.bursts.push({ lane, born: perf, gold: j === 'perfect', big: part === 'swipe' });
    if (this.bursts.length > 12) this.bursts.shift();
    if (!this.opts.reducedEffects) this.spawnParticles(lane, j === 'perfect' ? 12 : j === 'great' ? 8 : 4, j === 'perfect');
  }

  press(lane: number): void {
    this.pressFade[lane] = 1;
  }

  milestone(combo: number, perf: number): void {
    this.banner = { text: `${combo} COMBO!`, born: perf };
  }

  showBanner(text: string, perf: number): void {
    this.banner = { text, born: perf };
  }

  reset(): void {
    this.popups = [];
    this.bursts = [];
    this.banner = null;
    this.plife.fill(0);
    this.cursor = 0;
    this.lastT = -Infinity;
    this.scoreShown = 0;
  }

  private spawnParticles(lane: number, count: number, gold: boolean): void {
    const x = this.laneX(lane, 1);
    const y = this.hitY;
    for (let i = 0; i < count; i++) {
      const p = this.pnext;
      this.pnext = (this.pnext + 1) % MAX_PARTICLES;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const sp = 140 + Math.random() * 320;
      this.px[p] = x + (Math.random() - 0.5) * this.noteSize * 0.4;
      this.py[p] = y;
      this.pvx[p] = Math.cos(a) * sp;
      this.pvy[p] = Math.sin(a) * sp;
      this.pmax[p] = this.plife[p] = 0.35 + Math.random() * 0.35;
      this.psize[p] = this.noteSize * (0.18 + Math.random() * 0.22);
      this.psprite[p] = gold && i % 2 === 0 ? -1 : lane;
    }
  }

  // --- frame -----------------------------------------------------------------

  draw(st: FrameState, perf: number): void {
    const g = this.g;
    const dt = this.lastPerf ? Math.min(0.1, (perf - this.lastPerf) / 1000) : 0.016;
    this.trackPerformance(perf, dt);
    this.lastPerf = perf;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    if (this.bg) g.drawImage(this.bg, 0, 0, this.W, this.H);

    const L = this.opts.laneCount;
    const reactive = this.opts.musicReactive && !this.opts.reducedEffects;
    const top = this.project(1);
    const halfTop = (this.hw / 2) * top.s;
    const halfBot = this.hw / 2;

    // Music-reactive horizon glow.
    if (reactive) {
      const a = 0.12 + 0.4 * st.energy + 0.25 * st.beatPulse;
      g.globalAlpha = clamp(a, 0, 0.8);
      g.globalCompositeOperation = 'lighter';
      const size = this.hw * (1.3 + 0.25 * st.beatPulse);
      g.drawImage(this.sprites.glow, this.cx - size / 2, this.topY - size * 0.45, size, size * 0.9);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }

    // Highway body.
    g.beginPath();
    g.moveTo(this.cx - halfBot, this.hitY + this.noteSize * 0.9);
    g.lineTo(this.cx - halfTop, top.y);
    g.lineTo(this.cx + halfTop, top.y);
    g.lineTo(this.cx + halfBot, this.hitY + this.noteSize * 0.9);
    g.closePath();
    g.fillStyle = this.theme.highway;
    g.fill();

    // Lane beams for pressed lanes.
    for (let l = 0; l < L; l++) {
      if (st.pressed[l] || st.held[l]) this.pressFade[l] = 1;
      else this.pressFade[l] = Math.max(0, this.pressFade[l] - dt * 7);
      const f = this.pressFade[l];
      if (f <= 0.01) continue;
      const x0b = this.cx - halfBot + l * this.laneW;
      const x0t = this.cx - halfTop + l * this.laneW * top.s;
      g.globalAlpha = f * (st.held[l] ? 1 : 0.85);
      g.fillStyle = this.laneGradients[l];
      g.beginPath();
      g.moveTo(x0b, this.hitY + this.noteSize * 0.5);
      g.lineTo(x0t, top.y);
      g.lineTo(x0t + this.laneW * top.s, top.y);
      g.lineTo(x0b + this.laneW, this.hitY + this.noteSize * 0.5);
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;

    // Lane dividers and edges.
    const edgeAlpha = 0.16 + (reactive ? 0.22 * st.beatPulse : 0);
    for (let l = 0; l <= L; l++) {
      const xb = this.cx - halfBot + l * this.laneW;
      const xt = this.cx - halfTop + l * this.laneW * top.s;
      const outer = l === 0 || l === L;
      g.strokeStyle = outer ? rgba(this.colors[Math.min(l, L - 1)], 0.35 + edgeAlpha) : `rgba(255,255,255,${edgeAlpha})`;
      g.lineWidth = outer ? 2 : 1;
      g.beginPath();
      g.moveTo(xb, this.hitY + this.noteSize * 0.9);
      g.lineTo(xt, top.y);
      g.stroke();
    }

    // Hit line.
    const lineGrad = g.createLinearGradient(this.cx - halfBot, 0, this.cx + halfBot, 0);
    this.colors.forEach((c, i) => lineGrad.addColorStop(L === 1 ? 0 : i / (L - 1), c));
    g.strokeStyle = lineGrad;
    g.lineWidth = 3;
    g.globalAlpha = 0.8;
    g.beginPath();
    g.moveTo(this.cx - halfBot, this.hitY);
    g.lineTo(this.cx + halfBot, this.hitY);
    g.stroke();
    g.globalAlpha = 1;

    // Receptors.
    const rs = this.noteSize * 1.08 * this.sprites.pad;
    for (let l = 0; l < L; l++) {
      const lit = this.pressFade[l] > 0.3;
      const spr = lit ? this.sprites.receptorLit[l] : this.sprites.receptor[l];
      const bump = 1 + 0.08 * this.pressFade[l];
      g.drawImage(spr, this.laneX(l, 1) - (rs * bump) / 2, this.hitY - (rs * bump) / 2, rs * bump, rs * bump);
    }

    this.drawNotes(st);
    this.drawEffects(perf, dt);
    this.drawHud(st, perf, dt);
  }

  private visibleRange(st: FrameState): [number, number] {
    const A = this.opts.approachMs;
    const notes = st.notes;
    if (st.t < this.lastT - 1) this.cursor = 0; // time went backwards (restart/rewind)
    this.lastT = st.t;
    if (this.maxHoldMs === 0 && notes.length) {
      for (const n of notes) this.maxHoldMs = Math.max(this.maxHoldMs, n.end - n.t);
      this.maxHoldMs += 1;
    }
    const from = st.t - 0.35 * A - this.maxHoldMs;
    while (this.cursor < notes.length && notes[this.cursor].t < from) this.cursor++;
    let end = this.cursor;
    const to = st.t + 1.08 * A;
    while (end < notes.length && notes[end].t <= to) end++;
    return [this.cursor, end];
  }

  private drawNotes(st: FrameState): void {
    const g = this.g;
    const A = this.opts.approachMs;
    const [from, to] = this.visibleRange(st);
    const sp = this.sprites;
    const pad = sp.pad;

    // Hold bodies first, underneath everything.
    for (let i = from; i < to; i++) {
      const n = st.notes[i];
      if (n.type !== 'hold') continue;
      if (n.state === NoteState.HoldDone || n.state === NoteState.Skipped) continue;
      const holding = n.state === NoteState.Holding;
      const broken = n.state === NoteState.HoldBroken || (n.state === NoteState.Missed && !n.caught);
      const z0 = holding ? 0 : (n.t - st.t) / A;
      const z1 = Math.min(1, (n.end - st.t) / A);
      if (z1 < -0.3 || z0 > 1) continue;
      const a = this.project(Math.max(-0.3, z0));
      const b = this.project(Math.max(-0.3, z1));
      const wA = this.noteSize * 0.36 * a.s;
      const wB = this.noteSize * 0.36 * b.s;
      const xa = this.laneX(n.lane, a.s);
      const xb = this.laneX(n.lane, b.s);
      const color = this.colors[n.lane];
      g.globalAlpha = broken ? 0.22 : holding ? 0.9 : 0.6;
      g.fillStyle = holding ? rgba(color, 0.75) : rgba(color, 0.45);
      g.beginPath();
      g.moveTo(xa - wA, a.y);
      g.lineTo(xb - wB, b.y);
      g.lineTo(xb + wB, b.y);
      g.lineTo(xa + wA, a.y);
      g.closePath();
      g.fill();
      // Bright core.
      g.strokeStyle = holding ? '#ffffff' : shade(color, 0.5);
      g.lineWidth = Math.max(1.5, wA * 0.25);
      g.beginPath();
      g.moveTo(xa, a.y);
      g.lineTo(xb, b.y);
      g.stroke();
      // Tail cap.
      if (z1 < 1) {
        g.fillStyle = shade(color, 0.4);
        g.beginPath();
        g.ellipse(xb, b.y, wB * 1.15, wB * 0.55, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }

    // Chord connectors (drawn under the heads).
    for (let i = from; i < to; i++) {
      const n = st.notes[i];
      if (n.group === undefined || n.state !== NoteState.Pending) continue;
      const m = st.notes[i + 1];
      if (!m || m.group !== n.group || m.state !== NoteState.Pending) continue;
      const z = (n.t - st.t) / A;
      if (z < -0.1 || z > 1) continue;
      const p = this.project(z);
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = Math.max(2, this.noteSize * 0.08 * p.s);
      g.beginPath();
      g.moveTo(this.laneX(n.lane, p.s), p.y);
      g.lineTo(this.laneX(m.lane, p.s), p.y);
      g.stroke();
    }

    // Heads, far to near so closer notes overlap farther ones.
    for (let i = to - 1; i >= from; i--) {
      const n = st.notes[i];
      let z: number;
      let alpha = 1;
      let lit = false;
      switch (n.state) {
        case NoteState.Pending:
          z = (n.t - st.t) / A;
          break;
        case NoteState.Arming:
          z = Math.max(0, (n.t - st.t) / A);
          lit = true;
          break;
        case NoteState.Holding:
          z = 0;
          lit = true;
          break;
        case NoteState.Missed:
          z = (n.t - st.t) / A;
          alpha = 0.35;
          if (n.type === 'hold' && n.caught) continue;
          break;
        default:
          continue;
      }
      if (z > 1.06 || z < -0.32) continue;
      if (z > 0.92) alpha *= clamp((1.06 - z) / 0.14, 0, 1);
      if (z < 0) alpha *= clamp(1 + z / 0.32, 0, 1);
      const p = this.project(z);
      const size = this.noteSize * p.s * pad;
      const x = this.laneX(n.lane, p.s);
      const spr = n.type === 'swipe' ? sp.swipe[n.dir ?? 'up'] : lit ? sp.noteLit[n.lane] : sp.note[n.lane];
      g.globalAlpha = alpha;
      g.drawImage(spr, x - size / 2, p.y - size / 2, size, size);
    }
    g.globalAlpha = 1;
  }

  private drawEffects(perf: number, dt: number): void {
    const g = this.g;
    g.globalCompositeOperation = 'lighter';
    // Bursts.
    this.bursts = this.bursts.filter((b) => perf - b.born < 300);
    for (const b of this.bursts) {
      const t = (perf - b.born) / 300;
      const size = this.noteSize * (1.1 + t * (b.big ? 2.2 : 1.5));
      g.globalAlpha = (1 - t) * (b.gold ? 1 : 0.8);
      const spr = this.sprites.burst[b.lane];
      g.drawImage(spr, this.laneX(b.lane, 1) - size / 2, this.hitY - size / 2, size, size);
    }
    // Particles.
    for (let p = 0; p < MAX_PARTICLES; p++) {
      if (this.plife[p] <= 0) continue;
      this.plife[p] -= dt;
      this.px[p] += this.pvx[p] * dt;
      this.py[p] += this.pvy[p] * dt;
      this.pvy[p] += 620 * dt;
      const life = Math.max(0, this.plife[p] / this.pmax[p]);
      const s = this.psize[p] * (0.4 + 0.6 * life);
      g.globalAlpha = life;
      const spr = this.psprite[p] < 0 ? this.sprites.goldDot : this.sprites.dot[this.psprite[p]];
      g.drawImage(spr, this.px[p] - s / 2, this.py[p] - s / 2, s, s);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  private drawHud(st: FrameState, perf: number, dt: number): void {
    const g = this.g;
    const { W, theme } = this;
    const top = this.insets.top;

    // Judgment popup.
    const pop = this.popups[0];
    if (pop) {
      const age = perf - pop.born;
      if (age > 520) this.popups = [];
      else {
        const a = age < 340 ? 1 : 1 - (age - 340) / 180;
        const scale = age < 90 ? 1.25 - (age / 90) * 0.25 : 1;
        const y = this.hitY - (this.hitY - this.topY) * 0.2;
        g.save();
        g.globalAlpha = a;
        g.translate(this.cx, y);
        g.scale(scale, scale);
        g.font = `700 ${Math.round(Math.min(34, W * 0.075))}px ${DISPLAY_FONT}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = pop.color;
        g.fillText(pop.text, 0, 0);
        if (pop.sub) {
          g.font = `600 ${Math.round(Math.min(14, W * 0.032))}px ${DISPLAY_FONT}`;
          g.fillStyle = 'rgba(255,255,255,0.7)';
          g.fillText(pop.sub, 0, 24);
        }
        g.restore();
      }
    }

    // Combo.
    if (st.combo !== this.lastCombo) {
      if (st.combo > this.lastCombo) this.comboBump = 1;
      this.lastCombo = st.combo;
    }
    this.comboBump = Math.max(0, this.comboBump - dt * 6);
    if (st.combo >= 4) {
      const y = this.topY + (this.hitY - this.topY) * 0.3;
      const size = Math.round(Math.min(68, W * 0.15) * (1 + 0.12 * this.comboBump));
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `700 ${size}px ${DISPLAY_FONT}`;
      g.globalAlpha = 0.9;
      g.fillStyle = st.multiplier >= 4 ? theme.gold : theme.text;
      g.fillText(String(st.combo), this.cx, y);
      g.font = `600 ${Math.round(size * 0.22)}px ${DISPLAY_FONT}`;
      g.fillStyle = rgba(theme.accent, 0.85);
      g.fillText('COMBO', this.cx, y + size * 0.62);
      g.globalAlpha = 1;
    }

    // Banner (milestones, countdown, resume).
    if (this.banner || st.banner) {
      const text = st.banner ?? this.banner!.text;
      const age = st.banner ? 200 : perf - this.banner!.born;
      if (!st.banner && age > 1100) this.banner = null;
      else {
        const a = st.banner ? 1 : age < 150 ? age / 150 : age > 800 ? 1 - (age - 800) / 300 : 1;
        const y = this.topY + (this.hitY - this.topY) * 0.52;
        g.globalAlpha = clamp(a, 0, 1);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = `700 ${Math.round(Math.min(40, W * 0.09))}px ${DISPLAY_FONT}`;
        g.fillStyle = theme.gold;
        g.fillText(text, this.cx, y);
        g.globalAlpha = 1;
      }
    }

    // Top bar: score, multiplier, accuracy, title, progress.
    this.scoreShown += (st.score - this.scoreShown) * Math.min(1, dt * 14);
    if (Math.abs(st.score - this.scoreShown) < 1) this.scoreShown = st.score;
    const right = W - this.insets.right - 14;
    g.textAlign = 'right';
    g.textBaseline = 'alphabetic';
    g.font = `700 ${Math.round(Math.min(26, W * 0.062))}px ${DISPLAY_FONT}`;
    g.fillStyle = theme.text;
    g.fillText(formatScore(this.scoreShown), right, top + 36);
    g.font = `600 ${Math.round(Math.min(13, W * 0.032))}px ${DISPLAY_FONT}`;
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fillText(`${(st.accuracy * 100).toFixed(1)}%`, right, top + 54);
    if (st.multiplier > 1) {
      g.font = `700 ${Math.round(Math.min(18, W * 0.045))}px ${DISPLAY_FONT}`;
      g.fillStyle = st.multiplier >= 4 ? theme.gold : theme.accent;
      g.textAlign = 'right';
      const w = g.measureText(formatScore(this.scoreShown)).width;
      g.font = `700 ${Math.round(Math.min(26, W * 0.062))}px ${DISPLAY_FONT}`;
      const sw = g.measureText(formatScore(this.scoreShown)).width;
      g.font = `700 ${Math.round(Math.min(18, W * 0.045))}px ${DISPLAY_FONT}`;
      g.fillText(`×${st.multiplier}`, right - Math.max(w, sw) - 10, top + 35);
    }
    const left = this.insets.left + 64;
    g.textAlign = 'left';
    g.font = `600 ${Math.round(Math.min(15, W * 0.038))}px ${DISPLAY_FONT}`;
    g.fillStyle = theme.text;
    const maxTitle = Math.max(60, right - left - 150);
    g.fillText(truncate(g, st.title, maxTitle), left, top + 30);
    g.font = `500 ${Math.round(Math.min(12, W * 0.03))}px ${DISPLAY_FONT}`;
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillText(truncate(g, st.autoplay ? `${st.subtitle} · AUTOPLAY` : st.subtitle, maxTitle), left, top + 48);
    // Progress.
    const barY = top + 64;
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(this.insets.left + 12, barY, W - this.insets.left - this.insets.right - 24, 3);
    const pg = g.createLinearGradient(0, 0, W, 0);
    pg.addColorStop(0, this.colors[0]);
    pg.addColorStop(1, this.colors[this.colors.length - 1]);
    g.fillStyle = pg;
    g.fillRect(this.insets.left + 12, barY, (W - this.insets.left - this.insets.right - 24) * clamp(st.progress, 0, 1), 3);

    if (this.opts.showFps) {
      g.textAlign = 'left';
      g.font = `500 11px ${DISPLAY_FONT}`;
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillText(this.fpsText, this.insets.left + 12, this.H - this.insets.bottom - 8);
    }
  }

  /** Lower the backing-store resolution if frames are consistently slow. */
  private trackPerformance(perf: number, dt: number): void {
    this.frameEma = this.frameEma * 0.95 + dt * 1000 * 0.05;
    this.fpsFrames++;
    if (perf - this.fpsSince > 1000) {
      this.fpsText = `${Math.round((this.fpsFrames * 1000) / (perf - this.fpsSince))} fps · ${this.dpr.toFixed(1)}x`;
      this.fpsFrames = 0;
      this.fpsSince = perf;
    }
    if (this.frameEma > 24) this.slowFrames++;
    else this.slowFrames = Math.max(0, this.slowFrames - 1);
    if (this.slowFrames > 120 && this.dpr > 1) {
      this.maxDpr = Math.max(1, this.dpr - 0.5);
      this.slowFrames = 0;
      this.resize();
    }
  }
}

function truncate(g: CanvasRenderingContext2D, text: string, max: number): string {
  if (g.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && g.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}
