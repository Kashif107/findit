import cfg from '../config/matching.js';
import Item from '../models/Item.js';
import Match from '../models/Match.js';

const DAY = 86400000;

// Vectors are L2-normalized, so cosine similarity is the dot product.
export function dot(a, b) {
  if (!a?.length || a.length !== b?.length) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function timeScore(lostDate, foundDate, category, c = cfg) {
  const days = (new Date(foundDate) - new Date(lostDate)) / DAY;
  // Found before lost is impossible, but allow a day of tolerance for sloppy dates.
  if (days < -c.foundBeforeLostToleranceDays) return 0;
  const decay = c.decayByCategory?.[category] ?? c.defaultDecayDays;
  return Math.exp(-Math.max(days, 0) / decay);
}

export function scorePair(lost, found, c = cfg) {
  const text = dot(lost.textEmbedding, found.textEmbedding);
  const hasImage = lost.imageEmbedding?.length > 0 && found.imageEmbedding?.length > 0;
  const image = hasImage ? dot(lost.imageEmbedding, found.imageEmbedding) : null;
  const category = lost.category === found.category ? 1 : 0;
  const time = timeScore(lost.dateOccurred, found.dateOccurred, lost.category, c);

  const score = hasImage
    ? c.weightsWithImage.text * text + c.weightsWithImage.image * image +
      c.weightsWithImage.category * category + c.weightsWithImage.time * time
    : c.weightsTextOnly.text * text + c.weightsTextOnly.category * category +
      c.weightsTextOnly.time * time;

  return { score, breakdown: { text, image, category, time } };
}

// Pure ranking over in-memory candidates (also used by the evaluation script).
export function rankCandidates(item, candidates, c = cfg, opts = {}) {
  const threshold = opts.threshold ?? c.threshold;
  const topK = opts.topK ?? c.topK;
  const out = [];
  for (const cand of candidates) {
    if (cand.type === item.type) continue;
    const [lost, found] = item.type === 'lost' ? [item, cand] : [cand, item];
    if (Math.abs(new Date(lost.dateOccurred) - new Date(found.dateOccurred)) > c.candidateWindowDays * DAY) continue;
    const { score, breakdown } = scorePair(lost, found, c);
    if (score >= threshold) out.push({ candidate: cand, lostItem: lost, foundItem: found, score, breakdown });
  }
  out.sort(
    (a, b) =>
      b.score - a.score ||
      new Date(b.candidate.createdAt || 0) - new Date(a.candidate.createdAt || 0)
  );
  return out.slice(0, topK);
}

// DB candidate filter: opposite type, open, other poster, within the date window.
export async function findMatches(item) {
  const w = cfg.candidateWindowDays * DAY;
  const t = new Date(item.dateOccurred).getTime();
  const candidates = await Item.find({
    _id: { $ne: item._id },
    type: item.type === 'lost' ? 'found' : 'lost',
    status: 'open',
    postedBy: { $ne: item.postedBy },
    embeddingStatus: 'done',
    dateOccurred: { $gte: new Date(t - w), $lte: new Date(t + w) }
  })
    .select('+textEmbedding +imageEmbedding')
    .lean();
  return rankCandidates(item, candidates);
}

export async function saveMatches(ranked) {
  if (!ranked.length) return;
  await Match.bulkWrite(
    ranked.map((r) => ({
      updateOne: {
        filter: { lostItem: r.lostItem._id, foundItem: r.foundItem._id },
        update: { $set: { score: r.score, breakdown: r.breakdown }, $setOnInsert: { createdAt: new Date() } },
        upsert: true
      }
    }))
  );
}
