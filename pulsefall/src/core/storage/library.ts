import type { IDBPDatabase } from 'idb';
import { starsFor } from '../engine/timing';
import {
  APP_VERSION,
  CHART_STYLES,
  DEFAULT_SETTINGS,
  type AnalysisResult,
  type BestRecord,
  type Chart,
  type ChartStyle,
  type PlayResult,
  type Settings,
  type SongRecord,
} from '../types';
import { openPulsefallDB, type PulsefallDB } from './db';

export class StorageError extends Error {
  constructor(
    readonly code: 'quota' | 'unavailable' | 'failed',
    message: string,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export interface ImportBundle {
  song: SongRecord;
  audio?: { bytes: ArrayBuffer; mime: string };
  artwork?: { bytes: ArrayBuffer; mime: string } | null;
  analysis?: AnalysisResult;
  charts: Chart[];
}

export const BACKUP_FORMAT = 'pulsefall-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  appVersion: string;
  exportedAt: number;
  settings?: Settings;
  songs: { song: SongRecord; charts: Chart[]; results: PlayResult[] }[];
}

export function chartId(songId: string, style: ChartStyle, source: 'auto' | 'custom'): string {
  return `${songId}:${style}:${source}`;
}

/** Fill in defaults for records written by older versions or restored from backups. */
export function normalizeSong(raw: Partial<SongRecord> & { id: string }): SongRecord {
  return {
    id: raw.id,
    fingerprint: raw.fingerprint ?? raw.id,
    title: (raw.title ?? '').trim() || 'Untitled',
    artist: (raw.artist ?? '').trim() || 'Unknown artist',
    album: raw.album,
    year: raw.year,
    durationMs: Number.isFinite(raw.durationMs) ? raw.durationMs! : 0,
    fileName: raw.fileName ?? '',
    fileType: raw.fileType ?? '',
    fileSize: raw.fileSize ?? 0,
    importedAt: raw.importedAt ?? Date.now(),
    hasAudio: !!raw.hasAudio,
    hasArtwork: !!raw.hasArtwork,
    analysisVersion: raw.analysisVersion ?? '',
    analysisStatus: raw.analysisStatus ?? 'ready',
    analysisSummary: raw.analysisSummary,
    overrides: raw.overrides ?? {},
    favorite: !!raw.favorite,
    playCount: raw.playCount ?? 0,
    lastPlayedAt: raw.lastPlayedAt,
    best: raw.best ?? {},
    previewStartMs: raw.previewStartMs ?? 0,
    isDemo: raw.isDemo,
    metadataEdited: raw.metadataEdited,
    trim: validTrim(raw.trim),
  };
}

function validTrim(t: unknown): SongRecord['trim'] {
  const r = t as SongRecord['trim'];
  return r && Number.isFinite(r.startMs) && Number.isFinite(r.endMs) && r.endMs > r.startMs && r.startMs >= 0 ? { startMs: r.startMs, endMs: r.endMs } : undefined;
}

export function toStorageError(e: unknown): StorageError {
  const name = (e as { name?: string })?.name ?? '';
  const msg = (e as { message?: string })?.message ?? String(e);
  if (name === 'QuotaExceededError' || /quota/i.test(msg)) {
    return new StorageError('quota', 'Your device is out of space for Pulsefall. Remove a few songs (or free up storage) and try again.');
  }
  return new StorageError('failed', `Saving failed: ${msg}`);
}

type Listener = () => void;

/**
 * The persistent music library (IndexedDB). All multi-record writes happen in a single
 * transaction, so an interrupted import never leaves half a song behind.
 */
export class Library {
  private dbp: Promise<IDBPDatabase<PulsefallDB>> | null = null;
  private listeners = new Set<Listener>();
  private artworkUrls = new Map<string, string>();

  constructor(private readonly dbName?: string) {}

