// One Node worker thread: plays the trials it's handed (runner.js handleChunk) and sends the rows back.
import { parentPort } from 'node:worker_threads';
import { handleChunk } from './runner.js';

const cache = new Map();
parentPort.on('message', (msg) => {
  try {
    parentPort.postMessage({ id: msg.id, rows: handleChunk(cache, msg) });
  } catch (err) {
    parentPort.postMessage({ id: msg.id, error: String(err?.stack || err) });
  }
});
