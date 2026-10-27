import type { AnalysisStage } from '../analysis/analyze';
import type { ChartBuildOutput, ChartJob } from '../chart/build';
import type { AnalysisResult } from '../types';

export type WorkerStage = AnalysisStage | 'charts' | 'render';

export type WorkerRequest =
  | { type: 'analyze'; id: number; pcm: Float32Array; sampleRate: number; job: ChartJob }
  | { type: 'generate'; id: number; analysis: AnalysisResult; job: ChartJob }
  /** Synthesize the demo track at 22.05 kHz, analyze it and chart it. */
  | { type: 'analyzeDemo'; id: number; job: ChartJob }
  /** Synthesize the demo track for playback. */
  | { type: 'renderDemo'; id: number; sampleRate: number };

export type WorkerResponse =
  | { type: 'progress'; id: number; stage: WorkerStage; fraction: number }
  | { type: 'done'; id: number; analysis?: AnalysisResult; output: ChartBuildOutput }
  | { type: 'audio'; id: number; left: Float32Array; right: Float32Array; sampleRate: number }
  | { type: 'error'; id: number; code: string; message: string };
