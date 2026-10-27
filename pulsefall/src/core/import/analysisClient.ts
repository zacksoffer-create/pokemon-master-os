import { AnalysisError, analyzeAudio } from '../analysis/analyze';
import { buildAutoCharts, type ChartBuildOutput, type ChartJob } from '../chart/build';
import type { AnalysisResult } from '../types';
import type { WorkerRequest, WorkerResponse, WorkerStage } from './workerProtocol';

export interface Job<T> {
  promise: Promise<T>;
  cancel(): void;
}

export class JobError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'JobError';
  }
}

let nextId = 1;

function spawnWorker(): Worker | null {
  try {
    return new Worker(new URL('../../workers/analysis.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
}

/**
 * Run an analysis or regeneration job in a dedicated worker (terminated afterwards so its
 * memory is released). If workers are unavailable or the worker crashes, the same code
 * runs on the main thread as a fallback.
 */
function runJob<T>(req: WorkerRequest, onProgress: (stage: WorkerStage, fraction: number) => void, inline: () => T): Job<T> {
  let worker: Worker | null = null;
  let cancelled = false;
  let rejectFn: (e: Error) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    rejectFn = reject;
    const fallback = () => {
      worker?.terminate();
      worker = null;
      if (cancelled) return;
      onProgress('spectrum', 0);
      // Give the UI a moment to paint the "working" state before blocking.
      setTimeout(() => {
        if (cancelled) return;
        try {
          resolve(inline());
        } catch (e) {
          reject(e instanceof AnalysisError ? new JobError(e.code, e.message) : new JobError('internal', (e as Error).message));
        }
      }, 60);
    };
    worker = typeof Worker !== 'undefined' ? spawnWorker() : null;
    if (!worker) {
      fallback();
      return;
    }
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.id !== req.id) return;
      if (msg.type === 'progress') onProgress(msg.stage, msg.fraction);
      else if (msg.type === 'done' || msg.type === 'audio') {
        worker?.terminate();
        worker = null;
        resolve(msg as unknown as T);
      } else if (msg.type === 'error') {
        worker?.terminate();
        worker = null;
        reject(new JobError(msg.code, msg.message));
      }
    };
    worker.onerror = (e) => {
      e.preventDefault?.();
      // A crashed worker (e.g. out of memory) gets one retry on the main thread.
      fallback();
    };
    try {
      // Copied rather than transferred, so the main-thread fallback still has the samples.
      worker.postMessage(req);
    } catch {
      fallback();
    }
  });
  return {
    promise,
    cancel() {
      cancelled = true;
      worker?.terminate();
      worker = null;
      rejectFn(new JobError('cancelled', 'Import cancelled.'));
    },
  };
}

export function analyzeInWorker(
  pcm: Float32Array,
  sampleRate: number,
  job: ChartJob,
  onProgress: (stage: WorkerStage, fraction: number) => void,
): Job<{ analysis: AnalysisResult; output: ChartBuildOutput }> {
  const req: WorkerRequest = { type: 'analyze', id: nextId++, pcm, sampleRate, job };
  const inline = () => {
    const analysis = analyzeAudio(pcm, sampleRate, { onProgress });
    return { analysis, output: buildAutoCharts(analysis, job) };
  };
  return runJob(req, onProgress, inline);
}

export function generateInWorker(
  analysis: AnalysisResult,
  job: ChartJob,
  onProgress: (stage: WorkerStage, fraction: number) => void = () => {},
): Job<{ output: ChartBuildOutput }> {
  const req: WorkerRequest = { type: 'generate', id: nextId++, analysis, job };
  return runJob(req, onProgress, () => ({ output: buildAutoCharts(analysis, job) }));
}

export function analyzeDemoInWorker(
  job: ChartJob,
  onProgress: (stage: WorkerStage, fraction: number) => void,
  inline: () => { analysis: AnalysisResult; output: ChartBuildOutput },
): Job<{ analysis: AnalysisResult; output: ChartBuildOutput }> {
  return runJob({ type: 'analyzeDemo', id: nextId++, job }, onProgress, inline);
}

export function renderDemoInWorker(
  sampleRate: number,
  onProgress: (stage: WorkerStage, fraction: number) => void,
  inline: () => { left: Float32Array; right: Float32Array; sampleRate: number },
): Job<{ left: Float32Array; right: Float32Array; sampleRate: number }> {
  return runJob({ type: 'renderDemo', id: nextId++, sampleRate }, onProgress, inline);
}
