/**
 * Audio metadata for imported songs: tags, embedded artwork, basic stream info
 * and DRM status, read straight from the file's bytes on the main thread.
 *
 * Ground rules:
 * - Zero dependencies and never throws. Every parser reads through a
 *   bounds-checked ByteReader; anything unexpected becomes a `warnings` entry
 *   and whatever was read before the problem is still returned.
 * - Only header regions are touched (ID3 tags, MPEG/ADTS frame headers, the MP4
 *   `moov` tree, FLAC metadata blocks, Ogg header pages, WAV chunk headers).
 *   Audio payloads are skipped by size and the input is never copied as a whole;
 *   artwork is a subarray view of the input wherever it is stored contiguously.
 */

export type AudioContainer = 'mp3' | 'mp4' | 'wav' | 'flac' | 'ogg' | 'aac' | 'unknown';

export interface AudioMetadata {
  container: AudioContainer;
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  /** `data` may be a subarray view of the input bytes. */
  artwork?: { mime: string; data: Uint8Array };
  drmProtected: boolean;
  /** e.g. 'mp3', 'mp4a', 'alac', 'ac-3', 'ec-3', 'drms', 'enca', 'flac', 'vorbis', 'opus', 'pcm' */
  codec?: string;
  sampleRate?: number;
  channels?: number;
  /** Only set when cheaply and reliably derivable from headers. */
  durationMs?: number;
  warnings: string[];
}

// ---------------------------------------------------------------- limits

const MAX_ARTWORK_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARS = 200;
/** Bytes decoded per text value: far more than MAX_TEXT_CHARS needs in any encoding. */
const MAX_TEXT_BYTES = 4096;
const MAX_WARNINGS = 32;
const MAX_ID3_TAGS = 8;
const MAX_ID3_FRAMES = 2048;
const MAX_ATOMS_PER_LEVEL = 4096;
const MAX_FLAC_BLOCKS = 256;
const MAX_VORBIS_COMMENTS = 4096;
const MAX_WAV_CHUNKS = 1024;
const MAX_OGG_HEADER_PAGES = 512;
/** Ogg header packets bigger than this (giant cover art) are not assembled. */
const MAX_OGG_HEADER_BYTES = 12 * 1024 * 1024;
const MAX_OGG_PAGE_BYTES = 27 + 255 + 255 * 255;
/** How far past the ID3 tag we search for the first MPEG/ADTS frame. */
const SYNC_SCAN_BYTES = 256 * 1024;

// ---------------------------------------------------------------- byte reader

/** Bounds-aware view over the input. Reads past the end throw RangeError, which callers turn into warnings. */
class ByteReader {
  readonly length: number;
  private readonly view: DataView;

  constructor(readonly bytes: Uint8Array) {
    this.length = bytes.length;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  /** True when `n` bytes starting at `pos` lie inside the buffer. */
  has(pos: number, n: number): boolean {
    return pos >= 0 && n >= 0 && pos + n <= this.length;
  }

  u8(pos: number): number {
    return this.view.getUint8(pos);
  }
  u16be(pos: number): number {
    return this.view.getUint16(pos);
  }
  u16le(pos: number): number {
    return this.view.getUint16(pos, true);
  }
  u24be(pos: number): number {
    return (this.view.getUint16(pos) << 8) | this.view.getUint8(pos + 2);
  }
  u32be(pos: number): number {
    return this.view.getUint32(pos);
  }
  u32le(pos: number): number {
    return this.view.getUint32(pos, true);
  }
  /** Unsigned 64-bit as a double: exact below 2^53, which covers every real file offset. */
  u64be(pos: number): number {
    return this.view.getUint32(pos) * 2 ** 32 + this.view.getUint32(pos + 4);
  }
  u64le(pos: number): number {
    return this.view.getUint32(pos + 4, true) * 2 ** 32 + this.view.getUint32(pos, true);
  }
  f64be(pos: number): number {
    return this.view.getFloat64(pos);
  }

  /** Latin-1 text of up to `n` bytes (fourccs, magic numbers). */
  ascii(pos: number, n: number): string {
    return decodeLatin1(this.slice(pos, pos + n));
  }

  /** View of [start, end) clamped to the buffer. Never copies. */
  slice(start: number, end: number): Uint8Array {
    const s = Math.min(Math.max(0, start), this.length);
    const e = Math.min(Math.max(s, end), this.length);
    return this.bytes.subarray(s, e);
  }

  sub(start: number, end: number): ByteReader {
    return new ByteReader(this.slice(start, end));
  }

  indexOf(byte: number, from: number, to = this.length): number {
    const i = this.slice(from, to).indexOf(byte);
    return i < 0 ? -1 : Math.max(0, from) + i;
  }
}

// ---------------------------------------------------------------- text

function decodeLatin1(bytes: Uint8Array): string {
  const n = Math.min(bytes.length, MAX_TEXT_BYTES);
  let out = '';
  for (let i = 0; i < n; i += 1024) {
    out += String.fromCharCode(...bytes.subarray(i, Math.min(n, i + 1024)));
  }
  return out;
}

function decodeUtf16(bytes: Uint8Array, littleEndian: boolean): string {
  const n = Math.min(bytes.length, MAX_TEXT_BYTES) & ~1;
  const units: number[] = [];
  for (let i = 0; i < n; i += 2) {
    units.push(littleEndian ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1]);
  }
  let out = '';
  for (let i = 0; i < units.length; i += 1024) out += String.fromCharCode(...units.slice(i, i + 1024));
  return out;
}

/** UTF-16 that should start with a BOM; without one, guess the byte order from where the zero bytes sit. */
function decodeUtf16WithBom(bytes: Uint8Array, defaultLittleEndian: boolean): string {
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return decodeUtf16(bytes.subarray(2), true);
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return decodeUtf16(bytes.subarray(2), false);
  }
  let evenZeros = 0;
  let oddZeros = 0;
  for (let i = 0; i < Math.min(bytes.length, 64); i++) {
    if (bytes[i] === 0) i % 2 === 0 ? evenZeros++ : oddZeros++;
  }
  const littleEndian = evenZeros === oddZeros ? defaultLittleEndian : oddZeros > evenZeros;
  return decodeUtf16(bytes, littleEndian);
}

let utf8Decoder: TextDecoder | undefined;
let strictUtf8Decoder: TextDecoder | undefined;

function decodeUtf8(bytes: Uint8Array): string {
  const slice = bytes.subarray(0, MAX_TEXT_BYTES);
  try {
    utf8Decoder ??= new TextDecoder('utf-8');
    return utf8Decoder.decode(slice);
  } catch {
    return decodeLatin1(slice);
  }
}

/** For fields with no declared encoding (ID3v1, RIFF INFO): UTF-8 when valid, else Latin-1. */
function decodeUtf8OrLatin1(bytes: Uint8Array): string {
  const slice = bytes.subarray(0, MAX_TEXT_BYTES);
  try {
    strictUtf8Decoder ??= new TextDecoder('utf-8', { fatal: true });
    return strictUtf8Decoder.decode(slice);
  } catch {
    return decodeLatin1(slice);
  }
}

/** Cuts a fixed-width field at its first NUL. */
function untilNul(bytes: Uint8Array): Uint8Array {
  const i = bytes.indexOf(0);
  return i < 0 ? bytes : bytes.subarray(0, i);
}

/** Removes control characters and BOMs, trims, caps the length; empty becomes undefined. */
function cleanText(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  let text = raw
    .replace(/[\u0000-\u001f\u007f-\u009f\ufeff\ufffe]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS);
    if (/[\ud800-\udbff]$/.test(text)) text = text.slice(0, -1);
    text = text.trimEnd();
  }
  return text === '' ? undefined : text;
}

/** "2024-05-01T07:00:00Z" -> "2024"; anything without a 4-digit year is kept as cleaned text. */
function normalizeYear(raw: string | undefined): string | undefined {
  const text = cleanText(raw);
  if (text === undefined) return undefined;
  return /(?:^|\D)(\d{4})(?!\d)/.exec(text)?.[1] ?? text;
}

/** Joins NUL-separated multi-values (ID3v2.4) into one display string. */
function joinValues(raw: string): string {
  const values = raw
    .split('\u0000')
    .map((v) => cleanText(v))
    .filter((v): v is string => v !== undefined);
  return [...new Set(values)].join(', ');
}

// ---------------------------------------------------------------- images

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function sniffImageMime(data: Uint8Array): string | undefined {
  if (PNG_SIGNATURE.every((b, i) => data[i] === b)) return 'image/png';
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  const head = decodeLatin1(data.subarray(0, 12));
  if (head.startsWith('GIF8')) return 'image/gif';
  if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP') return 'image/webp';
  if (head.startsWith('BM')) return 'image/bmp';
  return undefined;
}

