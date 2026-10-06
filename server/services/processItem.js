import cfg from '../config/matching.js';
import { cloudinaryEnabled } from '../config/cloudinary.js';
import Item from '../models/Item.js';
import { embedText, embedImage } from './embeddings.js';
import { dot, findMatches, saveMatches } from './matching.js';
import { notify } from './notify.js';
import { removeLocal } from './storage.js';
import { embeddingText, normalizeAnswer } from './text.js';

const inFlight = new Set(); // avoid double-processing the same item (e.g. cron retry vs initial run)

// Background pipeline: embed -> duplicate check -> match -> notify. Called without await.
export async function processItem(itemId) {
  const key = String(itemId);
  if (inFlight.has(key)) return;
  inFlight.add(key);
  try {
    const item = await Item.findById(itemId).select(
      '+secretDetail +secretEmbedding +imageLocalPath +textEmbedding +imageEmbedding'
    );
    if (!item) return;

    item.textEmbedding = await embedText(embeddingText(item));
    const imageSrc = item.imageLocalPath || item.imageUrl;
    item.imageEmbedding = imageSrc ? await embedImage(imageSrc) : [];
    if (item.type === 'found' && item.secretDetail) {
      item.secretEmbedding = await embedText(normalizeAnswer(item.secretDetail));
    }
    // With Cloudinary the local file was only a temp copy for embedding
    if (cloudinaryEnabled && item.imageLocalPath) {
      await removeLocal(item.imageLocalPath);
      item.imageLocalPath = '';
    }
    item.embeddingStatus = 'done';
    await item.save();

    await checkDuplicates(item);

    const ranked = await findMatches(item.toObject());
    await saveMatches(ranked);
    await notifyMatches(item, ranked);
    console.log(`[process] ${item.type} "${item.title}" -> ${ranked.length} match(es)`);
  } catch (err) {
    console.error(`[process] failed for ${key}:`, err.message);
    await Item.updateOne({ _id: itemId }, { embeddingStatus: 'failed' }).catch(() => {});
  } finally {
    inFlight.delete(key);
  }
}

// Same-type near-duplicates: warn, never block.
async function checkDuplicates(item) {
  const others = await Item.find({
    _id: { $ne: item._id },
    type: item.type,
    status: 'open',
    embeddingStatus: 'done'
  })
    .select('+textEmbedding')
    .lean();
  const dupes = others.filter((o) => dot(item.textEmbedding, o.textEmbedding) > cfg.duplicateThreshold);
  if (!dupes.length) return;
  await Item.updateOne({ _id: item._id }, { duplicateOf: dupes.map((d) => d._id) });
  await notify(item.postedBy, {
    type: 'system',
    message: `"${item.title}" looks very similar to an existing ${item.type} post. You may have posted a duplicate.`,
    itemId: item._id
  });
}

async function notifyMatches(item, ranked) {
  if (!ranked.length) return;
  const n = ranked.length;
  if (item.type === 'found') {
    // Tell each potential owner, and the finder
    for (const r of ranked) {
      await notify(r.candidate.postedBy, {
        type: 'new-match',
        message: `A found item may match your lost "${r.candidate.title}" (${Math.round(r.score * 100)}% match).`,
        itemId: r.candidate._id
      });
    }
    await notify(item.postedBy, {
      type: 'new-match',
      message: `${n} possible owner${n > 1 ? 's' : ''} found for "${item.title}".`,
      itemId: item._id
    });
  } else {
    await notify(item.postedBy, {
      type: 'new-match',
      message: `We found ${n} possible match${n > 1 ? 'es' : ''} for your lost "${item.title}".`,
      itemId: item._id
    });
  }
}
