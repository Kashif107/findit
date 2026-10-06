import { parentPort } from 'node:worker_threads';
import {
  pipeline,
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
  env
} from '@huggingface/transformers';

env.allowLocalModels = false;

let textExtractor = null;
let imageProcessor = null;
let visionModel = null;

function l2normalize(vec) {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
  const norm = Math.sqrt(sum) || 1;
  return vec.map((v) => v / norm);
}

async function init() {
  textExtractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  imageProcessor = await AutoProcessor.from_pretrained('Xenova/clip-vit-base-patch32');
  visionModel = await CLIPVisionModelWithProjection.from_pretrained('Xenova/clip-vit-base-patch32');
}

async function embedText(text) {
  const out = await textExtractor(text, { pooling: 'mean', normalize: true });
  return Array.from(out.data); // 384 dims
}

async function embedImage(pathOrUrl) {
  const image = await RawImage.read(pathOrUrl); // local path or URL
  const inputs = await imageProcessor(image);
  const { image_embeds } = await visionModel(inputs);
  return l2normalize(Array.from(image_embeds.data)); // 512 dims
}

parentPort.on('message', async ({ id, type, payload }) => {
  try {
    let result;
    if (type === 'init') result = (await init(), true);
    else if (type === 'text') result = await embedText(payload);
    else if (type === 'image') result = await embedImage(payload);
    else throw new Error(`Unknown message type: ${type}`);
    parentPort.postMessage({ id, ok: true, result });
  } catch (err) {
    parentPort.postMessage({ id, ok: false, error: err.message || String(err) });
  }
});
