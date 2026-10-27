// Pulsefall demo synth: a tiny, deterministic DSP toolkit in plain TypeScript.
//
// No Web Audio: everything renders into Float32Arrays so the demo song is
// bit-identical in Node tests and in the browser. Conventions:
//   - oscillator phases are in cycles [0, 1), not radians;
//   - voices write (not add) `n` samples into a scratch buffer and return `n`;
//     the caller mixes the scratch into the song at the event's sample index;
//   - all noise comes from seeded mulberry32 streams, never Math.random.

export const TWO_PI = Math.PI * 2;

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function centsToRatio(cents: number): number {
  return Math.pow(2, cents / 1200);
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------

/** mulberry32 PRNG with explicit state, so hot loops call a monomorphic method instead of a closure. */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Uniform in [0, 1). */
  float(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), this.state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform in [-1, 1): white noise. */
  bipolar(): number {
    return this.float() * 2 - 1;
  }
}

/** Classic mulberry32 as a function, for callers outside hot loops. */
export function mulberry32(seed: number): () => number {
  const rng = new Rng(seed);
  return () => rng.float();
}

/**
 * White noise of fixed variance spreads its power over 0..sr/2, so filtered
 * noise gets quieter as the sample rate rises. Scaling by this keeps the
 * in-band level (and the mix) the same at 22.05, 44.1 and 48 kHz.
 */
export function noiseScale(sampleRate: number): number {
  return Math.sqrt(sampleRate / 44100);
}

/** Small integer hash so per-event seeds are well spread. */
export function hashSeed(a: number, b = 0): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  return h | 0;
}

// ---------------------------------------------------------------------------
// Oscillators (phase in cycles)
// ---------------------------------------------------------------------------

/**
 * Polynomial band-limited step residual. Subtracting it around each
 * discontinuity removes most of the aliasing of naive saw/square waves.
 */
export function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

export function sawBlep(phase: number, dt: number): number {
  return 2 * phase - 1 - polyBlep(phase, dt);
}

export function squareBlep(phase: number, dt: number): number {
  let p2 = phase + 0.5;
  if (p2 >= 1) p2 -= 1;
  return (phase < 0.5 ? 1 : -1) + polyBlep(phase, dt) - polyBlep(p2, dt);
}

export function triangle(phase: number): number {
  return phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase;
}

export function sine(phase: number): number {
  return Math.sin(TWO_PI * phase);
}

// ---------------------------------------------------------------------------
// Envelopes
// ---------------------------------------------------------------------------

/** Per-sample multiplier giving exp(-t / timeConstant). */
export function decayCoef(timeConstantSec: number, sampleRate: number): number {
  return Math.exp(-1 / (Math.max(1e-5, timeConstantSec) * sampleRate));
}

/**
 * ADSR value at `t` seconds after note-on for a note gated for `gate` seconds.
 * Linear attack, linear decay to sustain, quadratic (natural-sounding) release.
 */
export function adsr(t: number, a: number, d: number, s: number, r: number, gate: number): number {
  if (t < 0) return 0;
  const g = t < gate ? t : gate;
  let level: number;
  if (g < a) level = g / a;
  else if (g < a + d) level = 1 - (1 - s) * ((g - a) / d);
  else level = s;
  if (t < gate) return level;
  const x = (t - gate) / r;
  if (x >= 1) return 0;
  const k = 1 - x;
  return level * k * k;
}

