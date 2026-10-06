import Notification from '../models/Notification.js';
import { asyncHandler } from '../middleware/error.js';

export const list = asyncHandler(async (req, res) => {
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50),
    Notification.countDocuments({ user: req.user._id, read: false })
  ]);
  res.json({ notifications, unreadCount });
});

export const markRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ message: 'Marked as read' });
});
