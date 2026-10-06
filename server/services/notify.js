import Notification from '../models/Notification.js';

let io = null;
export const initNotify = (server) => { io = server; };

// Stores the notification and pushes it to the user's socket room. Never throws:
// notifications are best-effort and must not break the calling flow.
export async function notify(userId, { type, message, itemId = null, data = {} }) {
  try {
    const n = await Notification.create({ user: userId, type, message, itemId });
    const event = type === 'new-match' || type === 'claim-update' ? type : 'notification';
    io?.to(`user:${userId}`).emit(event, { notification: n.toObject(), itemId, ...data });
    return n;
  } catch (err) {
    console.error('[notify] failed:', err.message);
    return null;
  }
}
