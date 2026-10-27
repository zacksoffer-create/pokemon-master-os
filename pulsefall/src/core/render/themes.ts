import type { ThemeId } from '../types';

export interface Theme {
  id: ThemeId;
  label: string;
  /** Lane colors for 3 lanes; the 4-lane layout inserts `extra` in the middle. */
  lanes: [string, string, string];
  extra: string;
  accent: string;
  gold: string;
  bgTop: string;
  bgBottom: string;
  highway: string;
  text: string;
  /** Use shapes by default (high-contrast theme). */
  shapes?: boolean;
}

export const THEMES: Record<ThemeId, Theme> = {
  neon: {
    id: 'neon',
    label: 'Neon Night',
    lanes: ['#22e6ff', '#a96bff', '#ff3fb4'],
    extra: '#5b8cff',
    accent: '#22e6ff',
    gold: '#ffd34d',
    bgTop: '#05040c',
    bgBottom: '#1a0b33',
    highway: 'rgba(12, 9, 30, 0.72)',
    text: '#f4f1ff',
  },
  sunset: {
    id: 'sunset',
    label: 'Sunset Strip',
    lanes: ['#ffb347', '#ff5e7e', '#c85cff'],
    extra: '#ff8a5b',
    accent: '#ff8a5b',
    gold: '#ffe08a',
    bgTop: '#0c0508',
    bgBottom: '#3a0f2a',
    highway: 'rgba(28, 8, 22, 0.7)',
    text: '#fff3ec',
  },
  aurora: {
    id: 'aurora',
    label: 'Aurora',
    lanes: ['#3dffb0', '#3dc9ff', '#8a7dff'],
    extra: '#4fe6e6',
    accent: '#3dffb0',
    gold: '#e8ff7a',
    bgTop: '#020b0c',
    bgBottom: '#0b2236',
    highway: 'rgba(4, 18, 24, 0.72)',
    text: '#ecfffb',
  },
  contrast: {
    id: 'contrast',
    label: 'High Contrast',
    lanes: ['#ffe600', '#ffffff', '#00e5ff'],
    extra: '#ff7ad9',
    accent: '#ffe600',
    gold: '#ffe600',
    bgTop: '#000000',
    bgBottom: '#000000',
    highway: 'rgba(20, 20, 20, 0.9)',
    text: '#ffffff',
    shapes: true,
  },
};

export function laneColors(theme: Theme, laneCount: number): string[] {
  if (laneCount === 4) return [theme.lanes[0], theme.lanes[1], theme.extra, theme.lanes[2]];
  return theme.lanes.slice(0, laneCount);
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Mix a color toward white (t > 0) or black (t < 0). */
export function shade(hex: string, t: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.round(t >= 0 ? c + (255 - c) * t : c * (1 + t));
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}

export const DISPLAY_FONT = '"Chakra Petch", "Avenir Next", "Segoe UI", system-ui, sans-serif';
