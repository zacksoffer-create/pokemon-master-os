import { THEMES, laneColors, rgba } from '../../core/render/themes';
import { DISPLAY_FONT } from '../../core/render/themes';
import type { Note, ThemeId } from '../../core/types';
import { clamp, formatDuration, lowerBound } from '../../core/util';
import type { Grid, Snap } from './editorModel';

export interface ViewState {
  /** Song time (ms) at the playhead line. */
  t: number;
  /** Pixels per millisecond. */
  zoom: number;
  notes: Note[];
  selected: Set<number>;
  snap: Snap;
  laneCount: number;
  playing: boolean;
  /** Chart offset: notes are drawn where they will actually sound. */
  offset: number;
  /** Ghost note preview while placing. */
  ghost?: { t: number; lane: number; end?: number; type: Note['type'] } | null;
}

export type Hit = { kind: 'note'; note: Note } | { kind: 'tail'; note: Note } | { kind: 'lane'; lane: number; t: number } | { kind: 'none'; t: number };

/**
 * Canvas timeline for the chart editor. Time runs upward (like the game): the playhead
 * line sits near the bottom and later notes are above it. A waveform column on the left
 * and the beat grid make it possible to line notes up by eye and ear.
 */
export class EditorView {
  private g: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private colors: string[];
  laneLeft = 0;
  laneW = 0;
  waveLeft = 0;
  waveW = 0;
  playY = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private peaks: Float32Array | null,
    private peaksFps: number,
    private grid: Grid,
    theme: ThemeId,
    laneCount: number,
  ) {
    this.g = canvas.getContext('2d')!;
    this.colors = laneColors(THEMES[theme], laneCount);
  }

  setLaneCount(theme: ThemeId, laneCount: number): void {
    this.colors = laneColors(THEMES[theme], laneCount);
  }

  resize(laneCount: number): void {
    const r = this.canvas.getBoundingClientRect();
    this.W = r.width;
    this.H = r.height;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.waveW = Math.min(64, this.W * 0.16);
    this.waveLeft = 4;
    const avail = this.W - this.waveW - 16;
    const lanesW = Math.min(avail, 120 * laneCount);
    this.laneW = lanesW / laneCount;
    this.laneLeft = this.waveLeft + this.waveW + 8 + (avail - lanesW) / 2;
    this.playY = this.H * 0.82;
  }

  timeAtY(y: number, s: ViewState): number {
    return s.t + (this.playY - y) / s.zoom;
  }

  yAtTime(t: number, s: ViewState): number {
    return this.playY - (t - s.t) * s.zoom;
  }

  laneAtX(x: number, laneCount: number): number {
    return clamp(Math.floor((x - this.laneLeft) / this.laneW), 0, laneCount - 1);
  }

  hitTest(x: number, y: number, s: ViewState): Hit {
    const t = this.timeAtY(y, s);
    const inLanes = x >= this.laneLeft && x <= this.laneLeft + this.laneW * s.laneCount;
    const r = Math.min(this.laneW * 0.32, 22) + 8;
    // Tails first (they sit above heads).
    for (const n of s.notes) {
      if (n.type !== 'hold' || n.end === undefined) continue;
      const cx = this.laneLeft + (n.lane + 0.5) * this.laneW;
      const ty = this.yAtTime(n.end + s.offset, s);
      if (Math.abs(x - cx) < r && Math.abs(y - ty) < 14) return { kind: 'tail', note: n };
    }
    let best: Note | null = null;
    let bestD = Infinity;
    for (const n of s.notes) {
      const cx = this.laneLeft + (n.lane + 0.5) * this.laneW;
      const cy = this.yAtTime(n.t + s.offset, s);
      const d = Math.hypot(x - cx, y - cy);
      if (d < r && d < bestD) {
        best = n;
        bestD = d;
      }
      // Clicking a hold body selects the hold.
      if (!best && n.type === 'hold' && n.end !== undefined && Math.abs(x - cx) < r * 0.6) {
        const top = this.yAtTime(n.end + s.offset, s);
        if (y < cy && y > top) best = n;
      }
    }
    if (best) return { kind: 'note', note: best };
    if (inLanes) return { kind: 'lane', lane: this.laneAtX(x, s.laneCount), t };
    return { kind: 'none', t };
  }

  draw(s: ViewState): void {
    const g = this.g;
    const { W, H } = this;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = '#0a0817';
    g.fillRect(0, 0, W, H);
    const t0 = this.timeAtY(H, s);
    const t1 = this.timeAtY(0, s);
    const L = s.laneCount;

    // Lane backgrounds.
    for (let l = 0; l < L; l++) {
      g.fillStyle = l % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.045)';
      g.fillRect(this.laneLeft + l * this.laneW, 0, this.laneW, H);
    }

    // Waveform column (peak envelope).
    if (this.peaks) {
      const cx = this.waveLeft + this.waveW / 2;
      g.fillStyle = 'rgba(169, 107, 255, 0.55)';
      for (let y = 0; y < H; y += 2) {
        const ta = this.timeAtY(y + 2, s);
        const tb = this.timeAtY(y, s);
        const ia = Math.max(0, Math.floor((ta / 1000) * this.peaksFps));
        const ib = Math.min(this.peaks.length - 1, Math.ceil((tb / 1000) * this.peaksFps));
        let m = 0;
        for (let i = ia; i <= ib; i++) if (this.peaks[i] > m) m = this.peaks[i];
        const w = m * this.waveW * 0.5;
        if (w > 0.3) g.fillRect(cx - w, y, w * 2, 2);
      }
    }

    // Grid.
    g.font = `600 10px ${DISPLAY_FONT}`;
    g.textAlign = 'left';
    g.textBaseline = 'bottom';
    for (const line of this.grid.lines(t0, t1, s.snap)) {
      const y = this.yAtTime(line.t, s);
      g.strokeStyle = line.level === 0 ? 'rgba(255,255,255,0.4)' : line.level === 1 ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)';
      g.lineWidth = line.level === 0 ? 1.5 : 1;
      g.beginPath();
      g.moveTo(this.laneLeft, y);
      g.lineTo(this.laneLeft + this.laneW * L, y);
      g.stroke();
      if (line.level === 0) {
        g.fillStyle = 'rgba(255,255,255,0.45)';
        g.fillText(String(line.bar), this.laneLeft + this.laneW * L + 4, y);
      }
    }

    // Notes.
    const r = Math.min(this.laneW * 0.32, 22);
    const off = s.offset;
    const from = Math.max(0, lowerBound(s.notes.map((n) => n.t + off), t0 - 30000));
    for (let i = from; i < s.notes.length; i++) {
      const n = s.notes[i];
      if (n.t + off > t1 + 200) break;
      const end = (n.end ?? n.t) + off;
      if (end < t0 - 200) continue;
      this.drawNote(n, s, r, s.selected.has(n.id), 1);
    }
    if (s.ghost) this.drawNote({ id: -1, t: s.ghost.t, lane: s.ghost.lane, type: s.ghost.type, end: s.ghost.end, dir: 'up' }, s, r, false, 0.45);

    // Playhead.
    g.strokeStyle = s.playing ? '#ffd34d' : '#ffffff';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, this.playY);
    g.lineTo(W, this.playY);
    g.stroke();
    g.fillStyle = s.playing ? '#ffd34d' : '#ffffff';
    g.font = `700 12px ${DISPLAY_FONT}`;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    const ms = Math.max(0, s.t);
    g.fillText(`${formatDuration(ms)}.${String(Math.floor(ms % 1000)).padStart(3, '0')}`, 6, this.playY + 6);
  }

  private drawNote(n: Note, s: ViewState, r: number, selected: boolean, alpha: number): void {
    const g = this.g;
    const cx = this.laneLeft + (n.lane + 0.5) * this.laneW;
    const cy = this.yAtTime(n.t + s.offset, s);
    const color = this.colors[n.lane] ?? '#fff';
    g.globalAlpha = alpha;
    if (n.type === 'hold' && n.end !== undefined) {
      const ty = this.yAtTime(n.end + s.offset, s);
      g.fillStyle = rgba(color, 0.4);
      roundRect(g, cx - r * 0.55, ty, r * 1.1, cy - ty, r * 0.5);
      g.fill();
      // Tail handle.
      g.fillStyle = selected ? '#ffffff' : rgba(color, 0.9);
      g.fillRect(cx - r * 0.7, ty - 3, r * 1.4, 6);
    }
    if (n.type === 'swipe') {
      g.fillStyle = '#ffd34d';
      g.beginPath();
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r, cy);
      g.lineTo(cx, cy + r);
      g.lineTo(cx - r, cy);
      g.closePath();
      g.fill();
      g.strokeStyle = '#1b1030';
      g.lineWidth = 3;
      const rot = n.dir === 'right' ? Math.PI / 2 : n.dir === 'down' ? Math.PI : n.dir === 'left' ? -Math.PI / 2 : 0;
      g.save();
      g.translate(cx, cy);
      g.rotate(rot);
      g.beginPath();
      g.moveTo(-r * 0.4, r * 0.2);
      g.lineTo(0, -r * 0.25);
      g.lineTo(r * 0.4, r * 0.2);
      g.stroke();
      g.restore();
    } else {
      g.fillStyle = color;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.beginPath();
      g.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
      g.fill();
    }
    if (selected) {
      g.strokeStyle = '#ffffff';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(cx, cy, r + 4, 0, Math.PI * 2);
      g.stroke();
    }
    if (n.group !== undefined) {
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fillRect(cx - r - 6, cy - 1, 4, 2);
    }
    g.globalAlpha = 1;
  }
}

/** Rounded rectangle path (CanvasRenderingContext2D.roundRect is missing on older Safari). */
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}
