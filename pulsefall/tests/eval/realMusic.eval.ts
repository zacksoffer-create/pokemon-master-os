// Runs the full analysis + chart pipeline on real recordings decoded to raw PCM
// (.eval/pcm/*.f32, mono 22050 Hz float32) and writes diagnostics to .eval/out/.
// Compares against reference beats in .eval/ref/<name>.json when present.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { analyzeAudio } from '../../src/core/analysis/analyze';
import { generateChart } from '../../src/core/chart/generate';
import { CHART_STYLES } from '../../src/core/types';
import { fMeasure } from '../fixtures/synthetic';

const ROOT = new URL('../../.eval/', import.meta.url).pathname;

it('real music', () => {
  const pcmDir = ROOT + 'pcm/';
  if (!existsSync(pcmDir)) return;
  mkdirSync(ROOT + 'out', { recursive: true });
  for (const file of readdirSync(pcmDir).filter((f) => f.endsWith('.f32'))) {
    const name = file.replace(/\.f32$/, '');
    const buf = readFileSync(pcmDir + file);
    const pcm = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    const t0 = performance.now();
    const a = analyzeAudio(Float32Array.from(pcm), 22050);
    const ms = performance.now() - t0;
    let refInfo = '';
    const refPath = ROOT + `ref/${name}.json`;
    if (existsSync(refPath)) {
      const ref = JSON.parse(readFileSync(refPath, 'utf8')) as { tempo: number; beats: number[] };
      const f = fMeasure(a.beats, ref.beats, 70);
      // Allow octave-related answers to be reported separately.
      const half = ref.beats.filter((_, i) => i % 2 === 0);
      const fHalf = Math.max(fMeasure(a.beats, half, 70).f, fMeasure(a.beats, ref.beats.filter((_, i) => i % 2 === 1), 70).f);
      refInfo = ` | ref ${ref.tempo.toFixed(1)} BPM F=${f.f.toFixed(2)} (vs half-ref ${fHalf.toFixed(2)})`;
    }
    console.log(
      `\n${name}\n  ${(a.durationMs / 1000).toFixed(1)}s analyzed in ${ms.toFixed(0)}ms | ${a.tempo.bpm.toFixed(1)} BPM conf ${a.tempo.confidence.toFixed(2)} stable=${a.tempo.stable} beatConf ${a.beatConfidence.toFixed(2)} meter ${a.meter.beatsPerBar} ${a.meter.subdivision}${refInfo}`,
    );
    console.log(`  onsets ${a.onsets.length}, segments: ${a.segments.map((s) => `${(s.startMs / 1000).toFixed(0)}s:${s.intensity.toFixed(2)}/L${s.label}`).join(' ')}`);
    const out: Record<string, unknown> = { name, beats: a.beats, onsets: a.onsets.map((o) => [Math.round(o.t), +o.s.toFixed(2)]), segments: a.segments, fps: a.fps, odf: Array.from(a.odf).map((v) => +v.toFixed(3)), charts: {} };
    for (const style of CHART_STYLES) {
      try {
        const c = generateChart(a, { style, seed: 12345 });
        const m = c.musicality;
        console.log(
          `  ${style.padEnd(9)} ${c.params.mode} notes=${c.stats.noteCount} nps=${c.stats.nps} peak=${c.stats.peakNps} lvl=${c.stats.level} holds=${c.stats.holds} chords=${c.stats.chords} swipes=${c.stats.swipes} align=${m.alignment.toFixed(2)} bal=${m.laneBalance.toFixed(2)} jack=${m.longestJack} fastJ=${m.fastJackRate.toFixed(2)} dens~E=${m.densityFollowsEnergy.toFixed(2)}${c.approximate ? ' APPROX' : ''}`,
        );
        (out.charts as Record<string, unknown>)[style] = c.notes;
      } catch (e) {
        console.log(`  ${style.padEnd(9)} FAILED: ${(e as Error).message}`);
      }
    }
    writeFileSync(ROOT + `out/${name}.json`, JSON.stringify(out));
  }
});