/** Short linear fade-out factor for the last `fadeSamples` of an `n`-sample voice. */
function tailFade(i: number, n: number, fadeSamples: number): number {
  const left = n - i;
  return left < fadeSamples ? left / fadeSamples : 1;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/**
 * Topology-preserving-transform state variable filter (Zavalishin / Simper).
 * Stable under fast cutoff modulation; one tick yields LP, BP and HP at once.
 */
export class Svf {
  lp = 0;
  bp = 0;
  hp = 0;
  private ic1 = 0;
  private ic2 = 0;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;
  private k = 1;
  private readonly sampleRate: number;

  constructor(sampleRate: number, cutoffHz = 1000, q = 0.707) {
    this.sampleRate = sampleRate;
    this.set(cutoffHz, q);
  }

  set(cutoffHz: number, q: number): void {
    const fc = clamp(cutoffHz, 10, this.sampleRate * 0.45);
    const g = Math.tan((Math.PI * fc) / this.sampleRate);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }

  tick(v0: number): void {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.lp = v2;
    this.bp = v1;
    this.hp = v0 - this.k * v1 - v2;
  }

  lowpass(x: number): number {
    this.tick(x);
    return this.lp;
  }

  highpass(x: number): number {
    this.tick(x);
    return this.hp;
  }

  bandpass(x: number): number {
    this.tick(x);
    return this.bp;
  }
}

/** One-pole smoother; `highpass` returns the input minus the lowpassed signal. */
export class OnePole {
  private z = 0;
  private a = 1;

  constructor(sampleRate: number, cutoffHz: number) {
    this.setCutoff(cutoffHz, sampleRate);
  }

  setCutoff(cutoffHz: number, sampleRate: number): void {
    this.a = 1 - Math.exp((-TWO_PI * cutoffHz) / sampleRate);
  }

  lowpass(x: number): number {
    this.z += this.a * (x - this.z);
    return this.z;
  }

  highpass(x: number): number {
    this.z += this.a * (x - this.z);
    return x - this.z;
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Pade tanh approximation, exact at 0 and +/-3 where it meets the clamp with
 * zero slope (so it stays smooth). ~4x cheaper than Math.tanh in hot loops.
 */
export function fastTanh(x: number): number {
  if (x >= 3) return 1;
  if (x <= -3) return -1;
  const x2 = x * x;
  return (x * (27 + x2)) / (27 + 9 * x2);
}

/** Linear below `knee`, then a tanh curve that approaches (never reaches) `ceiling`. */
export function softClip(x: number, knee: number, ceiling: number): number {
  const ax = x < 0 ? -x : x;
  if (ax <= knee) return x;
  const room = ceiling - knee;
  const y = knee + room * Math.tanh((ax - knee) / room);
  return x < 0 ? -y : y;
}

export interface PanGains {
  left: number;
  right: number;
}

/** Equal-power pan law, pan in [-1, 1]; centre gives 0.707 per side. */
export function panGains(pan: number): PanGains {
  const a = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  return { left: Math.cos(a), right: Math.sin(a) };
}

/**
 * Adds one sidechain "pump" into `env` (0 = untouched, 1 = fully ducked),
 * max-combined with what is already there: a few-ms dip followed by a
 * quadratic recovery, the classic French-house kick duck.
 */
export function addSidechainDuck(
  env: Float32Array,
  start: number,
  amount: number,
  attackSamples: number,
  releaseSamples: number,
): void {
  const total = attackSamples + releaseSamples;
  const end = Math.min(env.length, start + total);
  for (let j = Math.max(0, start); j < end; j++) {
    const i = j - start;
    let v: number;
    if (i < attackSamples) {
      v = (amount * (i + 1)) / attackSamples;
    } else {
      const x = 1 - (i - attackSamples) / releaseSamples;
      v = amount * x * x;
    }
    if (v > env[j]) env[j] = v;
  }
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

/** Stereo ping-pong delay fed by a mono send; damped, low-cut feedback path. */
export class PingPongDelay {
  private readonly bufL: Float32Array;
  private readonly bufR: Float32Array;
  private readonly length: number;
  private readonly feedback: number;
  private readonly damp: OnePole;
  private readonly lowCut: OnePole;

  constructor(sampleRate: number, delaySec: number, feedback: number, dampHz = 3500, lowCutHz = 350) {
    this.length = Math.max(1, Math.round(delaySec * sampleRate));
    this.bufL = new Float32Array(this.length);
    this.bufR = new Float32Array(this.length);
    this.feedback = feedback;
    this.damp = new OnePole(sampleRate, dampHz);
    this.lowCut = new OnePole(sampleRate, lowCutHz);
  }

  /** Adds `wet` x the echoes of `send` into outL/outR. */
  process(send: Float32Array, outL: Float32Array, outR: Float32Array, wet: number): void {
    const { bufL, bufR, length, feedback, damp, lowCut } = this;
    let idx = 0;
    const n = send.length;
    for (let i = 0; i < n; i++) {
      const echoL = bufL[idx];
      const echoR = bufR[idx];
      const input = lowCut.highpass(send[i]);
      // Input enters on the left only; each repeat crosses sides.
      bufL[idx] = input + damp.lowpass(echoR) * feedback;
      bufR[idx] = echoL * feedback;
      outL[i] += echoL * wet;
      outR[i] += echoR * wet;
      if (++idx === length) idx = 0;
    }
  }
}

const COMB_TUNING_44K = [1116, 1188, 1277, 1356];
const ALLPASS_TUNING_44K = [556, 441];
const STEREO_SPREAD_44K = 23;

/**
 * Freeverb-lite: four damped feedback combs in parallel (shared by both
 * channels) followed by two allpass diffusers per channel, the right side
 * using slightly longer allpasses for decorrelation.
 */
export class Reverb {
  private readonly combs: Float32Array[];
  private readonly combIdx: Int32Array;
  private readonly combStore: Float64Array;
  private readonly apL: Float32Array[];
  private readonly apR: Float32Array[];
  private readonly apIdxL: Int32Array;
  private readonly apIdxR: Int32Array;
  private readonly preDelay: Float32Array;
  private readonly feedback: number;
  private readonly damping: number;
  private readonly inputHp: OnePole;

  constructor(sampleRate: number, roomSize = 0.8, damping = 0.35, preDelaySec = 0.018, lowCutHz = 280) {
    const scale = sampleRate / 44100;
    this.combs = COMB_TUNING_44K.map((len) => new Float32Array(Math.max(1, Math.round(len * scale))));
    this.combIdx = new Int32Array(this.combs.length);
    this.combStore = new Float64Array(this.combs.length);
    this.apL = ALLPASS_TUNING_44K.map((len) => new Float32Array(Math.max(1, Math.round(len * scale))));
    this.apR = ALLPASS_TUNING_44K.map(
      (len) => new Float32Array(Math.max(1, Math.round((len + STEREO_SPREAD_44K) * scale))),
    );
    this.apIdxL = new Int32Array(this.apL.length);
    this.apIdxR = new Int32Array(this.apR.length);
    this.preDelay = new Float32Array(Math.max(1, Math.round(preDelaySec * sampleRate)));
    this.feedback = roomSize;
    this.damping = damping;
    this.inputHp = new OnePole(sampleRate, lowCutHz);
  }

  /** Adds `wet` x the reverberated `send` into outL/outR. */
  process(send: Float32Array, outL: Float32Array, outR: Float32Array, wet: number): void {
    const { combs, combIdx, combStore, apL, apR, apIdxL, apIdxR, preDelay, feedback, damping, inputHp } = this;
    const c0 = combs[0];
    const c1 = combs[1];
    const c2 = combs[2];
    const c3 = combs[3];
    const a0L = apL[0];
    const a1L = apL[1];
    const a0R = apR[0];
    const a1R = apR[1];
    let i0 = combIdx[0];
    let i1 = combIdx[1];
    let i2 = combIdx[2];
    let i3 = combIdx[3];
    let s0 = combStore[0];
    let s1 = combStore[1];
    let s2 = combStore[2];
    let s3 = combStore[3];
    let j0L = apIdxL[0];
    let j1L = apIdxL[1];
    let j0R = apIdxR[0];
    let j1R = apIdxR[1];
    let pd = 0;
    const pdLen = preDelay.length;
    const undamp = 1 - damping;
    const n = send.length;
    for (let i = 0; i < n; i++) {
      const delayed = preDelay[pd];
      preDelay[pd] = inputHp.highpass(send[i]) * 0.25;
      if (++pd === pdLen) pd = 0;

      // Lowpass-feedback combs (the damping is what makes the tail darken).
      let y = c0[i0];
      s0 = y * undamp + s0 * damping;
      c0[i0] = delayed + s0 * feedback;
      if (++i0 === c0.length) i0 = 0;
      let acc = y;
      y = c1[i1];
      s1 = y * undamp + s1 * damping;
      c1[i1] = delayed + s1 * feedback;
      if (++i1 === c1.length) i1 = 0;
      acc += y;
      y = c2[i2];
      s2 = y * undamp + s2 * damping;
      c2[i2] = delayed + s2 * feedback;
      if (++i2 === c2.length) i2 = 0;
      acc += y;
      y = c3[i3];
      s3 = y * undamp + s3 * damping;
      c3[i3] = delayed + s3 * feedback;
      if (++i3 === c3.length) i3 = 0;
      acc += y;

      // Schroeder allpasses, gain 0.5.
      let l = acc;
      let b = a0L[j0L];
      a0L[j0L] = l + b * 0.5;
      l = b - l;
      if (++j0L === a0L.length) j0L = 0;
      b = a1L[j1L];
      a1L[j1L] = l + b * 0.5;
      l = b - l;
      if (++j1L === a1L.length) j1L = 0;

      let r = acc;
      b = a0R[j0R];
      a0R[j0R] = r + b * 0.5;
      r = b - r;
      if (++j0R === a0R.length) j0R = 0;
      b = a1R[j1R];
      a1R[j1R] = r + b * 0.5;
      r = b - r;
      if (++j1R === a1R.length) j1R = 0;

      outL[i] += l * wet;
      outR[i] += r * wet;
    }
    combIdx[0] = i0;
    combIdx[1] = i1;
    combIdx[2] = i2;
    combIdx[3] = i3;
    combStore[0] = s0;
    combStore[1] = s1;
    combStore[2] = s2;
    combStore[3] = s3;
    apIdxL[0] = j0L;
    apIdxL[1] = j1L;
    apIdxR[0] = j0R;
    apIdxR[1] = j1R;
  }
}

// ---------------------------------------------------------------------------
// Drum voices. Each writes `vel`-scaled mono (or L/R) samples from index 0
// and returns how many it wrote; `lengthSec` caps the sound with a short fade.
// ---------------------------------------------------------------------------

function voiceLength(out: Float32Array, lengthSec: number, sampleRate: number): number {
  return Math.min(out.length, Math.max(1, Math.ceil(lengthSec * sampleRate)));
}

/** Sine kick: pitch sweeps ~150 -> 48 Hz, tanh-driven body, highpassed-noise beater click. */
export function kickVoice(out: Float32Array, sr: number, vel: number, lengthSec: number, seed: number): number {
  const n = voiceLength(out, lengthSec, sr);
  const rng = new Rng(seed);
  const clickHp = new OnePole(sr, 2200);
  const pitchK = decayCoef(0.034, sr);
  const ampK = decayCoef(0.17, sr);
  const clickK = decayCoef(0.0016, sr);
  const fade = Math.round(0.05 * sr);
  const drive = 2.4;
  const norm = 1 / fastTanh(drive);
  const ns = noiseScale(sr);
  let pitchEnv = 1;
  let amp = 1;
  let click = 1;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const f = 48 + 104 * pitchEnv;
    const body = fastTanh(drive * amp * Math.sin(TWO_PI * phase)) * norm;
    const c = clickHp.highpass(rng.bipolar() * ns) * click;
    out[i] = vel * (0.9 * body + 0.45 * c) * tailFade(i, n, fade);
    phase += f / sr;
    if (phase >= 1) phase -= 1;
    pitchEnv *= pitchK;
    amp *= ampK;
    click *= clickK;
  }
  return n;
}

/**
 * Snare: two pitch-dropping sines for the shell plus band-limited noise for
 * the wires. `tone` (0..1) opens the wires' lowpass, used by the build roll.
 */
export function snareVoice(
  out: Float32Array,
  sr: number,
  vel: number,
  lengthSec: number,
  tone: number,
  seed: number,
): number {
  const n = voiceLength(out, lengthSec, sr);
  const rng = new Rng(seed);
  const hp = new Svf(sr, 1400, 0.7);
  const lp = new OnePole(sr, 4500 + 6000 * tone);
  const noiseTau = clamp(lengthSec * 0.28, 0.025, 0.09);
  const noiseK = decayCoef(noiseTau, sr);
  const bodyK = decayCoef(0.045, sr);
  const pitchK = decayCoef(0.012, sr);
  const fade = Math.min(Math.round(0.012 * sr), n >> 1);
  const ns = noiseScale(sr);
  let pA = 0;
  let pB = 0;
  let noiseEnv = 1;
  let bodyEnv = 1;
  let pitchEnv = 1;
  for (let i = 0; i < n; i++) {
    const bend = 1 + 0.35 * pitchEnv;
    pA += (185 * bend) / sr;
    if (pA >= 1) pA -= 1;
    pB += (330 * bend) / sr;
    if (pB >= 1) pB -= 1;
    const body = (Math.sin(TWO_PI * pA) + 0.6 * Math.sin(TWO_PI * pB)) * bodyEnv;
    const wires = lp.lowpass(hp.highpass(rng.bipolar() * ns)) * noiseEnv;
    out[i] = vel * (0.42 * body + 1.05 * wires) * tailFade(i, n, fade);
    noiseEnv *= noiseK;
    bodyEnv *= bodyK;
    pitchEnv *= pitchK;
  }
  return n;
}

/** Clap: three tight bandpassed-noise bursts ~10 ms apart, then a longer tail. Stereo via two noise seeds. */
export function clapVoice(
  outL: Float32Array,
  outR: Float32Array,
  sr: number,
  vel: number,
  lengthSec: number,
  seed: number,
): number {
  const n = Math.min(voiceLength(outL, lengthSec, sr), outR.length);
  const rngL = new Rng(seed);
  const rngR = new Rng(seed ^ 0x5bd1e995);
  const bpL = new Svf(sr, 1250, 1.4);
  const bpR = new Svf(sr, 1320, 1.4);
  const hpL = new OnePole(sr, 600);
  const hpR = new OnePole(sr, 600);
  const burstGap = Math.round(0.0105 * sr);
  const tailStart = burstGap * 3;
  const burstK = decayCoef(0.0042, sr);
  const tailK = decayCoef(0.1, sr);
  const fade = Math.round(0.03 * sr);
  const ns = noiseScale(sr);
  let burst = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) {
    if (i === 0) burst = 1;
    else if (i === burstGap) burst = 0.85;
    else if (i === burstGap * 2) burst = 0.95;
    if (i === tailStart) tail = 1;
    const env = (burst + tail * 0.9) * tailFade(i, n, fade);
    outL[i] = vel * 1.6 * env * hpL.highpass(bpL.bandpass(rngL.bipolar() * ns));
    outR[i] = vel * 1.6 * env * hpR.highpass(bpR.bandpass(rngR.bipolar() * ns));
    burst *= burstK;
    tail *= tailK;
  }
  return n;
}

// Six detuned square partials (TR-808 style ratios) give hats their metallic ring.
const METAL_HZ = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0];

/** Closed/open hi-hat: highpassed noise plus a metallic square cluster. */
export function hatVoice(
  out: Float32Array,
  sr: number,
  vel: number,
  lengthSec: number,
  open: boolean,
  seed: number,
): number {
  const n = voiceLength(out, lengthSec, sr);
  const rng = new Rng(seed);
  const hp = new Svf(sr, 7200, 0.9);
  const air = new OnePole(sr, 4000);
  const ampK = decayCoef(open ? 0.13 : 0.017, sr);
  const fade = Math.round((open ? 0.04 : 0.008) * sr);
  const m0 = (METAL_HZ[0] * 1.7) / sr;
  const m1 = (METAL_HZ[1] * 1.7) / sr;
  const m2 = (METAL_HZ[2] * 1.7) / sr;
  const m3 = (METAL_HZ[3] * 1.7) / sr;
  const m4 = (METAL_HZ[4] * 1.7) / sr;
  const m5 = (METAL_HZ[5] * 1.7) / sr;
  let p0 = 0.1;
  let p1 = 0.37;
  let p2 = 0.61;
  let p3 = 0.83;
  let p4 = 0.29;
  let p5 = 0.53;
  const ns = noiseScale(sr);
  let amp = 1;
  for (let i = 0; i < n; i++) {
    const metal =
      (p0 < 0.5 ? 1 : -1) +
      (p1 < 0.5 ? 1 : -1) +
      (p2 < 0.5 ? 1 : -1) +
      (p3 < 0.5 ? 1 : -1) +
      (p4 < 0.5 ? 1 : -1) +
      (p5 < 0.5 ? 1 : -1);
    p0 += m0;
    if (p0 >= 1) p0 -= 1;
    p1 += m1;
    if (p1 >= 1) p1 -= 1;
    p2 += m2;
    if (p2 >= 1) p2 -= 1;
    p3 += m3;
    if (p3 >= 1) p3 -= 1;
    p4 += m4;
    if (p4 >= 1) p4 -= 1;
    p5 += m5;
    if (p5 >= 1) p5 -= 1;
    const src = 0.07 * metal + 0.85 * ns * rng.bipolar();
    const y = air.highpass(hp.highpass(src));
    out[i] = vel * 1.5 * y * amp * tailFade(i, n, fade);
    amp *= ampK;
  }
  return n;
}

/** Crash cymbal: long, bright, stereo noise with a little metallic shimmer. */
export function crashVoice(
  outL: Float32Array,
  outR: Float32Array,
  sr: number,
  vel: number,
  lengthSec: number,
  seed: number,
): number {
  const n = Math.min(voiceLength(outL, lengthSec, sr), outR.length);
  const rngL = new Rng(seed);
  const rngR = new Rng(seed ^ 0x27d4eb2d);
  const hpL = new Svf(sr, 3800, 0.8);
  const hpR = new Svf(sr, 4100, 0.8);
  const lpL = new OnePole(sr, 12000);
  const lpR = new OnePole(sr, 12000);
  const ampK = decayCoef(0.62, sr);
  const flashK = decayCoef(0.03, sr);
  const fade = Math.round(0.25 * sr);
  const dm0 = (METAL_HZ[2] * 5.1) / sr;
  const dm1 = (METAL_HZ[5] * 4.3) / sr;
  let pm0 = 0;
  let pm1 = 0.5;
  const ns = noiseScale(sr);
  let amp = 1;
  let flash = 1;
  for (let i = 0; i < n; i++) {
    const metal = 0.12 * ((pm0 < 0.5 ? 1 : -1) + (pm1 < 0.5 ? 1 : -1));
    pm0 += dm0;
    if (pm0 >= 1) pm0 -= 1;
    pm1 += dm1;
    if (pm1 >= 1) pm1 -= 1;
    const env = vel * (amp * 0.8 + flash * 0.5) * tailFade(i, n, fade);
    outL[i] = env * lpL.lowpass(hpL.highpass(rngL.bipolar() * ns + metal));
    outR[i] = env * lpR.lowpass(hpR.highpass(rngR.bipolar() * ns - metal));
    amp *= ampK;
    flash *= flashK;
  }
  return n;
}

/** Fill: a downward "tom zap" (sine sweep ~300 -> 75 Hz) with a noisy stick attack. */
export function fillVoice(out: Float32Array, sr: number, vel: number, lengthSec: number, seed: number): number {
  const n = voiceLength(out, lengthSec, sr);
  const rng = new Rng(seed);
  const stick = new Svf(sr, 2200, 1.2);
  const pitchK = decayCoef(0.11, sr);
  const ampK = decayCoef(0.2, sr);
  const stickK = decayCoef(0.012, sr);
  const fade = Math.round(0.03 * sr);
  const ns = noiseScale(sr);
  let pitchEnv = 1;
  let amp = 1;
  let stickEnv = 1;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const f = 75 + 235 * pitchEnv;
    phase += f / sr;
    if (phase >= 1) phase -= 1;
    const tone = Math.sin(TWO_PI * phase) + 0.25 * triangle(phase);
    const hit = stick.bandpass(rng.bipolar() * ns) * stickEnv;
    out[i] = vel * (0.85 * fastTanh(1.5 * tone * amp) + 0.9 * hit) * tailFade(i, n, fade);
    pitchEnv *= pitchK;
    amp *= ampK;
    stickEnv *= stickK;
  }
  return n;
}

