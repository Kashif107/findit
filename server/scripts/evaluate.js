// Usage: npm run evaluate   (from repo root or server/)
// Embeds the labelled test set, reports top-1/top-3 accuracy, then grid-searches weights/decay/threshold.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cfg from '../config/matching.js';
import { loadModels, embedText, embedImage, shutdownModels } from '../services/embeddings.js';
import { rankCandidates } from '../services/matching.js';
import { embeddingText } from '../services/text.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(dir, 'testPairs.json'), 'utf8'));
const BASE = Date.UTC(2025, 0, 31);
const DAY = 86400000;
const r2 = (n) => Math.round(n * 100) / 100;

function build(x, type, id, category, pairId) {
  const d = new Date(BASE + x.dayOffset * DAY);
  return { id, pairId, type, category, title: x.title, description: x.description, location: x.location,
    image: x.image, dateOccurred: d, createdAt: d };
}

const lost = [], found = [];
for (const p of data.pairs) {
  lost.push(build(p.lost, 'lost', `L${p.id}`, p.category, p.id));
  found.push(build(p.found, 'found', `F${p.id}`, p.category, p.id));
}
for (const [i, x] of data.distractors.entries()) {
  (x.type === 'lost' ? lost : found).push(build(x, x.type, `D${i + 1}`, x.category, null));
}

function score(c) {
  let t1 = 0, t3 = 0, n = 0;
  const preds = [];
  for (const l of lost) {
    const ranked = rankCandidates(l, found, c, { threshold: -Infinity, topK: Infinity });
    const top = ranked[0];
    const correct = l.pairId != null && top?.candidate.id === `F${l.pairId}`;
    preds.push({ isPair: l.pairId != null, score: top ? top.score : -1, correct });
    if (l.pairId != null) {
      n++;
      t1 += correct;
      t3 += ranked.slice(0, 3).some((r) => r.candidate.id === `F${l.pairId}`);
    }
  }
  return { top1: t1 / n, top3: t3 / n, preds };
}

// Predict top-1 only when its score clears the threshold; wrong or distractor predictions are false positives.
function prf(preds, thr) {
  let tp = 0, fp = 0, fn = 0;
  for (const p of preds) {
    const predicted = p.score >= thr;
    if (predicted && p.isPair && p.correct) tp++;
    else if (predicted) fp++;
    if (p.isPair && !(predicted && p.correct)) fn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return { precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0 };
}

const objective = (s) => (2 * s.top1 + s.top3) / 3;

async function main() {
  await loadModels();
  console.log(`Embedding ${lost.length + found.length} items...`);
  let withImages = 0;
  for (const it of [...lost, ...found]) {
    it.textEmbedding = await embedText(embeddingText(it));
    it.imageEmbedding = [];
    const file = it.image && path.join(dir, it.image);
    if (file && fs.existsSync(file)) { it.imageEmbedding = await embedImage(file); withImages++; }
  }
  await shutdownModels();

  const base = score(cfg);
  const bp = prf(base.preds, cfg.threshold);
  console.log(`\n=== Current config (threshold ${cfg.threshold}) ===`);
  console.log(`pairs: ${data.pairs.length}, distractors: ${data.distractors.length}, items with images: ${withImages}`);
  console.log(`top-1: ${(base.top1 * 100).toFixed(1)}%   top-3: ${(base.top3 * 100).toFixed(1)}%`);
  console.log(`at threshold: precision ${(bp.precision * 100).toFixed(1)}%  recall ${(bp.recall * 100).toFixed(1)}%  F1 ${bp.f1.toFixed(3)}`);

  // Grid search 1: text-only weights + decay
  let best = { c: cfg, s: base, obj: objective(base) };
  for (let text = 0.4; text <= 0.851; text += 0.05) {
    for (let category = 0; category <= 0.301; category += 0.05) {
      const time = r2(1 - text - category);
      if (time < 0 || time > 0.4) continue;
      for (const decay of [3, 7, 14]) {
        const c = { ...cfg, weightsTextOnly: { text: r2(text), category: r2(category), time }, defaultDecayDays: decay, decayByCategory: {} };
        const s = score(c);
        if (objective(s) > best.obj + 1e-9) best = { c, s, obj: objective(s) };
      }
    }
  }

  // Grid search 2 (only when test items have images): with-image weights
  if (withImages > 0) {
    for (const text of [0.25, 0.35, 0.45]) for (const image of [0.25, 0.35, 0.45]) for (const category of [0.1, 0.15]) {
      const time = r2(1 - text - image - category);
      if (time < 0.05) continue;
      const c = { ...best.c, weightsWithImage: { text, image, category, time } };
      const s = score(c);
      if (objective(s) > best.obj + 1e-9) best = { c, s, obj: objective(s) };
    }
  }

  // Grid search 3: threshold maximizing F1 for the best weights
  let bestThr = { thr: cfg.threshold, f1: -1 };
  for (let thr = 0.3; thr <= 0.801; thr += 0.01) {
    const m = prf(best.s.preds, thr);
    if (m.f1 > bestThr.f1) bestThr = { thr: r2(thr), ...m };
  }

  console.log('\n=== Best configuration found ===');
  console.log(`top-1: ${(best.s.top1 * 100).toFixed(1)}%   top-3: ${(best.s.top3 * 100).toFixed(1)}%`);
  console.log(`threshold ${bestThr.thr}: precision ${(bestThr.precision * 100).toFixed(1)}%  recall ${(bestThr.recall * 100).toFixed(1)}%  F1 ${bestThr.f1.toFixed(3)}`);
  console.log('\nPaste into server/config/matching.js:');
  console.log(JSON.stringify({
    weightsTextOnly: best.c.weightsTextOnly,
    ...(withImages > 0 ? { weightsWithImage: best.c.weightsWithImage } : {}),
    defaultDecayDays: best.c.defaultDecayDays,
    decayByCategory: best.c.decayByCategory,
    threshold: bestThr.thr
  }, null, 2));
  if (withImages === 0) console.log('\nNote: no test images were found, so image weights were not tuned. Add "image" paths in testPairs.json to tune them.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
