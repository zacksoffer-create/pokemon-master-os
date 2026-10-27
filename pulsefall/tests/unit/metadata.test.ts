import { describe, it, expect, afterEach, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import {
  compatibilityNote,
  detectContainer,
  guessFromFileName,
  parseAudioMetadata,
  type AudioContainer,
  type AudioMetadata,
} from '../../src/core/import/metadata';

// ---------------------------------------------------------------- helpers

const fixtureUrl = (name: string): URL => new URL(`../fixtures/audio/${name}`, import.meta.url);
const hasFixture = (name: string): boolean => existsSync(fixtureUrl(name));
const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(fixtureUrl(name)));

const COVER = fixture('cover.png');
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** A tiny fake JPEG full of 0xFF bytes, so ID3 unsynchronisation actually changes it. */
const FAKE_JPEG = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xff, 0x00, 0xff, 0xd9,
]);
const TAGS = { title: 'Neon Test Tone', artist: 'Pulsefall Lab', album: 'Fixtures', year: '2024' };
const CONTAINERS: AudioContainer[] = ['mp3', 'mp4', 'wav', 'flac', 'ogg', 'aac', 'unknown'];

type Part = Uint8Array | number[] | string;

/** Concatenates byte parts; strings are written as Latin-1 (one byte per char). */
function bin(...parts: Part[]): Uint8Array {
  const arrays = parts.map((p) =>
    typeof p === 'string'
      ? Uint8Array.from(p, (c) => c.charCodeAt(0) & 0xff)
      : p instanceof Uint8Array
        ? p
        : Uint8Array.from(p),
  );
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let n = 0;
  for (const a of arrays) {
    out.set(a, n);
    n += a.length;
  }
  return out;
}

