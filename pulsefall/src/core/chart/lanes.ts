import type { PatternStyle } from '../types';
import { hashString, mulberry32 } from '../util';

/**
 * Lane assignment as a beam search over a comfort + musicality cost:
 *  - follow the melodic/brightness contour (brighter -> move right),
 *  - lean low-heavy hits left and bright hits right (softly, never as a rule),
 *  - avoid fast same-lane repeats and lopsided lane usage,
 *  - keep held lanes free while a hold is active,
 *  - repeat the lane pattern of an earlier matching phrase (chorus 2 plays like chorus 1).
 */

export interface LaneEvent {
  t: number;
  end?: number;
  chord: boolean;
  swipe: boolean;
  sal: number;
  low: number;
  high: number;
  bright: number;
  /** Mirror the low-left / bright-right lean for this event's phrase. */
  flip?: boolean;
  /** Events sharing a refKey should share a lane (phrase repetition). */
  refKey?: string;
  /** Softer echo of an earlier bar in the same phrase (motifs). */
  echoKey?: string;
}

export interface LaneAssignment {
  lane: number;
  partner?: number;
}

export interface LaneOptions {
  laneCount: number;
  patternStyle: PatternStyle;
  seed: number;
  /** Below this spacing (ms) same-lane repeats are hard to play. */
  fastMs: number;
  sameLaneGapMs: number;
}

interface Node {
  cost: number;
  lane: number;
  partner: number;
  prev: Node | null;
  l1: number;
  l2: number;
  t: number;
  bright: number;
  busy: Float64Array;
  lastAt: Float64Array;
  recent: number[];
}

const BEAM = 24;

export function assignLanes(events: LaneEvent[], opts: LaneOptions): LaneAssignment[] {
  if (events.length === 0) return [];
  // Pass 1: free assignment. Pass 2: repeat lanes of the first occurrence of each phrase.
  const first = runBeam(events, opts, null, null);
  const refLanes = new Map<string, number>();
  const echoLanes = new Map<string, number>();
  events.forEach((e, i) => {
    if (e.refKey && !refLanes.has(e.refKey)) refLanes.set(e.refKey, first[i].lane);
  });
  events.forEach((e, i) => {
    if (e.refKey) echoLanes.set(e.refKey, first[i].lane);
  });
  return runBeam(events, opts, refLanes, echoLanes);
}

