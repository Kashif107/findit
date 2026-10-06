import cron from 'node-cron';
import cfg from '../config/matching.js';
import Item from '../models/Item.js';
import { modelsReady } from './embeddings.js';
import { notify } from './notify.js';
import { processItem } from './processItem.js';

const HOUR = 3600000;
const DAY = 24 * HOUR;
const opts = { timezone: 'UTC' }; // all schedules run in UTC

export function startCron() {
  // Daily 02:00 - expire (never delete) stale open posts
  cron.schedule('0 2 * * *', async () => {
    const r = await Item.updateMany(
      { status: 'open', createdAt: { $lt: new Date(Date.now() - cfg.expireAfterDays * DAY) } },
      { status: 'expired' }
    );
    console.log(`[cron] expired ${r.modifiedCount} post(s)`);
  }, opts);

  // Hourly - claims not completed within 72h go back to open
  cron.schedule('0 * * * *', async () => {
    const r = await Item.updateMany(
      { status: 'claimed', claimedAt: { $lt: new Date(Date.now() - cfg.claimReleaseHours * HOUR) } },
      { status: 'open', claimedBy: null, claimedAt: null }
    );
    if (r.modifiedCount) console.log(`[cron] released ${r.modifiedCount} stale claim(s)`);
  }, opts);

  // Daily 09:00 - day-7 reminder for lost posts still open
  cron.schedule('0 9 * * *', async () => {
    const due = await Item.find({
      type: 'lost',
      status: 'open',
      reminderSent: false,
      createdAt: { $lte: new Date(Date.now() - cfg.reminderAfterDays * DAY) }
    }).select('title postedBy');
    for (const item of due) {
      await notify(item.postedBy, {
        type: 'reminder',
        message: `Is your item still missing? "${item.title}" is still listed.`,
        itemId: item._id
      });
      await Item.updateOne({ _id: item._id }, { reminderSent: true });
    }
  }, opts);

  // Every 10 minutes - retry failed (or stuck pending) embeddings, max 3 times
  cron.schedule('*/10 * * * *', async () => {
    if (!modelsReady()) return;
    const items = await Item.find({
      embeddingRetries: { $lt: cfg.maxEmbeddingRetries },
      $or: [
        { embeddingStatus: 'failed' },
        { embeddingStatus: 'pending', updatedAt: { $lt: new Date(Date.now() - 15 * 60000) } }
      ]
    }).select('_id');
    for (const { _id } of items) {
      await Item.updateOne({ _id }, { $inc: { embeddingRetries: 1 }, embeddingStatus: 'pending' });
      await processItem(_id);
    }
    if (items.length) console.log(`[cron] retried ${items.length} item(s)`);
  }, opts);

  console.log('[cron] jobs scheduled (UTC)');
}
