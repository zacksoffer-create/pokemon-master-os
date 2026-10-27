import { gridFromTempo } from '../analysis/beats';
import { sampleMax } from '../analysis/meter';
import { BF_CHROMA, BF_TIMBRE } from '../analysis/structure';
import {
  GENERATOR_VERSION,
  type AnalysisResult,
  type ChartStats,
  type ChartStyle,
  type GenerationParams,
  type MeterInfo,
  type Note,
  type Onset,
  type PatternStyle,
  type SwipeDir,
} from '../types';
import { clamp, hashString, lowerBound, median, mulberry32 } from '../util';
import { assignLanes, type LaneEvent } from './lanes';
import { chartStats, musicality, type MusicalityReport } from './stats';
import { styleParams, type StyleParams } from './styles';
import { validateChart } from './validate';

export interface GenerateOptions {
  style: ChartStyle;
  laneCount?: number;
  /** Base seed, normally derived from the audio fingerprint. */
  seed: number;
  /** User-requested alternative interpretation (0 = default). */
  variation?: number;
  densityAdjust?: number;
  patternStyle?: PatternStyle;
  bpmOverride?: number;
  firstBeatOverrideMs?: number;
}

export interface GeneratedChart {
  notes: Note[];
  params: GenerationParams;
  approximate: boolean;
  fixes: string[];
  warnings: string[];
  stats: ChartStats;
  musicality: MusicalityReport;
}

export class ChartGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChartGenerationError';
  }
}

/** A candidate musical moment that may become a note. */
interface Ev {
  t: number;
  sal: number;
  onset: Onset | null;
  level: number;
  bar: number;
  pos: number;
  intensity: number;
  seg: number;
  hold?: number;
  chord?: boolean;
  swipe?: boolean;
  /** Mirror the lane lean for this phrase (call and response between phrases). */
  flip?: boolean;
  refKey?: string;
  echoKey?: string;
}

interface Slot {
  t: number;
  level: number;
  beat: number;
  bar: number;
  pos: number;
  sal: number;
  onset: Onset | null;
}

const MATCH_SNAP_MS = 28;

export function generateChart(a: AnalysisResult, opts: GenerateOptions): GeneratedChart {
  if (!a.rhythmic || a.onsets.length < 4) {
    throw new ChartGenerationError('No meaningful rhythm was detected in this track, so a chart cannot be built from it.');
  }
  const laneCount = clamp(Math.round(opts.laneCount ?? 3), 3, 4);
  const variation = opts.variation ?? 0;
  const densityAdjust = clamp(opts.densityAdjust ?? 0, -2, 2);
  const patternStyle = opts.patternStyle ?? 'flow';
  const seed = (opts.seed ^ hashString(`${opts.style}|${variation}|${GENERATOR_VERSION}`)) >>> 0;
  const sp = styleParams(opts.style, densityAdjust);

  // Beat grid: a manual override always wins, otherwise trust the analysis when confident.
  let beats = a.beats;
  let meter = a.meter;
  let gridConfidence = a.beatConfidence;
  if (opts.bpmOverride && opts.bpmOverride > 30) {
    beats = gridFromTempo(opts.bpmOverride, opts.firstBeatOverrideMs ?? a.beats[0] ?? 0, a.durationMs);
    gridConfidence = 1;
    const first = opts.firstBeatOverrideMs ?? beats[0];
    meter = { ...a.meter, firstDownbeat: Math.max(0, lowerBound(beats, first - 5)) % a.meter.beatsPerBar };
  }

  const ctx = { a, sp, seed, laneCount, patternStyle };
  let mode: 'grid' | 'free' = gridConfidence >= 0.45 && beats.length >= 8 ? 'grid' : 'free';
  let built = finish(ctx, mode === 'grid' ? gridEvents(ctx, beats, meter) : freeEvents(ctx), beats);

  // In the grey zone, also try the other interpretation and keep the more musical chart.
  if (mode === 'grid' && gridConfidence < 0.62 && !opts.bpmOverride) {
    const alt = finish(ctx, freeEvents(ctx), beats);
    if (score(alt.musicality) > score(built.musicality) + 0.05) {
      built = alt;
      mode = 'free';
    }
  }
  if (built.notes.length === 0) {
    throw new ChartGenerationError('The analysis found sound but no playable rhythm. Try a different track.');
  }

  return {
    ...built,
    approximate: mode === 'free' || gridConfidence < 0.6,
    params: {
      style: opts.style,
      laneCount,
      seed: opts.seed,
      variation,
      densityAdjust,
      patternStyle,
      bpmOverride: opts.bpmOverride,
      firstBeatOverrideMs: opts.firstBeatOverrideMs,
      mode,
    },
  };
}

