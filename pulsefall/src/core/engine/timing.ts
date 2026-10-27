import type { TimingProfileId } from '../types';

export type Judgment = 'perfect' | 'great' | 'good' | 'miss';

export interface TimingProfile {
  id: TimingProfileId;
  label: string;
  description: string;
  /** Half-widths of each judgment window in ms (|error| <= value). */
  perfect: number;
  great: number;
  good: number;
}

export const TIMING_PROFILES: Record<TimingProfileId, TimingProfile> = {
  comfortable: {
    id: 'comfortable',
    label: 'Comfortable',
    description: 'Generous windows. The default — play along and enjoy it.',
    perfect: 60,
    great: 115,
    good: 175,
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    description: 'Tighter windows for when you know the song.',
    perfect: 45,
    great: 90,
    good: 140,
  },
  strict: {
    id: 'strict',
    label: 'Strict',
    description: 'Arcade-tight. Calibrate your sync first.',
    perfect: 32,
    great: 70,
    good: 110,
  },
};

export function judge(errorMs: number, profile: TimingProfile): Judgment {
  const e = Math.abs(errorMs);
  if (e <= profile.perfect) return 'perfect';
  if (e <= profile.great) return 'great';
  if (e <= profile.good) return 'good';
  return 'miss';
}

export const JUDGMENT_POINTS: Record<Judgment, number> = {
  perfect: 100,
  great: 75,
  good: 40,
  miss: 0,
};

/** Contribution of each judgment to accuracy. */
export const JUDGMENT_WEIGHT: Record<Judgment, number> = {
  perfect: 1,
  great: 0.8,
  good: 0.5,
  miss: 0,
};

export const MAX_MULTIPLIER = 4;
export const COMBO_PER_MULTIPLIER = 10;

export function multiplierFor(combo: number): number {
  return Math.min(MAX_MULTIPLIER, 1 + Math.floor(combo / COMBO_PER_MULTIPLIER));
}

/** Stars are a celebration, not a gate: everyone who finishes gets at least one. */
export function starsFor(accuracy: number): number {
  if (accuracy >= 0.97) return 5;
  if (accuracy >= 0.9) return 4;
  if (accuracy >= 0.8) return 3;
  if (accuracy >= 0.65) return 2;
  return 1;
}

export function starLabel(stars: number, fullCombo: boolean, allPerfect: boolean): string {
  if (allPerfect) return 'Flawless!';
  if (fullCombo) return 'Full Combo!';
  return ['Cleared', 'Cleared', 'Nice', 'Great', 'Excellent', 'Superb'][stars] ?? 'Cleared';
}
