import { eventPerfTime } from '../audio/clock';
import type { SwipeDir } from '../types';

export interface InputHandlers {
  /** A finger/key went down in a lane. `perf` is the event's performance timestamp. */
  press(lane: number, perf: number, pointer: string): void;
  release(pointer: string, perf: number): void;
  /** A flick was recognised; `perf` is when the touch began. */
  swipe(pointer: string, dir: SwipeDir, startPerf: number): void;
}

interface Track {
  lane: number;
  x: number;
  y: number;
  perf: number;
  swiped: boolean;
}

const KEYMAP_3: Record<string, number> = {
  KeyF: 0, KeyD: 0, ArrowLeft: 0, Digit1: 0, KeyA: 0,
  Space: 1, KeyG: 1, KeyH: 1, ArrowDown: 1, ArrowUp: 1, Digit2: 1, KeyS: 1,
  KeyJ: 2, KeyK: 2, ArrowRight: 2, Digit3: 2, KeyL: 2,
};
const KEYMAP_4: Record<string, number> = {
  KeyD: 0, ArrowLeft: 0, Digit1: 0,
  KeyF: 1, ArrowDown: 1, Digit2: 1,
  KeyJ: 2, ArrowUp: 2, Digit3: 2,
  KeyK: 3, ArrowRight: 3, Digit4: 3,
};

export function keyLabels(laneCount: number): string[] {
  return laneCount === 4 ? ['D', 'F', 'J', 'K'] : ['F', 'Space', 'J'];
}

/**
 * Pointer + keyboard input wired straight to the gameplay engine (no framework state in
 * the loop). Multitouch works through Pointer Events; each pointer keeps the lane it
 * touched down in, so a thumb that drifts while holding does not break the hold.
 */
export class InputController {
  private tracks = new Map<number, Track>();
  private keysDown = new Set<string>();
  private detachFns: (() => void)[] = [];
  enabled = true;

  constructor(
    private readonly el: HTMLElement,
    private readonly laneAt: (x: number) => number,
    private readonly laneCount: number,
    private readonly handlers: InputHandlers,
  ) {}

  /** Lanes currently pressed (for lighting receptors). */
  pressedLanes(out: boolean[]): boolean[] {
    out.fill(false);
    for (const t of this.tracks.values()) out[t.lane] = true;
    for (const code of this.keysDown) {
      const lane = this.keymap()[code];
      if (lane !== undefined) out[lane] = true;
    }
    return out;
  }

  attach(): void {
    const el = this.el;
    const opts: AddEventListenerOptions = { passive: false };
    // Buttons layered over the playfield (pause, skip) keep their normal behaviour.
    const isUi = (e: Event) => !!(e.target as Element | null)?.closest?.('button, a, input, [data-ui]');
    const down = (e: PointerEvent) => {
      if (!this.enabled || isUi(e) || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* capture is best-effort */
      }
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const lane = this.laneAt(x);
      const perf = eventPerfTime(e);
      this.tracks.set(e.pointerId, { lane, x: e.clientX, y: e.clientY, perf, swiped: false });
      this.handlers.press(lane, perf, `p${e.pointerId}`);
    };
    const move = (e: PointerEvent) => {
      const t = this.tracks.get(e.pointerId);
      if (!t || t.swiped) return;
      e.preventDefault();
      const dx = e.clientX - t.x;
      const dy = e.clientY - t.y;
      const dist = Math.hypot(dx, dy);
      const threshold = Math.max(22, Math.min(window.innerWidth, window.innerHeight) * 0.045);
      if (dist < threshold) return;
      if (eventPerfTime(e) - t.perf > 450) return;
      t.swiped = true;
      const dir: SwipeDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy < 0 ? 'up' : 'down';
      this.handlers.swipe(`p${e.pointerId}`, dir, t.perf);
    };
    const up = (e: PointerEvent) => {
      if (!this.tracks.has(e.pointerId)) return;
      e.preventDefault();
      this.tracks.delete(e.pointerId);
      this.handlers.release(`p${e.pointerId}`, eventPerfTime(e));
    };
    // Belt and braces against iOS scrolling, zooming and the callout menu.
    const block = (e: Event) => {
      if (this.enabled && !isUi(e)) e.preventDefault();
    };
    const keydown = (e: KeyboardEvent) => {
      if (!this.enabled || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const lane = this.keymap()[e.code];
      if (lane === undefined) return;
      e.preventDefault();
      this.keysDown.add(e.code);
      const perf = eventPerfTime(e);
      this.handlers.press(lane, perf, `k${e.code}`);
      // Shift + key flicks (keyboard players can hit swipe notes deliberately).
      if (e.shiftKey) this.handlers.swipe(`k${e.code}`, 'up', perf);
    };
    const keyup = (e: KeyboardEvent) => {
      if (!this.keysDown.has(e.code)) return;
      this.keysDown.delete(e.code);
      this.handlers.release(`k${e.code}`, eventPerfTime(e));
    };
    el.addEventListener('pointerdown', down, opts);
    el.addEventListener('pointermove', move, opts);
    el.addEventListener('pointerup', up, opts);
    el.addEventListener('pointercancel', up, opts);
    el.addEventListener('lostpointercapture', up as EventListener, opts);
    el.addEventListener('touchstart', block, opts);
    el.addEventListener('touchmove', block, opts);
    el.addEventListener('contextmenu', block, opts);
    el.addEventListener('gesturestart', block, opts);
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    this.detachFns.push(() => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('lostpointercapture', up as EventListener);
      el.removeEventListener('touchstart', block);
      el.removeEventListener('touchmove', block);
      el.removeEventListener('contextmenu', block);
      el.removeEventListener('gesturestart', block);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
    });
  }

  /** Forget all active touches/keys without reporting releases (used when pausing). */
  clearAll(): void {
    this.tracks.clear();
    this.keysDown.clear();
  }

  detach(): void {
    for (const fn of this.detachFns) fn();
    this.detachFns = [];
    this.tracks.clear();
    this.keysDown.clear();
  }

  private keymap(): Record<string, number> {
    return this.laneCount === 4 ? KEYMAP_4 : KEYMAP_3;
  }
}
