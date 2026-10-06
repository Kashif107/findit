import Item, { PUBLIC_SELECT } from '../models/Item.js';
import Match from '../models/Match.js';
import User from '../models/User.js';
import { HttpError, asyncHandler } from '../middleware/error.js';
import { deleteItemCascade } from './itemController.js';

export const stats = asyncHandler(async (_req, res) => {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 29);

  const [totalPosts, returnedCount, perDay, lostIds, foundIds] = await Promise.all([
    Item.countDocuments(),
    Item.countDocuments({ status: 'returned' }),
    Item.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, count: { $sum: 1 } } }
    ]),
    Match.distinct('lostItem'),
    Match.distinct('foundItem')
  ]);

  // Match success rate = of posts that received at least one suggestion, the share that ended claimed/returned
  const matchedIds = [...new Set([...lostIds, ...foundIds].map(String))];
  const resolvedMatched = matchedIds.length
    ? await Item.countDocuments({ _id: { $in: matchedIds }, status: { $in: ['claimed', 'returned'] } })
    : 0;

  const byDay = Object.fromEntries(perDay.map((d) => [d._id, d.count]));
  const postsPerDay = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    return { date, count: byDay[date] || 0 };
  });

  res.json({
    totalPosts,
    returnedCount,
    matchedPosts: matchedIds.length,
    matchSuccessRate: matchedIds.length ? resolvedMatched / matchedIds.length : 0,
    postsPerDay
  });
});

export const listItems = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = 20;
  const [items, total] = await Promise.all([
    Item.find().select(PUBLIC_SELECT).populate('postedBy', 'name email isBanned role')
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Item.countDocuments()
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

export const deleteAnyItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id).select('+imageLocalPath');
  if (!item) throw new HttpError(404, 'Item not found');
  await deleteItemCascade(item);
  res.json({ message: 'Post deleted' });
});

export const banUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');
  if (user.role === 'admin') throw new HttpError(403, 'Admins cannot be banned');
  user.isBanned = req.body?.banned === false ? false : true;
  await user.save();
  res.json({ message: user.isBanned ? 'User banned' : 'User unbanned', isBanned: user.isBanned });
});
