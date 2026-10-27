import { chartId } from '../storage/library';
import {
  CHART_STYLES,
  GENERATOR_VERSION,
  type AnalysisResult,
  type AnalysisSummary,
  type Chart,
  type ChartOverrides,
  type ChartStyle,
} from '../types';
import { ChartGenerationError, generateChart } from './generate';

export interface ChartJob {
  songId: string;
  seed: number;
  styles?: ChartStyle[];
  /** Lane count used by the Advanced style (3 or 4). */
  advancedLanes: number;
  overrides?: ChartOverrides;
}

export interface ChartBuildOutput {
  charts: Chart[];
  errors: { style: ChartStyle; message: string }[];
}

/** Generate every requested style as storable auto charts. Pure: runs in a worker or inline. */
export function buildAutoCharts(analysis: AnalysisResult, job: ChartJob): ChartBuildOutput {
  const charts: Chart[] = [];
  const errors: ChartBuildOutput['errors'] = [];
  const now = Date.now();
  const ov = job.overrides ?? {};
  for (const style of job.styles ?? CHART_STYLES) {
    try {
      const laneCount = ov.laneCount ?? (style === 'advanced' ? job.advancedLanes : 3);
      const g = generateChart(analysis, {
        style,
        seed: job.seed,
        laneCount,
        variation: ov.variation ?? 0,
        densityAdjust: ov.densityAdjust ?? 0,
        patternStyle: ov.patternStyle ?? 'flow',
        bpmOverride: ov.bpm,
        firstBeatOverrideMs: ov.firstBeatMs,
      });
      charts.push({
        id: chartId(job.songId, style, 'auto'),
        songId: job.songId,
        style,
        source: 'auto',
        laneCount,
        offsetMs: 0,
        generatorVersion: GENERATOR_VERSION,
        params: g.params,
        notes: g.notes,
        createdAt: now,
        updatedAt: now,
        validation: { ok: g.warnings.length === 0, fixes: g.fixes.length, warnings: g.warnings },
        stats: g.stats,
        approximate: g.approximate,
      });
    } catch (e) {
      errors.push({ style, message: e instanceof ChartGenerationError ? e.message : `Chart generation failed: ${(e as Error).message}` });
    }
  }
  return { charts, errors };
}

export function summarize(a: AnalysisResult): AnalysisSummary {
  return {
    bpm: Math.round(a.tempo.bpm * 10) / 10,
    tempoConfidence: a.tempo.confidence,
    beatConfidence: a.beatConfidence,
    beatsPerBar: a.meter.beatsPerBar,
    subdivision: a.meter.subdivision,
    sections: a.segments.length,
    approximate: a.beatConfidence < 0.6,
    stable: a.tempo.stable,
  };
}

/** Start of the most energetic section, for 15-second previews. */
export function previewStart(a: AnalysisResult): number {
  if (!a.segments.length) return Math.max(0, a.durationMs * 0.3);
  const best = a.segments.reduce((m, s) => (s.intensity > m.intensity + 0.02 ? s : m), a.segments[0]);
  return Math.max(0, Math.min(best.startMs, a.durationMs - 16000));
}
