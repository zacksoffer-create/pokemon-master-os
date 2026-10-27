// Shared data model for Pulsefall. Everything that crosses a module boundary
// (analysis -> chart generation -> engine -> storage -> UI) is described here.

export type NoteType = 'tap' | 'hold' | 'swipe';
export type SwipeDir = 'up' | 'left' | 'right' | 'down';

export interface Note {
  /** Stable within a chart. New notes get max(id) + 1. */
  id: number;
  /** Absolute song time in milliseconds (before the chart offset is applied). */
  t: number;
  lane: number;
  type: NoteType;
  /** Hold end time in ms (holds only). */
  end?: number;
  /** Swipe direction (swipes only). */
  dir?: SwipeDir;
  /** Notes that share a group are a simultaneous chord. */
  group?: number;
  /** 0..1 musical salience of the event this note came from (auto charts). */
  conf?: number;
}

export type ChartStyle = 'relaxed' | 'classic' | 'full' | 'advanced';
export const CHART_STYLES: ChartStyle[] = ['relaxed', 'classic', 'full', 'advanced'];

export type ChartSource = 'auto' | 'edited' | 'authored';

export interface ChartStats {
  noteCount: number;
  /** Judgeable events: taps + swipes + hold heads + hold tails. */
  judgeCount: number;
  holds: number;
  swipes: number;
  chords: number;
  durationMs: number;
  /** Average notes per second across the playable span. */
  nps: number;
  /** Peak notes per second in any 2 s window. */
  peakNps: number;
  /** 1..10 difficulty estimate. */
  level: number;
}

export interface ChartValidation {
  ok: boolean;
  fixes: number;
  warnings: string[];
}

export interface GenerationParams {
  style: ChartStyle;
  laneCount: number;
  seed: number;
  variation: number;
  densityAdjust: number;
  patternStyle: PatternStyle;
  bpmOverride?: number;
  firstBeatOverrideMs?: number;
  /** 'grid' when a confident beat grid drove note placement, 'free' when notes follow raw onsets. */
  mode?: 'grid' | 'free';
}

export type PatternStyle = 'flow' | 'alternate' | 'melodic';

export interface Chart {
  id: string;
  songId: string;
  style: ChartStyle;
  source: ChartSource;
  laneCount: number;
  /** Added to every note time at play time (ms). Positive = notes later. */
  offsetMs: number;
  generatorVersion: string;
  params?: GenerationParams;
  notes: Note[];
  createdAt: number;
  updatedAt: number;
  validation: ChartValidation;
  stats: ChartStats;
  /** True when the analysis was not confident and the mapping is approximate. */
  approximate?: boolean;
}

export interface Onset {
  /** ms */
  t: number;
  /** 0..~1.5 normalized overall strength */
  s: number;
  /** Per-band normalized strengths. */
  low: number;
  mid: number;
  high: number;
  /** Spectral brightness right after the onset, 0..1 (relative pitch/brightness proxy). */
  bright: number;
  /** How long (ms) the energy that this onset introduced is sustained. */
  sustain: number;
}

export interface TempoInfo {
  bpm: number;
  /** 0..1 */
  confidence: number;
  /** True when the local tempo stays within a few percent of the global tempo. */
  stable: boolean;
  /** Alternative interpretations (half/double time etc.) with relative scores. */
  candidates: { bpm: number; score: number }[];
}

export interface MeterInfo {
  beatsPerBar: number;
  /** Index into beats[] of the first downbeat. */
  firstDownbeat: number;
  confidence: number;
  /** 'ternary' when beats split into threes (swing / triplet feel). */
  subdivision: 'binary' | 'ternary';
}

export interface Segment {
  startMs: number;
  endMs: number;
  /** 0..1 relative intensity (loudness + rhythmic activity). */
  intensity: number;
  /** Segments that sound alike share a label. */
  label: number;
}

export interface AnalysisResult {
  version: string;
  durationMs: number;
  /** Frames per second of the feature curves below. */
  fps: number;
  /** Onset strength curves, normalized so the 95th percentile ~ 1. */
  odf: Float32Array;
  odfLow: Float32Array;
  odfHigh: Float32Array;
  /** Loudness curve 0..1 at `fps`. */
  energy: Float32Array;
  /** Peak amplitude envelope 0..1 at `fps` (for the editor waveform and cover art). */
  peaks: Float32Array;
  onsets: Onset[];
  tempo: TempoInfo;
  /** Beat times in ms (empty when no usable pulse was found). */
  beats: number[];
  /** Confidence 0..1 that beats[] is a usable grid. */
  beatConfidence: number;
  meter: MeterInfo;
  segments: Segment[];
  /** Per-beat timbre/harmony descriptors, row-major beats.length x beatFeatureDims. */
  beatFeatures: Float32Array;
  beatFeatureDims: number;
  firstSoundMs: number;
  lastSoundMs: number;
  /** Overall loudness of the file in dBFS (RMS). */
  loudnessDb: number;
  /** False when no meaningful rhythmic content was found. */
  rhythmic: boolean;
  notes: string[];
}