function normalizeImageMime(declared: string | undefined): string | undefined {
  const mime = declared?.trim().toLowerCase();
  if (!mime) return undefined;
  if (mime === 'jpg' || mime === 'jpeg' || mime === 'image/jpg') return 'image/jpeg';
  if (mime === 'png' || mime === 'gif' || mime === 'bmp' || mime === 'webp') return `image/${mime}`;
  return mime.startsWith('image/') ? mime : undefined;
}

// ---------------------------------------------------------------- parse context

type TagField = 'title' | 'artist' | 'albumArtist' | 'album' | 'year';

interface Picture {
  mime: string;
  data: Uint8Array;
  /** ID3/FLAC picture type; 3 = front cover. */
  pictureType: number;
}

const FRONT_COVER = 3;

class ParseContext {
  readonly tags: Partial<Record<TagField, string>> = {};
  picture?: Picture;

  constructor(
    readonly r: ByteReader,
    readonly meta: AudioMetadata,
  ) {}

  warn(message: string): void {
    const { warnings } = this.meta;
    if (warnings.length < MAX_WARNINGS && !warnings.includes(message)) warnings.push(message);
  }

  /** Keeps the first value seen: parsers offer sources in priority order. */
  setTag(field: TagField, raw: string | undefined): void {
    if (this.tags[field] !== undefined) return;
    const value = field === 'year' ? normalizeYear(raw) : cleanText(raw);
    if (value !== undefined) this.tags[field] = value;
  }

  /** Keeps the first front cover, or the first picture of any type until a front cover turns up. */
  offerArtwork(data: Uint8Array, declaredMime: string | undefined, pictureType: number): void {
    if (data.length === 0) return;
    if (this.picture?.pictureType === FRONT_COVER) return;
    if (this.picture && pictureType !== FRONT_COVER) return;
    if (data.length > MAX_ARTWORK_BYTES) {
      this.warn('Embedded artwork is larger than 8 MB and was ignored');
      return;
    }
    const mime = sniffImageMime(data) ?? normalizeImageMime(declaredMime);
    if (!mime) {
      this.warn('Embedded artwork is in an unrecognized image format and was ignored');
      return;
    }
    this.picture = { mime, data, pictureType };
  }

  /** Copies collected tags onto the result; runs even when a parser bailed out midway. */
  applyTags(): void {
    const { meta, tags } = this;
    if (tags.title) meta.title = tags.title;
    const artist = tags.artist ?? tags.albumArtist;
    if (artist) meta.artist = artist;
    if (tags.album) meta.album = tags.album;
    if (tags.year) meta.year = tags.year;
    if (this.picture) meta.artwork = { mime: this.picture.mime, data: this.picture.data };
  }
}

function describeError(err: unknown): string {
  if (err instanceof RangeError) return 'data ends unexpectedly';
  return err instanceof Error ? err.message : String(err);
}

/** Runs one parsing step, turning any error into a warning so later steps still run. */
function guarded<T>(ctx: ParseContext, what: string, step: () => T): T | undefined {
  try {
    return step();
  } catch (err) {
    ctx.warn(`Could not fully read ${what} (${describeError(err)})`);
    return undefined;
  }
}

function printable(fourcc: string): string {
  return fourcc.replace(/[^\x20-\x7e\xa9]/g, '?');
}

function isPrintableFourcc(fourcc: string): boolean {
  return fourcc.length === 4 && /^[\x20-\x7e\xa9]{4}$/.test(fourcc);
}

// ---------------------------------------------------------------- ID3v2

interface Id3Span {
  start: number;
  /** Declared end (header + body + footer); may lie past the end of a truncated file. */
  end: number;
}

function syncsafe(r: ByteReader, pos: number): number {
  return (r.u8(pos) << 21) | (r.u8(pos + 1) << 14) | (r.u8(pos + 2) << 7) | r.u8(pos + 3);
}

/** Length of a well-formed ID3v2 tag header at `pos` (header + body + footer), or 0. */
function id3v2TagLength(r: ByteReader, pos: number): number {
  if (!r.has(pos, 10) || r.ascii(pos, 3) !== 'ID3') return 0;
  const major = r.u8(pos + 3);
  if (major === 0xff || r.u8(pos + 4) === 0xff) return 0;
  if ((r.u32be(pos + 6) & 0x80808080) !== 0) return 0;
  const footer = major === 4 && (r.u8(pos + 5) & 0x10) !== 0 ? 10 : 0;
  return 10 + syncsafe(r, pos + 6) + footer;
}

/** Consecutive ID3v2 tags starting at `pos` (some files carry more than one). */
function findLeadingId3v2(r: ByteReader, pos: number): Id3Span[] {
  const spans: Id3Span[] = [];
  let p = pos;
  while (spans.length < MAX_ID3_TAGS) {
    const length = id3v2TagLength(r, p);
    if (length === 0) break;
    spans.push({ start: p, end: p + length });
    p += length;
  }
  return spans;
}

function endOfTags(spans: Id3Span[], fallback: number): number {
  return spans.length > 0 ? spans[spans.length - 1].end : fallback;
}

/** An ID3v2.4 tag appended at the end of the file (located by its "3DI" footer), possibly before an ID3v1 tag. */
function findAppendedId3v2(r: ByteReader): Id3Span | undefined {
  for (const end of [r.length, r.length - 128]) {
    const footer = end - 10;
    if (!r.has(footer, 10) || r.ascii(footer, 3) !== '3DI') continue;
    if ((r.u32be(footer + 6) & 0x80808080) !== 0) continue;
    const start = footer - syncsafe(r, footer + 6) - 10;
    if (start >= 0 && id3v2TagLength(r, start) === end - start) return { start, end };
  }
  return undefined;
}

/** Undoes ID3 unsynchronisation: every 0xFF 0x00 pair becomes 0xFF. Copies only when needed. */
function removeUnsync(bytes: Uint8Array): Uint8Array {
  if (bytes.indexOf(0xff) < 0) return bytes;
  const out = new Uint8Array(bytes.length);
  let n = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    out[n++] = b;
    if (b === 0xff && bytes[i + 1] === 0x00) i++;
  }
  return out.subarray(0, n);
}

const ID3_TEXT_FRAMES: Record<string, TagField> = {
  TIT2: 'title',
  TT2: 'title',
  TPE1: 'artist',
  TP1: 'artist',
  TPE2: 'albumArtist',
  TP2: 'albumArtist',
  TALB: 'album',
  TAL: 'album',
  TYER: 'year',
  TDRC: 'year',
  TYE: 'year',
};

function isFrameId(id: string, length: number): boolean {
  return id.length === length && /^[A-Z0-9]+$/.test(id);
}

function decodeId3Text(encoding: number, bytes: Uint8Array): string {
  switch (encoding) {
    case 1:
      return decodeUtf16WithBom(bytes, true);
    case 2:
      return decodeUtf16WithBom(bytes, false);
    case 3:
      return decodeUtf8(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes);
    default:
      return decodeLatin1(bytes);
  }
}

/** Index of the string terminator at or after `from` (two aligned zero bytes for UTF-16), or -1. */
function findTerminator(bytes: Uint8Array, from: number, encoding: number): number {
  if (encoding === 1 || encoding === 2) {
    for (let i = from; i + 1 < bytes.length; i += 2) if (bytes[i] === 0 && bytes[i + 1] === 0) return i;
    return -1;
  }
  return bytes.indexOf(0, from);
}

function parseId3v2(r: ByteReader, span: Id3Span, ctx: ParseContext): void {
  guarded(ctx, 'the ID3v2 tag', () => {
    const major = r.u8(span.start + 3);
    const flags = r.u8(span.start + 5);
    if (major < 2 || major > 4) {
      ctx.warn(`Skipped an unsupported ID3v2.${major} tag`);
      return;
    }
    let bodyEnd = span.start + 10 + syncsafe(r, span.start + 6);
    if (bodyEnd > r.length) {
      ctx.warn('ID3v2 tag is larger than the file (file may be truncated)');
      bodyEnd = r.length;
    }
    if (major === 2 && flags & 0x40) {
      ctx.warn('Skipped a compressed ID3v2.2 tag');
      return;
    }
    const tagUnsync = (flags & 0x80) !== 0;
    let body = r.slice(span.start + 10, bodyEnd);
    // v2.2/2.3 unsynchronise the whole tag body; v2.4 does it per frame.
    if (tagUnsync && major < 4) body = removeUnsync(body);
    const b = new ByteReader(body);
    let pos = 0;
    if (major >= 3 && flags & 0x40) {
      if (!b.has(0, 4)) return;
      // v2.3: size excludes its own 4 bytes; v2.4: syncsafe size includes them.
      pos = major === 3 ? 4 + b.u32be(0) : syncsafe(b, 0);
      if (pos > b.length) {
        ctx.warn('ID3v2 extended header is malformed');
        return;
      }
    }
    parseId3Frames(b, pos, major, tagUnsync, ctx);
  });
}

