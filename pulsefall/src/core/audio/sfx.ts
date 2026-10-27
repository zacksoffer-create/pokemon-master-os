import { mulberry32 } from '../util';

/**
 * Every sound effect is synthesized at startup: no bundled samples, nothing to license,
 * and the buffers are ready before the first tap. They are short and soft on purpose —
 * the song is the star.
 */
export type SfxName = 'tick' | 'snap' | 'swipe' | 'ui' | 'back' | 'milestone' | 'fanfare' | 'count' | 'go' | 'miss';
export type SfxBank = Record<SfxName, AudioBuffer>;

type Gen = (t: number, i: number, rnd: () => number) => number;

function make(ctx: BaseAudioContext, seconds: number, gen: Gen): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.max(1, Math.round(seconds * sr));
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const rnd = mulberry32(5);
  for (let i = 0; i < n; i++) d[i] = gen(i / sr, i, rnd);
  // Short fade-out to avoid clicks.
  const fade = Math.min(n, Math.round(0.004 * sr));
  for (let i = 0; i < fade; i++) d[n - 1 - i] *= i / fade;
  return buf;
}

const TAU = Math.PI * 2;

function tone(freqs: number[], t: number, decay: number): number {
  let v = 0;
  for (const f of freqs) v += Math.sin(TAU * f * t);
  return (v / freqs.length) * Math.exp(-t * decay);
}

export function buildSfx(ctx: BaseAudioContext): SfxBank {
  return {
    // A soft wooden tick: a short sine pair with a fast attack.
    tick: make(ctx, 0.06, (t) => 0.5 * tone([1850, 2770], t, 70) * Math.min(1, t * 4000)),
    // A dry snap: filtered noise burst plus a tiny tonal body.
    snap: make(ctx, 0.07, (t, _i, rnd) => {
      const env = Math.exp(-t * 85) * Math.min(1, t * 6000);
      return 0.35 * (rnd() * 2 - 1) * env + 0.25 * Math.sin(TAU * 1400 * t) * Math.exp(-t * 120);
    }),
    // An upward whoosh for swipes.
    swipe: make(ctx, 0.18, (t, _i, rnd) => {
      const env = Math.sin(Math.PI * Math.min(1, t / 0.18)) ** 2;
      const f = 900 + 2400 * (t / 0.18);
      return 0.25 * env * ((rnd() * 2 - 1) * 0.6 + 0.4 * Math.sin(TAU * f * t));
    }),
    ui: make(ctx, 0.08, (t) => 0.35 * tone([1320, 1980], t, 45) * Math.min(1, t * 3000)),
    back: make(ctx, 0.09, (t) => 0.3 * tone([990, 660], t, 40) * Math.min(1, t * 3000)),
    milestone: make(ctx, 0.55, (t) => {
      // Rising sparkle arpeggio.
      const notes = [1046.5, 1318.5, 1568, 2093];
      const idx = Math.min(notes.length - 1, Math.floor(t / 0.07));
      const local = t - idx * 0.07;
      return 0.22 * Math.sin(TAU * notes[idx] * t) * Math.exp(-local * 12) * Math.exp(-t * 2.5);
    }),
    fanfare: make(ctx, 1.4, (t) => {
      const chord = t < 0.18 ? [523.25, 659.25] : t < 0.36 ? [587.33, 783.99] : [659.25, 783.99, 1046.5];
      const start = t < 0.18 ? 0 : t < 0.36 ? 0.18 : 0.36;
      const local = t - start;
      let v = 0;
      for (const f of chord) v += Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * 2 * f * t);
      return (0.16 * v * Math.min(1, local * 60) * Math.exp(-local * (start === 0.36 ? 2.2 : 6))) / chord.length;
    }),
    count: make(ctx, 0.12, (t) => 0.32 * tone([880], t, 30) * Math.min(1, t * 2000)),
    go: make(ctx, 0.25, (t) => 0.32 * tone([1760, 1318.5], t, 14) * Math.min(1, t * 2000)),
    miss: make(ctx, 0.09, (t) => 0.18 * Math.sin(TAU * (180 - 600 * t) * t) * Math.exp(-t * 40)),
  };
}
