import type { ChartStyle } from '../types';

/**
 * Each chart style is a different *strategy* for interpreting the same analysis,
 * not just a different density: which metrical levels it may use, how strongly it
 * prefers the beat, and which note types it introduces.
 */
export interface StyleParams {
  id: ChartStyle;
  label: string;
  tagline: string;
  /** Target notes per second at segment intensity 0 and 1. */
  npsLow: number;
  npsHigh: number;
  /** Minimum time between consecutive note events (a chord counts once). */
  minGapMs: number;
  /** Minimum time between two notes in the same lane. */
  sameLaneGapMs: number;
  /** Deepest metrical level used: 0 bar, 1 beat, 2 half-beat, 3 quarter-beat. */
  maxLevel: number;
  /** Preference multipliers per metrical level. */
  levelWeights: [number, number, number, number];
  /** Minimum salience for a note away from the beat (no notes where nothing happens). */
  offbeatFloor: number;
  /** Minimum salience for a note on a beat. */
  beatFloor: number;
  chordRate: number;
  holdRate: number;
  minHoldMs: number;
  /** Notes may overlap a hold in other lanes. */
  holdOverlap: boolean;
  swipes: 'none' | 'transitions' | 'accents';
  /** Hard cap on notes in any one-second window. */
  maxNps: number;
  /** Notes per bar allowed beyond the shared bar pattern for one-off accents and fills. */
  extraAccents: number;
}

export const STYLES: Record<ChartStyle, StyleParams> = {
  relaxed: {
    id: 'relaxed',
    label: 'Relaxed',
    tagline: 'The groove, without the rush.',
    npsLow: 0.55,
    npsHigh: 1.5,
    minGapMs: 300,
    sameLaneGapMs: 420,
    maxLevel: 2,
    levelWeights: [1.6, 1.25, 0.55, 0.2],
    offbeatFloor: 0.75,
    beatFloor: 0.12,
    chordRate: 0,
    holdRate: 0.14,
    minHoldMs: 650,
    holdOverlap: false,
    swipes: 'none',
    maxNps: 3,
    extraAccents: 0,
  },
  classic: {
    id: 'classic',
    label: 'Classic Groove',
    tagline: 'The main pulse and the moments that pop.',
    npsLow: 1.0,
    npsHigh: 2.7,
    minGapMs: 165,
    sameLaneGapMs: 250,
    maxLevel: 2,
    levelWeights: [1.45, 1.2, 0.85, 0.35],
    offbeatFloor: 0.42,
    beatFloor: 0.1,
    chordRate: 0.045,
    holdRate: 0.1,
    minHoldMs: 480,
    holdOverlap: false,
    swipes: 'transitions',
    maxNps: 5,
    extraAccents: 1,
  },
  full: {
    id: 'full',
    label: 'Full Rhythm',
    tagline: 'Syncopation, pickups and the details.',
    npsLow: 1.5,
    npsHigh: 4.0,
    minGapMs: 112,
    sameLaneGapMs: 170,
    maxLevel: 3,
    levelWeights: [1.3, 1.15, 0.95, 0.65],
    offbeatFloor: 0.3,
    beatFloor: 0.08,
    chordRate: 0.065,
    holdRate: 0.09,
    minHoldMs: 400,
    holdOverlap: true,
    swipes: 'transitions',
    maxNps: 7,
    extraAccents: 2,
  },
  advanced: {
    id: 'advanced',
    label: 'Advanced',
    tagline: 'Everything the track gives you.',
    npsLow: 2.1,
    npsHigh: 5.6,
    minGapMs: 88,
    sameLaneGapMs: 140,
    maxLevel: 3,
    levelWeights: [1.2, 1.1, 1.0, 0.85],
    offbeatFloor: 0.22,
    beatFloor: 0.06,
    chordRate: 0.1,
    holdRate: 0.08,
    minHoldMs: 330,
    holdOverlap: true,
    swipes: 'accents',
    maxNps: 9.5,
    extraAccents: 2,
  },
};

export function styleParams(style: ChartStyle, densityAdjust = 0): StyleParams {
  const base = STYLES[style];
  const k = Math.pow(1.22, Math.max(-2, Math.min(2, densityAdjust)));
  return {
    ...base,
    npsLow: base.npsLow * k,
    npsHigh: base.npsHigh * k,
    minGapMs: base.minGapMs / Math.sqrt(k),
    maxNps: base.maxNps * Math.sqrt(k),
  };
}
