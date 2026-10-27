import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AnalysisResult, Chart, PlayResult, SongRecord } from '../types';

export interface AudioBlobRecord {
  songId: string;
  bytes: ArrayBuffer;
  mime: string;
}

export interface ArtworkRecord {
  songId: string;
  bytes: ArrayBuffer;
  mime: string;
}

export interface StoredAnalysis extends AnalysisResult {
  songId: string;
}

export interface MetaRecord {
  key: string;
  value: unknown;
}

export interface PulsefallDB extends DBSchema {
  songs: { key: string; value: SongRecord; indexes: { fingerprint: string } };
  audio: { key: string; value: AudioBlobRecord };
  artwork: { key: string; value: ArtworkRecord };
  analysis: { key: string; value: StoredAnalysis };
  charts: { key: string; value: Chart; indexes: { songId: string } };
  results: { key: number; value: PlayResult; indexes: { songId: string } };
  meta: { key: string; value: MetaRecord };
}

export const DB_NAME = 'pulsefall';
export const DB_VERSION = 1;

/**
 * Schema migrations run in order inside the upgrade transaction. Add a new block for
 * every version bump; never edit an old one.
 */
export function openPulsefallDB(name = DB_NAME): Promise<IDBPDatabase<PulsefallDB>> {
  return openDB<PulsefallDB>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const songs = db.createObjectStore('songs', { keyPath: 'id' });
        songs.createIndex('fingerprint', 'fingerprint', { unique: false });
        db.createObjectStore('audio', { keyPath: 'songId' });
        db.createObjectStore('artwork', { keyPath: 'songId' });
        db.createObjectStore('analysis', { keyPath: 'songId' });
        const charts = db.createObjectStore('charts', { keyPath: 'id' });
        charts.createIndex('songId', 'songId', { unique: false });
        const results = db.createObjectStore('results', { keyPath: 'id', autoIncrement: true });
        results.createIndex('songId', 'songId', { unique: false });
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    },
    blocked() {
      // Another tab holds an older version open; it will be asked to close.
    },
    blocking(_cur, _next, event) {
      (event.target as IDBDatabase | null)?.close();
    },
  });
}
