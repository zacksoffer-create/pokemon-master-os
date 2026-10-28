import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractMp4Audio, looksLikeMp4 } from '../../src/core/import/mp4Audio';
import { parseAudioMetadata } from '../../src/core/import/metadata';

// Fixtures come from scripts/make-video-fixtures.sh.
const load = (dir: string, name: string) => new Uint8Array(readFileSync(new URL(`../fixtures/${dir}/${name}`, import.meta.url)));
const video = (name: string) => load('video', name);
const blob = (bytes: Uint8Array) => new Blob([bytes as BlobPart]);

const u32 = (b: Uint8Array, p: number) => ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0;
const fourcc = (b: Uint8Array, p: number) => String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);

/** Top-level boxes as [type, start, size]. */
function boxes(b: Uint8Array): [string, number, number][] {
  const out: [string, number, number][] = [];
  for (let p = 0; p + 8 <= b.length; ) {
    const size = u32(b, p);
    out.push([fourcc(b, p + 4), p, size]);
    p += size;
  }
  return out;
}

function mdatPayload(b: Uint8Array): Uint8Array {
  const m = boxes(b).find(([t]) => t === 'mdat')!;
  return b.subarray(m[1] + 8, m[1] + m[2]);
}

function countHandlers(b: Uint8Array, kind: string): number {
  let n = 0;
  for (let p = 0; p + 20 <= b.length; p++) if (fourcc(b, p) === 'hdlr' && fourcc(b, p + 12) === kind) n++;
  return n;
}

// ffmpeg's own audio-only copy of clip.mp4: the same compressed samples, back to back.
const REFERENCE = mdatPayload(video('clip-audio-ref.m4a'));

describe('extractMp4Audio', () => {
  it.each(['clip.mp4', 'clip-faststart.mp4', 'clip.mov'])('pulls the sound out of %s without re-encoding', async (name) => {
    const src = video(name);
    const r = await extractMp4Audio(blob(src));
    expect(r?.kind).toBe('extracted');
    const out = (r as { bytes: Uint8Array }).bytes;
    // ftyp, index, then the audio samples; much smaller than the video.
    expect(boxes(out).map(([t]) => t)).toEqual(['ftyp', 'moov', 'mdat']);
    expect(boxes(out).reduce((s, [, , size]) => s + size, 0)).toBe(out.length);
    expect(countHandlers(out, 'soun')).toBe(1);
    expect(countHandlers(out, 'vide')).toBe(0);
    expect(mdatPayload(out)).toEqual(REFERENCE);
    expect(out.length).toBeLessThan(src.length * 0.75);
  });

  it('points every chunk offset at its samples in the new file', async () => {
    const out = ((await extractMp4Audio(blob(video('clip.mp4')))) as { bytes: Uint8Array }).bytes;
    let p = 0;
    while (fourcc(out, p) !== 'stco') p++;
    const stco = p - 4;
    const count = u32(out, stco + 12);
    const mdat = boxes(out).find(([t]) => t === 'mdat')!;
    expect(u32(out, stco + 16)).toBe(mdat[1] + 8);
    for (let i = 1; i < count; i++) expect(u32(out, stco + 16 + i * 4)).toBeGreaterThan(u32(out, stco + 12 + i * 4));
    expect(u32(out, stco + 12 + count * 4)).toBeLessThan(mdat[1] + mdat[2]);
  });

  it('keeps the tags and duration readable', async () => {
    const out = ((await extractMp4Audio(blob(video('clip.mp4')))) as { bytes: Uint8Array }).bytes;
    const meta = parseAudioMetadata(out, 'clip.m4a');
    expect(meta.container).toBe('mp4');
    expect(meta.title).toBe('Neon Test Clip');
    expect(meta.artist).toBe('Pulsefall Lab');
    expect(meta.durationMs).toBeGreaterThan(5800);
    expect(meta.durationMs).toBeLessThan(6300);
    expect(meta.drmProtected).toBe(false);
  });

  it('leaves audio-only files alone', async () => {
    expect(await extractMp4Audio(blob(video('clip-audio-ref.m4a')))).toEqual({ kind: 'audio-only' });
    expect(await extractMp4Audio(blob(load('audio', 'tone.m4a')))).toEqual({ kind: 'audio-only' });
  });

  it('reports a video without sound', async () => {
    expect(await extractMp4Audio(blob(video('silent-video.mp4')))).toEqual({ kind: 'no-audio' });
  });

  it('declines layouts it does not handle, so the original is decoded instead', async () => {
    expect(await extractMp4Audio(blob(video('clip-frag.mp4')))).toBeNull();
    const src = video('clip.mp4');
    expect(await extractMp4Audio(blob(src.subarray(0, src.length >> 1)))).toBeNull(); // index cut off
    expect(await extractMp4Audio(blob(new Uint8Array(4096).fill(7)))).toBeNull();
    expect(await extractMp4Audio(blob(new Uint8Array(0)))).toBeNull();
  });

  it('respects the audio size limit', async () => {
    expect(await extractMp4Audio(blob(video('clip.mp4')), 1000)).toBeNull();
  });

  it('recognises MP4 and MOV headers', () => {
    expect(looksLikeMp4(video('clip.mp4'))).toBe(true);
    expect(looksLikeMp4(video('clip.mov'))).toBe(true);
    expect(looksLikeMp4(load('audio', 'tone-id3v24.mp3'))).toBe(false);
  });
});