function score(m: MusicalityReport): number {
  return m.alignment + 0.25 * m.densityFollowsEnergy + 0.2 * m.laneBalance - 0.5 * m.fastJackRate;
}

interface Ctx {
  a: AnalysisResult;
  sp: StyleParams;
  seed: number;
  laneCount: number;
  patternStyle: PatternStyle;
}

function targetNps(sp: StyleParams, intensity: number): number {
  return sp.npsLow + (sp.npsHigh - sp.npsLow) * Math.pow(clamp(intensity, 0, 1), 1.15);
}

function segmentAt(a: AnalysisResult, t: number): number {
  for (let i = a.segments.length - 1; i >= 0; i--) if (t >= a.segments[i].startMs) return i;
  return 0;
}

/** Strongest onset within ±tol of t. */
function matchOnset(onsets: Onset[], times: number[], t: number, tol: number): Onset | null {
  let best: Onset | null = null;
  for (let i = lowerBound(times, t - tol); i < onsets.length && times[i] <= t + tol; i++) {
    if (!best || onsets[i].s > best.s) best = onsets[i];
  }
  return best;
}

// ---------------------------------------------------------------------------
// Grid mode: metrical slots, bar-pattern clustering, phrase repetition.
// ---------------------------------------------------------------------------

function gridEvents(ctx: Ctx, beats: number[], meter: MeterInfo): Ev[] {
  const { a, sp, seed } = ctx;
  const rng = mulberry32(seed);
  const m = meter.beatsPerBar;
  const subs = meter.subdivision === 'ternary' ? [0, 1 / 3, 2 / 3] : [0, 0.25, 0.5, 0.75];
  const subLevels = meter.subdivision === 'ternary' ? [-1, 3, 2] : [-1, 3, 2, 3];
  const perBar = m * subs.length;
  const onsetTimes = a.onsets.map((o) => o.t);

  // 1. Slots with salience.
  const slots: Slot[] = [];
  for (let i = 0; i < beats.length; i++) {
    const period = i + 1 < beats.length ? beats[i + 1] - beats[i] : beats[i] - beats[i - 1];
    const rel = i - meter.firstDownbeat;
    const bar = Math.floor(rel / m);
    const beatInBar = ((rel % m) + m) % m;
    const nSubs = i + 1 < beats.length ? subs.length : 1;
    for (let k = 0; k < nSubs; k++) {
      const t = beats[i] + period * subs[k];
      if (t < 0 || t > a.durationMs - 50) continue;
      const level = k === 0 ? (beatInBar === 0 ? 0 : 1) : subLevels[k];
      const tol = Math.min(42, (period / subs.length) * 0.22);
      const onset = matchOnset(a.onsets, onsetTimes, t, tol);
      const odfSal = 0.7 * sampleMax(a.odf, a.fps, t, 1);
      const sal = Math.max(onset ? onset.s : 0, odfSal);
      slots.push({ t: onset && Math.abs(onset.t - t) <= MATCH_SNAP_MS ? onset.t : t, level, beat: i, bar, pos: beatInBar * subs.length + k, sal, onset });
    }
  }

  // 2. Bars and their descriptors.
  const barMap = new Map<number, Slot[]>();
  for (const s of slots) {
    let list = barMap.get(s.bar);
    if (!list) barMap.set(s.bar, (list = []));
    list.push(s);
  }
  const barIds = [...barMap.keys()].sort((x, y) => x - y);
  const D = a.beatFeatureDims;
  const featDims = 12 + 8;
  const zMean = new Float64Array(featDims);
  const zStd = new Float64Array(featDims);
  const nRows = D > 0 ? a.beatFeatures.length / D : 0;
  const featAt = (beat: number, d: number) => {
    const col = d < 12 ? BF_CHROMA + d : BF_TIMBRE + (d - 12);
    return beat < nRows ? a.beatFeatures[beat * D + col] : 0;
  };
  if (nRows > 0) {
    for (let d = 0; d < featDims; d++) {
      let s = 0;
      for (let r = 0; r < nRows; r++) s += featAt(r, d);
      zMean[d] = s / nRows;
      let v = 0;
      for (let r = 0; r < nRows; r++) v += (featAt(r, d) - zMean[d]) ** 2;
      zStd[d] = Math.sqrt(v / nRows) || 1;
    }
  }
  interface BarInfo {
    id: number;
    slots: Slot[];
    rhythm: Float64Array;
    feat: Float64Array;
    start: number;
    end: number;
    intensity: number;
    budget: number;
    cluster: number;
    seg: number;
  }
  const bars: BarInfo[] = barIds.map((id) => {
    const list = barMap.get(id)!;
    const rhythm = new Float64Array(perBar);
    for (const s of list) rhythm[s.pos] = s.sal;
    const feat = new Float64Array(featDims);
    const beatSet = [...new Set(list.map((s) => s.beat))];
    for (const b of beatSet) for (let d = 0; d < featDims; d++) feat[d] += (featAt(b, d) - zMean[d]) / zStd[d] / beatSet.length;
    const start = list[0].t;
    const lastBeat = beatSet[beatSet.length - 1];
    const end = lastBeat + 1 < beats.length ? beats[lastBeat + 1] : list[list.length - 1].t + 200;
    const seg = segmentAt(a, start + 10);
    const intensity = a.segments[seg]?.intensity ?? 0.6;
    const budget = (targetNps(sp, intensity) * (end - start)) / 1000;
    return { id, slots: list, rhythm, feat, start, end, intensity, budget, cluster: -1, seg };
  });

  // 3. Cluster bars that share rhythm and sound, so they get the same rhythm pattern.
  const cos = (x: Float64Array, y: Float64Array) => {
    let s = 0;
    let nx = 0;
    let ny = 0;
    for (let i = 0; i < x.length; i++) {
      s += x[i] * y[i];
      nx += x[i] * x[i];
      ny += y[i] * y[i];
    }
    return nx > 1e-12 && ny > 1e-12 ? s / Math.sqrt(nx * ny) : nx < 1e-12 && ny < 1e-12 ? 1 : 0;
  };
  const leaders: number[] = [];
  for (let b = 0; b < bars.length; b++) {
    const bar = bars[b];
    if (bar.slots.length < perBar * 0.75) continue; // partial bars stand alone
    for (let c = 0; c < leaders.length; c++) {
      const L = bars[leaders[c]];
      const sim = 0.65 * cos(bar.rhythm, L.rhythm) + 0.35 * (0.5 + 0.5 * cos(bar.feat, L.feat));
      if (sim >= 0.86 && Math.abs(bar.intensity - L.intensity) < 0.25) {
        bar.cluster = c;
        break;
      }
    }
    if (bar.cluster < 0) {
      leaders.push(b);
      bar.cluster = leaders.length - 1;
    }
  }

  // 4. Choose a rhythm pattern per cluster from the averaged salience of its members.
  const levelOf = new Int8Array(perBar);
  for (let p = 0; p < perBar; p++) {
    const k = p % subs.length;
    levelOf[p] = k === 0 ? (p === 0 ? 0 : 1) : subLevels[k];
  }
  const floorFor = (level: number) => (level <= 1 ? sp.beatFloor : sp.offbeatFloor);
  const patternFor = new Map<number, number[]>();
  const jitter = Array.from({ length: perBar }, () => 1 + 0.04 * rng());
  const choose = (rhythm: Float64Array, budget: number, refBar: BarInfo): number[] => {
    const span = (refBar.end - refBar.start) / perBar;
    const cands: { p: number; score: number }[] = [];
    for (let p = 0; p < perBar; p++) {
      const lv = levelOf[p];
      if (lv > sp.maxLevel) continue;
      if (rhythm[p] < floorFor(lv)) continue;
      cands.push({ p, score: Math.pow(rhythm[p], 0.85) * sp.levelWeights[lv] * jitter[p] });
    }
    cands.sort((x, y) => y.score - x.score);
    const chosen: number[] = [];
    const k = Math.max(0, Math.round(budget));
    for (const c of cands) {
      if (chosen.length >= k) break;
      if (chosen.some((q) => Math.abs(q - c.p) * span < sp.minGapMs)) continue;
      chosen.push(c.p);
    }
    // Anchor a clearly marked downbeat even in sparse bars.
    if (k > 0 && !chosen.includes(0) && rhythm[0] >= Math.max(0.3, floorFor(0)) && chosen.every((q) => q * span >= sp.minGapMs)) {
      if (chosen.length >= k && chosen.length > 0) {
        // Replace the weakest choice.
        let weakest = 0;
        for (let i = 1; i < chosen.length; i++) if (rhythm[chosen[i]] < rhythm[chosen[weakest]]) weakest = i;
        if (rhythm[chosen[weakest]] < rhythm[0]) chosen.splice(weakest, 1);
      }
      if (chosen.length < k) chosen.push(0);
    }
    return chosen.sort((x, y) => x - y);
  };
  for (let c = 0; c < leaders.length; c++) {
    const members = bars.filter((b) => b.cluster === c);
    const avg = new Float64Array(perBar);
    for (const b of members) for (let p = 0; p < perBar; p++) avg[p] += b.rhythm[p] / members.length;
    const budget = median(members.map((b) => b.budget));
    patternFor.set(c, choose(avg, budget, bars[leaders[c]]));
  }

  // 5. Phrases of 4 bars (restarting at each segment) for lane repetition.
  const phraseOf = new Map<number, { idx: number; barInPhrase: number; inSeg: number }>();
  const phraseKeys: string[] = [];
  let phraseIdx = -1;
  let barInPhrase = 0;
  let phraseInSeg = 0;
  let lastSeg = -1;
  for (const bar of bars) {
    if (bar.seg !== lastSeg || barInPhrase >= 4) {
      phraseIdx++;
      phraseInSeg = bar.seg !== lastSeg ? 0 : phraseInSeg + 1;
      barInPhrase = 0;
      lastSeg = bar.seg;
      // The phrase's position inside its section is part of its identity, so phrases vary
      // within a section while a repeated section replays the same sequence.
      phraseKeys.push(`${phraseInSeg}#`);
    }
    phraseOf.set(bar.id, { idx: phraseIdx, barInPhrase, inSeg: phraseInSeg });
    phraseKeys[phraseIdx] += `${bar.cluster},`;
    barInPhrase++;
  }
  // Phrases with identical bar-cluster sequences (and the same section type) repeat lanes.
  const phraseLeader = new Map<string, number>();
  const phraseRef: number[] = phraseKeys.map((key, i) => {
    const firstBar = bars.find((b) => phraseOf.get(b.id)?.idx === i);
    const label = firstBar ? a.segments[firstBar.seg]?.label ?? 0 : 0;
    const full = `${label}|${key}`;
    if (!phraseLeader.has(full)) phraseLeader.set(full, i);
    return phraseLeader.get(full)!;
  });

  // 6. Realize each bar: the cluster pattern, adapted to what this bar actually contains.
  const events: Ev[] = [];
  for (const bar of bars) {
    const pattern = bar.cluster >= 0 ? patternFor.get(bar.cluster)! : choose(bar.rhythm, bar.budget, bar);
    const bySlot = new Map(bar.slots.map((s) => [s.pos, s]));
    const chosen = new Set<number>();
    for (const p of pattern) {
      const s = bySlot.get(p);
      if (!s) continue;
      if (s.sal < floorFor(levelOf[p]) * 0.6) continue; // this repetition lacks the hit
      chosen.add(p);
    }
    // Unique accents in this bar (fills, stabs) that the shared pattern does not cover.
    let extras = 0;
    for (const s of [...bar.slots].sort((x, y) => y.sal - x.sal)) {
      if (extras >= sp.extraAccents) break;
      const lv = levelOf[s.pos];
      if (chosen.has(s.pos) || lv > sp.maxLevel) continue;
      if (s.sal < Math.max(0.85, floorFor(lv) * 1.5)) continue;
      const span = (bar.end - bar.start) / perBar;
      if ([...chosen].some((q) => Math.abs(q - s.pos) * span < sp.minGapMs)) continue;
      chosen.add(s.pos);
      extras++;
    }
    const ph = phraseOf.get(bar.id)!;
    for (const p of [...chosen].sort((x, y) => x - y)) {
      const s = bySlot.get(p)!;
      const ev: Ev = {
        t: s.t,
        sal: s.sal,
        onset: s.onset,
        level: levelOf[p],
        bar: bar.id,
        pos: p,
        intensity: bar.intensity,
        seg: bar.seg,
        flip: ph.inSeg % 2 === 1,
        refKey: `${phraseRef[ph.idx]}:${ph.barInPhrase}:${p}`,
        echoKey: ph.barInPhrase >= 2 ? `${phraseRef[ph.idx]}:${ph.barInPhrase - 2}:${p}` : undefined,
      };
      events.push(ev);
    }
  }
  events.sort((x, y) => x.t - y.t);

  // 7. Quiet stretches with sustained sound get long holds on the downbeat.
  addPadHolds(ctx, events, bars.map((b) => ({ start: b.start, end: b.end })));
  return events;
}

