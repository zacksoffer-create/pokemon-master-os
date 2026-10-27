import { median } from '../util';

/**
 * The single definition of how latency settings shift time. Everything that converts a
 * clock reading into gameplay time goes through here, so an offset can never be applied
 * twice or forgotten in one path.
 */
export interface Offsets {
  /** Extra output latency the browser does not report (e.g. Bluetooth). */
  audio: number;
  /** Delay between a physical tap and the event we receive. */
  input: number;
  /** Draw notes this much later/earlier to match the display. */
  visual: number;
}

export function heardTime(rawSongMs: number, o: Offsets): number {
  return rawSongMs - o.audio;
}

export function judgeTime(rawSongMs: number, o: Offsets): number {
  return heardTime(rawSongMs, o) - o.input;
}

export function renderTime(rawSongMs: number, o: Offsets): number {
  return heardTime(rawSongMs, o) + o.visual;
}

/**
 * Calibration from two tap-along tests:
 *  - audio test: tapping to clicks you hear measures (unreported audio latency + input latency);
 *  - visual test: tapping to flashes you see measures (display latency + input latency).
 * Input latency is attributed from the visual test, the remainder to audio. With only the
 * audio test, the existing input offset is kept and audio absorbs the difference.
 * Taps are median-filtered and outliers (> 150 ms from the median) are dropped.
 */
export function calibrate(
  audioDeltas: number[],
  visualDeltas: number[] | null,
  current: Offsets,
): { offsets: Offsets; audioMedian: number; visualMedian: number | null; consistency: number } {
  const clean = (xs: number[]) => {
    const m = median(xs);
    return xs.filter((x) => Math.abs(x - m) <= 150);
  };
  const a = clean(audioDeltas);
  const audioMedian = Math.round(median(a));
  let input = current.input;
  let visualMedian: number | null = null;
  if (visualDeltas && visualDeltas.length >= 4) {
    visualMedian = Math.round(median(clean(visualDeltas)));
    input = visualMedian;
  }
  const spread = a.length ? Math.sqrt(a.reduce((s, x) => s + (x - audioMedian) ** 2, 0) / a.length) : 999;
  return {
    offsets: { audio: clampOffset(audioMedian - input), input: clampOffset(input), visual: current.visual },
    audioMedian,
    visualMedian,
    consistency: Math.max(0, Math.min(1, 1 - spread / 80)),
  };
}

export function clampOffset(ms: number): number {
  return Math.max(-300, Math.min(500, Math.round(ms)));
}
