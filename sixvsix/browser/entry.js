// The browser bundle's entry: the same src/ the Node runner uses, as one global (SixVSix). In a Web Worker it also
// answers {job} messages with the finished Simulation Result, reporting progress as it goes.
import * as S from '../src/index.js';

const api = { ...S, BUILD: typeof __SIXVSIX_BUILD__ !== 'undefined' ? __SIXVSIX_BUILD__ : 'dev' };
globalThis.SixVSix = api;

const isWorker = typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope;
if (isWorker) {
  globalThis.onmessage = (e) => {
    const { job, platform, legality, every = 5 } = e.data || {};
    try {
      const result = S.runJobSync(job, {
        platform, legality,
        onProgress: (done, total) => { if (done % every === 0 || done === total) globalThis.postMessage({ progress: [done, total] }); },
      });
      globalThis.postMessage({ result });
    } catch (err) {
      globalThis.postMessage({ error: String(err?.stack || err) });
    }
  };
}