/**
 * Frame size, defending against writers that use the wrong size flavour
 * (v2.4 sizes are syncsafe, v2.3 sizes are plain; iTunes famously mixed them up).
 * If the expected reading does not land on another frame but the alternative does, trust the alternative.
 */
function id3FrameSize(b: ByteReader, pos: number, major: number): number {
  const plain = b.u32be(pos + 4);
  const syncsafeShaped = (plain & 0x80808080) === 0;
  const safe = syncsafeShaped ? syncsafe(b, pos + 4) : plain;
  const expected = major === 4 ? safe : plain;
  const alternative = major === 4 ? plain : safe;
  if (alternative === expected) return expected;
  const landsOnFrame = (size: number): boolean => {
    const next = pos + 10 + size;
    if (next === b.length) return true;
    if (next > b.length) return false;
    return b.u8(next) === 0 || isFrameId(b.ascii(next, 4), 4);
  };
  if (landsOnFrame(expected)) return expected;
  return landsOnFrame(alternative) ? alternative : expected;
}

function parseId3Frames(b: ByteReader, start: number, major: number, tagUnsync: boolean, ctx: ParseContext): void {
  const idLength = major === 2 ? 3 : 4;
  const headerLength = major === 2 ? 6 : 10;
  let pos = start;
  for (let count = 0; count < MAX_ID3_FRAMES && b.has(pos, headerLength); count++) {
    if (b.u8(pos) === 0) return; // padding
    const id = b.ascii(pos, idLength);
    if (!isFrameId(id, idLength)) {
      ctx.warn('ID3v2 tag contains a malformed frame; the rest of the tag was skipped');
      return;
    }
    const size = major === 2 ? b.u24be(pos + 3) : id3FrameSize(b, pos, major);
    const dataStart = pos + headerLength;
    if (dataStart + size > b.length) ctx.warn('An ID3v2 frame is cut off (file may be truncated)');
    const field = ID3_TEXT_FRAMES[id];
    const isPicture = id === 'APIC' || id === 'PIC';
    if (field || isPicture) {
      const formatFlags = major === 2 ? 0 : b.u8(pos + 9);
      const data = id3FrameData(b.slice(dataStart, dataStart + size), major, formatFlags, tagUnsync, ctx);
      if (data && data.length > 0) {
        if (field) ctx.setTag(field, joinValues(decodeId3Text(data[0], data.subarray(1))));
        else parseId3Picture(data, major === 2, ctx);
      }
    }
    pos = dataStart + size;
  }
}

/** Strips per-frame extras (grouping byte, data length indicator) and undoes v2.4 unsync; undefined when unreadable. */
function id3FrameData(
  data: Uint8Array,
  major: number,
  formatFlags: number,
  tagUnsync: boolean,
  ctx: ParseContext,
): Uint8Array | undefined {
  if (major === 3) {
    if (formatFlags & 0xc0) {
      ctx.warn('Skipped a compressed or encrypted ID3v2 frame');
      return undefined;
    }
    return formatFlags & 0x20 ? data.subarray(1) : data;
  }
  if (major === 4) {
    if (formatFlags & 0x0c) {
      ctx.warn('Skipped a compressed or encrypted ID3v2 frame');
      return undefined;
    }
    let skip = 0;
    if (formatFlags & 0x40) skip += 1; // grouping identity
    if (formatFlags & 0x01) skip += 4; // data length indicator
    const body = data.subarray(skip);
    return formatFlags & 0x02 || tagUnsync ? removeUnsync(body) : body;
  }
  return data;
}

/** APIC (v2.3/2.4): enc, mime\0, type, desc\0, data. PIC (v2.2): enc, 3-char format, type, desc\0, data. */
function parseId3Picture(data: Uint8Array, v22: boolean, ctx: ParseContext): void {
  const encoding = data[0];
  let pos: number;
  let mime: string;
  if (v22) {
    mime = decodeLatin1(data.subarray(1, 4));
    pos = 4;
  } else {
    const mimeEnd = data.indexOf(0, 1);
    if (mimeEnd < 0) return;
    mime = decodeLatin1(data.subarray(1, mimeEnd));
    pos = mimeEnd + 1;
  }
  if (mime === '-->' || pos >= data.length) return; // "-->" means the picture is only a URL
  const pictureType = data[pos];
  const descEnd = findTerminator(data, pos + 1, encoding);
  if (descEnd < 0) return;
  const imageStart = descEnd + (encoding === 1 || encoding === 2 ? 2 : 1);
  ctx.offerArtwork(data.subarray(imageStart), mime, pictureType);
}

// ---------------------------------------------------------------- ID3v1

function parseId3v1(r: ByteReader, ctx: ParseContext): void {
  const pos = r.length - 128;
  if (pos < 0 || r.ascii(pos, 3) !== 'TAG') return;
  const field = (offset: number, length: number): string =>
    decodeUtf8OrLatin1(untilNul(r.slice(pos + offset, pos + offset + length)));
  ctx.setTag('title', field(3, 30));
  ctx.setTag('artist', field(33, 30));
  ctx.setTag('album', field(63, 30));
  ctx.setTag('year', field(93, 4));
}

// ---------------------------------------------------------------- MPEG audio

interface MpegFrame {
  version: 1 | 2 | 2.5;
  layer: 1 | 2 | 3;
  sampleRate: number;
  channels: number;
  samplesPerFrame: number;
  /** Bytes including header; 0 for free-format streams. */
  frameLength: number;
}

