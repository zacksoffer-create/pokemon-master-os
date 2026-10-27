import type { NoteStyleId, SwipeDir } from '../types';
import { rgba, shade, type Theme } from './themes';

/**
 * Pre-rendered note art. Glows and gradients are expensive to draw every frame on mobile
 * GPUs (shadowBlur especially), so everything soft is baked once into offscreen canvases
 * and stamped with drawImage.
 */
export type Sprite = HTMLCanvasElement | OffscreenCanvas;

export interface SpriteSet {
  /** Note body per lane; drawn at size `noteSize * scale` centered. */
  note: Sprite[];
  /** Pressed/armed variant (brighter). */
  noteLit: Sprite[];
  swipe: Record<SwipeDir, Sprite>;
  receptor: Sprite[];
  receptorLit: Sprite[];
  burst: Sprite[];
  dot: Sprite[];
  goldDot: Sprite;
  glow: Sprite;
  /** Ratio between sprite size and the note's nominal diameter (glow margin). */
  pad: number;
}

function canvas(size: number): Sprite {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(size, size);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function ctx2d(c: Sprite): CanvasRenderingContext2D {
  return c.getContext('2d') as CanvasRenderingContext2D;
}

const PAD = 1.7;

function shapePath(g: CanvasRenderingContext2D, shape: number, cx: number, cy: number, r: number): void {
  g.beginPath();
  switch (shape) {
    case 1: // diamond
      g.moveTo(cx, cy - r * 1.08);
      g.lineTo(cx + r * 1.08, cy);
      g.lineTo(cx, cy + r * 1.08);
      g.lineTo(cx - r * 1.08, cy);
      g.closePath();
      break;
    case 2: {
      // rounded square
      const s = r * 0.9;
      const k = r * 0.32;
      g.moveTo(cx - s + k, cy - s);
      g.arcTo(cx + s, cy - s, cx + s, cy + s, k);
      g.arcTo(cx + s, cy + s, cx - s, cy + s, k);
      g.arcTo(cx - s, cy + s, cx - s, cy - s, k);
      g.arcTo(cx - s, cy - s, cx + s, cy - s, k);
      g.closePath();
      break;
    }
    case 3: // hexagon
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        const x = cx + Math.cos(a) * r * 1.05;
        const y = cy + Math.sin(a) * r * 1.05;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      break;
    default:
      g.arc(cx, cy, r, 0, Math.PI * 2);
  }
}

function drawNote(color: string, size: number, shape: number, lit: boolean, useShapes: boolean): Sprite {
  const px = Math.ceil(size * PAD);
  const c = canvas(px);
  const g = ctx2d(c);
  const cx = px / 2;
  const r = size / 2;
  // Outer glow.
  const glow = g.createRadialGradient(cx, cx, r * 0.6, cx, cx, px / 2);
  glow.addColorStop(0, rgba(color, lit ? 0.75 : 0.5));
  glow.addColorStop(1, rgba(color, 0));
  g.fillStyle = glow;
  g.fillRect(0, 0, px, px);
  const s = useShapes ? shape : 0;
  // Body: glossy gradient.
  const body = g.createRadialGradient(cx - r * 0.35, cx - r * 0.45, r * 0.1, cx, cx, r * 1.05);
  body.addColorStop(0, shade(color, lit ? 0.85 : 0.65));
  body.addColorStop(0.45, color);
  body.addColorStop(1, shade(color, -0.45));
  shapePath(g, s, cx, cx, r);
  g.fillStyle = body;
  g.fill();
  // Bright rim.
  g.lineWidth = Math.max(1.5, size * 0.06);
  g.strokeStyle = shade(color, 0.7);
  g.stroke();
  // Inner core / glyph so lanes differ by more than color.
  g.fillStyle = 'rgba(255,255,255,0.85)';
  shapePath(g, s, cx, cx, r * 0.28);
  g.fill();
  // Specular highlight.
  g.globalAlpha = 0.5;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.ellipse(cx - r * 0.28, cx - r * 0.42, r * 0.36, r * 0.18, -0.5, 0, Math.PI * 2);
  g.fill();
  return c;
}

function drawSwipe(gold: string, size: number, dir: SwipeDir): Sprite {
  const px = Math.ceil(size * PAD);
  const c = canvas(px);
  const g = ctx2d(c);
  const cx = px / 2;
  const r = size / 2;
  const glow = g.createRadialGradient(cx, cx, r * 0.5, cx, cx, px / 2);
  glow.addColorStop(0, rgba(gold, 0.7));
  glow.addColorStop(1, rgba(gold, 0));
  g.fillStyle = glow;
  g.fillRect(0, 0, px, px);
  const body = g.createLinearGradient(cx, cx - r, cx, cx + r);
  body.addColorStop(0, shade(gold, 0.6));
  body.addColorStop(1, shade(gold, -0.35));
  shapePath(g, 1, cx, cx, r * 1.02);
  g.fillStyle = body;
  g.fill();
  g.lineWidth = Math.max(2, size * 0.07);
  g.strokeStyle = '#fffbe6';
  g.stroke();
  // Chevron arrow.
  g.save();
  g.translate(cx, cx);
  const rot = dir === 'up' ? 0 : dir === 'right' ? Math.PI / 2 : dir === 'down' ? Math.PI : -Math.PI / 2;
  g.rotate(rot);
  g.strokeStyle = '#1b1030';
  g.lineWidth = size * 0.12;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const off of [-0.05, 0.25]) {
    g.beginPath();
    g.moveTo(-r * 0.42, r * (0.18 + off));
    g.lineTo(0, r * (-0.22 + off));
    g.lineTo(r * 0.42, r * (0.18 + off));
    g.stroke();
  }
  g.restore();
  return c;
}

