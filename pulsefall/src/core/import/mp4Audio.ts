/**
 * The sound of an MP4/MOV video, without re-encoding.
 *
 * A video file keeps its audio as a separate track. This copies that track's compressed
 * samples (and the file's tags) into a small audio-only M4A with the index first, dropping
 * the picture. It reads the source through Blob slices, so a large video is never in memory
 * all at once, and the result decodes like any M4A — including on iOS, whose audio decoder
 * won't take a video container.
 *
 * Fragmented MP4s and layouts this doesn't understand give `null`; the caller then decodes
 * the original file instead.
 */

export type Mp4AudioResult =
  /** The file had a video track; `bytes` is the extracted audio-only M4A. */
  | { kind: 'extracted'; bytes: Uint8Array }
  /** Already an audio-only file: use it as it is. */
  | { kind: 'audio-only' }
  /** A video without a sound track. */
  | { kind: 'no-audio' }
  | null;

interface Box {
  type: string;
  /** Offset of the box header. */
  start: number;
  headerSize: number;
  /** Total size, header included. */
  size: number;
}

/** A box being rebuilt: either copied verbatim or rebuilt from children. */
type Node = { type: string; raw: Uint8Array } | { type: string; children: Node[] };

/** Boxes on the path to the sample tables, which are parsed rather than copied. */
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl']);
const READ_WINDOW = 8 * 1024 * 1024;
const MAX_INDEX_BYTES = 64 * 1024 * 1024;

const u32 = (b: Uint8Array, p: number) => ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0;
const u64 = (b: Uint8Array, p: number) => u32(b, p) * 2 ** 32 + u32(b, p + 4);
const fourcc = (b: Uint8Array, p: number) => String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);

async function read(blob: Blob, start: number, length: number): Promise<Uint8Array> {
  return new Uint8Array(await blob.slice(start, start + length).arrayBuffer());
}

/** Parses box headers in `buf[start, end)`; null if they don't tile the range. */
function parseBoxes(buf: Uint8Array, start: number, end: number): Box[] | null {
  const out: Box[] = [];
  let p = start;
  while (p + 8 <= end) {
    let size = u32(buf, p);
    let headerSize = 8;
    if (size === 1) {
      if (p + 16 > end) return null;
      size = u64(buf, p + 8);
      headerSize = 16;
    } else if (size === 0) size = end - p;
    if (size < headerSize || p + size > end) return null;
    out.push({ type: fourcc(buf, p + 4), start: p, headerSize, size });
    p += size;
  }
  return out;
}

async function topLevelBoxes(blob: Blob): Promise<Box[] | null> {
  const out: Box[] = [];
  let p = 0;
  while (p + 8 <= blob.size && out.length < 4096) {
    const h = await read(blob, p, 16);
    let size = u32(h, 0);
    let headerSize = 8;
    const type = fourcc(h, 4);
    if (size === 1) {
      if (h.length < 16) return null;
      size = u64(h, 8);
      headerSize = 16;
    } else if (size === 0) size = blob.size - p;
    if (size < headerSize) return null;
    // A truncated final media box is common in cut-short recordings; its index is elsewhere.
    if (p + size > blob.size) {
      if (type !== 'mdat') return null;
      size = blob.size - p;
    }
    out.push({ type, start: p, headerSize, size });
    p += size;
  }
  return out;
}

function toNode(buf: Uint8Array, box: Box): Node | null {
  if (!CONTAINERS.has(box.type)) return { type: box.type, raw: buf.subarray(box.start, box.start + box.size) };
  const kids = parseBoxes(buf, box.start + box.headerSize, box.start + box.size);
  if (!kids) return null;
  const children: Node[] = [];
  for (const k of kids) {
    const n = toNode(buf, k);
    if (!n) return null;
    children.push(n);
  }
  return { type: box.type, children };
}