// ---------------------------------------------------------------------------
// Free mode: when the pulse is unreliable, follow detected hits directly.
// ---------------------------------------------------------------------------

function freeEvents(ctx: Ctx): Ev[] {
  const { a, sp } = ctx;
  const out: Ev[] = [];
  const BLOCK = 2000;
  const cands = a.onsets.filter((o) => o.s >= Math.max(0.12, sp.beatFloor + 0.05));
  for (let start = 0; start < a.durationMs; start += BLOCK) {
    const inBlock = cands.filter((o) => o.t >= start && o.t < start + BLOCK);
    if (!inBlock.length) continue;
    const seg = segmentAt(a, start + BLOCK / 2);
    const intensity = a.segments[seg]?.intensity ?? 0.6;
    const k = Math.round((targetNps(ctx.sp, intensity) * BLOCK) / 1000);
    const chosen: Onset[] = [];
    for (const o of inBlock.slice().sort((x, y) => y.s - x.s)) {
      if (chosen.length >= k) break;
      if (o.s < sp.offbeatFloor * 0.8 && chosen.length >= 1) continue;
      const prev = out.length ? out[out.length - 1].t : -Infinity;
      if (o.t - prev < sp.minGapMs) continue;
      if (chosen.some((c) => Math.abs(c.t - o.t) < sp.minGapMs)) continue;
      chosen.push(o);
    }
    chosen.sort((x, y) => x.t - y.t);
    for (const o of chosen) out.push({ t: o.t, sal: o.s, onset: o, level: 1, bar: -1, pos: 0, intensity, seg });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shared finishing: spacing, holds, chords, swipes, lanes, validation.
// ---------------------------------------------------------------------------

function addPadHolds(ctx: Ctx, events: Ev[], bars: { start: number; end: number }[]): void {
  const { a, sp } = ctx;
  if (sp.holdRate <= 0) return;
  const added: Ev[] = [];
  for (let i = 0; i + 1 < bars.length; i += 2) {
    const start = bars[i].start;
    const end = bars[i + 1].end;
    if (start < a.firstSoundMs - 50) continue;
    const prev = events[lowerBound(events.map((e) => e.t), start) - 1];
    const next = events[lowerBound(events.map((e) => e.t), start)];
    if ((prev && start - prev.t < 600) || (next && next.t < end)) continue;
    const e0 = a.energy[Math.round((start / 1000) * a.fps)] ?? 0;
    const e1 = a.energy[Math.round(((start + end) / 2000) * a.fps)] ?? 0;
    if (Math.min(e0, e1) < 0.35) continue;
    const seg = segmentAt(a, start);
    added.push({
      t: start,
      sal: 0.3,
      onset: null,
      level: 0,
      bar: -1,
      pos: 0,
      intensity: a.segments[seg]?.intensity ?? 0.3,
      seg,
      hold: start + (end - start) * 0.75,
    });
  }
  if (added.length) {
    events.push(...added);
    events.sort((x, y) => x.t - y.t);
  }
}

function finish(ctx: Ctx, input: Ev[], beats: number[]): Omit<GeneratedChart, 'params' | 'approximate'> {
  const { a, sp, laneCount } = ctx;
  // Global spacing: drop the weaker of two events that are too close.
  const events: Ev[] = [];
  for (const e of input) {
    if (e.t < Math.max(0, a.firstSoundMs - 60) || e.t > a.durationMs - 60) continue;
    const prev = events[events.length - 1];
    if (prev && e.t - prev.t < sp.minGapMs) {
      if (e.sal > prev.sal && !prev.hold) events[events.length - 1] = e;
      continue;
    }
    events.push(e);
  }
  const beatPeriod = beats.length > 1 ? median(beats.slice(1).map((b, i) => b - beats[i])) : 500;

  // Holds: (a) where the sound rings on across a rest in the chart, (b) on long sustained
  // notes. In styles without overlap a long note replaces the weaker taps beneath it.
  if (sp.holdRate > 0) {
    const releaseGap = Math.max(120, sp.sameLaneGapMs * 0.6);
    const energyAt = (t: number) => a.energy[clamp(Math.round((t / 1000) * a.fps), 0, a.energy.length - 1)] ?? 0;
    const energyHolds = (t0: number, t1: number) => {
      const ref = energyAt(t0 + 60);
      for (let t = t0 + 100; t < t1 - 100; t += 50) if (energyAt(t) < Math.max(0.3, ref * 0.6)) return false;
      return ref > 0.3;
    };
    const cands: { i: number; end: number; score: number; removes: number[] }[] = [];
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.hold !== undefined || e.chord) continue;
      const next = events[i + 1];
      const gap = (next ? next.t : a.durationMs - 100) - e.t;
      const sus = e.onset?.sustain ?? 0;
      if (gap >= Math.max(sp.minHoldMs + releaseGap, 1.4 * beatPeriod) && (sus >= 0.6 * gap || energyHolds(e.t, e.t + gap))) {
        const end = snapDown(e.t + gap - releaseGap, beats, e.t);
        if (end - e.t >= sp.minHoldMs) cands.push({ i, end, score: (end - e.t) * (0.5 + e.sal), removes: [] });
        continue;
      }
      if (sus < Math.max(sp.minHoldMs, 1.2 * beatPeriod)) continue;
      let end = snapDown(Math.min(e.t + sus, a.durationMs - 100), beats, e.t);
      const removes: number[] = [];
      if (!sp.holdOverlap) {
        for (let j = i + 1; j < events.length && events[j].t < end + releaseGap; j++) {
          const f = events[j];
          if (f.chord || f.swipe || f.hold !== undefined || f.sal > e.sal * 1.1) {
            end = snapDown(f.t - releaseGap, beats, e.t);
            break;
          }
          removes.push(j);
        }
        while (removes.length && events[removes[removes.length - 1]].t >= end + releaseGap) removes.pop();
      }
      if (end - e.t < sp.minHoldMs) continue;
      cands.push({ i, end, score: (end - e.t) * (0.5 + e.sal) * 0.8, removes });
    }
    cands.sort((x, y) => y.score - x.score);
    const maxHolds = Math.max(1, Math.round(events.length * sp.holdRate));
    let made = events.filter((e) => e.hold !== undefined).length;
    const taken: { t: number; end: number }[] = [];
    const dropped = new Set<number>();
    for (const c of cands) {
      if (made >= maxHolds) break;
      const e = events[c.i];
      if (dropped.has(c.i) || taken.some((h) => e.t < h.end + 300 && c.end > h.t - 300)) continue;
      e.hold = c.end;
      for (const j of c.removes) dropped.add(j);
      taken.push({ t: e.t, end: c.end });
      made++;
    }
    if (dropped.size) {
      const kept = events.filter((_, i) => !dropped.has(i));
      events.length = 0;
      events.push(...kept);
    }
  }

  // Chords on big broadband accents and on the arrival of energetic sections.
  const sectionStarts = new Set<number>();
  for (let s = 1; s < a.segments.length; s++) {
    if (a.segments[s].intensity - a.segments[s - 1].intensity >= 0.12) {
      const idx = nearestEvent(events, a.segments[s].startMs, beatPeriod * 0.6);
      if (idx >= 0) sectionStarts.add(idx);
    }
  }
  if (sp.chordRate > 0) {
    const cands = events
      .map((e, i) => ({ i, e }))
      .filter(({ e }) => e.hold === undefined && e.onset && e.onset.low > 0.55 && e.onset.high > 0.55 && e.sal > 0.6)
      .map(({ i, e }) => ({ i, score: e.sal * (e.onset!.low + e.onset!.high) + (sectionStarts.has(i) ? 3 : 0) + (e.level === 0 ? 0.3 : 0) }));
    for (const i of sectionStarts) if (!cands.some((c) => c.i === i) && events[i].hold === undefined) cands.push({ i, score: 3 });
    cands.sort((x, y) => y.score - x.score);
    const maxChords = Math.round(events.length * sp.chordRate);
    let made = 0;
    const lastT: number[] = [];
    for (const c of cands) {
      if (made >= maxChords) break;
      const t = events[c.i].t;
      if (lastT.some((x) => Math.abs(x - t) < beatPeriod * 1.5)) continue;
      events[c.i].chord = true;
      lastT.push(t);
      made++;
    }
  }

  // Swipes: flick into a new energetic section, the final hit, and (advanced) rare accents.
  if (sp.swipes !== 'none') {
    for (const i of sectionStarts) {
      const e = events[i];
      if (!e.chord && e.hold === undefined) e.swipe = true;
    }
    const lastIdx = events.length - 1;
    if (lastIdx > 4 && a.durationMs - events[lastIdx].t > 800 && !events[lastIdx].chord && events[lastIdx].hold === undefined) {
      events[lastIdx].swipe = true;
    }
    if (sp.swipes === 'accents') {
      const sals = events.map((e) => e.sal).sort((x, y) => y - x);
      const cut = sals[Math.floor(sals.length * 0.03)] ?? Infinity;
      let lastSwipe = -Infinity;
      for (let i = 1; i + 1 < events.length; i++) {
        const e = events[i];
        if (e.sal < cut || e.chord || e.hold !== undefined || e.swipe) continue;
        if (e.t - events[i - 1].t < 420 || events[i + 1].t - e.t < 420 || e.t - lastSwipe < 15000) continue;
        e.swipe = true;
        lastSwipe = e.t;
      }
    }
  }

  // Lanes.
  const laneEvents: LaneEvent[] = events.map((e) => ({
    t: e.t,
    end: e.hold,
    chord: !!e.chord,
    swipe: !!e.swipe,
    sal: e.sal,
    low: e.onset?.low ?? 0.3,
    high: e.onset?.high ?? 0.3,
    bright: e.onset?.bright ?? 0.5,
    flip: e.flip,
    refKey: e.refKey,
    echoKey: e.echoKey,
  }));
  const lanes = assignLanes(laneEvents, {
    laneCount,
    patternStyle: ctx.patternStyle,
    seed: ctx.seed,
    fastMs: Math.max(200, sp.sameLaneGapMs),
    sameLaneGapMs: sp.sameLaneGapMs,
  });

  const notes: Note[] = [];
  let id = 1;
  events.forEach((e, i) => {
    const { lane, partner } = lanes[i];
    const conf = Math.round(clamp(e.sal, 0, 1.5) * 100) / 100;
    if (e.swipe) {
      notes.push({ id: id++, t: Math.round(e.t), lane, type: 'swipe', dir: swipeDir(lane, laneCount), conf });
    } else if (e.hold !== undefined) {
      notes.push({ id: id++, t: Math.round(e.t), lane, type: 'hold', end: Math.round(e.hold), conf });
    } else {
      notes.push({ id: id++, t: Math.round(e.t), lane, type: 'tap', conf });
    }
    if (partner !== undefined && partner >= 0) notes.push({ id: id++, t: Math.round(e.t), lane: partner, type: 'tap', conf });
  });

  const report = validateChart(notes, {
    laneCount,
    durationMs: a.durationMs,
    sameLaneGapMs: Math.min(sp.sameLaneGapMs, 160),
    maxNps: sp.maxNps,
    minHoldMs: Math.min(sp.minHoldMs, 300),
  });
  return {
    notes: report.notes,
    fixes: report.fixes,
    warnings: report.warnings,
    stats: chartStats(report.notes, a.durationMs),
    musicality: musicality(report.notes, a.onsets, laneCount, a.segments),
  };
}

function swipeDir(lane: number, laneCount: number): SwipeDir {
  if (lane === 0) return 'left';
  if (lane === laneCount - 1) return 'right';
  return 'up';
}

function nearestEvent(events: Ev[], t: number, tol: number): number {
  let best = -1;
  let bestD = tol;
  for (let i = 0; i < events.length; i++) {
    const d = Math.abs(events[i].t - t);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
    if (events[i].t > t + tol) break;
  }
  return best;
}

/** Snap a hold end down to the nearest half-beat grid position after `from`. */
function snapDown(t: number, beats: number[], from: number): number {
  if (beats.length < 2) return t;
  const i = lowerBound(beats, t) - 1;
  if (i < 0 || i + 1 >= beats.length) return t;
  const half = (beats[i] + beats[i + 1]) / 2;
  const snapped = t >= half ? half : beats[i];
  return snapped > from ? snapped : t;
}