const V2_LAYER23_KBPS = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
/** Bitrates by [MPEG-1 | MPEG-2/2.5][layer - 1][bitrate index]. */
const MPEG_BITRATES_KBPS = [
  [
    [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  ],
  [[0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256], V2_LAYER23_KBPS, V2_LAYER23_KBPS],
];

/** Decodes a 32-bit MPEG audio frame header (sync 0xFFE), or undefined if any field is invalid. */
function parseMpegHeader(h: number): MpegFrame | undefined {
  if (h >>> 21 !== 0x7ff) return undefined;
  const versionBits = (h >>> 19) & 3;
  const layerBits = (h >>> 17) & 3;
  const bitrateIndex = (h >>> 12) & 15;
  const rateIndex = (h >>> 10) & 3;
  if (versionBits === 1 || layerBits === 0 || bitrateIndex === 15 || rateIndex === 3) return undefined;
  const version = versionBits === 3 ? 1 : versionBits === 2 ? 2 : 2.5;
  const layer = (4 - layerBits) as 1 | 2 | 3;
  const sampleRate = [44100, 48000, 32000][rateIndex] / (version === 1 ? 1 : version === 2 ? 2 : 4);
  const bitrate = MPEG_BITRATES_KBPS[version === 1 ? 0 : 1][layer - 1][bitrateIndex] * 1000;
  const padding = (h >>> 9) & 1;
  const samplesPerFrame = layer === 1 ? 384 : layer === 3 && version !== 1 ? 576 : 1152;
  let frameLength = 0;
  if (bitrate > 0) {
    frameLength =
      layer === 1
        ? (Math.floor((12 * bitrate) / sampleRate) + padding) * 4
        : Math.floor(((samplesPerFrame / 8) * bitrate) / sampleRate) + padding;
  }
  const channels = ((h >>> 6) & 3) === 3 ? 1 : 2;
  return { version, layer, sampleRate, channels, samplesPerFrame, frameLength };
}

/**
 * First MPEG frame at or after `start`. A candidate counts when the next frame
 * header matches it, or when it sits exactly at `start` and the next frame cannot be checked.
 */
function findMpegFrame(
  r: ByteReader,
  start: number,
  scanBytes = SYNC_SCAN_BYTES,
): { pos: number; frame: MpegFrame } | undefined {
  const last = Math.min(r.length - 4, start + scanBytes);
  for (let p = Math.max(0, start); p <= last; p++) {
    if (r.u8(p) !== 0xff || (r.u8(p + 1) & 0xe0) !== 0xe0) continue;
    const frame = parseMpegHeader(r.u32be(p));
    if (!frame) continue;
    const next = p + frame.frameLength;
    if (frame.frameLength === 0 || !r.has(next, 4)) {
      if (p === start) return { pos: p, frame };
      continue;
    }
    const nextFrame = parseMpegHeader(r.u32be(next));
    if (
      nextFrame &&
      nextFrame.version === frame.version &&
      nextFrame.layer === frame.layer &&
      nextFrame.sampleRate === frame.sampleRate
    ) {
      return { pos: p, frame };
    }
  }
  return undefined;
}

/** Exact duration from a Xing/Info (+ LAME gapless info) or VBRI header in the first frame; undefined otherwise. */
function mpegDurationMs(r: ByteReader, pos: number, frame: MpegFrame): number | undefined {
  const sideInfo = frame.version === 1 ? (frame.channels === 1 ? 17 : 32) : frame.channels === 1 ? 9 : 17;
  // Xing sits right after the side info; allow for a 2-byte CRC before it.
  for (const offset of [4 + sideInfo, 6 + sideInfo]) {
    const x = pos + offset;
    if (!r.has(x, 8)) continue;
    const tag = r.ascii(x, 4);
    if (tag !== 'Xing' && tag !== 'Info') continue;
    const flags = r.u32be(x + 4);
    if (!(flags & 1) || !r.has(x + 8, 4)) return undefined;
    const frames = r.u32be(x + 8);
    if (frames === 0) return undefined;
    let samples = frames * frame.samplesPerFrame;
    // LAME-style extension: 9-byte encoder id, then encoder delay/padding (12 bits each) at +21.
    const lame = x + 8 + (flags & 1 ? 4 : 0) + (flags & 2 ? 4 : 0) + (flags & 4 ? 100 : 0) + (flags & 8 ? 4 : 0);
    if (r.has(lame, 24) && /^[A-Za-z][A-Za-z0-9. ]{3}$/.test(r.ascii(lame, 4))) {
      const gapless = r.u24be(lame + 21);
      const trim = (gapless >>> 12) + (gapless & 0xfff);
      if (trim < samples) samples -= trim;
    }
    return (samples / frame.sampleRate) * 1000;
  }
  const v = pos + 4 + 32;
  if (r.has(v, 18) && r.ascii(v, 4) === 'VBRI') {
    const frames = r.u32be(v + 14);
    return frames > 0 ? ((frames * frame.samplesPerFrame) / frame.sampleRate) * 1000 : undefined;
  }
  return undefined;
}

function parseMp3(ctx: ParseContext): void {
  const { r, meta } = ctx;
  const leading = findLeadingId3v2(r, 0);
  for (const span of leading) parseId3v2(r, span, ctx);
  const appended = findAppendedId3v2(r);
  if (appended && appended.start >= endOfTags(leading, 0)) parseId3v2(r, appended, ctx);
  if (!ctx.tags.title || !ctx.tags.artist) guarded(ctx, 'the ID3v1 tag', () => parseId3v1(r, ctx));

  const found = findMpegFrame(r, Math.min(endOfTags(leading, 0), r.length));
  if (!found) {
    ctx.warn('No MPEG audio frames found (file may be truncated or not really an MP3)');
    return;
  }
  const { frame } = found;
  meta.codec = frame.layer === 3 ? 'mp3' : `mp${frame.layer}`;
  meta.sampleRate = frame.sampleRate;
  meta.channels = frame.channels;
  const ms = mpegDurationMs(r, found.pos, frame);
  if (ms !== undefined) meta.durationMs = Math.round(ms);
}

// ---------------------------------------------------------------- ADTS AAC

const AAC_SAMPLE_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

interface AdtsHeader {
  sampleRate: number;
  /** 0 means "defined in the bitstream" (program config element). */
  channelConfig: number;
  frameLength: number;
}

function parseAdtsHeader(r: ByteReader, p: number): AdtsHeader | undefined {
  if (!r.has(p, 7)) return undefined;
  // 12-bit sync 0xFFF followed by the MPEG version bit and layer bits that must be 00.
  if (r.u8(p) !== 0xff || (r.u8(p + 1) & 0xf6) !== 0xf0) return undefined;
  const b2 = r.u8(p + 2);
  const b3 = r.u8(p + 3);
  const rateIndex = (b2 >> 2) & 0xf;
  if (rateIndex >= AAC_SAMPLE_RATES.length) return undefined;
  const frameLength = ((b3 & 3) << 11) | (r.u8(p + 4) << 3) | (r.u8(p + 5) >> 5);
  if (frameLength < 7) return undefined;
  return { sampleRate: AAC_SAMPLE_RATES[rateIndex], channelConfig: ((b2 & 1) << 2) | (b3 >> 6), frameLength };
}

function findAdtsFrame(r: ByteReader, start: number): AdtsHeader | undefined {
  const last = Math.min(r.length - 7, start + SYNC_SCAN_BYTES);
  for (let p = Math.max(0, start); p <= last; p++) {
    if (r.u8(p) !== 0xff) continue;
    const header = parseAdtsHeader(r, p);
    if (!header) continue;
    const next = p + header.frameLength;
    if (!r.has(next, 7)) {
      if (p === start) return header;
      continue;
    }
    const nextHeader = parseAdtsHeader(r, next);
    if (nextHeader && nextHeader.sampleRate === header.sampleRate) return header;
  }
  return undefined;
}

function parseAac(ctx: ParseContext): void {
  const { r, meta } = ctx;
  const leading = findLeadingId3v2(r, 0);
  for (const span of leading) parseId3v2(r, span, ctx);
  const header = findAdtsFrame(r, Math.min(endOfTags(leading, 0), r.length));
  if (!header) {
    ctx.warn('No AAC (ADTS) frames found (file may be truncated)');
    return;
  }
  meta.codec = 'mp4a';
  meta.sampleRate = header.sampleRate;
  if (header.channelConfig > 0) meta.channels = header.channelConfig === 7 ? 8 : header.channelConfig;
}

// ---------------------------------------------------------------- MP4 / M4A

interface Atom {
  type: string;
  start: number;
  /** Payload start (after the 8- or 16-byte header). */
  body: number;
  /** Clamped to the parent's end. */
  end: number;
}

/** Child atoms in [start, end). Sizes are validated; size 0 means "to the end of the parent". */
function readAtoms(r: ByteReader, start: number, end: number, ctx: ParseContext): Atom[] {
  const atoms: Atom[] = [];
  let p = start;
  while (p + 8 <= end && atoms.length < MAX_ATOMS_PER_LEVEL) {
    let size = r.u32be(p);
    const type = r.ascii(p + 4, 4);
    let header = 8;
    if (size === 1) {
      if (p + 16 > end) {
        ctx.warn(`The ${printable(type)} atom is cut off (file may be truncated)`);
        break;
      }
      size = r.u64be(p + 8);
      header = 16;
    } else if (size === 0) {
      size = end - p;
    }
    if (size < header) {
      ctx.warn(`Invalid ${printable(type)} atom size; stopped reading that part of the file`);
      break;
    }
    let atomEnd = p + size;
    if (atomEnd > end) {
      ctx.warn(`The ${printable(type)} atom is cut off (file may be truncated)`);
      atomEnd = end;
    }
    atoms.push({ type, start: p, body: p + header, end: atomEnd });
    p = atomEnd;
  }
  return atoms;
}

function child(atoms: Atom[], type: string): Atom | undefined {
  return atoms.find((a) => a.type === type);
}

/** Follows a path of container atoms, e.g. ['mdia', 'minf', 'stbl']. */
function descend(r: ByteReader, parent: Atom, path: string[], ctx: ParseContext): Atom | undefined {
  let current: Atom | undefined = parent;
  for (const type of path) {
    if (!current) return undefined;
    current = child(readAtoms(r, current.body, current.end, ctx), type);
  }
  return current;
}

/** `{ timescale, duration }` from an mvhd/mdhd full box (version 0: 32-bit fields, version 1: 64-bit). */
function readTimeHeader(r: ByteReader, atom: Atom): { timescale: number; duration: number } | undefined {
  const version = r.u8(atom.body);
  const timescaleAt = atom.body + (version === 1 ? 20 : 12);
  const durationBytes = version === 1 ? 8 : 4;
  if (!r.has(timescaleAt, 4 + durationBytes) || atom.end < timescaleAt + 4 + durationBytes) return undefined;
  const timescale = r.u32be(timescaleAt);
  const duration = version === 1 ? r.u64be(timescaleAt + 4) : r.u32be(timescaleAt + 4);
  // All-ones means "unknown".
  if (timescale === 0 || duration === 0 || duration === 0xffffffff || duration >= 2 ** 53) return undefined;
  return { timescale, duration };
}

const MP4_CODEC_NAMES: Record<string, string> = {
  Opus: 'opus',
  fLaC: 'flac',
  '.mp3': 'mp3',
  lpcm: 'pcm',
  sowt: 'pcm',
  twos: 'pcm',
  in24: 'pcm',
  in32: 'pcm',
  fl32: 'pcm',
  fl64: 'pcm',
};

const MP4_IMAGE_TYPES: Record<number, string> = { 13: 'image/jpeg', 14: 'image/png', 27: 'image/bmp' };

interface SampleEntry {
  codec: string;
  channels?: number;
  sampleRate?: number;
  protected: boolean;
}

/** Audio sample entry: 8 bytes reserved/data-ref, then version-dependent fields (ISO/QuickTime v0, v1, v2). */
function parseAudioSampleEntry(r: ByteReader, entry: Atom, ctx: ParseContext): SampleEntry {
  const fourcc = entry.type;
  const result: SampleEntry = {
    codec: MP4_CODEC_NAMES[fourcc] ?? fourcc.trim(),
    protected: fourcc === 'drms' || fourcc === 'enca',
  };
  const b = entry.body;
  if (!r.has(b, 28) || entry.end < b + 28) return result;
  const version = r.u16be(b + 8);
  let childrenStart = b + 28;
  let channels = r.u16be(b + 16);
  let sampleRate = r.u32be(b + 24) / 65536; // 16.16 fixed point
  if (version === 1) {
    childrenStart += 16;
  } else if (version === 2 && r.has(b + 28, 36)) {
    childrenStart += 36;
    sampleRate = r.f64be(b + 32);
    channels = r.u32be(b + 40);
  }
  for (const atom of readAtoms(r, childrenStart, entry.end, ctx)) {
    if (atom.type === 'sinf') result.protected = true;
    // ALACSpecificConfig (after 4 bytes version/flags) carries the true rate, which may exceed 16.16 range.
    if (atom.type === 'alac' && r.has(atom.body + 4, 24)) {
      channels = r.u8(atom.body + 4 + 9);
      sampleRate = r.u32be(atom.body + 4 + 20);
    }
  }
  if (fourcc === 'Opus') sampleRate = 48000; // Opus always decodes at 48 kHz
  if (channels > 0 && channels <= 64) result.channels = channels;
  if (sampleRate >= 1000 && sampleRate <= 768000) result.sampleRate = Math.round(sampleRate);
  return result;
}

interface TrackInfo {
  handler?: string;
  entry?: SampleEntry;
  mediaTimescale?: number;
  mediaDurationMs?: number;
}

function parseTrak(r: ByteReader, trak: Atom, ctx: ParseContext): TrackInfo {
  const info: TrackInfo = {};
  const mdia = descend(r, trak, ['mdia'], ctx);
  if (!mdia) return info;
  const mdiaChildren = readAtoms(r, mdia.body, mdia.end, ctx);
  const hdlr = child(mdiaChildren, 'hdlr');
  if (hdlr && r.has(hdlr.body + 8, 4)) info.handler = r.ascii(hdlr.body + 8, 4);
  const mdhd = child(mdiaChildren, 'mdhd');
  if (mdhd) {
    const time = readTimeHeader(r, mdhd);
    if (time) {
      info.mediaTimescale = time.timescale;
      info.mediaDurationMs = (time.duration / time.timescale) * 1000;
    } else if (r.has(mdhd.body, 16)) {
      info.mediaTimescale = r.u32be(mdhd.body + (r.u8(mdhd.body) === 1 ? 20 : 12)) || undefined;
    }
  }
  const minf = child(mdiaChildren, 'minf');
  const stsd = minf && descend(r, minf, ['stbl', 'stsd'], ctx);
  // stsd: 4 bytes version/flags, 4 bytes entry count, then sample entries.
  if (stsd && info.handler !== 'vide') {
    const first = readAtoms(r, stsd.body + 8, stsd.end, ctx)[0];
    if (first) info.entry = parseAudioSampleEntry(r, first, ctx);
  }
  return info;
}

/** Codec names (after MP4_CODEC_NAMES mapping) that identify an audio track lacking a handler box. */
const AUDIO_SAMPLE_ENTRIES = new Set([
  'mp4a',
  'alac',
  'drms',
  'enca',
  'ac-3',
  'ec-3',
  'opus',
  'flac',
  'mp3',
  'pcm',
  'samr',
]);

/** iTunes item atoms; the leading byte 0xA9 decodes (Latin-1) to U+00A9. */
const ILST_FIELDS: Record<string, TagField> = {
  '\xa9nam': 'title',
  '\xa9ART': 'artist',
  aART: 'albumArtist',
  '\xa9alb': 'album',
  '\xa9day': 'year',
};

/**
 * `meta` is a full box (4 bytes version/flags before its children) in ISO files,
 * but QuickTime-style files omit them. If the first 8 bytes already look like a
 * child atom header, there are no version/flags.
 */
function metaChildrenStart(r: ByteReader, meta: Atom): number {
  const p = meta.body;
  if (r.has(p, 8)) {
    const size = r.u32be(p);
    if (size >= 8 && p + size <= meta.end && isPrintableFourcc(r.ascii(p + 4, 4))) return p;
  }
  return p + 4;
}

function parseIlst(r: ByteReader, ilst: Atom, ctx: ParseContext): void {
  for (const item of readAtoms(r, ilst.body, ilst.end, ctx)) {
    const field = ILST_FIELDS[item.type];
    if (!field && item.type !== 'covr') continue;
    for (const data of readAtoms(r, item.body, item.end, ctx)) {
      // data atom: 4 bytes type indicator (1 version byte + 24-bit type), 4 bytes locale, then the value.
      if (data.type !== 'data' || data.end < data.body + 8) continue;
      const dataType = r.u32be(data.body) & 0xffffff;
      const value = r.slice(data.body + 8, data.end);
      if (field) {
        ctx.setTag(field, dataType === 2 ? decodeUtf16(value, false) : decodeUtf8(value));
        break;
      }
      ctx.offerArtwork(value, MP4_IMAGE_TYPES[dataType], FRONT_COVER);
    }
  }
}

function parseMetaAtom(r: ByteReader, meta: Atom, ctx: ParseContext): void {
  const ilst = child(readAtoms(r, metaChildrenStart(r, meta), meta.end, ctx), 'ilst');
  if (ilst) parseIlst(r, ilst, ctx);
}

function parseMoov(r: ByteReader, moov: Atom, ctx: ParseContext): void {
  const { meta } = ctx;
  const children = readAtoms(r, moov.body, moov.end, ctx);

  let audio: TrackInfo | undefined;
  for (const trak of children) {
    if (trak.type !== 'trak') continue;
    const info = guarded(ctx, 'an MP4 track', () => parseTrak(r, trak, ctx));
    const isAudio =
      info?.handler === 'soun' || (info?.handler === undefined && AUDIO_SAMPLE_ENTRIES.has(info?.entry?.codec ?? ''));
    if (info && isAudio) {
      audio = info;
      break;
    }
  }
  if (audio?.entry) {
    meta.codec = audio.entry.codec;
    meta.channels = audio.entry.channels;
    meta.sampleRate = audio.entry.sampleRate;
    if (audio.entry.protected) meta.drmProtected = true;
    if (
      meta.sampleRate === undefined &&
      audio.mediaTimescale &&
      audio.mediaTimescale >= 8000 &&
      audio.mediaTimescale <= 768000
    ) {
      meta.sampleRate = audio.mediaTimescale;
    }
  } else {
    ctx.warn('No audio track found in this MP4 file');
  }

  guarded(ctx, 'the MP4 duration', () => {
    const mvhd = child(children, 'mvhd');
    const movie = mvhd && readTimeHeader(r, mvhd);
    let ms = movie ? (movie.duration / movie.timescale) * 1000 : audio?.mediaDurationMs;
    // Fragmented files keep the total in mvex/mehd (mvhd timescale).
    const mvex = child(children, 'mvex');
    const mehd = ms === undefined && mvhd && mvex ? descend(r, mvex, ['mehd'], ctx) : undefined;
    if (mehd && mvhd && r.has(mehd.body, 12)) {
      const timescale = r.u32be(mvhd.body + (r.u8(mvhd.body) === 1 ? 20 : 12));
      const duration = r.u8(mehd.body) === 1 ? r.u64be(mehd.body + 4) : r.u32be(mehd.body + 4);
      if (timescale > 0 && duration > 0) ms = (duration / timescale) * 1000;
    }
    if (ms !== undefined) meta.durationMs = Math.round(ms);
  });

  guarded(ctx, 'the MP4 tags', () => {
    const udta = child(children, 'udta');
    const udtaMeta = udta && descend(r, udta, ['meta'], ctx);
    if (udtaMeta) parseMetaAtom(r, udtaMeta, ctx);
    const moovMeta = child(children, 'meta');
    if (moovMeta) parseMetaAtom(r, moovMeta, ctx);
  });
}

function parseMp4(ctx: ParseContext): void {
  const { r, meta } = ctx;
  const top = readAtoms(r, 0, r.length, ctx);
  const ftyp = child(top, 'ftyp');
  if (ftyp) {
    // Major brand, minor version, then compatible brands. 'M4P ' marks FairPlay-protected iTunes audio.
    const brands = [r.ascii(ftyp.body, 4)];
    for (let p = ftyp.body + 8; p + 4 <= ftyp.end; p += 4) brands.push(r.ascii(p, 4));
    if (brands.includes('M4P ')) meta.drmProtected = true;
  }
  const moov = child(top, 'moov');
  if (!moov) {
    ctx.warn('No moov atom found (file may be truncated or still downloading)');
    return;
  }
  parseMoov(r, moov, ctx);
}

// ---------------------------------------------------------------- WAV

const WAV_CODECS: Record<number, string> = {
  0x0001: 'pcm',
  0x0003: 'pcm', // IEEE float
  0x0002: 'adpcm',
  0x0011: 'adpcm',
  0x0006: 'alaw',
  0x0007: 'mulaw',
  0x0050: 'mp2',
  0x0055: 'mp3',
  0x00ff: 'aac',
  0x1610: 'aac',
  0x2000: 'ac-3',
};
/** Formats whose byte rate is exact, so data size / byte rate is the true duration. */
const WAV_CONSTANT_RATE = new Set([0x0001, 0x0003, 0x0006, 0x0007]);

const RIFF_INFO_FIELDS: Record<string, TagField> = { INAM: 'title', IART: 'artist', IPRD: 'album', ICRD: 'year' };

function parseRiffInfo(r: ByteReader, start: number, end: number, ctx: ParseContext): void {
  let p = start;
  while (p + 8 <= end) {
    const id = r.ascii(p, 4);
    const size = r.u32le(p + 4);
    const field = RIFF_INFO_FIELDS[id];
    if (field) ctx.setTag(field, decodeUtf8OrLatin1(untilNul(r.slice(p + 8, Math.min(p + 8 + size, end)))));
    p += 8 + size + (size & 1);
  }
}

function parseWav(ctx: ParseContext): void {
  const { r, meta } = ctx;
  const isRf64 = r.ascii(0, 4) !== 'RIFF';
  let formatTag: number | undefined;
  let byteRate = 0;
  let dataBytes: number | undefined;
  let rf64DataSize: number | undefined;
  let p = 12;
  for (let count = 0; count < MAX_WAV_CHUNKS && p + 8 <= r.length; count++) {
    const id = r.ascii(p, 4);
    if (!isPrintableFourcc(id)) {
      ctx.warn('Unexpected bytes between WAV chunks; the rest of the file was skipped');
      break;
    }
    const size = r.u32le(p + 4);
    const body = p + 8;
    const end = Math.min(body + size, r.length);
    switch (id) {
      case 'ds64': // RF64: real 64-bit sizes (riff size, data size, sample count)
        if (r.has(body, 16)) rf64DataSize = r.u64le(body + 8);
        break;
      case 'fmt ':
        if (!r.has(body, 16)) break;
        formatTag = r.u16le(body);
        // WAVE_FORMAT_EXTENSIBLE: the real format is the first 2 bytes of the SubFormat GUID.
        if (formatTag === 0xfffe && size >= 40 && r.has(body + 24, 2)) formatTag = r.u16le(body + 24);
        meta.channels = r.u16le(body + 2) || undefined;
        meta.sampleRate = r.u32le(body + 4) || undefined;
        byteRate = r.u32le(body + 8) || (meta.sampleRate ?? 0) * r.u16le(body + 12);
        meta.codec = WAV_CODECS[formatTag] ?? `wav-0x${formatTag.toString(16).padStart(4, '0')}`;
        break;
      case 'data': {
        const declared = isRf64 && size === 0xffffffff && rf64DataSize !== undefined ? rf64DataSize : size;
        const available = r.length - body;
        if (declared === 0 || declared === 0xffffffff) {
          dataBytes = available; // streamed file that never got its size patched
        } else {
          if (declared > available) ctx.warn('Audio data is cut off (file may be truncated)');
          dataBytes = Math.min(declared, available);
        }
        break;
      }
      case 'LIST':
        if (r.ascii(body, 4) === 'INFO') guarded(ctx, 'the WAV INFO tags', () => parseRiffInfo(r, body + 4, end, ctx));
        break;
      case 'id3 ':
      case 'ID3 ': {
        const length = id3v2TagLength(r, body);
        if (length > 0) parseId3v2(r, { start: body, end: body + length }, ctx);
        break;
      }
    }
    if (body + size >= r.length) break;
    p = body + size + (size & 1);
  }
  if (formatTag === undefined) ctx.warn('WAV file has no format chunk');
  if (formatTag !== undefined && WAV_CONSTANT_RATE.has(formatTag) && dataBytes !== undefined && byteRate > 0) {
    meta.durationMs = Math.round((dataBytes / byteRate) * 1000);
  }
}

// ---------------------------------------------------------------- Vorbis comments & FLAC pictures

const BASE64_VALUES = (() => {
  const table = new Int16Array(256).fill(-1);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < alphabet.length; i++) table[alphabet.charCodeAt(i)] = i;
  table['-'.charCodeAt(0)] = 62; // tolerate base64url
  table['_'.charCodeAt(0)] = 63;
  return table;
})();