function runBeam(
  events: LaneEvent[],
  opts: LaneOptions,
  refLanes: Map<string, number> | null,
  echoLanes: Map<string, number> | null,
): LaneAssignment[] {
  const L = opts.laneCount;
  const mid = (L - 1) / 2;
  const contourW = opts.patternStyle === 'melodic' ? 2.2 : opts.patternStyle === 'alternate' ? 0.5 : 1;
  const bandW = opts.patternStyle === 'melodic' ? 0.5 : 1;
  const altW = opts.patternStyle === 'alternate' ? 1 : 0;

  const root: Node = {
    cost: 0,
    lane: -1,
    partner: -1,
    prev: null,
    l1: -1,
    l2: -1,
    t: -Infinity,
    bright: 0.5,
    busy: new Float64Array(L).fill(-Infinity),
    lastAt: new Float64Array(L).fill(-Infinity),
    recent: [],
  };
  let beam: Node[] = [root];

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const rng = mulberry32(opts.seed ^ hashString(`${i}:${Math.round(e.t)}`));
    const noise = Array.from({ length: L }, () => rng() * 0.3);
    const lean = e.low > e.high * 1.4 ? 0 : e.high > e.low * 1.4 ? L - 1 : mid;
    const pref = e.flip ? L - 1 - lean : lean;
    const ref = refLanes && e.refKey !== undefined ? refLanes.get(e.refKey) : undefined;
    const echo = echoLanes && e.echoKey !== undefined ? echoLanes.get(e.echoKey) : undefined;
    const candidates: Node[] = [];

    for (const node of beam) {
      const dt = e.t - node.t;
      for (let c = 0; c < L; c++) {
        if (node.busy[c] > e.t - 60) continue;
        const partners = e.chord ? chordPartners(c, L) : [-1];
        for (const p of partners) {
          if (p >= 0 && (node.busy[p] > e.t - 60 || e.t - node.lastAt[p] < opts.sameLaneGapMs)) continue;
          let cost = node.cost + noise[c];
          // Same-lane spacing and jacks.
          if (e.t - node.lastAt[c] < opts.sameLaneGapMs) cost += 8;
          if (c === node.l1) {
            cost += dt < opts.fastMs ? 3.5 : dt < 400 ? 0.9 : 0.25;
            if (c === node.l2) cost += dt < 400 ? 1.5 : 0.4;
          }
          if (node.l1 >= 0 && Math.abs(c - node.l1) >= 2 && dt < 140) cost += 0.8;
          // Contour.
          // Mirrored phrases mirror the contour too, so the pattern reads as a deliberate answer.
          const d = (e.bright - node.bright) * (e.flip ? -1 : 1);
          if (node.l1 >= 0 && Math.abs(d) > 0.025 && dt < 1200) {
            const mv = Math.sign(c - node.l1);
            const w = contourW * Math.min(1, Math.abs(d) / 0.08);
            if (mv === -Math.sign(d)) cost += 0.55 * w;
            else if (mv === 0) cost += 0.25 * w;
          }
          // Band lean.
          cost += 0.18 * bandW * (Math.abs(c - pref) / Math.max(1, L - 1));
          // Lane balance over the last 8 events.
          let same = 0;
          for (const r of node.recent) if (r === c) same++;
          if (same >= 5) cost += 0.6 * (same - 4);
          // Alternating style: favour hopping sides.
          if (altW && node.l1 >= 0) {
            if (c === node.l1) cost += 0.8 * altW;
            else if (Math.sign(c - mid) === Math.sign(node.l1 - mid) && c !== mid) cost += 0.3 * altW;
          }
          // Phrase repetition.
          if (ref !== undefined && c !== ref) cost += 1.4;
          else if (echo !== undefined && ref === undefined && c !== echo) cost += 0.45;
          // Chords: two thumbs are happiest on the outside pair.
          if (p >= 0 && Math.abs(c - p) < L - 1) cost += 0.15;
          // Swipes read best on the outer lanes (flick outward).
          if (e.swipe && L >= 3 && c !== 0 && c !== L - 1) cost += 0.2;

          const busy = Float64Array.from(node.busy);
          const lastAt = Float64Array.from(node.lastAt);
          const end = e.end ?? e.t;
          busy[c] = e.end !== undefined ? end : -Infinity;
          lastAt[c] = end;
          if (p >= 0) lastAt[p] = e.t;
          const recent = node.recent.length >= 8 ? node.recent.slice(1) : node.recent.slice();
          recent.push(c);
          candidates.push({
            cost,
            lane: c,
            partner: p,
            prev: node,
            l1: c,
            l2: node.l1,
            t: e.t,
            bright: e.bright,
            busy,
            lastAt,
            recent,
          });
        }
      }
    }
    if (candidates.length === 0) {
      // Every lane is held: fall back to the lane whose hold ends soonest.
      for (const node of beam) {
        let c = 0;
        for (let k = 1; k < L; k++) if (node.busy[k] < node.busy[c]) c = k;
        candidates.push({ ...node, cost: node.cost + 10, lane: c, partner: -1, prev: node, l2: node.l1, l1: c, t: e.t });
      }
    }
    candidates.sort((a, b) => a.cost - b.cost);
    const seen = new Set<string>();
    const next: Node[] = [];
    for (const cand of candidates) {
      const key = `${cand.l1},${cand.l2},${cand.partner}`;
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(cand);
      if (next.length >= BEAM) break;
    }
    beam = next;
  }

  const out: LaneAssignment[] = new Array(events.length);
  let node: Node | null = beam[0];
  for (let i = events.length - 1; i >= 0 && node; i--) {
    out[i] = node.partner >= 0 ? { lane: node.lane, partner: node.partner } : { lane: node.lane };
    node = node.prev;
  }
  return out;
}

function chordPartners(c: number, L: number): number[] {
  const out: number[] = [];
  for (let p = 0; p < L; p++) if (p !== c && p > c) out.push(p);
  // Only enumerate each unordered pair once (c is the lower lane).
  return out.length ? out : [];
}