const be16 = (n: number): number[] => [(n >>> 8) & 255, n & 255];
const be24 = (n: number): number[] => [(n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const be32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le16 = (n: number): number[] => [n & 255, (n >>> 8) & 255];
const le32 = (n: number): number[] => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const syncsafe = (n: number): number[] => [(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127];
const zeros = (n: number): number[] => new Array<number>(n).fill(0);
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
const utf16 = (s: string, littleEndian: boolean): number[] =>
  [...s].flatMap((ch) => {
    const out: number[] = [];
    for (let i = 0; i < ch.length; i++) {
      const u = ch.charCodeAt(i);
      out.push(...(littleEndian ? [u & 255, u >> 8] : [u >> 8, u & 255]));
    }
    return out;
  });

/** ID3 unsynchronisation: a 0x00 after every 0xFF (a superset of what the spec requires; decoders undo it the same way). */
function unsync(bytes: Uint8Array): Uint8Array {
  const out: number[] = [];
  for (const b of bytes) {
    out.push(b);
    if (b === 0xff) out.push(0);
  }
  return Uint8Array.from(out);
}

function id3Tag(major: 2 | 3 | 4, body: Uint8Array, flags = 0): Uint8Array {
  return bin('ID3', [major, 0, flags], syncsafe(body.length), body);
}
const frame23 = (id: string, data: Uint8Array, flags = 0): Uint8Array => bin(id, be32(data.length), [0, flags], data);
const frame24 = (id: string, data: Uint8Array, flags = 0): Uint8Array =>
  bin(id, syncsafe(data.length), [0, flags], data);
const frame22 = (id: string, data: Uint8Array): Uint8Array => bin(id, be24(data.length), data);
const latin1Text = (s: string): Uint8Array => bin([0], s);
const apic = (pictureType: number, mime: string, data: Uint8Array): Uint8Array =>
  bin([0], mime, [0, pictureType], 'desc', [0], data);

/** Real MPEG audio frames (8 kHz mono, no tags) to put behind hand-made ID3 tags. */
const MPEG_FRAMES = fixture('tone-notags.mp3');

function atom(type: string, ...children: Part[]): Uint8Array {
  const body = bin(...children);
  return bin(be32(8 + body.length), type, body);
}
const FULL_BOX = [0, 0, 0, 0];
const mvhd = (timescale: number, duration: number): Uint8Array =>
  atom('mvhd', FULL_BOX, be32(0), be32(0), be32(timescale), be32(duration), zeros(80));
const hdlr = (handler: string): Uint8Array => atom('hdlr', FULL_BOX, be32(0), handler, zeros(12), [0]);
const audioEntry = (fourcc: string, channels: number, rate: number, ...children: Part[]): Uint8Array =>
  atom(
    fourcc,
    zeros(6),
    be16(1),
    be16(0),
    be16(0),
    be32(0),
    be16(channels),
    be16(16),
    be16(0),
    be16(0),
    be32(rate * 65536),
    ...children,
  );
const stsd = (entry: Uint8Array): Uint8Array => atom('stsd', FULL_BOX, be32(1), entry);
const trak = (handler: string, entry: Uint8Array): Uint8Array =>
  atom('trak', atom('mdia', hdlr(handler), atom('minf', atom('stbl', stsd(entry)))));
const sinf = (): Uint8Array => atom('sinf', atom('frma', 'mp4a'), atom('schm', FULL_BOX, 'itun', be32(0)));
const ilstItem = (type: string, dataType: number, value: Part): Uint8Array =>
  atom(type, atom('data', be32(dataType), be32(0), value));

interface MoovOptions {
  entry?: Uint8Array;
  tracks?: Uint8Array[];
  udta?: Uint8Array;
  movieHeader?: Uint8Array;
}
const ftyp = (brand = 'M4A '): Uint8Array => atom('ftyp', brand, be32(0), brand, 'isom');
function moov(opts: MoovOptions): Uint8Array {
  const tracks = opts.tracks ?? [trak('soun', opts.entry ?? audioEntry('mp4a', 2, 44100))];
  return atom('moov', opts.movieHeader ?? mvhd(1000, 2500), ...tracks, ...(opts.udta ? [opts.udta] : []));
}
/** Minimal M4A: ftyp, moov (2.5 s, one AAC track by default), small mdat. */
const m4a = (opts: MoovOptions & { brand?: string }): Uint8Array =>
  bin(ftyp(opts.brand), moov(opts), atom('mdat', zeros(64)));

/** One Ogg page; CRC is left at zero (the parser does not verify it). */
function oggPage(
  serial: number,
  sequence: number,
  headerType: number,
  granule: number,
  lacing: number[],
  body: Uint8Array,
): Uint8Array {
  return bin(
    'OggS',
    [0, headerType],
    le32(granule),
    le32(0),
    le32(serial),
    le32(sequence),
    le32(0),
    [lacing.length],
    lacing,
    body,
  );
}

/** Lays packets out as Ogg pages of at most `segmentsPerPage` segments, so packets can span pages. */
function oggStream(serial: number, packets: Uint8Array[], segmentsPerPage: number, finalGranule: number): Uint8Array {
  const segments: { data: Uint8Array; continues: boolean }[] = [];
  for (const packet of packets) {
    let off = 0;
    for (;;) {
      const len = Math.min(255, packet.length - off);
      segments.push({ data: packet.subarray(off, off + len), continues: off > 0 });
      off += len;
      if (len < 255) break;
    }
  }
  const pages: Uint8Array[] = [];
  for (let i = 0, seq = 0; i < segments.length; i += segmentsPerPage, seq++) {
    const group = segments.slice(i, i + segmentsPerPage);
    const last = i + segmentsPerPage >= segments.length;
    const headerType = (seq === 0 ? 2 : 0) | (group[0].continues ? 1 : 0) | (last ? 4 : 0);
    const granule = last ? finalGranule : 0;
    pages.push(
      oggPage(
        serial,
        seq,
        headerType,
        granule,
        group.map((s) => s.data.length),
        bin(...group.map((s) => s.data)),
      ),
    );
  }
  return bin(...pages);
}

function flacPictureBlock(pictureType: number, mime: string, data: Uint8Array): Uint8Array {
  return bin(
    be32(pictureType),
    be32(mime.length),
    mime,
    be32(0),
    be32(16),
    be32(16),
    be32(24),
    be32(0),
    be32(data.length),
    data,
  );
}

function vorbisComment(entries: string[]): Uint8Array {
  const encoded = entries.map(utf8);
  return bin(le32(6), 'tester', le32(entries.length), ...encoded.flatMap((e) => [Uint8Array.from(le32(e.length)), e]));
}

/** Deterministic PRNG (mulberry32) so fuzz failures are reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function expectWellFormed(meta: AudioMetadata): void {
  expect(CONTAINERS).toContain(meta.container);
  expect(Array.isArray(meta.warnings)).toBe(true);
  expect(typeof meta.drmProtected).toBe('boolean');
  for (const key of ['title', 'artist', 'album', 'year'] as const) {
    const value = meta[key];
    if (value !== undefined) {
      expect(value.length).toBeGreaterThan(0);
      expect(value.length).toBeLessThanOrEqual(200);
    }
  }
}

function expectCover(meta: AudioMetadata): void {
  expect(meta.artwork?.mime).toBe('image/png');
  const data = meta.artwork?.data ?? new Uint8Array();
  expect([...data.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  expect(data).toEqual(COVER);
}

// ---------------------------------------------------------------- generated fixtures

interface FixtureCase {
  file: string;
  container: AudioContainer;
  codec: string;
  sampleRate: number;
  channels: number;
  /** True duration of the encoded tone, or undefined where the parser should not claim one. */
  durationMs?: number;
  tags: Partial<typeof TAGS>;
  artwork: boolean;
  /** Set when the fixture depends on an optional ffmpeg encoder. */
  needs?: string;
}

const FIXTURES: FixtureCase[] = [
  {
    file: 'tone-id3v24.mp3',
    container: 'mp3',
    codec: 'mp3',
    sampleRate: 44100,
    channels: 2,
    durationMs: 1500,
    tags: TAGS,
    artwork: true,
  },
  {
    file: 'tone-id3v23.mp3',
    container: 'mp3',
    codec: 'mp3',
    sampleRate: 22050,
    channels: 1,
    durationMs: 1000,
    tags: { ...TAGS, album: 'Fixtures ✦ Café' }, // stored as UTF-16 with BOM
    artwork: true,
  },
  {
    file: 'tone-v1only.mp3',
    container: 'mp3',
    codec: 'mp3',
    sampleRate: 32000,
    channels: 1,
    durationMs: 1000,
    tags: TAGS,
    artwork: false,
  },
  // No Xing/Info header, so the duration must stay unknown.
  { file: 'tone-notags.mp3', container: 'mp3', codec: 'mp3', sampleRate: 8000, channels: 1, tags: {}, artwork: false },
  {
    file: 'tone.m4a',
    container: 'mp4',
    codec: 'mp4a',
    sampleRate: 44100,
    channels: 2,
    durationMs: 1500,
    tags: TAGS,
    artwork: true,
  },
  {
    file: 'tone-moovend.m4a',
    container: 'mp4',
    codec: 'mp4a',
    sampleRate: 22050,
    channels: 1,
    durationMs: 1000,
    tags: TAGS,
    artwork: true,
  },
  {
    file: 'tone-alac.m4a',
    container: 'mp4',
    codec: 'alac',
    sampleRate: 16000,
    channels: 1,
    durationMs: 1000,
    tags: TAGS,
    artwork: false,
  },
  // ffmpeg writes INAM/IART/IPRD/ICRD into LIST/INFO.
  {
    file: 'tone.wav',
    container: 'wav',
    codec: 'pcm',
    sampleRate: 8000,
    channels: 1,
    durationMs: 1250,
    tags: TAGS,
    artwork: false,
  },
  {
    file: 'tone.flac',
    container: 'flac',
    codec: 'flac',
    sampleRate: 16000,
    channels: 1,
    durationMs: 1000,
    tags: { ...TAGS, album: 'Fixtures ✦ Café' },
    artwork: true,
  },
  {
    file: 'tone.ogg',
    container: 'ogg',
    codec: 'vorbis',
    sampleRate: 22050,
    channels: 2,
    durationMs: 1500,
    tags: TAGS,
    artwork: false,
    needs: 'libvorbis',
  },
  // Artwork travels as a base64 METADATA_BLOCK_PICTURE comment.
  {
    file: 'tone.opus',
    container: 'ogg',
    codec: 'opus',
    sampleRate: 48000,
    channels: 1,
    durationMs: 1500,
    tags: TAGS,
    artwork: true,
    needs: 'libopus',
  },
  // Raw ADTS has no cheap duration source.
  { file: 'tone.aac', container: 'aac', codec: 'mp4a', sampleRate: 22050, channels: 1, tags: {}, artwork: false },
];

describe('generated fixtures', () => {
  for (const c of FIXTURES) {
    if (!hasFixture(c.file)) {
      it.skip(`${c.file}: not generated (ffmpeg lacked ${c.needs ?? 'an encoder'}); rerun scripts/make-audio-fixtures.sh`, () => {});
      continue;
    }
    it(c.file, () => {
      const bytes = fixture(c.file);
      const meta = parseAudioMetadata(bytes, c.file);

      expect(meta.warnings).toEqual([]);
      expect(meta.container).toBe(c.container);
      expect(meta.codec).toBe(c.codec);
      expect(meta.sampleRate).toBe(c.sampleRate);
      expect(meta.channels).toBe(c.channels);
      expect(meta.drmProtected).toBe(false);
      if (c.durationMs === undefined) expect(meta.durationMs).toBeUndefined();
      else expect(Math.abs((meta.durationMs ?? -1e9) - c.durationMs)).toBeLessThanOrEqual(60);
      expect({ title: meta.title, artist: meta.artist, album: meta.album, year: meta.year }).toEqual({
        title: c.tags.title,
        artist: c.tags.artist,
        album: c.tags.album,
        year: c.tags.year,
      });
      if (c.artwork) expectCover(meta);
      else expect(meta.artwork).toBeUndefined();

      // Magic bytes win over a misleading (or missing) file name.
      expect(detectContainer(bytes)).toBe(c.container);
      expect(detectContainer(bytes, 'renamed.txt')).toBe(c.container);
      expect(detectContainer(bytes, c.container === 'mp3' ? 'x.m4a' : 'x.mp3')).toBe(c.container);
    });
  }

  it('returns artwork as a view into the input rather than a copy', () => {
    for (const name of ['tone-id3v24.mp3', 'tone.m4a', 'tone.flac']) {
      const bytes = fixture(name);
      expect(parseAudioMetadata(bytes).artwork?.data.buffer).toBe(bytes.buffer);
    }
  });

  it('finds moov when it sits after mdat', () => {
    const bytes = fixture('tone-moovend.m4a');
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.indexOf('moov')).toBeGreaterThan(text.indexOf('mdat'));
    expect(parseAudioMetadata(bytes).durationMs).toBe(1000);
  });

  it('flags only the formats that need a compatibility note', () => {
    expect(compatibilityNote(parseAudioMetadata(fixture('tone-alac.m4a')))).toMatch(/Apple Lossless/);
    for (const name of ['tone-id3v24.mp3', 'tone.m4a', 'tone.wav', 'tone.flac', 'tone.aac']) {
      expect(compatibilityNote(parseAudioMetadata(fixture(name)))).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------- ID3

describe('ID3v2', () => {
  it('reads v2.3 UTF-16 text (both BOMs) and APIC from a whole-tag unsynchronised tag', () => {
    const frames = bin(
      frame23('TIT2', bin([1, 0xff, 0xfe], utf16('Ünïcødé ÿ Tone', true), [0, 0])), // ÿ is FF 00 in UTF-16LE
      frame23('TPE1', bin([1, 0xfe, 0xff], utf16('Pulsefall Lab', false))),
      frame23('TALB', latin1Text('Fixtures')),
      frame23('TYER', latin1Text('2024')),
      frame23('APIC', bin([1], 'image/jpeg', [0, 3], [0xff, 0xfe], utf16('Cover', true), [0, 0], FAKE_JPEG)),
    );
    const body = unsync(frames);
    expect(body.length).toBeGreaterThan(frames.length); // the unsync path is really exercised
    const meta = parseAudioMetadata(bin(id3Tag(3, body, 0x80), MPEG_FRAMES));

    expect(meta.warnings).toEqual([]);
    expect(meta).toMatchObject({
      container: 'mp3',
      title: 'Ünïcødé ÿ Tone',
      artist: 'Pulsefall Lab',
      album: 'Fixtures',
      year: '2024',
    });
    expect(meta.artwork?.mime).toBe('image/jpeg');
    expect(meta.artwork?.data).toEqual(FAKE_JPEG);
    expect(meta.sampleRate).toBe(8000);
  });

  it('reads v2.2 TT2/TP1/TAL/TYE and PIC', () => {
    const body = bin(
      frame22('TT2', latin1Text('Old School')),
      frame22('TP1', latin1Text('Tagger 2.2')),
      frame22('TAL', latin1Text('Archive')),
      frame22('TYE', latin1Text('1999')),
      frame22('PIC', bin([0], 'PNG', [3], 'front', [0], COVER)),
    );
    const meta = parseAudioMetadata(bin(id3Tag(2, body), MPEG_FRAMES), 'old.mp3');
    expect(meta).toMatchObject({
      title: 'Old School',
      artist: 'Tagger 2.2',
      album: 'Archive',
      year: '1999',
      sampleRate: 8000,
    });
    expectCover(meta);
  });

  it('handles v2.4 extended header, per-frame unsync + data length indicator, footer, multi-values and TPE2 fallback', () => {
    const extendedHeader = [0, 0, 0, 6, 1, 0];
    const apicRaw = apic(3, 'image/jpeg', FAKE_JPEG);
    const apicStored = bin(syncsafe(apicRaw.length), unsync(apicRaw)); // DLI + unsynchronised data
    const body = bin(
      extendedHeader,
      frame24('TIT2', bin([3], utf8('Neon ✦ Tone'))),
      frame24('TPE2', bin([3], utf8('Album Artist Only'))),
      frame24('TALB', bin([3], utf8('Fixtures\u0000Bonus Disc'))),
      frame24('TDRC', latin1Text('2024-05-01T12:00')),
      frame24('APIC', apicStored, 0x03),
    );
    const header = bin('ID3', [4, 0, 0x50], syncsafe(body.length));
    const footer = bin('3DI', [4, 0, 0x50], syncsafe(body.length));
    const meta = parseAudioMetadata(bin(header, body, footer, MPEG_FRAMES));

    expect(meta.warnings).toEqual([]);
    expect(meta).toMatchObject({
      title: 'Neon ✦ Tone',
      artist: 'Album Artist Only',
      album: 'Fixtures, Bonus Disc',
      year: '2024',
    });
    expect(meta.artwork?.data).toEqual(FAKE_JPEG);
    expect(meta.sampleRate).toBe(8000); // the footer was skipped correctly to reach the audio
  });

  it('recovers from a v2.4 tag that wrongly uses plain (non-syncsafe) frame sizes', () => {
    const longTitle = 'long title '.repeat(24) + 'end'; // 268 bytes with the encoding byte: plain 0x10C, read as syncsafe 140
    const title = bin([0], longTitle);
    const body = bin(frame23('TIT2', title), frame23('TPE1', latin1Text('Pulsefall Lab'))); // v2.3-style sizes in a v2.4 tag
    const meta = parseAudioMetadata(bin(id3Tag(4, body), MPEG_FRAMES));
    expect(meta.artist).toBe('Pulsefall Lab');
    expect(meta.title?.length).toBeLessThanOrEqual(200);
    expect(meta.title?.startsWith('long title long title')).toBe(true);
  });

  it('prefers the front cover over other picture types', () => {
    const otherFirst = id3Tag(
      3,
      bin(frame23('APIC', apic(0, 'image/jpeg', FAKE_JPEG)), frame23('APIC', apic(3, 'image/png', COVER))),
    );
    expectCover(parseAudioMetadata(bin(otherFirst, MPEG_FRAMES)));
    const coverFirst = id3Tag(
      3,
      bin(frame23('APIC', apic(3, 'image/png', COVER)), frame23('APIC', apic(4, 'image/jpeg', FAKE_JPEG))),
    );
    expectCover(parseAudioMetadata(bin(coverFirst, MPEG_FRAMES)));
  });

  it('falls back to ID3v1 for fields the v2 tag lacks', () => {
    const v1 = bin(
      'TAG',
      'V1 Title'.padEnd(30, '\0'),
      'V1 Artist'.padEnd(30, '\0'),
      'V1 Album'.padEnd(30, '\0'),
      '1987',
      zeros(30),
      [255],
    );
    const v2 = id3Tag(3, frame23('TALB', latin1Text('V2 Album')));
    const meta = parseAudioMetadata(bin(v2, MPEG_FRAMES, v1));
    expect(meta).toMatchObject({ title: 'V1 Title', artist: 'V1 Artist', album: 'V2 Album', year: '1987' });
  });

  it('reads an ID3v2.4 tag appended at the end of the file (before ID3v1)', () => {
    const body = frame24('TIT2', latin1Text('Appended Title'));
    const appended = bin('ID3', [4, 0, 0x10], syncsafe(body.length), body, '3DI', [4, 0, 0x10], syncsafe(body.length));
    const v1 = bin(
      'TAG',
      'V1 Title'.padEnd(30, '\0'),
      'V1 Artist'.padEnd(30, '\0'),
      zeros(30),
      '2001',
      zeros(30),
      [255],
    );
    const meta = parseAudioMetadata(bin(MPEG_FRAMES, appended, v1), 'appended.mp3');
    expect(meta).toMatchObject({ title: 'Appended Title', artist: 'V1 Artist', year: '2001', sampleRate: 8000 });
  });

  it('clamps a tag that claims to be larger than the file', () => {
    const body = frame23('TIT2', latin1Text('Still Readable'));
    const tag = bin('ID3', [3, 0, 0], syncsafe(100_000), body);
    const meta = parseAudioMetadata(tag, 'cut.mp3');
    expect(meta.title).toBe('Still Readable');
    expect(meta.warnings.join(' ')).toMatch(/larger than the file/);
  });

  it('ignores artwork over 8 MB with a warning', () => {
    const huge = new Uint8Array(8 * 1024 * 1024 + 16);
    huge.set(PNG_SIGNATURE);
    const tag = id3Tag(3, bin(frame23('TIT2', latin1Text('Big Art')), frame23('APIC', apic(3, 'image/png', huge))));
    const meta = parseAudioMetadata(bin(tag, MPEG_FRAMES));
    expect(meta.title).toBe('Big Art');
    expect(meta.artwork).toBeUndefined();
    expect(meta.warnings.join(' ')).toMatch(/8 MB/);
  });

  it('reads an ID3v2 tag in front of raw AAC', () => {
    const bytes = bin(id3Tag(4, frame24('TIT2', latin1Text('Radio Rip'))), fixture('tone.aac'));
    expect(detectContainer(bytes)).toBe('aac');
    expect(parseAudioMetadata(bytes)).toMatchObject({
      container: 'aac',
      codec: 'mp4a',
      title: 'Radio Rip',
      sampleRate: 22050,
      channels: 1,
    });
  });
});

describe('MPEG duration', () => {
  it('uses the VBRI frame count', () => {
    const header = [0xff, 0xfb, 0x90, 0x00]; // MPEG-1 layer III, 128 kbps, 44.1 kHz, stereo: 417-byte frames
    const vbri = bin('VBRI', be16(1), be16(0), be16(75), be32(417 * 100), be32(100));
    const first = bin(header, zeros(32), vbri);
    const frames = bin(first, zeros(417 - first.length), header, zeros(413));
    const meta = parseAudioMetadata(frames, 'vbr.mp3');
    expect(meta).toMatchObject({ codec: 'mp3', sampleRate: 44100, channels: 2 });
    expect(meta.durationMs).toBe(Math.round((100 * 1152 * 1000) / 44100));
  });
});

// ---------------------------------------------------------------- MP4

describe('MP4', () => {
  it('reads a plain AAC track', () => {
    const meta = parseAudioMetadata(m4a({}));
    expect(meta).toMatchObject({
      container: 'mp4',
      codec: 'mp4a',
      channels: 2,
      sampleRate: 44100,
      durationMs: 2500,
      drmProtected: false,
    });
    expect(compatibilityNote(meta)).toBeUndefined();
  });

  it('flags FairPlay drms sample entries with sinf as DRM', () => {
    const meta = parseAudioMetadata(m4a({ entry: audioEntry('drms', 2, 44100, sinf()) }), 'Purchased.m4p');
    expect(meta).toMatchObject({ drmProtected: true, codec: 'drms' });
    expect(compatibilityNote(meta)).toBe(
      'This file is copy-protected (DRM), usually from Apple Music or an old iTunes purchase. Pulsefall can only play unprotected files like MP3s or DRM-free M4As.',
    );
  });

  it('flags a sinf inside an mp4a entry, an enca entry, and the M4P brand as DRM', () => {
    expect(parseAudioMetadata(m4a({ entry: audioEntry('mp4a', 2, 44100, sinf()) }))).toMatchObject({
      drmProtected: true,
      codec: 'mp4a',
    });
    expect(parseAudioMetadata(m4a({ entry: audioEntry('enca', 2, 44100) }))).toMatchObject({
      drmProtected: true,
      codec: 'enca',
    });
    expect(parseAudioMetadata(m4a({ brand: 'M4P ' })).drmProtected).toBe(true);
  });

  it('reads ilst inside a QuickTime-style meta atom without version/flags', () => {
    const ilst = atom(
      'ilst',
      ilstItem('\u00a9nam', 1, utf8('QuickTime Title')),
      ilstItem('aART', 1, utf8('Album Artist')),
      ilstItem('\u00a9day', 1, '2019-03-04T08:00:00Z'),
      ilstItem('covr', 13, FAKE_JPEG),
    );
    const udta = atom('udta', atom('meta', hdlr('mdir'), ilst)); // no FULL_BOX bytes
    const meta = parseAudioMetadata(m4a({ udta }));
    expect(meta).toMatchObject({ title: 'QuickTime Title', artist: 'Album Artist', year: '2019' });
    expect(meta.artwork).toEqual({ mime: 'image/jpeg', data: FAKE_JPEG });
  });

  it('handles 64-bit atom sizes, size-0 atoms and version 1 mvhd', () => {
    const mvhdV1 = atom('mvhd', [1, 0, 0, 0], zeros(16), be32(48000), be32(0), be32(96000), zeros(80));
    const mdat64 = bin(be32(1), 'mdat', be32(0), be32(16 + 32), zeros(32));
    const sizeZeroTail = bin(be32(0), 'free', zeros(20)); // size 0: extends to the end of the file
    const meta = parseAudioMetadata(bin(ftyp(), moov({ movieHeader: mvhdV1 }), mdat64, sizeZeroTail));
    expect(meta.warnings).toEqual([]);
    expect(meta.durationMs).toBe(2000);
    expect(meta.codec).toBe('mp4a');
  });

  it('skips a video track to find the audio track', () => {
    const video = trak('vide', atom('avc1', zeros(78)));
    const meta = parseAudioMetadata(m4a({ tracks: [video, trak('soun', audioEntry('mp4a', 1, 48000))] }));
    expect(meta).toMatchObject({ codec: 'mp4a', channels: 1, sampleRate: 48000 });
  });

  it('explains Dolby tracks', () => {
    const meta = parseAudioMetadata(m4a({ entry: audioEntry('ec-3', 6, 48000) }));
    expect(meta.codec).toBe('ec-3');
    expect(compatibilityNote(meta)).toMatch(/Dolby/);
  });

  it('keeps tags from a faststart file cut in half, and warns about the missing moov otherwise', () => {
    const fast = fixture('tone.m4a');
    const half = parseAudioMetadata(fast.subarray(0, fast.length >> 1));
    expect(half).toMatchObject({ title: TAGS.title, durationMs: 1500 });
    expect(half.warnings.join(' ')).toMatch(/truncated/);

    const end = fixture('tone-moovend.m4a');
    const cut = parseAudioMetadata(end.subarray(0, end.length >> 1), 'tone.m4a');
    expect(cut.title).toBeUndefined();
    expect(cut.warnings.join(' ')).toMatch(/moov/);
  });

  it('finds moov behind a large mdat without reading the payload', () => {
    const mdat = new Uint8Array(24 * 1024 * 1024);
    mdat.set(bin(be32(mdat.length), 'mdat'));
    const bytes = bin(ftyp(), mdat, moov({}));
    const start = performance.now();
    const meta = parseAudioMetadata(bytes);
    expect(performance.now() - start).toBeLessThan(250);
    expect(meta.durationMs).toBe(2500);
  });
});

// ---------------------------------------------------------------- WAV, FLAC, Ogg

describe('WAV', () => {
  it('reads WAVE_FORMAT_EXTENSIBLE, an odd-sized id3 chunk and LIST/INFO', () => {
    const fmt = bin(
      'fmt ',
      le32(40),
      le16(0xfffe),
      le16(2),
      le32(48000),
      le32(192000),
      le16(4),
      le16(16),
      le16(22),
      le16(16),
      le32(3),
      le16(1),
      zeros(14),
    );
    const data = bin('data', le32(19200), zeros(19200)); // 100 ms
    const id3 = id3Tag(3, frame23('TIT2', latin1Text('From ID3 chunk')));
    expect(id3.length % 2).toBe(1); // odd-sized chunk: the walker must skip its pad byte
    const id3Chunk = bin('id3 ', le32(id3.length), id3, [0]);
    const info = bin('INFO', 'INAM', le32(11), 'Info Title', [0], [0], 'IART', le32(12), 'Info Artist', [0]);
    const list = bin('LIST', le32(info.length), info);
    const body = bin('WAVE', fmt, data, id3Chunk, list);
    const meta = parseAudioMetadata(bin('RIFF', le32(body.length), body));

    expect(meta.warnings).toEqual([]);
    expect(meta).toMatchObject({ container: 'wav', codec: 'pcm', channels: 2, sampleRate: 48000, durationMs: 100 });
    expect(meta).toMatchObject({ title: 'From ID3 chunk', artist: 'Info Artist' });
  });

  it('reports the playable duration of a truncated file', () => {
    const wav = fixture('tone.wav');
    const meta = parseAudioMetadata(wav.subarray(0, wav.length >> 1));
    expect(meta.title).toBe(TAGS.title);
    expect(meta.durationMs).toBeGreaterThan(500);
    expect(meta.durationMs).toBeLessThan(1250);
    expect(meta.warnings.join(' ')).toMatch(/truncated/);
  });
});

describe('FLAC', () => {
  it('tolerates an ID3v2 tag before fLaC and prefers the Vorbis comments', () => {
    const tag = id3Tag(3, bin(frame23('TIT2', latin1Text('ID3 Title')), frame23('TCON', latin1Text('Genre'))));
    const bytes = bin(tag, fixture('tone.flac'));
    expect(detectContainer(bytes, 'tone.mp3')).toBe('flac');
    const meta = parseAudioMetadata(bytes);
    expect(meta).toMatchObject({ container: 'flac', title: TAGS.title, sampleRate: 16000, durationMs: 1000 });
    expectCover(meta);
  });

  it('reads tags when cut inside the padding block', () => {
    const flac = fixture('tone.flac');
    const meta = parseAudioMetadata(flac.subarray(0, 1000));
    expect(meta).toMatchObject({ title: TAGS.title, durationMs: 1000 });
    expect(meta.warnings.join(' ')).toMatch(/cut off/);
  });
});

describe('Ogg', () => {
  const identification = bin([1], 'vorbis', le32(0), [2], le32(44100), le32(0), le32(96000), le32(0), [0xb8, 1]);

  it('reads a Vorbis comment packet that spans several pages, with a picture', () => {
    const picture = Buffer.from(flacPictureBlock(3, 'image/png', COVER)).toString('base64');
    const comment = bin(
      [3],
      'vorbis',
      vorbisComment([
        'title=Spanning Pages',
        'ARTIST=Ogg Lab',
        'Album=Pages',
        'DATE=2023-02-03',
        `COMMENT=${'x'.repeat(700)}`,
        `METADATA_BLOCK_PICTURE=${picture}`,
      ]),
      [1],
    );
    expect(comment.length).toBeGreaterThan(3 * 255);
    const audio = Uint8Array.from({ length: 40 }, (_, i) => i);
    const bytes = oggStream(0x1234, [identification, comment, audio], 2, 88200);
    const meta = parseAudioMetadata(bytes);

    expect(meta.warnings).toEqual([]);
    expect(meta).toMatchObject({ container: 'ogg', codec: 'vorbis', channels: 2, sampleRate: 44100, durationMs: 2000 });
    expect(meta).toMatchObject({ title: 'Spanning Pages', artist: 'Ogg Lab', album: 'Pages', year: '2023' });
    expectCover(meta);
  });

  it('reads Opus pre-skip into the duration', () => {
    const head = bin('OpusHead', [1, 2], le16(312), le32(44100), le16(0), [0]);
    const tags = bin('OpusTags', vorbisComment(['TITLE=Opus Hand Made']));
    const bytes = oggStream(9, [head, tags, Uint8Array.from([1, 2, 3])], 1, 48000 + 312);
    expect(parseAudioMetadata(bytes)).toMatchObject({
      codec: 'opus',
      channels: 2,
      sampleRate: 48000,
      durationMs: 1000,
      title: 'Opus Hand Made',
    });
  });
});

// ---------------------------------------------------------------- robustness

describe('robustness', () => {
  const names = FIXTURES.map((c) => c.file).filter(hasFixture);

  it('never throws on truncated fixtures', () => {
    for (const name of names) {
      const bytes = fixture(name);
      for (const length of [0, 3, 10, 100, bytes.length >> 1, bytes.length - 1]) {
        const cut = bytes.slice(0, length);
        const meta = parseAudioMetadata(cut, name);
        expectWellFormed(meta);
        if (length === 0) expect(meta.warnings.length).toBeGreaterThan(0);
        expect(() => compatibilityNote(meta)).not.toThrow();
      }
    }
  });

  it('never throws on random garbage, with or without a believable magic number', () => {
    const prefixes: Part[] = [
      [],
      'ID3\x04\x00\x00',
      'ID3\x03\x00\xc0',
      'ID3\x02\x00\x00',
      '\x00\x00\x00\x20ftypM4A ',
      'RIFF\x00\x00\x00\x00WAVE',
      'fLaC',
      'OggS\x00\x02',
      [0xff, 0xfb, 0x90, 0x00],
      [0xff, 0xf1, 0x50, 0x80],
    ];
    const fileNames = [undefined, 'x.mp3', 'x.m4a', 'x.wav', 'x.flac', 'x.ogg', 'x.aac'];
    for (let seed = 1; seed <= 120; seed++) {
      const random = rng(seed);
      const garbage = Uint8Array.from({ length: 1024 }, () => Math.floor(random() * 256));
      const prefix = prefixes[seed % prefixes.length];
      const meta = parseAudioMetadata(bin(prefix, garbage), fileNames[seed % fileNames.length]);
      expectWellFormed(meta);
    }
  });

  it('never throws when header bytes of real files are corrupted', () => {
    const random = rng(42);
    for (const name of names) {
      const original = fixture(name);
      for (let round = 0; round < 60; round++) {
        const bytes = original.slice();
        const flips = 1 + Math.floor(random() * 8);
        for (let i = 0; i < flips; i++) {
          // Mostly hit the header regions at both ends, where the parser actually looks.
          const nearEnd = random() < 0.3;
          const span = Math.min(bytes.length, 2048);
          const pos = nearEnd ? bytes.length - 1 - Math.floor(random() * span) : Math.floor(random() * span);
          bytes[pos] = Math.floor(random() * 256);
        }
        expectWellFormed(parseAudioMetadata(bytes, name));
      }
    }
  });

  it('survives input that is not a Uint8Array', () => {
    const meta = parseAudioMetadata(undefined as unknown as Uint8Array);
    expect(meta.container).toBe('unknown');
    expect(meta.warnings.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------- detection

describe('detectContainer', () => {
  const noise = Uint8Array.from({ length: 256 }, (_, i) => (i * 37 + 11) & 0x7f);

  it('falls back to the extension when the bytes are inconclusive', () => {
    expect(detectContainer(noise, 'song.M4A')).toBe('mp4');
    expect(detectContainer(noise, 'song.opus')).toBe('ogg');
    expect(detectContainer(noise, 'song.wave')).toBe('wav');
    expect(detectContainer(noise, 'song.aac')).toBe('aac');
    expect(detectContainer(noise, 'song')).toBe('unknown');
    expect(detectContainer(noise)).toBe('unknown');
    expect(detectContainer(new Uint8Array(0), 'empty.mp3')).toBe('mp3');
  });

  it('looks past ID3v2 tags', () => {
    const tag = id3Tag(3, frame23('TIT2', latin1Text('x')));
    expect(detectContainer(bin(tag, MPEG_FRAMES), 'x.flac')).toBe('mp3');
    expect(detectContainer(bin(tag, 'fLaC', zeros(40)))).toBe('flac');
    expect(detectContainer(bin(tag, noise), 'x.flac')).toBe('flac');
    expect(detectContainer(bin(tag, noise))).toBe('mp3');
  });

  it('does not mistake other RIFF files for WAV', () => {
    expect(detectContainer(bin('RIFF', le32(100), 'AVI ', zeros(100)))).toBe('unknown');
  });
});

// ---------------------------------------------------------------- file names

describe('guessFromFileName', () => {
  const cases: [string, { title: string; artist?: string }][] = [
    ['01 - Artist - Title (Remix).mp3', { artist: 'Artist', title: 'Title (Remix)' }],
    ['01 Title.mp3', { title: 'Title' }],
    ['01. Artist - Title.m4a', { artist: 'Artist', title: 'Title' }],
    ['07 - Title Only.mp3', { title: 'Title Only' }],
    ['1-03 Disc Track.flac', { title: 'Disc Track' }],
    ['1. First.wav', { title: 'First' }],
    ['Artist - Title.MP3', { artist: 'Artist', title: 'Title' }],
    ['Artist – Title.opus', { artist: 'Artist', title: 'Title' }],
    ['Artist - Title - Live at Wembley.ogg', { artist: 'Artist', title: 'Title - Live at Wembley' }],
    ['Daft_Punk_-_One_More_Time.mp3', { artist: 'Daft Punk', title: 'One More Time' }],
    ['02_some_song.m4a', { title: 'some song' }],
    ['Jay-Z - Encore.mp3', { artist: 'Jay-Z', title: 'Encore' }],
    ['3 Doors Down - Kryptonite.mp3', { artist: '3 Doors Down', title: 'Kryptonite' }],
    ['JustATitle.wav', { title: 'JustATitle' }],
    ['Mr. Brightside', { title: 'Mr. Brightside' }],
    ['Hits Vol.2.aac', { title: 'Hits Vol.2' }],
    ['song.final.Flac', { title: 'song.final' }],
    ['  spaced   out  .mp3', { title: 'spaced out' }],
    ['/var/mobile/Music/My Song.m4a', { title: 'My Song' }],
    ['C:\\Music\\Band - Song.wav', { artist: 'Band', title: 'Song' }],
    ['', { title: 'Untitled' }],
  ];
  for (const [input, expected] of cases) {
    it(JSON.stringify(input), () => {
      expect(guessFromFileName(input)).toEqual(expected);
    });
  }
});

// ---------------------------------------------------------------- compatibility notes

describe('compatibilityNote', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const base: AudioMetadata = { container: 'mp3', codec: 'mp3', drmProtected: false, warnings: [] };
  const opus: AudioMetadata = { ...base, container: 'ogg', codec: 'opus' };
  const ua = (userAgent: string): void => {
    vi.stubGlobal('navigator', { userAgent });
  };

  it('explains DRM first, whatever the codec', () => {
    expect(compatibilityNote({ ...base, container: 'mp4', codec: 'alac', drmProtected: true })).toMatch(/DRM/);
  });

  it('explains unknown containers', () => {
    expect(compatibilityNote({ ...base, container: 'unknown', codec: undefined })).toMatch(/MP3/);
  });

  it('warns about OGG/Opus only on iOS before 17', () => {
    ua(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    );
    expect(compatibilityNote(opus)).toMatch(/older iPhones/);
    expect(compatibilityNote({ ...opus, codec: 'vorbis' })).toMatch(/older iPhones/);
    expect(compatibilityNote(base)).toBeUndefined();

    ua(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
    );
    expect(compatibilityNote(opus)).toMatch(/older iPhones/); // iPadOS desktop mode

    ua(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    );
    expect(compatibilityNote(opus)).toBeUndefined();

    ua(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    );
    expect(compatibilityNote(opus)).toBeUndefined();
  });
});