/** Decodes base64 text held as ASCII bytes; skips whitespace and stops at padding. */
function decodeBase64(ascii: Uint8Array): Uint8Array {
  const out = new Uint8Array(Math.floor((ascii.length * 3) / 4));
  let n = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < ascii.length; i++) {
    const v = BASE64_VALUES[ascii[i]];
    if (v < 0) {
      if (ascii[i] === 0x3d) break; // '='
      continue;
    }
    acc = ((acc << 6) | v) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[n++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, n);
}

/** FLAC PICTURE block body (also the payload of METADATA_BLOCK_PICTURE). All integers big-endian. */
function parseFlacPicture(b: ByteReader, ctx: ParseContext): void {
  if (!b.has(0, 8)) return;
  const pictureType = b.u32be(0);
  const mimeLength = b.u32be(4);
  let p = 8;
  if (!b.has(p, mimeLength + 4)) return;
  const mime = b.ascii(p, Math.min(mimeLength, 64));
  p += mimeLength;
  p += 4 + b.u32be(p); // description
  p += 16; // width, height, depth, colour count
  if (!b.has(p, 4)) return;
  const dataLength = b.u32be(p);
  p += 4;
  if (mime === '-->') return; // URL, not image data
  if (dataLength > MAX_ARTWORK_BYTES) {
    ctx.warn('Embedded artwork is larger than 8 MB and was ignored');
    return;
  }
  if (!b.has(p, dataLength)) {
    ctx.warn('Embedded artwork is cut off (file may be truncated)');
    return;
  }
  ctx.offerArtwork(b.slice(p, p + dataLength), mime, pictureType);
}

