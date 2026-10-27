import type { AudioEngine } from '../audio/audioEngine';
import { buildAutoCharts, previewStart, summarize } from '../chart/build';
import { chartStats } from '../chart/stats';
import { analyzeDemoInWorker, renderDemoInWorker } from '../import/analysisClient';
import type { WorkerStage } from '../import/workerProtocol';
import { chartId, library, normalizeSong } from '../storage/library';
import { ANALYSIS_VERSION, GENERATOR_VERSION, type Chart, type Settings, type SongRecord } from '../types';
import { hashString } from '../util';
import { analyzeAudio } from '../analysis/analyze';
import { buildDemoChart } from './demoChart';
import { DEMO_ARTIST, DEMO_TITLE, demoDurationMs, renderDemoSong } from './demoSong';

export const DEMO_ID = 'demo-neon-overture';

/**
 * Make sure the built-in demo is in the library: its auto charts come from running the
 * real analysis pipeline on the synthesized track, plus a hand-authored showcase chart.
 * Stats (plays, bests) survive regeneration after app updates.
 */
export async function ensureDemo(settings: Settings, onProgress: (stage: WorkerStage, fraction: number) => void = () => {}): Promise<SongRecord> {
  const existing = await library.getSong(DEMO_ID);
  const charts = existing ? await library.getCharts(DEMO_ID) : [];
  const current =
    existing &&
    existing.analysisVersion === ANALYSIS_VERSION &&
    charts.some((c) => c.source === 'auto' && c.generatorVersion === GENERATOR_VERSION) &&
    charts.some((c) => c.source === 'authored');
  if (current) return existing!;

  const job = { songId: DEMO_ID, seed: hashString(DEMO_ID), advancedLanes: settings.advancedLanes, overrides: existing?.overrides };
  const { analysis, output } = await analyzeDemoInWorker(job, onProgress, () => {
    const r = renderDemoSong(22050);
    const mono = new Float32Array(r.left.length);
    for (let i = 0; i < mono.length; i++) mono[i] = 0.5 * (r.left[i] + r.right[i]);
    const a = analyzeAudio(mono, 22050);
    return { analysis: a, output: buildAutoCharts(a, job) };
  }).promise;

  const now = Date.now();
  const notes = buildDemoChart();
  const authored: Chart = {
    id: chartId(DEMO_ID, 'classic', 'custom'),
    songId: DEMO_ID,
    style: 'classic',
    source: 'authored',
    laneCount: 3,
    offsetMs: 0,
    generatorVersion: GENERATOR_VERSION,
    notes,
    createdAt: now,
    updatedAt: now,
    validation: { ok: true, fixes: 0, warnings: [] },
    stats: chartStats(notes, demoDurationMs()),
  };
  const song = normalizeSong({
    ...(existing ?? {}),
    id: DEMO_ID,
    fingerprint: DEMO_ID,
    title: DEMO_TITLE,
    artist: DEMO_ARTIST,
    album: 'Pulsefall Originals',
    durationMs: demoDurationMs(),
    fileName: 'Built-in demo',
    fileType: 'synth',
    fileSize: 0,
    importedAt: existing?.importedAt ?? now,
    hasAudio: true,
    hasArtwork: false,
    analysisVersion: ANALYSIS_VERSION,
    analysisStatus: 'ready',
    analysisSummary: summarize(analysis),
    previewStartMs: previewStart(analysis),
    isDemo: true,
  });
  await library.saveImport({ song, analysis, charts: [...output.charts, authored] });
  return song;
}

let demoBufferCache: { rate: number; buffer: AudioBuffer } | null = null;

/** The demo track as a playable AudioBuffer (synthesized off the main thread, cached). */
export async function demoAudioBuffer(engine: AudioEngine, onProgress: (fraction: number) => void = () => {}): Promise<AudioBuffer> {
  if (!engine.ctx) await engine.unlock();
  const ctx = engine.ctx!;
  if (demoBufferCache && demoBufferCache.rate === ctx.sampleRate) return demoBufferCache.buffer;
  const rate = ctx.sampleRate;
  const r = await renderDemoInWorker(rate, (_s, f) => onProgress(f), () => renderDemoSong(rate)).promise;
  const buffer = ctx.createBuffer(2, r.left.length, r.sampleRate);
  buffer.copyToChannel(r.left as Float32Array<ArrayBuffer>, 0);
  buffer.copyToChannel(r.right as Float32Array<ArrayBuffer>, 1);
  demoBufferCache = { rate, buffer };
  return buffer;
}
