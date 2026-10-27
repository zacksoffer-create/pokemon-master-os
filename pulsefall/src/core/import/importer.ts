import { audio } from '../audio/audioEngine';
import { previewStart, summarize, type ChartJob } from '../chart/build';
import { library, StorageError } from '../storage/library';
import { ANALYSIS_VERSION, type AnalysisResult, type Chart, type Settings, type SongRecord } from '../types';
import { hashBytesHex, hashString } from '../util';
import { analyzeInWorker, generateInWorker, JobError, type Job } from './analysisClient';
import { compatibilityNote, guessFromFileName, parseAudioMetadata, type AudioMetadata } from './metadata';
import type { WorkerStage } from './workerProtocol';

export type ImportStage = 'reading' | 'decoding' | WorkerStage | 'saving' | 'done';

export interface ImportProgress {
  stage: ImportStage;
  /** Real progress within the stage when known (0..1), otherwise undefined. */
  fraction?: number;
}

export type ImportErrorCode =
  | 'unsupported'
  | 'drm'
  | 'decode'
  | 'silent'
  | 'too-short'
  | 'too-long'
  | 'too-large'
  | 'no-rhythm'
  | 'storage'
  | 'cancelled'
  | 'internal';

export class ImportError extends Error {
  constructor(
    readonly code: ImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ImportError';
  }
}

export interface ImportOutcome {
  kind: 'imported' | 'duplicate' | 'relinked';
  song: SongRecord;
  /** Styles that could not be charted (rare), with reasons. */
  chartErrors: { style: string; message: string }[];
}

export const MAX_FILE_BYTES = 150 * 1024 * 1024;
export const MAX_DURATION_MS = 20 * 60 * 1000;
const ANALYSIS_RATE = 22050;

export function songIdFor(fingerprint: string): string {
  return `s_${fingerprint}`;
}

export function fingerprintBytes(bytes: Uint8Array): string {
  return `${hashBytesHex(bytes)}${bytes.length.toString(36)}`;
}

export function seedFor(fingerprint: string): number {
  return hashString(fingerprint);
}

