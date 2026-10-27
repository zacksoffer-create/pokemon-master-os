import { describe, expect, it } from 'vitest';
import { RealFFT } from '../../src/core/analysis/fft';

describe('RealFFT', () => {
  it('matches a naive DFT', () => {
    for (const n of [8, 64, 1024]) {
      const x = Array.from({ length: n }, (_, i) => Math.sin(i * 0.37) + 0.5 * Math.cos(i * 1.91) + (i % 7) * 0.01);
      const out = new Float32Array(n / 2 + 1);
      new RealFFT(n).magnitudes(x, out);
      for (let k = 0; k <= n / 2; k++) {
        let re = 0;
        let im = 0;
        for (let t = 0; t < n; t++) {
          re += x[t] * Math.cos((2 * Math.PI * k * t) / n);
          im -= x[t] * Math.sin((2 * Math.PI * k * t) / n);
        }
        expect(out[k]).toBeCloseTo(Math.hypot(re, im), 3);
      }
    }
  });
});