export interface AnalysisSummary {
  bpm: number;
  tempoConfidence: number;
  beatConfidence: number;
  beatsPerBar: number;
  subdivision: 'binary' | 'ternary';
  sections: number;
  approximate: boolean;
  stable: boolean;
}

export interface ChartOverrides {
  bpm?: number;
  firstBeatMs?: number;
  /** -2..2 */
  densityAdjust?: number;
  laneCount?: number;
  patternStyle?: PatternStyle;
  /** Song-specific timing offset in ms applied to every chart of the song. */
  offsetMs?: number;
  variation?: number;
}

export interface BestRecord {
  score: number;
  accuracy: number;
  maxCombo: number;
  stars: number;
  fullCombo: boolean;
  allPerfect: boolean;
  playedAt: number;
  chartId: string;
}

export interface SongRecord {
  id: string;
  fingerprint: string;
  title: string;
  artist: string;
  album?: string;
  year?: string;
  durationMs: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  importedAt: number;
  hasAudio: boolean;
  hasArtwork: boolean;
  analysisVersion: string;
  analysisStatus: 'ready' | 'failed';
  analysisSummary?: AnalysisSummary;
  overrides?: ChartOverrides;
  favorite: boolean;
  playCount: number;
  lastPlayedAt?: number;
  best: Partial<Record<ChartStyle, BestRecord>>;
  /** Start of the most energetic section, used for previews. */
  previewStartMs: number;
  isDemo?: boolean;
  /** Metadata was corrected by hand; never overwrite from tags again. */
  metadataEdited?: boolean;
}

export interface JudgmentCounts {
  perfect: number;
  great: number;
  good: number;
  miss: number;
}

export interface PlayResult {
  id?: number;
  songId: string;
  chartId: string;
  style: ChartStyle;
  chartSource: ChartSource;
  playedAt: number;
  score: number;
  accuracy: number;
  maxCombo: number;
  counts: JudgmentCounts;
  totalJudgments: number;
  fullCombo: boolean;
  allPerfect: boolean;
  stars: number;
  /** Mean signed timing error of hits in ms (negative = early). */
  meanErrorMs: number;
  timingProfile: TimingProfileId;
  offsets: { audio: number; input: number; visual: number };
  appVersion: string;
  autoplay: boolean;
  completed: boolean;
}

export type TimingProfileId = 'comfortable' | 'standard' | 'strict';

export type ThemeId = 'neon' | 'sunset' | 'aurora' | 'contrast';
export type NoteStyleId = 'orbs' | 'shapes';

export interface Settings {
  /** 1..10, higher = faster notes / shorter approach time. */
  noteSpeed: number;
  timingProfile: TimingProfileId;
  perspective: boolean;
  advancedLanes: 3 | 4;
  swipeAssist: boolean;
  showTimingIndicator: boolean;
  musicVolume: number;
  sfxVolume: number;
  uiVolume: number;
  hitSound: 'tick' | 'snap' | 'off';
  audioOffsetMs: number;
  inputOffsetMs: number;
  visualOffsetMs: number;
  theme: ThemeId;
  noteStyle: NoteStyleId;
  reducedEffects: boolean;
  musicReactive: boolean;
  /** 0.7..1 share of the screen width used by the highway in portrait. */
  highwayWidth: number;
  lastStyle: ChartStyle;
  showFps: boolean;
  calibrated: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  noteSpeed: 5,
  timingProfile: 'comfortable',
  perspective: true,
  advancedLanes: 3,
  swipeAssist: true,
  showTimingIndicator: false,
  musicVolume: 0.9,
  sfxVolume: 0.45,
  uiVolume: 0.5,
  hitSound: 'tick',
  audioOffsetMs: 0,
  inputOffsetMs: 0,
  visualOffsetMs: 0,
  theme: 'neon',
  noteStyle: 'orbs',
  reducedEffects: false,
  musicReactive: true,
  highwayWidth: 1,
  lastStyle: 'classic',
  showFps: false,
  calibrated: false,
};

export const APP_VERSION = '1.0.0';
export const ANALYSIS_VERSION = 'a1';
export const GENERATOR_VERSION = 'g1';