/** Riser: stereo noise through a resonant bandpass sweeping up exponentially, swelling in level. */
export function riserVoice(
  outL: Float32Array,
  outR: Float32Array,
  sr: number,
  vel: number,
  lengthSec: number,
  seed: number,
): number {
  const n = Math.min(voiceLength(outL, lengthSec, sr), outR.length);
  const rngL = new Rng(seed);
  const rngR = new Rng(seed ^ 0x165667b1);
  const bpL = new Svf(sr, 300, 1.2);
  const bpR = new Svf(sr, 300, 1.2);
  const fLo = 280;
  const fHi = Math.min(9500, sr * 0.42);
  const fade = Math.round(0.03 * sr);
  const block = 32;
  const ns = noiseScale(sr);
  let level = 0;
  for (let i = 0; i < n; i++) {
    if (i % block === 0) {
      const x = i / n;
      const fc = fLo * Math.pow(fHi / fLo, x * x * (1.4 - 0.4 * x));
      const q = 1.2 + 2.5 * x;
      bpL.set(fc, q);
      bpR.set(fc * 1.04, q);
      level = 0.08 + 0.92 * x * x;
    }
    const env = vel * level * tailFade(i, n, fade);
    outL[i] = env * 2.2 * bpL.bandpass(rngL.bipolar() * ns);
    outR[i] = env * 2.2 * bpR.bandpass(rngR.bipolar() * ns);
  }
  return n;
}

