import Item, { CATEGORIES, PUBLIC_SELECT } from '../models/Item.js';
import Match from '../models/Match.js';
import Claim from '../models/Claim.js';
import User from '../models/User.js';
import cfg from '../config/matching.js';
import { HttpError, asyncHandler } from '../middleware/error.js';
import { saveImage, removeLocal } from '../services/storage.js';
import { processItem } from '../services/processItem.js';
import { notify } from '../services/notify.js';

const STATUSES = ['open', 'claimed', 'returned', 'expired'];
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const same = (a, b) => a && b && String(a) === String(b);

const loadPublic = (id) => Item.findById(id).select(PUBLIC_SELECT).populate('postedBy', 'name');

export const createItem = asyncHandler(async (req, res) => {
  const b = req.body;
  const doc = {
    type: b.type, title: b.title, description: b.description, category: b.category,
    location: b.location, dateOccurred: b.dateOccurred, timeOccurred: b.timeOccurred || '',
    postedBy: req.user._id
  };
  if (b.type === 'found') Object.assign(doc, { secretQuestion: b.secretQuestion, secretDetail: b.secretDetail });
  if (req.file) Object.assign(doc, await saveImage(req.file));

  const created = await Item.create(doc);
  const item = await loadPublic(created._id);

  res.status(201).json({ item });
  // Fire-and-forget: the response is already sent
  processItem(created._id).catch((e) => console.error('[processItem]', e));
});

export const getItems = asyncHandler(async (req, res) => {
  const q = req.query;
  const filter = {};
  if (['lost', 'found'].includes(str(q.type))) filter.type = str(q.type);
  if (CATEGORIES.includes(str(q.category))) filter.category = str(q.category);
  const status = str(q.status);
  if (status !== 'all') filter.status = STATUSES.includes(status) ? status : 'open';

  const from = new Date(str(q.from));
  const to = new Date(str(q.to));
  if (!Number.isNaN(from.getTime()) || !Number.isNaN(to.getTime())) {
    filter.dateOccurred = {};
    if (!Number.isNaN(from.getTime())) filter.dateOccurred.$gte = from;
    if (!Number.isNaN(to.getTime())) filter.dateOccurred.$lte = to;
  }
  const text = str(q.q).slice(0, 100);
  if (text) {
    const rx = new RegExp(escapeRegex(text), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { location: rx }];
  }

  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(q.limit, 10) || 12));
  const [items, total] = await Promise.all([
    Item.find(filter).select(PUBLIC_SELECT).populate('postedBy', 'name')
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Item.countDocuments(filter)
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

export const myItems = asyncHandler(async (req, res) => {
  const items = await Item.find({ postedBy: req.user._id }).select(PUBLIC_SELECT).sort({ createdAt: -1 }).lean();
  const ids = items.map((i) => i._id);
  const matches = await Match.find({ $or: [{ lostItem: { $in: ids } }, { foundItem: { $in: ids } }] })
    .select('lostItem foundItem').lean();
  const counts = {};
  for (const m of matches) {
    for (const id of [String(m.lostItem), String(m.foundItem)]) counts[id] = (counts[id] || 0) + 1;
  }
  res.json({ items: items.map((i) => ({ ...i, matchCount: counts[String(i._id)] || 0 })) });
});

export const getItem = asyncHandler(async (req, res) => {
  const item = await loadPublic(req.params.id);
  if (!item) throw new HttpError(404, 'Item not found');
  const user = req.user;
  const isOwner = same(item.postedBy?._id, user?._id);

  let canClaim = false;
  if (user && !isOwner && item.type === 'found' && item.status === 'open') {
    const myLost = await Item.find({ postedBy: user._id, type: 'lost', status: 'open' }).distinct('_id');
    canClaim = Boolean(await Match.exists({ foundItem: item._id, lostItem: { $in: myLost } }));
  }

  // Contact details are shared only between finder and the verified claimant
  let contact = null;
  if (user && item.claimedBy) {
    const otherId = isOwner ? item.claimedBy : same(item.claimedBy, user._id) ? item.postedBy?._id : null;
    if (otherId) contact = await User.findById(otherId).select('name email phone');
  }
  res.json({ item, canClaim, contact });
});

export const updateItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id).select('+secretDetail');
  if (!item) throw new HttpError(404, 'Item not found');
  if (!same(item.postedBy, req.user._id)) throw new HttpError(403, 'You can only edit your own posts');
  if (item.status !== 'open') throw new HttpError(409, 'Only open posts can be edited');

  const allowed = ['title', 'description', 'category', 'location', 'dateOccurred', 'timeOccurred'];
  if (item.type === 'found') allowed.push('secretQuestion', 'secretDetail');
  let reembed = false;
  for (const key of allowed) {
    if (req.body[key] === undefined || req.body[key] === '' && key !== 'timeOccurred') continue;
    item[key] = req.body[key];
    if (key !== 'timeOccurred') reembed = true;
  }
  if (reembed) {
    // Content changed: old embeddings and matches are stale
    item.embeddingStatus = 'pending';
    item.embeddingRetries = 0;
    item.duplicateOf = [];
    await Match.deleteMany({ $or: [{ lostItem: item._id }, { foundItem: item._id }] });
  }
  await item.save();
  res.json({ item: await loadPublic(item._id) });
  if (reembed) processItem(item._id).catch((e) => console.error('[processItem]', e));
});