const VORBIS_FIELDS: Record<string, TagField> = {
  TITLE: 'title',
  ARTIST: 'artist',
  ALBUMARTIST: 'albumArtist',
  'ALBUM ARTIST': 'albumArtist',
  ALBUM: 'album',
  DATE: 'year',
  YEAR: 'year',
};

/** Vorbis comment block: vendor string, then "KEY=value" UTF-8 entries; all lengths are little-endian. */
function parseVorbisComment(b: ByteReader, start: number, ctx: ParseContext): void {
  let p = start;
  if (!b.has(p, 4)) return;
  p += 4 + b.u32le(p); // vendor
  if (!b.has(p, 4)) {
    ctx.warn('Vorbis comment block is cut off');
    return;
  }
  const count = Math.min(b.u32le(p), MAX_VORBIS_COMMENTS);
  p += 4;
  const values = new Map<TagField, string[]>();
  let coverArtMime: string | undefined;
  let coverArt: Uint8Array | undefined;
  for (let i = 0; i < count; i++) {
    if (!b.has(p, 4)) {
      ctx.warn('Vorbis comment block is cut off');
      break;
    }
    const length = b.u32le(p);
    const entryStart = p + 4;
    const entryEnd = entryStart + length;
    p = entryEnd;
    if (entryEnd > b.length) ctx.warn('Vorbis comment block is cut off');
    const eq = b.indexOf(0x3d, entryStart, Math.min(entryEnd, entryStart + 64));
    if (eq < 0) continue;
    const key = b.ascii(entryStart, eq - entryStart).toUpperCase();
    const value = b.slice(eq + 1, entryEnd);
    const field = VORBIS_FIELDS[key];
    if (field) {
      const list = values.get(field) ?? [];
      list.push(decodeUtf8(value));
      values.set(field, list);
    } else if (key === 'METADATA_BLOCK_PICTURE') {
      if (value.length > (MAX_ARTWORK_BYTES * 4) / 3 + 1024)
        ctx.warn('Embedded artwork is larger than 8 MB and was ignored');
      else parseFlacPicture(new ByteReader(decodeBase64(value)), ctx);
    } else if (key === 'COVERART') {
      coverArt = value; // legacy: raw base64 image
    } else if (key === 'COVERARTMIME') {
      coverArtMime = decodeLatin1(value);
    }
  }
  for (const [field, list] of values) ctx.setTag(field, joinValues(list.join('\u0000')));
  if (coverArt && coverArt.length <= (MAX_ARTWORK_BYTES * 4) / 3 + 1024) {
    ctx.offerArtwork(decodeBase64(coverArt), coverArtMime, FRONT_COVER);
  }
}

