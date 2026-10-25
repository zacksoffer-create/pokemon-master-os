// The browser bundle's entry: the same src/ the Node runner uses, as one global (SixVSix). In a Web Worker it also
// answers {job} messages with the finished Simulation Result, reporting progress as it goes.
import * as S from '../src/index.js';

const api = { ...S, BUILD: typeof __SIXVSIX_BUILD__ !== 'undefined' ? __SIXVSIX_BUILD__ : 'dev' };
globalThis.SixVSix = api;

const isWorker = typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope;
if (isWorker) {
  const cache = new Map();
  globalThis.onmessage = (e) => {
    // the Lab's runner protocol (runner.js): play the trials it hands over, send the rows back
    if (e.data && e.data.indices) {
      try { globalThis.postMessage({ id: e.data.id, rows: S.handleChunk(cache, e.data) }); }
      catch (err) { globalThis.postMessage({ id: e.data.id, error: String(err?.stack || err) }); }
      return;
    }
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
