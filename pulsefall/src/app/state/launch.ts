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

let cache: { songId: string; buffer: AudioBuffer } | null = null;

export class AudioMissingError extends Error {}

/**
 * Decoded playback audio for a song, at full quality. Only the most recent song is kept
 * in memory (decoded audio is ~10 MB per minute).
 */
export async function loadSongBuffer(song: SongRecord, onProgress?: (f: number) => void): Promise<AudioBuffer> {
  if (cache?.songId === song.id) return cache.buffer;
  cache = null;
  let buffer: AudioBuffer;
  if (song.isDemo) buffer = await demoAudioBuffer(audio, onProgress);
  else {
    const stored = await library.getAudio(song.id);
    if (!stored) throw new AudioMissingError('The audio for this song is not on this device. Re-import the file to play it.');
    buffer = await audio.decode(stored.bytes);
  }
  cache = { songId: song.id, buffer };
  return buffer;
}

export function forgetBuffer(songId?: string): void {
  if (!songId || cache?.songId === songId) cache = null;
}