const child = (n: Node | undefined, type: string): Node | undefined => (n && 'children' in n ? n.children.find((c) => c.type === type) : undefined);
const rawOf = (n: Node | undefined): Uint8Array | undefined => (n && 'raw' in n ? n.raw : undefined);

function handlerType(trak: Node): string | undefined {
  const hdlr = rawOf(child(child(trak, 'mdia'), 'hdlr'));
  // header(8) + version/flags(4) + pre_defined / QuickTime component type(4), then the type.
  return hdlr && hdlr.length >= 20 ? fourcc(hdlr, 16) : undefined;
}

function sizeOf(n: Node): number {
  if ('raw' in n) return n.raw.length;
  let s = 8;
  for (const c of n.children) s += sizeOf(c);
  return s;
}

function write(n: Node, out: Uint8Array, p: number): number {
  if ('raw' in n) {
    out.set(n.raw, p);
    return p + n.raw.length;
  }
  const size = sizeOf(n);
  new DataView(out.buffer, out.byteOffset + p, 8).setUint32(0, size);
  for (let i = 0; i < 4; i++) out[p + 4 + i] = n.type.charCodeAt(i);
  let q = p + 8;
  for (const c of n.children) q = write(c, out, q);
  return q;
}

interface Chunk {
  offset: number;
  size: number;
}

/** Byte ranges of every chunk of the track, in chunk order. */
function chunkTable(stbl: Node): Chunk[] | null {
  const stsc = rawOf(child(stbl, 'stsc'));
  const stsz = rawOf(child(stbl, 'stsz'));
  const stco = rawOf(child(stbl, 'stco'));
  const co64 = rawOf(child(stbl, 'co64'));
  if (!stsc || !stsz || (!stco && !co64) || stsc.length < 16 || stsz.length < 20) return null;

  const offsets: number[] = [];
  const table = (stco ?? co64)!;
  const wide = !stco;
  const nChunks = u32(table, 12);
  if (table.length < 16 + nChunks * (wide ? 8 : 4)) return null;
  for (let i = 0; i < nChunks; i++) offsets.push(wide ? u64(table, 16 + i * 8) : u32(table, 16 + i * 4));

  const fixedSize = u32(stsz, 12);
  const nSamples = u32(stsz, 16);
  if (fixedSize === 0 && stsz.length < 20 + nSamples * 4) return null;
  const sampleSize = (i: number) => (fixedSize !== 0 ? fixedSize : u32(stsz, 20 + i * 4));

  const nRuns = u32(stsc, 12);
  if (nRuns === 0 || stsc.length < 16 + nRuns * 12) return null;
  const runFirst = (r: number) => u32(stsc, 16 + r * 12);
  const runSamples = (r: number) => u32(stsc, 16 + r * 12 + 4);

  const chunks: Chunk[] = [];
  let sample = 0;
  let run = 0;
  for (let c = 1; c <= nChunks; c++) {
    while (run + 1 < nRuns && runFirst(run + 1) <= c) run++;
    const count = runSamples(run);
    let size = 0;
    for (let k = 0; k < count; k++, sample++) {
      if (sample >= nSamples) return null;
      size += sampleSize(sample);
    }
    chunks.push({ offset: offsets[c - 1], size });
  }
  return sample === nSamples ? chunks : null;
}

/** A 32-bit chunk offset table with `count` entries, filled in later through `view`. */
function stcoBox(count: number): { node: Node; view: DataView } {
  const raw = new Uint8Array(16 + count * 4);
  const view = new DataView(raw.buffer);
  view.setUint32(0, raw.length);
  raw.set([0x73, 0x74, 0x63, 0x6f], 4); // 'stco'
  view.setUint32(12, count);
  return { node: { type: 'stco', raw }, view };
}

