// Small, dependency-free helpers shared by analysis, generation and the engine.

/** Deterministic PRNG (mulberry32). Returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 32-bit FNV-1a over a string. Stable across platforms; used for seeds and ids. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Hash arbitrary bytes into a 64-bit-ish hex string (two independent 32-bit FNV variants). */
export function hashBytesHex(bytes: Uint8Array): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x050c5d1f;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    h1 ^= b;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= b + i;
    h2 = Math.imul(h2, 0x01000193) ^ (h2 >>> 13);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function median(values: ArrayLike<number>): number {
  if (values.length === 0) return 0;
  const arr = Array.from(values).sort((a, b) => a - b);
  const mid = arr.length >> 1;
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

/** p in [0, 1]. Linear interpolation between order statistics. */
export function percentile(values: ArrayLike<number>, p: number): number {
  if (values.length === 0) return 0;
  const arr = Float64Array.from(values as ArrayLike<number>).sort();
  const pos = clamp(p, 0, 1) * (arr.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(arr.length - 1, lo + 1);
  return arr[lo] + (arr[hi] - arr[lo]) * (pos - lo);
}

export function mean(values: ArrayLike<number>, from = 0, to = values.length): number {
  if (to <= from) return 0;
  let s = 0;
  for (let i = from; i < to; i++) s += values[i];
  return s / (to - from);
}

/** Binary search: first index i with arr[i] >= x (arr sorted ascending). */
export function lowerBound(arr: ArrayLike<number>, x: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function uid(prefix = ''): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${rnd}`;
}

export function formatDuration(ms: number): string {
  if (!isFinite(ms) || ms < 0) ms = 0;
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatScore(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}