  private db(): Promise<IDBPDatabase<PulsefallDB>> {
    if (!this.dbp) {
      if (typeof indexedDB === 'undefined') {
        return Promise.reject(new StorageError('unavailable', 'This browser does not allow offline storage (private browsing?).'));
      }
      this.dbp = openPulsefallDB(this.dbName).catch((e) => {
        this.dbp = null;
        throw new StorageError('unavailable', `Could not open the library: ${(e as Error).message}`);
      });
    }
    return this.dbp;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private changed(): void {
    for (const fn of this.listeners) fn();
  }

  async listSongs(): Promise<SongRecord[]> {
    const db = await this.db();
    return (await db.getAll('songs')).map(normalizeSong);
  }

  async getSong(id: string): Promise<SongRecord | null> {
    const db = await this.db();
    const s = await db.get('songs', id);
    return s ? normalizeSong(s) : null;
  }

  async findByFingerprint(fp: string): Promise<SongRecord | null> {
    const db = await this.db();
    const s = await db.getFromIndex('songs', 'fingerprint', fp);
    return s ? normalizeSong(s) : null;
  }

  async getCharts(songId: string): Promise<Chart[]> {
    const db = await this.db();
    return db.getAllFromIndex('charts', 'songId', songId);
  }

  async getChart(id: string): Promise<Chart | null> {
    const db = await this.db();
    return (await db.get('charts', id)) ?? null;
  }

  async getAnalysis(songId: string): Promise<AnalysisResult | null> {
    const db = await this.db();
    return (await db.get('analysis', songId)) ?? null;
  }

  async getAudio(songId: string): Promise<{ bytes: ArrayBuffer; mime: string } | null> {
    const db = await this.db();
    const a = await db.get('audio', songId);
    return a ? { bytes: a.bytes, mime: a.mime } : null;
  }

  /** Object URL for a song's embedded artwork (cached), or null. */
  async artworkUrl(songId: string): Promise<string | null> {
    const cached = this.artworkUrls.get(songId);
    if (cached) return cached;
    const db = await this.db();
    const art = await db.get('artwork', songId);
    if (!art) return null;
    const url = URL.createObjectURL(new Blob([art.bytes], { type: art.mime }));
    this.artworkUrls.set(songId, url);
    return url;
  }

  /** Save a newly imported (or re-linked) song and everything derived from it, atomically. */
  async saveImport(b: ImportBundle): Promise<void> {
    const db = await this.db();
    try {
      const tx = db.transaction(['songs', 'audio', 'artwork', 'analysis', 'charts'], 'readwrite');
      const song = normalizeSong({ ...b.song, hasAudio: !!b.audio || b.song.hasAudio, hasArtwork: !!b.artwork || b.song.hasArtwork });
      await tx.objectStore('songs').put(song);
      if (b.audio) await tx.objectStore('audio').put({ songId: song.id, bytes: b.audio.bytes, mime: b.audio.mime });
      if (b.artwork) await tx.objectStore('artwork').put({ songId: song.id, bytes: b.artwork.bytes, mime: b.artwork.mime });
      if (b.analysis) await tx.objectStore('analysis').put({ ...b.analysis, songId: song.id });
      for (const c of b.charts) await tx.objectStore('charts').put(c);
      await tx.done;
    } catch (e) {
      throw toStorageError(e);
    }
    this.changed();
  }

  async updateSong(id: string, patch: Partial<SongRecord>): Promise<SongRecord | null> {
    const db = await this.db();
    const tx = db.transaction('songs', 'readwrite');
    const cur = await tx.store.get(id);
    if (!cur) return null;
    const next = normalizeSong({ ...cur, ...patch, id });
    await tx.store.put(next);
    await tx.done;
    this.changed();
    return next;
  }

  /** Store a hand-edited (custom) chart for a style. */
  async saveCustomChart(chart: Chart): Promise<Chart> {
    const db = await this.db();
    const c: Chart = { ...chart, id: chartId(chart.songId, chart.style, 'custom'), source: chart.source === 'authored' ? 'authored' : 'edited', updatedAt: Date.now() };
    try {
      await db.put('charts', c);
    } catch (e) {
      throw toStorageError(e);
    }
    this.changed();
    return c;
  }

  async deleteChart(id: string): Promise<void> {
    const db = await this.db();
    await db.delete('charts', id);
    this.changed();
  }

  /** Replace automatically generated charts; custom (edited) charts are never touched. */
  async replaceAutoCharts(songId: string, charts: Chart[], songPatch: Partial<SongRecord> = {}): Promise<void> {
    const db = await this.db();
    try {
      const tx = db.transaction(['charts', 'songs'], 'readwrite');
      const existing = await tx.objectStore('charts').index('songId').getAll(songId);
      for (const c of existing) if (c.source === 'auto') await tx.objectStore('charts').delete(c.id);
      for (const c of charts) await tx.objectStore('charts').put(c);
      const song = await tx.objectStore('songs').get(songId);
      if (song) await tx.objectStore('songs').put(normalizeSong({ ...song, ...songPatch, id: songId }));
      await tx.done;
    } catch (e) {
      throw toStorageError(e);
    }
    this.changed();
  }

  async deleteSong(id: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(['songs', 'audio', 'artwork', 'analysis', 'charts', 'results'], 'readwrite');
    await tx.objectStore('songs').delete(id);
    await tx.objectStore('audio').delete(id);
    await tx.objectStore('artwork').delete(id);
    await tx.objectStore('analysis').delete(id);
    for (const key of await tx.objectStore('charts').index('songId').getAllKeys(id)) await tx.objectStore('charts').delete(key);
    for (const key of await tx.objectStore('results').index('songId').getAllKeys(id)) await tx.objectStore('results').delete(key);
    await tx.done;
    const url = this.artworkUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    this.artworkUrls.delete(id);
    this.changed();
  }

  /** Remove the stored audio but keep charts and scores (frees space; re-import to play). */
  async removeAudio(id: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(['songs', 'audio'], 'readwrite');
    await tx.objectStore('audio').delete(id);
    const s = await tx.objectStore('songs').get(id);
    if (s) await tx.objectStore('songs').put({ ...s, hasAudio: false });
    await tx.done;
    this.changed();
  }

  /**
   * Record a finished play: appends the result and updates play count, last played and
   * the per-style personal best, in one transaction. Returns the previous best.
   */
  async recordPlay(result: PlayResult): Promise<{ previousBest: BestRecord | null; isNewBest: boolean }> {
    const db = await this.db();
    const tx = db.transaction(['results', 'songs'], 'readwrite');
    const { id: _ignored, ...rest } = result;
    await tx.objectStore('results').add(rest as PlayResult);
    const song = await tx.objectStore('songs').get(result.songId);
    let previousBest: BestRecord | null = null;
    let isNewBest = false;
    if (song) {
      const s = normalizeSong(song);
      previousBest = s.best[result.style] ?? null;
      s.playCount += 1;
      s.lastPlayedAt = result.playedAt;
      if (!result.autoplay && result.completed && (!previousBest || result.score > previousBest.score)) {
        isNewBest = true;
        s.best[result.style] = {
          score: result.score,
          accuracy: result.accuracy,
          maxCombo: Math.max(result.maxCombo, previousBest?.maxCombo ?? 0),
          stars: starsFor(result.accuracy),
          fullCombo: result.fullCombo || !!previousBest?.fullCombo,
          allPerfect: result.allPerfect || !!previousBest?.allPerfect,
          playedAt: result.playedAt,
          chartId: result.chartId,
        };
      } else if (previousBest && !result.autoplay && result.completed) {
        s.best[result.style] = {
          ...previousBest,
          maxCombo: Math.max(previousBest.maxCombo, result.maxCombo),
          fullCombo: previousBest.fullCombo || result.fullCombo,
          allPerfect: previousBest.allPerfect || result.allPerfect,
        };
      }
      await tx.objectStore('songs').put(s);
    }
    await tx.done;
    this.changed();
    return { previousBest, isNewBest };
  }

  async listResults(songId: string, limit = 20): Promise<PlayResult[]> {
    const db = await this.db();
    const all = await db.getAllFromIndex('results', 'songId', songId);
    return all.sort((a, b) => b.playedAt - a.playedAt).slice(0, limit);
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    const db = await this.db();
    return (await db.get('meta', key))?.value as T | undefined;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    const db = await this.db();
    await db.put('meta', { key, value });
  }

  /** Approximate bytes used per song (audio + artwork), for the storage screen. */
  async audioSizes(): Promise<Map<string, number>> {
    const db = await this.db();
    const out = new Map<string, number>();
    let cursor = await db.transaction('audio').store.openCursor();
    while (cursor) {
      out.set(cursor.key, cursor.value.bytes.byteLength);
      cursor = await cursor.continue();
    }
    return out;
  }

  // --- backup ----------------------------------------------------------------

  async exportBackup(settings?: Settings): Promise<BackupFile> {
    const db = await this.db();
    const songs = await db.getAll('songs');
    const out: BackupFile = { format: BACKUP_FORMAT, version: BACKUP_VERSION, appVersion: APP_VERSION, exportedAt: Date.now(), settings, songs: [] };
    for (const s of songs) {
      if (s.isDemo) continue;
      const charts = await db.getAllFromIndex('charts', 'songId', s.id);
      const results = await db.getAllFromIndex('results', 'songId', s.id);
      out.songs.push({ song: { ...s, hasAudio: false, hasArtwork: false }, charts, results: results.map(({ id: _id, ...r }) => r as PlayResult) });
    }
    return out;
  }

  /**
   * Merge a backup into the library. Existing songs keep their audio; charts from the
   * backup win for custom charts (that is the user's work), auto charts are only added
   * if missing. Returns counts for the confirmation message.
   */
  async importBackup(raw: unknown): Promise<{ songs: number; charts: number; results: number; settings?: Settings }> {
    const data = validateBackup(raw);
    const db = await this.db();
    let songs = 0;
    let charts = 0;
    let results = 0;
    try {
      const tx = db.transaction(['songs', 'charts', 'results'], 'readwrite');
      for (const entry of data.songs) {
        const existing = await tx.objectStore('songs').get(entry.song.id);
        const merged = existing
          ? normalizeSong({
              ...existing,
              favorite: existing.favorite || entry.song.favorite,
              playCount: Math.max(existing.playCount, entry.song.playCount),
              best: mergeBest(existing.best, entry.song.best),
              overrides: { ...entry.song.overrides, ...existing.overrides },
            })
          : normalizeSong({ ...entry.song, hasAudio: false, hasArtwork: false });
        await tx.objectStore('songs').put(merged);
        songs++;
        for (const c of entry.charts) {
          const have = await tx.objectStore('charts').get(c.id);
          if (!have || c.source !== 'auto') {
            await tx.objectStore('charts').put(c);
            charts++;
          }
        }
        if (!existing) {
          for (const r of entry.results) {
            await tx.objectStore('results').add(r);
            results++;
          }
        }
      }
      await tx.done;
    } catch (e) {
      throw toStorageError(e);
    }
    this.changed();
    return { songs, charts, results, settings: data.settings };
  }
}

function mergeBest(a: SongRecord['best'], b: SongRecord['best']): SongRecord['best'] {
  const out: SongRecord['best'] = { ...a };
  for (const style of CHART_STYLES) {
    const x = a[style];
    const y = b?.[style];
    if (y && (!x || y.score > x.score)) out[style] = y;
  }
  return out;
}

export class BackupError extends Error {}

/** Structural validation of an untrusted backup file. */
export function validateBackup(raw: unknown): BackupFile {
  const fail = (why: string): never => {
    throw new BackupError(`This doesn't look like a Pulsefall backup (${why}).`);
  };
  if (!raw || typeof raw !== 'object') fail('not JSON data');
  const d = raw as Partial<BackupFile>;
  if (d.format !== BACKUP_FORMAT) fail('missing format marker');
  if (typeof d.version !== 'number' || d.version > BACKUP_VERSION) fail('made by a newer version');
  if (!Array.isArray(d.songs)) fail('no songs list');
  const songs = d.songs!.filter(
    (e) =>
      e &&
      e.song &&
      typeof e.song.id === 'string' &&
      Array.isArray(e.charts) &&
      e.charts.every((c) => c && typeof c.id === 'string' && c.songId === e.song.id && Array.isArray(c.notes)),
  );
  return {
    format: BACKUP_FORMAT,
    version: d.version!,
    appVersion: String(d.appVersion ?? ''),
    exportedAt: Number(d.exportedAt ?? 0),
    settings: d.settings ? { ...DEFAULT_SETTINGS, ...d.settings } : undefined,
    songs: songs.map((e) => ({ song: normalizeSong(e.song), charts: e.charts, results: Array.isArray(e.results) ? e.results : [] })),
  };
}

export const library = new Library();
