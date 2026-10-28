import { audio } from '../../core/audio/audioEngine';
import { demoAudioBuffer } from '../../core/demo/demoSetup';
import { library } from '../../core/storage/library';
import type { Chart, SongRecord } from '../../core/types';
import type { Route } from '../router';

/** What the game screen should play next (set right before navigating to it). */
export interface Launch {
  songId: string;
  chartId: string;
  autoplay?: boolean;
  startAtMs?: number;
  /** Stop here (with startAtMs: play just this part). Parts are practice: not recorded. */
  endAtMs?: number;
  /** An unsaved chart (editor preview). Results are not recorded. */
  chart?: Chart;
  returnTo?: Route;
}

let pending: Launch | null = null;

export function setLaunch(l: Launch): void {
  pending = l;
}

export function takeLaunch(songId: string): Launch | null {
  const l = pending && pending.songId === songId ? pending : null;
  return l;
}

export function clearLaunch(): void {
  pending = null;
}

let cache: { songId: string; buffer: Promise<AudioBuffer> } | null = null;

export class AudioMissingError extends Error {}

/**
 * Decoded playback audio for a song, at full quality. Only the most recent song is kept
 * in memory (decoded audio is ~10 MB per minute). Concurrent calls for the same song share
 * one decode.
 */
export function loadSongBuffer(song: SongRecord, onProgress?: (f: number) => void): Promise<AudioBuffer> {
  if (cache?.songId === song.id) return cache.buffer;
  const buffer = decodeSong(song, onProgress);
  const entry = { songId: song.id, buffer };
  cache = entry;
  // A failed decode isn't cached, so the next attempt tries again.
  buffer.catch(() => {
    if (cache === entry) cache = null;
  });
  return buffer;
}

async function decodeSong(song: SongRecord, onProgress?: (f: number) => void): Promise<AudioBuffer> {
  if (song.isDemo) return demoAudioBuffer(audio, onProgress);
  const stored = await library.getAudio(song.id);
  if (!stored) throw new AudioMissingError('The audio for this song is not on this device. Re-import the file to play it.');
  return audio.decode(stored.bytes);
}

export function forgetBuffer(songId?: string): void {
  if (!songId || cache?.songId === songId) cache = null;
}