// ---------------------------------------------------------------- FLAC

interface StreamInfo {
  sampleRate: number;
  channels: number;
  totalSamples: number;
}

/** STREAMINFO bytes 10..17: sample rate (20 bits), channels-1 (3), bits-1 (5), total samples (36). */
function parseStreamInfo(b: ByteReader, p: number): StreamInfo | undefined {
  if (!b.has(p, 18)) return undefined;
  const sampleRate = (b.u8(p + 10) << 12) | (b.u8(p + 11) << 4) | (b.u8(p + 12) >> 4);
  const channels = ((b.u8(p + 12) >> 1) & 7) + 1;
  const totalSamples = (b.u8(p + 13) & 0x0f) * 2 ** 32 + b.u32be(p + 14);
  return { sampleRate, channels, totalSamples };
}

function applyStreamInfo(info: StreamInfo | undefined, meta: AudioMetadata): void {
  if (!info) return;
  if (info.sampleRate > 0) meta.sampleRate = info.sampleRate;
  meta.channels = info.channels;
  if (info.sampleRate > 0 && info.totalSamples > 0)
    meta.durationMs = Math.round((info.totalSamples / info.sampleRate) * 1000);
}

function parseFlac(ctx: ParseContext): void {
  const { r, meta } = ctx;
  meta.codec = 'flac';
  // Some taggers put an ID3v2 tag in front of "fLaC"; its values only fill gaps left by the Vorbis comments.
  const leading = findLeadingId3v2(r, 0);
  const start = endOfTags(leading, 0);
  if (r.ascii(start, 4) !== 'fLaC') {
    ctx.warn('FLAC signature not found');
  } else {
    let p = start + 4;
    for (let count = 0; count < MAX_FLAC_BLOCKS && r.has(p, 4); count++) {
      // Block header: last-block flag (1 bit), type (7 bits), length (24 bits).
      const header = r.u8(p);
      const type = header & 0x7f;
      const length = r.u24be(p + 1);
      const body = p + 4;
      if (body + length > r.length) ctx.warn('A FLAC metadata block is cut off (file may be truncated)');
      const block = r.sub(body, body + length);
      if (type === 0) guarded(ctx, 'FLAC STREAMINFO', () => applyStreamInfo(parseStreamInfo(block, 0), meta));
      else if (type === 4) guarded(ctx, 'FLAC tags', () => parseVorbisComment(block, 0, ctx));
      else if (type === 6) guarded(ctx, 'FLAC artwork', () => parseFlacPicture(block, ctx));
      else if (type === 127) {
        ctx.warn('Invalid FLAC metadata block');
        break;
      }
      if (header & 0x80) break;
      p = body + length;
    }
  }
  for (const span of leading) parseId3v2(r, span, ctx);
}

// ---------------------------------------------------------------- Ogg

interface OggPage {
  headerType: number;
  /** undefined when no packet ends on this page (granule -1). */
  granule: number | undefined;
  serial: number;
  segmentTable: number;
  segmentCount: number;
  bodyStart: number;
  /** May lie past the end of a truncated file. */
  end: number;
}

function readOggPage(r: ByteReader, p: number): OggPage | undefined {
  if (!r.has(p, 27) || r.ascii(p, 4) !== 'OggS') return undefined;
  const segmentCount = r.u8(p + 26);
  if (!r.has(p + 27, segmentCount)) return undefined;
  let bodyLength = 0;
  for (let i = 0; i < segmentCount; i++) bodyLength += r.u8(p + 27 + i);
  const lo = r.u32le(p + 6);
  const hi = r.u32le(p + 10);
  return {
    headerType: r.u8(p + 5),
    granule: lo === 0xffffffff && hi === 0xffffffff ? undefined : hi * 2 ** 32 + lo,
    serial: r.u32le(p + 14),
    segmentTable: p + 27,
    segmentCount,
    bodyStart: p + 27 + segmentCount,
    end: p + 27 + segmentCount + bodyLength,
  };
}

/** Byte ranges [start, end) of the input that make up one packet. */
type Ranges = Array<[number, number]>;

function joinRanges(r: ByteReader, ranges: Ranges): Uint8Array {
  if (ranges.length === 1) return r.slice(ranges[0][0], ranges[0][1]);
  const out = new Uint8Array(ranges.reduce((n, [start, end]) => n + end - start, 0));
  let n = 0;
  for (const [start, end] of ranges) {
    out.set(r.slice(start, end), n);
    n += end - start;
  }
  return out;
}

/**
 * The first `wanted` packets of the first logical stream. Segments that are
 * contiguous in the file stay one view, so a packet is only copied when it spans pages.
 */
function readOggHeaderPackets(
  r: ByteReader,
  wanted: number,
  ctx: ParseContext,
): { serial: number; packets: Uint8Array[] } | undefined {
  const first = readOggPage(r, 0);
  if (!first) return undefined;
  const serial = first.serial;
  const packets: Uint8Array[] = [];
  let ranges: Ranges = [];
  let pending = 0;
  let page: OggPage | undefined = first;
  for (let pages = 0; page && packets.length < wanted && pages < MAX_OGG_HEADER_PAGES; pages++) {
    if (page.serial === serial) {
      let off = page.bodyStart;
      for (let i = 0; i < page.segmentCount && packets.length < wanted; i++) {
        const lacing = r.u8(page.segmentTable + i);
        const end = Math.min(off + lacing, r.length);
        const last = ranges[ranges.length - 1];
        if (last && last[1] === off) last[1] = end;
        else if (end > off) ranges.push([off, end]);
        pending += Math.max(0, end - off);
        off += lacing;
        if (pending > MAX_OGG_HEADER_BYTES) {
          ctx.warn('Ogg header is unusually large; its tags were skipped');
          return { serial, packets };
        }
        // A lacing value below 255 ends the packet.
        if (lacing < 255) {
          packets.push(joinRanges(r, ranges));
          ranges = [];
          pending = 0;
        }
      }
    }
    if (page.end > r.length) {
      ctx.warn('Ogg stream is cut off (file may be truncated)');
      break;
    }
    page = readOggPage(r, page.end);
    if (!page && packets.length < wanted) ctx.warn('Ogg stream is damaged or cut off');
  }
  if (packets.length < wanted && pending > 0) packets.push(joinRanges(r, ranges)); // partial packet: read what is there
  return { serial, packets };
}

/** Granule position of the last page of `serial`, searching backwards over at most one maximum-size page. */
function lastGranule(r: ByteReader, serial: number): { granule: number; endOfStream: boolean } | undefined {
  const stop = Math.max(0, r.length - MAX_OGG_PAGE_BYTES - 27);
  for (let p = r.length - 27; p >= stop; p--) {
    if (r.u8(p) !== 0x4f || r.ascii(p, 4) !== 'OggS') continue; // 'O'
    const page = readOggPage(r, p);
    if (page && page.serial === serial && page.granule !== undefined) {
      return { granule: page.granule, endOfStream: (page.headerType & 4) !== 0 };
    }
  }
  return undefined;
}

function parseOgg(ctx: ParseContext): void {
  const { r, meta } = ctx;
  const header = readOggHeaderPackets(r, 2, ctx);
  const [ident, comments] = header?.packets ?? [];
  if (!header || !ident) {
    ctx.warn('Ogg stream has no readable header');
    return;
  }
  const id = new ByteReader(ident);
  let preSkip = 0;
  let commentStart: number;
  if (id.ascii(0, 7) === '\x01vorbis' && id.has(0, 16)) {
    meta.codec = 'vorbis';
    meta.channels = id.u8(11);
    meta.sampleRate = id.u32le(12);
    commentStart = 7; // 0x03 "vorbis"
  } else if (id.ascii(0, 8) === 'OpusHead' && id.has(0, 12)) {
    meta.codec = 'opus';
    meta.channels = id.u8(9);
    preSkip = id.u16le(10);
    meta.sampleRate = 48000; // Opus always decodes at 48 kHz
    commentStart = 8; // "OpusTags"
  } else if (id.ascii(0, 5) === '\x7fFLAC') {
    // 0x7F "FLAC", version (2), header count (2), "fLaC", then a STREAMINFO metadata block.
    meta.codec = 'flac';
    applyStreamInfo(parseStreamInfo(id, 17), meta);
    commentStart = 4; // the next packet is a VORBIS_COMMENT block with its 4-byte header
  } else {
    ctx.warn('Unsupported codec inside the Ogg file');
    return;
  }
  if (!meta.channels) delete meta.channels;
  if (!meta.sampleRate) delete meta.sampleRate;

  if (comments) guarded(ctx, 'the Ogg tags', () => parseVorbisComment(new ByteReader(comments), commentStart, ctx));

  const end = lastGranule(r, header.serial);
  if (end && meta.sampleRate && meta.durationMs === undefined) {
    if (!end.endOfStream) ctx.warn('Ogg stream does not end cleanly (file may be truncated)');
    const samples = meta.codec === 'opus' ? end.granule - preSkip : end.granule;
    if (samples > 0) meta.durationMs = Math.round((samples / meta.sampleRate) * 1000);
  }
}