// ---------------------------------------------------------------------------
// Melodic voices
// ---------------------------------------------------------------------------

/** Mono synth bass: saw through an enveloped resonant lowpass, plus a clean sine sub, gently saturated. */
export function bassVoice(out: Float32Array, sr: number, freq: number, gateSec: number, vel: number): number {
  const release = 0.03;
  const n = voiceLength(out, gateSec + release, sr);
  const lp = new Svf(sr, 400, 1.5);
  const dt = freq / sr;
  const filterK = decayCoef(0.085, sr);
  const attack = Math.max(1, Math.round(0.003 * sr));
  const gate = Math.round(gateSec * sr);
  const rel = Math.max(1, n - gate);
  const block = 32;
  let phase = 0;
  let fenv = 1;
  for (let i = 0; i < n; i++) {
    if (i % block === 0) lp.set(90 + freq * 1.6 + 1900 * fenv * (0.4 + 0.6 * vel), 1.5);
    const saw = lp.lowpass(sawBlep(phase, dt));
    const sub = Math.sin(TWO_PI * phase);
    let amp = i < attack ? i / attack : 1;
    if (i >= gate) {
      const k = 1 - (i - gate) / rel;
      amp *= k * k;
    }
    out[i] = vel * amp * fastTanh(1.3 * (0.8 * saw + 0.75 * sub));
    phase += dt;
    if (phase >= 1) phase -= 1;
    fenv *= filterK;
  }
  return n;
}

