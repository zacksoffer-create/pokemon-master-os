/**
 * Real-input FFT of size N (power of two) computed with one complex FFT of size N/2.
 * Allocation-free after construction; `magnitudes()` writes N/2 + 1 bins.
 */
export class RealFFT {
  readonly size: number;
  private readonly half: number;
  private readonly rev: Uint32Array;
  private readonly cos: Float64Array;
  private readonly sin: Float64Array;
  private readonly postCos: Float64Array;
  private readonly postSin: Float64Array;
  private readonly re: Float64Array;
  private readonly im: Float64Array;

  constructor(size: number) {
    if (size < 4 || (size & (size - 1)) !== 0) throw new Error('FFT size must be a power of two >= 4');
    this.size = size;
    const m = size >> 1;
    this.half = m;
    this.re = new Float64Array(m);
    this.im = new Float64Array(m);
    this.rev = new Uint32Array(m);
    const bits = Math.log2(m);
    for (let i = 0; i < m; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
    this.cos = new Float64Array(m >> 1);
    this.sin = new Float64Array(m >> 1);
    for (let i = 0; i < m >> 1; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / m);
      this.sin[i] = -Math.sin((2 * Math.PI * i) / m);
    }
    this.postCos = new Float64Array(m + 1);
    this.postSin = new Float64Array(m + 1);
    for (let k = 0; k <= m; k++) {
      this.postCos[k] = Math.cos((2 * Math.PI * k) / size);
      this.postSin[k] = -Math.sin((2 * Math.PI * k) / size);
    }
  }

  /** input: `size` real samples (already windowed). out: size/2 + 1 magnitudes. */
  magnitudes(input: ArrayLike<number>, out: Float32Array): void {
    const m = this.half;
    const re = this.re;
    const im = this.im;
    const rev = this.rev;
    for (let i = 0; i < m; i++) {
      const j = rev[i];
      re[j] = input[2 * i];
      im[j] = input[2 * i + 1];
    }
    // Iterative radix-2 butterflies.
    for (let len = 2; len <= m; len <<= 1) {
      const halfLen = len >> 1;
      const step = m / len;
      for (let i = 0; i < m; i += len) {
        for (let k = 0; k < halfLen; k++) {
          const wr = this.cos[k * step];
          const wi = this.sin[k * step];
          const a = i + k;
          const b = a + halfLen;
          const tr = re[b] * wr - im[b] * wi;
          const ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }
    // Split the packed spectrum into the spectrum of the real signal.
    for (let k = 0; k <= m; k++) {
      const k1 = k === m ? 0 : k;
      const k2 = (m - k) % m;
      const ar = re[k1];
      const ai = im[k1];
      const br = re[k2];
      const bi = -im[k2];
      const er = 0.5 * (ar + br);
      const ei = 0.5 * (ai + bi);
      // (a - b) / (2i)
      const or = 0.5 * (ai - bi);
      const oi = -0.5 * (ar - br);
      const c = this.postCos[k];
      const s = this.postSin[k];
      const xr = er + or * c - oi * s;
      const xi = ei + or * s + oi * c;
      out[k] = Math.sqrt(xr * xr + xi * xi);
    }
  }
}

export function hannWindow(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
}
