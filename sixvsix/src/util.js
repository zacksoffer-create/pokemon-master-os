// Deterministic helpers that behave identically in Node and in any browser: string hashing, seed derivation and
// the policies' random numbers. Nothing here touches Date, Math.random or a platform crypto API, so a job run on a
// phone and on the home laptop draws exactly the same numbers.

/** 32-bit murmur3-style hash of a string with a salt. */
function hash32(str, salt) {
  let h = (0x9747b28c ^ salt) >>> 0;
  for (let i = 0; i < str.length; i++) {
    let k = str.charCodeAt(i);
    k = Math.imul(k, 0xcc9e2d51); k = (k << 15) | (k >>> 17); k = Math.imul(k, 0x1b873593);
    h ^= k; h = (h << 13) | (h >>> 19); h = (Math.imul(h, 5) + 0xe6546b64) >>> 0;
  }
  h ^= str.length;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}

const hex8 = (n) => (n >>> 0).toString(16).padStart(8, '0');

/** A 128-bit hex digest of the parts (not cryptographic; stable across platforms). */
export function digest(...parts) {
  const s = parts.map(String).join('␟');
  return hex8(hash32(s, 1)) + hex8(hash32(s, 2)) + hex8(hash32(s, 3)) + hex8(hash32(s, 4));
}

/** A short content hash, for comparing logs and results. */
export function shortHash(text) {
  return digest(text).slice(0, 16);
}

/**
 * The battle seed for one battle of a job: Showdown's own 'sodium' PRNG, keyed from the job seed and the pair index.
 * Both battles of a pair (sides swapped) get the same battle seed.
 */
export function battleSeed(jobSeed, pair) {
  return 'sodium,' + digest('battle', jobSeed, pair);
}

/** The policy seed for one side of one battle, independent of the battle seed. */
export function policySeed(jobSeed, battleIndex, who) {
  return digest('policy', jobSeed, battleIndex, who).slice(0, 32);
}

/** sfc32: a small fast PRNG for the agents. A 32-hex-digit seed is used as is; any other string is hashed first. */
export class PolicyRNG {
  constructor(seed) {
    const s = /^[0-9a-f]{32}$/.test(String(seed)) ? String(seed) : digest('policy-rng', seed);
    this.a = parseInt(s.slice(0, 8), 16) >>> 0;
    this.b = parseInt(s.slice(8, 16), 16) >>> 0;
    this.c = parseInt(s.slice(16, 24), 16) >>> 0;
    this.d = parseInt(s.slice(24, 32), 16) >>> 0 || 1;
    for (let i = 0; i < 12; i++) this.next();
  }
  next() {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.c = (this.c + t) >>> 0;
    return t / 4294967296;
  }
  /** An integer in [0, n). */
  int(n) { return Math.floor(this.next() * n); }
  pick(list) { return list[this.int(list.length)]; }
}

/** Showdown's id form: lowercase letters and digits only. */
export const toID = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

/** Stable JSON: object keys sorted, so equal objects serialize equally. */
export function stableStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().filter((k) => value[k] !== undefined)
      .map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

/** A monotonic clock in milliseconds where one exists (timing only; never feeds a result). */
export const now = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());
