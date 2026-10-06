import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const workerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../workers/embedWorker.js');

let worker = null;
let modelsLoaded = false;
let nextId = 1;
const pending = new Map(); // request id -> { resolve, reject }

// FIFO queue, concurrency 1: one inference at a time keeps RAM predictable.
let queueTail = Promise.resolve();

function send(type, payload) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, payload });
  });
}

function enqueue(type, payload) {
  if (!modelsLoaded) return Promise.reject(new Error('Embedding models are not loaded'));
  const run = () => send(type, payload);
  const result = queueTail.then(run, run);
  queueTail = result.catch(() => {}); // keep the chain alive after failures
  return result;
}

// Called once at startup, before the server starts listening.
export async function loadModels() {
  if (modelsLoaded) return;
  worker = new Worker(workerPath);

  worker.on('message', ({ id, ok, result, error }) => {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    ok ? entry.resolve(result) : entry.reject(new Error(error));
  });
  worker.on('error', (err) => {
    console.error('[embeddings] worker error:', err);
    for (const { reject } of pending.values()) reject(err);
    pending.clear();
    modelsLoaded = false;
  });
  worker.on('exit', (code) => {
    if (code !== 0) console.error(`[embeddings] worker exited with code ${code}`);
    modelsLoaded = false;
  });

  console.log('[embeddings] loading models (first run downloads ~150 MB)...');
  await send('init');
  modelsLoaded = true;
  console.log('[embeddings] models ready');
}

export const modelsReady = () => modelsLoaded;
export const embedText = (text) => enqueue('text', String(text));
export const embedImage = (pathOrUrl) => enqueue('image', pathOrUrl);

export async function shutdownModels() {
  if (worker) await worker.terminate();
  modelsLoaded = false;
}