/** ftyp: major brand 'M4A ', compatible with M4A, MP4 v2 and ISO base media. */
function ftypBox(): Uint8Array {
  const text = 'ftypM4A \0\0\0\0M4A mp42isom';
  const raw = new Uint8Array(4 + text.length);
  new DataView(raw.buffer).setUint32(0, raw.length);
  for (let i = 0; i < text.length; i++) raw[4 + i] = text.charCodeAt(i);
  return raw;
}

/** Extracts the first audio track of an MP4/MOV file. See the module comment. */
export async function extractMp4Audio(blob: Blob, maxAudioBytes = 150 * 1024 * 1024): Promise<Mp4AudioResult> {
  const top = await topLevelBoxes(blob);
  if (!top) return null;
  const moovBox = top.find((b) => b.type === 'moov');
  if (!moovBox || top.some((b) => b.type === 'moof') || moovBox.size > MAX_INDEX_BYTES) return null;
  const moovBuf = await read(blob, moovBox.start, moovBox.size);
  const moov = toNode(moovBuf, { ...moovBox, start: 0 });
  if (!moov || !('children' in moov) || child(moov, 'mvex')) return null;

  const traks = moov.children.filter((c) => c.type === 'trak');
  const audio = traks.find((t) => handlerType(t) === 'soun');
  const hasVideo = traks.some((t) => handlerType(t) === 'vide');
  if (!audio) return hasVideo ? { kind: 'no-audio' } : null;
  if (!hasVideo) return { kind: 'audio-only' };

  const stbl = child(child(child(audio, 'mdia'), 'minf'), 'stbl');
  if (!stbl || !('children' in stbl)) return null;
  const chunks = chunkTable(stbl);
  if (!chunks || chunks.length === 0) return null;
  let total = 0;
  for (const c of chunks) {
    if (c.offset + c.size > blob.size) return null;
    total += c.size;
  }
  if (total === 0 || total > maxAudioBytes) return null;

  // The new index: only the audio track (no references to the dropped ones), new offsets.
  const stco = stcoBox(chunks.length);
  stbl.children = stbl.children.filter((c) => c.type !== 'stco' && c.type !== 'co64').concat(stco.node);
  if ('children' in audio) audio.children = audio.children.filter((c) => c.type !== 'tref');
  moov.children = moov.children.filter((c) => (c.type === 'trak' ? c === audio : c.type !== 'iods'));

  const ftyp = ftypBox();
  const moovSize = sizeOf(moov);
  const mdatStart = ftyp.length + moovSize;
  const offsets: number[] = [];
  let acc = mdatStart + 8;
  for (const c of chunks) {
    offsets.push(acc);
    acc += c.size;
  }
  if (acc > 0xffffffff) return null;
  offsets.forEach((o, i) => stco.view.setUint32(16 + i * 4, o));

  const out = new Uint8Array(acc);
  out.set(ftyp, 0);
  write(moov, out, ftyp.length);
  new DataView(out.buffer).setUint32(mdatStart, 8 + total);
  out.set([0x6d, 0x64, 0x61, 0x74], mdatStart + 4); // 'mdat'

  // Copy the samples, reading the source in large windows in file order.
  const order = chunks.map((_, i) => i).sort((a, b) => chunks[a].offset - chunks[b].offset);
  let winStart = 0;
  let win: Uint8Array = new Uint8Array(0);
  for (const i of order) {
    const { offset, size } = chunks[i];
    if (offset < winStart || offset + size > winStart + win.length) {
      winStart = offset;
      win = await read(blob, offset, Math.max(READ_WINDOW, size));
      if (win.length < size) return null;
    }
    out.set(win.subarray(offset - winStart, offset - winStart + size), offsets[i]);
  }
  return { kind: 'extracted', bytes: out };
}

/** True if the first bytes look like an MP4/MOV (ISO base media) file. */
export function looksLikeMp4(head: Uint8Array): boolean {
  if (head.length < 8) return false;
  const t = fourcc(head, 4);
  return t === 'ftyp' || t === 'moov' || t === 'wide' || t === 'mdat' || t === 'free' || t === 'skip';
}
