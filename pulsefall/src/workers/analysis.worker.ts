/// <reference lib="webworker" />
import { AnalysisError, analyzeAudio, type AnalyzeOptions } from '../core/analysis/analyze';
import { buildAutoCharts } from '../core/chart/build';
import { renderDemoSong } from '../core/demo/demoSong';
import type { WorkerRequest, WorkerResponse } from '../core/import/workerProtocol';

// Heavy work (music analysis, chart generation, demo synthesis) runs here so the
// interface stays responsive.
const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(msg: WorkerResponse, transfer: Transferable[] = []): void {
  ctx.postMessage(msg, transfer);
}

function progress(id: number): AnalyzeOptions['onProgress'] {
  let last = 0;
  return (stage, fraction) => {
    const now = performance.now();
    if (fraction === 0 || fraction === 1 || now - last > 120) {
      last = now;
      post({ type: 'progress', id, stage, fraction });
    }
  };
}

ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    switch (req.type) {
      case 'analyze': {
        const analysis = analyzeAudio(req.pcm, req.sampleRate, { onProgress: progress(req.id) });
        post({ type: 'progress', id: req.id, stage: 'charts', fraction: 0 });
        post({ type: 'done', id: req.id, analysis, output: buildAutoCharts(analysis, req.job) });
        break;
      }
      case 'generate':
        post({ type: 'progress', id: req.id, stage: 'charts', fraction: 0 });
        post({ type: 'done', id: req.id, output: buildAutoCharts(req.analysis, req.job) });
        break;
      case 'analyzeDemo': {
        post({ type: 'progress', id: req.id, stage: 'render', fraction: 0 });
        const r = renderDemoSong(22050);
        const mono = new Float32Array(r.left.length);
        for (let i = 0; i < mono.length; i++) mono[i] = 0.5 * (r.left[i] + r.right[i]);
        const analysis = analyzeAudio(mono, 22050, { onProgress: progress(req.id) });
        post({ type: 'progress', id: req.id, stage: 'charts', fraction: 0 });
        post({ type: 'done', id: req.id, analysis, output: buildAutoCharts(analysis, req.job) });
        break;
      }
      case 'renderDemo': {
        const r = renderDemoSong(req.sampleRate, (f) => post({ type: 'progress', id: req.id, stage: 'render', fraction: f }));
        post({ type: 'audio', id: req.id, left: r.left, right: r.right, sampleRate: r.sampleRate }, [r.left.buffer, r.right.buffer]);
        break;
      }
    }
  } catch (err) {
    const code = err instanceof AnalysisError ? err.code : 'internal';
    post({ type: 'error', id: req.id, code, message: (err as Error).message || String(err) });
  }
};