export async function deleteItemCascade(item) {
  await Promise.all([
    Match.deleteMany({ $or: [{ lostItem: item._id }, { foundItem: item._id }] }),
    Claim.deleteMany({ item: item._id }),
    removeLocal(item.imageLocalPath),
    item.deleteOne()
  ]);
}

export const deleteItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id).select('+imageLocalPath');
  if (!item) throw new HttpError(404, 'Item not found');
  if (!same(item.postedBy, req.user._id) && req.user.role !== 'admin') {
    throw new HttpError(403, 'You can only delete your own posts');
  }
  await deleteItemCascade(item);
  res.json({ message: 'Post deleted' });
});

export const setStatus = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) throw new HttpError(404, 'Item not found');
  if (!same(item.postedBy, req.user._id)) throw new HttpError(403, 'Only the owner can mark this as returned');
  if (!['open', 'claimed'].includes(item.status)) throw new HttpError(409, `Cannot mark a ${item.status} post as returned`);
  item.status = 'returned';
  await item.save();
  if (item.claimedBy) {
    await notify(item.claimedBy, {
      type: 'claim-update', message: `"${item.title}" was marked as returned. Glad it worked out!`, itemId: item._id
    });
  }
  res.json({ item: await loadPublic(item._id) });
});

export const getMatches = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id).select('type postedBy embeddingStatus duplicateOf');
  if (!item) throw new HttpError(404, 'Item not found');
  if (!same(item.postedBy, req.user._id)) throw new HttpError(403, 'Only the owner can see matches');

  const isLost = item.type === 'lost';
  const otherField = isLost ? 'foundItem' : 'lostItem';
  const rows = await Match.find({ [isLost ? 'lostItem' : 'foundItem']: item._id })
    .sort({ score: -1 }).limit(cfg.topK * 2)
    .populate({ path: otherField, select: PUBLIC_SELECT, populate: { path: 'postedBy', select: 'name' } });

  const matches = rows
    .filter((m) => m[otherField])
    .map((m) => ({ _id: m._id, score: m.score, breakdown: m.breakdown, createdAt: m.createdAt, item: m[otherField] }));
  const duplicates = item.duplicateOf?.length
    ? await Item.find({ _id: { $in: item.duplicateOf } }).select(PUBLIC_SELECT)
    : [];

  res.json({
    processed: item.embeddingStatus === 'done',
    embeddingStatus: item.embeddingStatus,
    matches,
    duplicates
  });
});
