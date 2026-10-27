// Renders the built-in demo song ("Neon Overture") to a 16-bit stereo 44.1 kHz WAV.
//
// Usage, from the pulsefall/ directory:
//   node scripts/render-demo.ts [out.wav]                              (Node >= 22.18 strips types natively)
//   node --experimental-strip-types scripts/render-demo.ts [out.wav]   (Node 22.6 - 22.17)
// The output path defaults to ./demo.wav.
//
// vite-node is not a dependency of this project, and Node alone cannot follow
// the song's extensionless TypeScript imports, so the song module is loaded
// through Vite's own module runner (runnerImport). This file therefore uses
// only erasable TypeScript syntax.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

type DemoModule = typeof import('../src/core/demo/demoSong');

const SAMPLE_RATE = 44100;

function encodeWav16(left: Float32Array, right: Float32Array, sampleRate: number): Uint8Array {
  const frames = left.length;
  const dataBytes = frames * 4;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 2, true); // channels
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true); // byte rate
  view.setUint16(32, 4, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    view.setInt16(offset, Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), true);
    view.setInt16(offset + 2, Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), true);
    offset += 4;
  }
  return bytes;
}

async function main(): Promise<void> {
  const outPath = resolve(process.argv[2] ?? 'demo.wav');
  const songPath = fileURLToPath(new URL('../src/core/demo/demoSong.ts', import.meta.url));
  const { module: song } = await runnerImport<DemoModule>(songPath, { configFile: false, logLevel: 'error' });

  const started = performance.now();
  const render = song.renderDemoSong(SAMPLE_RATE);
  const renderMs = performance.now() - started;

  let peak = 0;
  for (let i = 0; i < render.left.length; i++) {
    peak = Math.max(peak, Math.abs(render.left[i]), Math.abs(render.right[i]));
  }
  writeFileSync(outPath, encodeWav16(render.left, render.right, render.sampleRate));
  console.log(
    `${song.DEMO_TITLE} by ${song.DEMO_ARTIST}: ${(render.durationMs / 1000).toFixed(2)} s at ${render.sampleRate} Hz, ` +
      `rendered in ${renderMs.toFixed(0)} ms, peak ${(20 * Math.log10(peak)).toFixed(2)} dBFS -> ${outPath}`,
  );
}

await main();