function mimeFor(meta: AudioMetadata, file: File): string {
  if (file.type) return file.type;
  switch (meta.container) {
    case 'mp3':
      return 'audio/mpeg';
    case 'mp4':
      return 'audio/mp4';
    case 'wav':
      return 'audio/wav';
    case 'flac':
      return 'audio/flac';
    case 'ogg':
      return 'audio/ogg';
    case 'aac':
      return 'audio/aac';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Decode at a reduced rate for analysis. An OfflineAudioContext at 22.05 kHz resamples
 * natively during decoding (less memory than a full-rate decode); older engines that
 * refuse that rate fall back to the shared context. The playback copy is decoded again at
 * full quality when the song is played.
 */
export async function decodeForAnalysis(bytes: ArrayBuffer): Promise<{ pcm: Float32Array; sampleRate: number; durationMs: number }> {
  let buffer: AudioBuffer | null = null;
  const Offline = (window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext) as
    | typeof OfflineAudioContext
    | undefined;
  if (Offline) {
    try {
      const off = new Offline(1, 1, ANALYSIS_RATE);
      buffer = await new Promise<AudioBuffer>((resolve, reject) => {
        const p = off.decodeAudioData(bytes.slice(0), resolve, reject);
        if (p && typeof p.then === 'function') p.then(resolve, reject);
      });
    } catch {
      buffer = null;
    }
  }
  if (!buffer) buffer = await audio.decode(bytes);
  const n = buffer.length;
  const pcm = new Float32Array(n);
  const ch = buffer.numberOfChannels;
  for (let c = 0; c < ch; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < n; i++) pcm[i] += data[i] / ch;
  }
  return { pcm, sampleRate: buffer.sampleRate, durationMs: buffer.duration * 1000 };
}

function toImportError(e: unknown): ImportError {
  if (e instanceof ImportError) return e;
  if (e instanceof StorageError) return new ImportError('storage', e.message);
  if (e instanceof JobError) {
    switch (e.code) {
      case 'silent':
        return new ImportError('silent', 'This file is silent, so there is nothing to play along to.');
      case 'too-short':
        return new ImportError('too-short', 'This track is too short to play (under 3 seconds).');
      case 'cancelled':
        return new ImportError('cancelled', 'Import cancelled.');
      default:
        return new ImportError('internal', `Analysis failed: ${e.message}`);
    }
  }
  return new ImportError('internal', (e as Error)?.message || 'Something went wrong during import.');
}

export interface ImportOptions {
  settings: Settings;
  onProgress(p: ImportProgress): void;
  /** Set by the caller to cancel; checked between stages and used to stop the worker. */
  signal?: AbortSignal;
}

/**
 * The whole import-to-playable pipeline for one file:
 * read -> identify -> decode -> analyze (worker) -> chart (worker) -> save (one transaction).
 */
export async function importFile(file: File, opts: ImportOptions): Promise<ImportOutcome> {
  const { onProgress, signal } = opts;
  let job: Job<{ analysis: AnalysisResult; output: { charts: Chart[]; errors: { style: string; message: string }[] } }> | null = null;
  const abort = () => job?.cancel();
  signal?.addEventListener('abort', abort);
  const check = () => {
    if (signal?.aborted) throw new ImportError('cancelled', 'Import cancelled.');
  };
  try {
    onProgress({ stage: 'reading' });
    if (file.size > MAX_FILE_BYTES) throw new ImportError('too-large', 'This file is larger than 150 MB. Try a regular song file (most are 3–15 MB).');
    if (file.size === 0) throw new ImportError('decode', 'This file is empty.');
    const bytes = await file.arrayBuffer();
    check();
    const u8 = new Uint8Array(bytes);
    const meta = parseAudioMetadata(u8, file.name);
    if (meta.drmProtected) throw new ImportError('drm', compatibilityNote(meta) ?? 'This file is copy-protected (DRM).');
    const fingerprint = fingerprintBytes(u8);
    const existing = await library.findByFingerprint(fingerprint);
    if (existing?.hasAudio) return { kind: 'duplicate', song: existing, chartErrors: [] };

    onProgress({ stage: 'decoding' });
    let decoded: { pcm: Float32Array; sampleRate: number; durationMs: number };
    try {
      decoded = await decodeForAnalysis(bytes);
    } catch {
      const note = compatibilityNote(meta);
      throw new ImportError(
        meta.container === 'unknown' ? 'unsupported' : 'decode',
        note ?? "This file couldn't be decoded. It may be damaged, or use a format this browser can't play. MP3 and AAC (M4A) files work best.",
      );
    }
    check();
    if (decoded.durationMs > MAX_DURATION_MS) throw new ImportError('too-long', 'This track is over 20 minutes long. Pulsefall works with songs up to 20 minutes.');
    if (decoded.durationMs < 3000) throw new ImportError('too-short', 'This track is too short to play (under 3 seconds).');

    const songId = existing?.id ?? songIdFor(fingerprint);
    const chartJob: ChartJob = {
      songId,
      seed: seedFor(fingerprint),
      advancedLanes: opts.settings.advancedLanes,
      overrides: existing?.overrides,
    };
    job = analyzeInWorker(decoded.pcm, decoded.sampleRate, chartJob, (stage, fraction) => onProgress({ stage, fraction }));
    const { analysis, output } = await job.promise;
    job = null;
    check();
    if (!analysis.rhythmic || output.charts.length === 0) {
      throw new ImportError(
        'no-rhythm',
        output.errors[0]?.message ?? 'No clear rhythm was found in this track (it may be ambient, spoken word or silence), so no chart could be made.',
      );
    }

    onProgress({ stage: 'saving' });
    const guess = guessFromFileName(file.name);
    const artwork = meta.artwork ? { bytes: meta.artwork.data.slice().buffer as ArrayBuffer, mime: meta.artwork.mime } : null;
    const base: SongRecord = existing ?? {
      id: songId,
      fingerprint,
      title: meta.title || guess.title,
      artist: meta.artist || guess.artist || 'Unknown artist',
      album: meta.album,
      year: meta.year,
      durationMs: decoded.durationMs,
      fileName: file.name,
      fileType: meta.container,
      fileSize: file.size,
      importedAt: Date.now(),
      hasAudio: true,
      hasArtwork: !!artwork,
      analysisVersion: ANALYSIS_VERSION,
      analysisStatus: 'ready',
      favorite: false,
      playCount: 0,
      best: {},
      previewStartMs: 0,
      overrides: {},
    };
    const song: SongRecord = {
      ...base,
      durationMs: decoded.durationMs,
      fileName: file.name,
      fileType: meta.container,
      fileSize: file.size,
      hasAudio: true,
      hasArtwork: base.hasArtwork || !!artwork,
      analysisVersion: ANALYSIS_VERSION,
      analysisStatus: 'ready',
      analysisSummary: summarize(analysis),
      previewStartMs: previewStart(analysis),
    };
    // When relinking a restored song, keep its existing charts (they may be hand-edited).
    const existingCharts = existing ? await library.getCharts(songId) : [];
    const charts = output.charts.filter((c) => !existingCharts.some((x) => x.id === c.id && x.source !== 'auto'));
    await library.saveImport({ song, audio: { bytes, mime: mimeFor(meta, file) }, artwork, analysis, charts });
    void requestPersistence();
    onProgress({ stage: 'done' });
    return { kind: existing ? 'relinked' : 'imported', song, chartErrors: output.errors };
  } catch (e) {
    throw toImportError(e);
  } finally {
    signal?.removeEventListener('abort', abort);
    job?.cancel();
  }
}

/** Rebuild the automatic charts of a song from its stored analysis (custom charts are kept). */
export async function regenerateCharts(song: SongRecord, settings: Settings): Promise<{ errors: { style: string; message: string }[] }> {
  const analysis = await library.getAnalysis(song.id);
  if (!analysis) throw new ImportError('internal', 'This song needs its audio re-imported before its charts can be rebuilt.');
  const job = generateInWorker(analysis, {
    songId: song.id,
    seed: seedFor(song.fingerprint),
    advancedLanes: settings.advancedLanes,
    overrides: song.overrides,
  });
  const { output } = await job.promise.catch((e) => {
    throw toImportError(e);
  });
  if (!output.charts.length) throw new ImportError('no-rhythm', output.errors[0]?.message ?? 'No chart could be generated.');
  await library.replaceAutoCharts(song.id, output.charts);
  return { errors: output.errors };
}

let persistAsked = false;
/** Ask the browser not to evict our storage (granted for installed web apps on iOS 17+). */
export async function requestPersistence(): Promise<boolean> {
  if (persistAsked) return false;
  persistAsked = true;
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