/** Bright plucked arp: two detuned saws and an octave square through a fast-closing lowpass. */
export function pluckVoice(
  out: Float32Array,
  sr: number,
  freq: number,
  gateSec: number,
  vel: number,
  brightness: number,
): number {
  const release = 0.06;
  const n = voiceLength(out, gateSec + release, sr);
  const lp = new Svf(sr, 2000, 1.4);
  const dtA = (freq * centsToRatio(-7)) / sr;
  const dtB = (freq * centsToRatio(7)) / sr;
  const dtC = (freq * 2) / sr;
  const ampK = decayCoef(0.2, sr);
  const filterK = decayCoef(0.075, sr);
  const attack = Math.max(1, Math.round(0.0015 * sr));
  const gate = Math.round(gateSec * sr);
  const rel = Math.max(1, n - gate);
  const sweep = 700 + 7000 * brightness;
  const block = 16;
  let pA = 0;
  let pB = 0.33;
  let pC = 0.5;
  let amp = 1;
  let fenv = 1;
  for (let i = 0; i < n; i++) {
    if (i % block === 0) lp.set(300 + freq * 1.2 + sweep * fenv, 1.4);
    const osc = sawBlep(pA, dtA) + sawBlep(pB, dtB) + 0.35 * squareBlep(pC, dtC);
    let env = amp;
    if (i < attack) env *= i / attack;
    if (i >= gate) env *= 1 - (i - gate) / rel;
    out[i] = vel * 0.5 * env * lp.lowpass(osc);
    pA += dtA;
    if (pA >= 1) pA -= 1;
    pB += dtB;
    if (pB >= 1) pB -= 1;
    pC += dtC;
    if (pC >= 1) pC -= 1;
    amp *= ampK;
    fenv *= filterK;
  }
  return n;
}

