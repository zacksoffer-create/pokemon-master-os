// Trials, wherever they run. A battle depends only on its job and its index (runTrial), so the same trials can run in
// this thread or spread over workers (Node worker threads, browser Web Workers) and every result is the same: how
// the work is split never changes an outcome, only how long it takes.
//
// A runner takes tasks, [{job, legality?, indices?}], and returns, task by task, {prepared, rows} with the rows in
// trial order. Jobs are checked once here (prepareJob, legality included); workers get the checked job and its
// legality reports and play the trials they're handed.

import { prepareJob, runTrial } from './batch.js';
import { now, shortHash, stableStringify } from './util.js';

const keyOf = (job) => `${job.id}|${shortHash(stableStringify(job))}`;

/** What a worker does with one chunk: prepare the job once (cached by its key), then play the trials it was given. */
export function handleChunk(cache, { key, job, legality, indices }) {
  let prepared = cache.get(key);
  if (!prepared) {
    prepared = prepareJob(job, { legality });
    cache.set(key, prepared);
    if (cache.size > 64) cache.delete(cache.keys().next().value);
  }
  return indices.map((i) => runTrial(prepared, i));
}

function prepareTasks(tasks) {
  return tasks.map((t) => {
    const prepared = prepareJob(t.job, { legality: t.legality });
    const indices = t.indices || Array.from({ length: t.job.trials.n }, (_, i) => i);
    return { prepared, indices, key: keyOf(t.job) };
  });
}

/** Runs everything in this thread. Yields between chunks so a page stays responsive. */
export function syncRunner({ yieldEvery = 4 } = {}) {
  const cache = new Map();
  return {
    kind: 'this thread', size: 1,
    async run(tasks, { onProgress, shouldStop } = {}) {
      const ready = prepareTasks(tasks);
      const total = ready.reduce((t, r) => t + r.indices.length, 0);
      let done = 0;
      const out = [];
      for (const r of ready) {
        cache.set(r.key, r.prepared);
        const rows = [];
        for (let k = 0; k < r.indices.length; k++) {
          if (shouldStop?.()) break;
          rows.push(runTrial(r.prepared, r.indices[k]));
          done++;
          if (onProgress) onProgress(done, total);
          if (yieldEvery && done % yieldEvery === 0) await new Promise((res) => setTimeout(res, 0));
        }
        out.push({ prepared: r.prepared, rows });
      }
      return out;
    },
    /** The same, without promises (for code that can't wait). */
    runNow(tasks) {
      return prepareTasks(tasks).map((r) => ({ prepared: r.prepared, rows: r.indices.map((i) => runTrial(r.prepared, i)) }));
    },
    close() {},
  };
}

/**
 * A pool of workers. `spawn()` makes one worker: {post(msg), onMessage(fn), onError(fn), terminate()}. The worker
 * answers each {id, key, job, legality, indices} with {id, rows} (or {id, error}), using handleChunk.
 */
export function poolRunner({ size, spawn, chunk = 4, kind = 'workers' }) {
  const workers = Array.from({ length: Math.max(1, size) }, () => spawn());
  let seq = 0, current = null;
  // one listener per worker for the pool's life; each run installs itself as `current`
  for (const w of workers) {
    w.onMessage((msg) => current?.message(w, msg));
    w.onError?.((err) => current?.error(err));
  }
  return {
    kind, size: workers.length,
    run(tasks, { onProgress, shouldStop } = {}) {
      if (current) return Promise.reject(new Error('this runner is already running a batch; wait for it or make another'));
      const ready = prepareTasks(tasks);
      const results = ready.map((r) => ({ prepared: r.prepared, rows: new Array(r.indices.length) }));
      const queue = [];
      ready.forEach((r, t) => {
        for (let k = 0; k < r.indices.length; k += chunk) queue.push({ t, from: k, indices: r.indices.slice(k, k + chunk) });
      });
      const total = ready.reduce((s, r) => s + r.indices.length, 0);
      let done = 0, active = 0;
      return new Promise((resolve, reject) => {
        const pending = new Map();
        const finish = (fn, v) => { current = null; fn(v); };
        const next = (w) => {
          if (shouldStop?.()) queue.length = 0;
          const job = queue.shift();
          if (!job) {
            if (active === 0) finish(resolve, results.map((r) => ({ ...r, rows: r.rows.filter(Boolean) })));
            return;
          }
          const id = ++seq;
          pending.set(id, job);
          active++;
          const r = ready[job.t];
          w.post({ id, key: r.key, job: r.prepared.job, legality: r.prepared.legality, indices: job.indices });
        };
        current = {
          message(w, msg) {
            const job = pending.get(msg.id);
            if (!job) return;
            pending.delete(msg.id);
            active--;
            if (msg.error) { queue.length = 0; finish(reject, new Error(msg.error)); return; }
            msg.rows.forEach((row, k) => { results[job.t].rows[job.from + k] = row; });
            done += msg.rows.length;
            if (onProgress) onProgress(done, total);
            next(w);
          },
          error(err) { queue.length = 0; finish(reject, err instanceof Error ? err : new Error(String(err))); },
        };
        if (!queue.length) { finish(resolve, results); return; }
        for (const w of workers) next(w);
      });
    },
    close() { for (const w of workers) w.terminate(); },
  };
}

/** Wall-clock timing for a set of rows, in the Simulation Result's shape. */
export function timingFor(rows, t0, platform = 'unknown', runner) {
  const ms = rows.map((b) => b.ms).sort((x, y) => x - y);
  return {
    total_ms: Math.round(now() - t0),
    per_battle_ms: { mean: Math.round((10 * ms.reduce((s, x) => s + x, 0)) / (ms.length || 1)) / 10,
                     median: ms[ms.length >> 1] ?? 0, max: ms[ms.length - 1] ?? 0 },
    platform: runner && runner.size > 1 ? `${platform} · ${runner.size} ${runner.kind}` : platform,
  };
}