function drawReceptor(color: string, size: number, shape: number, lit: boolean, useShapes: boolean): Sprite {
  const px = Math.ceil(size * PAD);
  const c = canvas(px);
  const g = ctx2d(c);
  const cx = px / 2;
  const r = size / 2;
  if (lit) {
    const glow = g.createRadialGradient(cx, cx, r * 0.3, cx, cx, px / 2);
    glow.addColorStop(0, rgba(color, 0.9));
    glow.addColorStop(0.55, rgba(color, 0.35));
    glow.addColorStop(1, rgba(color, 0));
    g.fillStyle = glow;
    g.fillRect(0, 0, px, px);
  }
  const s = useShapes ? shape : 0;
  shapePath(g, s, cx, cx, r * 0.98);
  g.fillStyle = rgba(color, lit ? 0.35 : 0.1);
  g.fill();
  g.lineWidth = Math.max(2, size * (lit ? 0.09 : 0.065));
  g.strokeStyle = lit ? shade(color, 0.6) : rgba(color, 0.85);
  g.stroke();
  shapePath(g, s, cx, cx, r * 0.62);
  g.lineWidth = Math.max(1, size * 0.025);
  g.strokeStyle = rgba(color, lit ? 0.9 : 0.35);
  g.stroke();
  return c;
}

function drawBurst(color: string, size: number): Sprite {
  const px = Math.ceil(size * 2);
  const c = canvas(px);
  const g = ctx2d(c);
  const cx = px / 2;
  const ring = g.createRadialGradient(cx, cx, size * 0.55, cx, cx, size);
  ring.addColorStop(0, rgba(color, 0));
  ring.addColorStop(0.7, rgba(color, 0.9));
  ring.addColorStop(0.85, 'rgba(255,255,255,0.95)');
  ring.addColorStop(1, rgba(color, 0));
  g.fillStyle = ring;
  g.fillRect(0, 0, px, px);
  return c;
}

function drawDot(color: string, size: number): Sprite {
  const c = canvas(Math.ceil(size));
  const g = ctx2d(c);
  const cx = size / 2;
  const grad = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.3, color);
  grad.addColorStop(1, rgba(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

export function buildSprites(theme: Theme, colors: string[], noteSizePx: number, noteStyle: NoteStyleId): SpriteSet {
  const useShapes = noteStyle === 'shapes' || !!theme.shapes;
  const size = Math.max(16, Math.round(noteSizePx));
  const shapes = colors.length === 4 ? [0, 1, 3, 2] : [0, 1, 2];
  return {
    note: colors.map((c, i) => drawNote(c, size, shapes[i], false, useShapes)),
    noteLit: colors.map((c, i) => drawNote(c, size, shapes[i], true, useShapes)),
    swipe: {
      up: drawSwipe(theme.gold, size, 'up'),
      down: drawSwipe(theme.gold, size, 'down'),
      left: drawSwipe(theme.gold, size, 'left'),
      right: drawSwipe(theme.gold, size, 'right'),
    },
    receptor: colors.map((c, i) => drawReceptor(c, size * 1.08, shapes[i], false, useShapes)),
    receptorLit: colors.map((c, i) => drawReceptor(c, size * 1.08, shapes[i], true, useShapes)),
    burst: colors.map((c) => drawBurst(c, size)),
    dot: colors.map((c) => drawDot(c, Math.max(8, size * 0.35))),
    goldDot: drawDot(theme.gold, Math.max(8, size * 0.35)),
    glow: drawDot(theme.accent, 256),
    pad: PAD,
  };
}