export interface PadChordParams {
  /** Frequencies (Hz) of the chord tones and their velocities (0..1). */
  freqs: readonly number[];
  vels: readonly number[];
  gateSec: number;
  attackSec: number;
  releaseSec: number;
  /** Lowpass cutoff at note-on and at note-off (exponential glide between). */
  cutoffFrom: number;
  cutoffTo: number;
  seed: number;
}

/**
 * Warm stereo pad: every tone is three detuned saws (left, centre, right).
 * Tones sharing onset, gate and filter automation are summed before a single
 * gliding lowpass per side, which sounds the same as filtering each tone (the
 * filter is linear) at a fraction of the cost.
 */
export function padChordVoice(outL: Float32Array, outR: Float32Array, sr: number, p: PadChordParams): number {
  const n = Math.min(voiceLength(outL, p.gateSec + p.releaseSec, sr), outR.length);
  const tones = p.freqs.length;
  const rng = new Rng(p.seed);
  const lpL = new Svf(sr, p.cutoffFrom, 0.9);
  const lpR = new Svf(sr, p.cutoffFrom, 0.9);
  const dtL = new Float64Array(tones);
  const dtC = new Float64Array(tones);
  const dtR = new Float64Array(tones);
  const phL = new Float64Array(tones);
  const phC = new Float64Array(tones);
  const phR = new Float64Array(tones);
  const amp = new Float64Array(tones);
  const detuneDown = centsToRatio(-12);
  const detuneUp = centsToRatio(11);
  for (let v = 0; v < tones; v++) {
    dtL[v] = (p.freqs[v] * detuneDown) / sr;
    dtC[v] = p.freqs[v] / sr;
    dtR[v] = (p.freqs[v] * detuneUp) / sr;
    // Random start phases keep the detuned saws from starting in a flanged lump.
    phL[v] = rng.float();
    phC[v] = rng.float();
    phR[v] = rng.float();
    amp[v] = p.vels[v];
  }
  const gate = Math.round(p.gateSec * sr);
  const attack = Math.max(1, Math.round(p.attackSec * sr));
  const rel = Math.max(1, n - gate);
  const ratio = p.cutoffTo / p.cutoffFrom;
  const block = 64;
  for (let i = 0; i < n; i++) {
    if (i % block === 0) {
      const x = i < gate ? i / gate : 1;
      const fc = p.cutoffFrom * Math.pow(ratio, x);
      lpL.set(fc, 0.9);
      lpR.set(fc, 0.9);
    }
    let l = 0;
    let r = 0;
    for (let v = 0; v < tones; v++) {
      const c = 0.6 * sawBlep(phC[v], dtC[v]);
      l += amp[v] * (sawBlep(phL[v], dtL[v]) + c);
      r += amp[v] * (sawBlep(phR[v], dtR[v]) + c);
      phL[v] += dtL[v];
      if (phL[v] >= 1) phL[v] -= 1;
      phC[v] += dtC[v];
      if (phC[v] >= 1) phC[v] -= 1;
      phR[v] += dtR[v];
      if (phR[v] >= 1) phR[v] -= 1;
    }
    let env = i < attack ? i / attack : 1;
    if (i >= gate) {
      const k = 1 - (i - gate) / rel;
      env *= k * k;
    }
    outL[i] = env * lpL.lowpass(l);
    outR[i] = env * lpR.lowpass(r);
  }
  return n;
}

