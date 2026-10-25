// The Node worker pool: one worker thread per spare core. Node only (the browser has its own pool in the Lab page).
import os from 'node:os';
import { Worker } from 'node:worker_threads';
import { poolRunner, syncRunner } from './runner.js';

const WORKER = new URL('./runner-node-worker.js', import.meta.url);

/** A runner for this machine: `workers` threads (default: cores − 1), or this thread when that's 1. */
export function nodeRunner({ workers, chunk } = {}) {
  const size = workers ?? Math.max(1, (os.availableParallelism?.() ?? os.cpus().length) - 1);
  if (size <= 1) return syncRunner({ yieldEvery: 0 });
  return poolRunner({
    size, chunk, kind: 'worker threads',
    spawn() {
      const w = new Worker(WORKER);
      return {
        post: (msg) => w.postMessage(msg),
        onMessage: (fn) => w.on('message', fn),
        onError: (fn) => w.on('error', fn),
        terminate: () => w.terminate(),
      };
    },
  });
}