// ---------------------------------------------------------------- detection

const EXTENSION_CONTAINERS = new Map<string, AudioContainer>([
  ['mp3', 'mp3'],
  ['mp2', 'mp3'],
  ['mpga', 'mp3'],
  ['m4a', 'mp4'],
  ['m4b', 'mp4'],
  ['m4p', 'mp4'],
  ['m4r', 'mp4'],
  ['mp4', 'mp4'],
  ['mov', 'mp4'],
  ['3gp', 'mp4'],
  ['aac', 'aac'],
  ['adts', 'aac'],
  ['wav', 'wav'],
  ['wave', 'wav'],
  ['flac', 'flac'],
  ['ogg', 'ogg'],
  ['oga', 'ogg'],
  ['opus', 'ogg'],
]);

function containerFromExtension(fileName: string | undefined): AudioContainer | undefined {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(fileName ?? '')?.[1];
  return ext ? EXTENSION_CONTAINERS.get(ext.toLowerCase()) : undefined;
}

/** Container implied by the magic bytes at `p`. */
function sniffMagic(r: ByteReader, p: number): AudioContainer | undefined {
  if (r.has(p, 8) && r.ascii(p + 4, 4) === 'ftyp') return 'mp4';
  const magic = r.ascii(p, 4);
  if ((magic === 'RIFF' || magic === 'RF64' || magic === 'BW64') && r.ascii(p + 8, 4) === 'WAVE') return 'wav';
  if (magic === 'fLaC') return 'flac';
  if (magic === 'OggS') return 'ogg';
  if (parseAdtsHeader(r, p)) return 'aac';
  if (r.has(p, 4) && parseMpegHeader(r.u32be(p))) return 'mp3';
  return undefined;
}

export function detectContainer(bytes: Uint8Array, fileName?: string): AudioContainer {
  try {
    const r = new ByteReader(bytes);
    const atStart = sniffMagic(r, 0);
    if (atStart) return atStart;
    const fromExtension = containerFromExtension(fileName);
    const tags = findLeadingId3v2(r, 0);
    if (tags.length > 0) {
      // ID3v2 is mostly MP3, but raw AAC and FLAC files sometimes carry one too.
      const after = sniffMagic(r, endOfTags(tags, 0));
      return after === 'flac' || after === 'aac' || after === 'mp3' ? after : (fromExtension ?? 'mp3');
    }
    if (fromExtension) return fromExtension;
    return findMpegFrame(r, 0, 4096) ? 'mp3' : 'unknown';
  } catch {
    return containerFromExtension(fileName) ?? 'unknown';
  }
}

// ---------------------------------------------------------------- entry point

const PARSERS: Record<AudioContainer, ((ctx: ParseContext) => void) | undefined> = {
  mp3: parseMp3,
  mp4: parseMp4,
  wav: parseWav,
  flac: parseFlac,
  ogg: parseOgg,
  aac: parseAac,
  unknown: undefined,
};

export function parseAudioMetadata(bytes: Uint8Array, fileName?: string): AudioMetadata {
  const meta: AudioMetadata = { container: 'unknown', drmProtected: false, warnings: [] };
  let ctx: ParseContext | undefined;
  try {
    if (!(bytes instanceof Uint8Array)) {
      meta.warnings.push('No file data to read');
    } else {
      meta.container = detectContainer(bytes, fileName);
      ctx = new ParseContext(new ByteReader(bytes), meta);
      if (bytes.length === 0) ctx.warn('The file is empty');
      const parse = PARSERS[meta.container];
      if (parse) parse(ctx);
      else ctx.warn('Unrecognized audio file format');
    }
  } catch (err) {
    meta.warnings.push(`Metadata could not be fully read (${describeError(err)})`);
  }
  try {
    ctx?.applyTags();
  } catch {
    // applyTags only copies plain values; nothing to recover here.
  }
  return meta;
}

// ---------------------------------------------------------------- file names

const AUDIO_EXTENSIONS =
  /\.(?:mp3|mp2|mpga|m4a|m4b|m4p|m4r|mp4|aac|adts|wav|wave|flac|ogg|oga|opus|aif|aiff|aifc|alac|caf|wma|webm|weba|mka|amr|3gp|mov)$/i;

/** Track-number prefixes, tried in order: "1-03 " (disc-track), "01. " / "01 - " / "1) ", then a bare "01 ". */
const TRACK_PREFIXES = [/^\d{1,2}-\d{1,3}\s+/, /^\d{1,3}\s*[.):-]\s*(?=\D)/, /^\d{2,3}\s+/];

/** "01 - Artist - Title (Remix).mp3" -> { artist: 'Artist', title: 'Title (Remix)' }; strips extension, leading track numbers, underscores->spaces, trims. */
export function guessFromFileName(fileName: string): { title: string; artist?: string } {
  const base =
    String(fileName ?? '')
      .split(/[\\/]/)
      .pop() ?? '';
  let name = base.replace(AUDIO_EXTENSIONS, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  for (const prefix of TRACK_PREFIXES) {
    const stripped = name.replace(prefix, '');
    if (stripped !== name) {
      if (stripped.trim() !== '') name = stripped.trim();
      break;
    }
  }
  const parts = name.split(/\s+[-\u2013\u2014]\s+/).map((part) => part.trim());
  if (parts.length >= 2 && parts[0] !== '' && parts.slice(1).join('') !== '') {
    const artist = cleanText(parts[0]);
    const title = cleanText(parts.slice(1).join(' - '));
    if (artist && title) return { title, artist };
  }
  return { title: cleanText(name) ?? cleanText(base) ?? 'Untitled' };
}

// ---------------------------------------------------------------- compatibility

const DRM_NOTE =
  'This file is copy-protected (DRM), usually from Apple Music or an old iTunes purchase. Pulsefall can only play unprotected files like MP3s or DRM-free M4As.';
const UNKNOWN_NOTE = "Pulsefall doesn't recognize this kind of file. Try an MP3 or M4A file instead.";
const ALAC_NOTE = 'Apple Lossless may not play in every browser; if import fails, convert it to MP3 or AAC.';
const DOLBY_NOTE =
  "This file uses Dolby audio, which most browsers can't play. Convert it to MP3 or AAC to use it in Pulsefall.";
const OGG_NOTE =
  'OGG and Opus files may not play on older iPhones and iPads (before iOS 17). If import fails, convert it to MP3 or AAC.';

/** Major iOS/iPadOS version from the current user agent, or undefined when not an Apple mobile browser. */
function appleMobileOsVersion(): number | undefined {
  const ua = typeof navigator === 'undefined' ? '' : String(navigator.userAgent ?? '');
  const ios = /\b(?:iPhone|iPad|iPod)\b.*?\bOS (\d+)[_.]\d/.exec(ua);
  if (ios) return Number(ios[1]);
  // iPadOS asks for desktop sites with a Mac user agent; Safari's version number tracks the OS release.
  if (/Macintosh/.test(ua) && !/Chrome|Chromium|Firefox|Edg\//.test(ua)) {
    const safari = /Version\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari\//.exec(ua);
    if (safari) return Number(safari[1]);
  }
  return undefined;
}

/** User-facing explanation for a container/codec the browser is unlikely to play, or undefined if fine. */
export function compatibilityNote(meta: AudioMetadata): string | undefined {
  if (meta.drmProtected) return DRM_NOTE;
  if (meta.container === 'unknown') return UNKNOWN_NOTE;
  const codec = meta.codec?.toLowerCase();
  if (codec === 'alac') return ALAC_NOTE;
  if (codec === 'ac-3' || codec === 'ec-3') return DOLBY_NOTE;
  if (meta.container === 'ogg' || codec === 'opus' || codec === 'vorbis') {
    const ios = appleMobileOsVersion();
    if (ios !== undefined && ios < 17) return OGG_NOTE;
  }
  return undefined;
}