const LEAD_DETUNE_CENTS = [-16, -7, 0, 7, 16];
// Left/right weight of each supersaw voice (outer voices hard-ish to the sides).
const LEAD_LEFT = [1, 0.8, 0.7, 0.35, 0.1];
const LEAD_RIGHT = [0.1, 0.35, 0.7, 0.8, 1];

/** Supersaw lead: five detuned saws spread in stereo, a sub-octave square, filter envelope and delayed vibrato. */
export function leadVoice(
  outL: Float32Array,
  outR: Float32Array,
  sr: number,
  freq: number,
  gateSec: number,
  vel: number,
  seed: number,
): number {
  const release = 0.14;
  const n = Math.min(voiceLength(outL, gateSec + release, sr), outR.length);
  const rng = new Rng(seed);
  const lpL = new Svf(sr, 3000, 1.0);
  const lpR = new Svf(sr, 3000, 1.0);
  const ratios = LEAD_DETUNE_CENTS.map(centsToRatio);
  const ph = new Float64Array(5);
  const baseDt = new Float64Array(5);
  const dt = new Float64Array(5);
  for (let v = 0; v < 5; v++) {
    ph[v] = rng.float();
    baseDt[v] = (freq * ratios[v]) / sr;
    dt[v] = baseDt[v];
  }
  const subBaseDt = (freq * 0.5) / sr;
  let subDt = subBaseDt;
  let subPh = 0;
  const gate = Math.round(gateSec * sr);
  const attack = Math.max(1, Math.round(0.005 * sr));
  const rel = Math.max(1, n - gate);
  const decayK = decayCoef(0.25, sr);
  const filterK = decayCoef(0.32, sr);
  const vibDelay = 0.28 * sr;
  const vibRamp = 0.35 * sr;
  const block = 32;
  let decay = 1;
  let fenv = 1;
  for (let i = 0; i < n; i++) {
    if (i % block === 0) {
      lpL.set(1100 + 2.2 * freq + 4200 * fenv * vel, 1.0);
      lpR.set(1150 + 2.2 * freq + 4200 * fenv * vel, 1.0);
      // Vibrato (up to ~18 cents) fades in on held notes only.
      const depth = i > vibDelay ? Math.min(1, (i - vibDelay) / vibRamp) * 0.0105 : 0;
      const mod = 1 + depth * Math.sin((TWO_PI * 5.3 * i) / sr);
      for (let v = 0; v < 5; v++) dt[v] = baseDt[v] * mod;
      subDt = subBaseDt * mod;
    }
    let l = 0;
    let r = 0;
    for (let v = 0; v < 5; v++) {
      const s = sawBlep(ph[v], dt[v]);
      l += s * LEAD_LEFT[v];
      r += s * LEAD_RIGHT[v];
      ph[v] += dt[v];
      if (ph[v] >= 1) ph[v] -= 1;
    }
    const sub = 0.45 * squareBlep(subPh, subDt);
    subPh += subDt;
    if (subPh >= 1) subPh -= 1;
    let env = i < attack ? i / attack : 1;
    env *= 0.78 + 0.22 * decay;
    if (i >= gate) {
      const k = 1 - (i - gate) / rel;
      env *= k * k;
    }
    const g = vel * env * 0.3;
    outL[i] = g * lpL.lowpass(l + sub);
    outR[i] = g * lpR.lowpass(r + sub);
    decay *= decayK;
    fenv *= filterK;
  }
  return n;
}
