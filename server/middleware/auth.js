import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { HttpError, asyncHandler } from './error.js';

export const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });

export async function userFromToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET_KEY);
  return User.findById(payload.id);
}

const bearer = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
};

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = bearer(req);
  if (!token) throw new HttpError(401, 'Authentication required');
  let user;
  try {
    user = await userFromToken(token);
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
  if (!user) throw new HttpError(401, 'Account no longer exists');
  if (user.isBanned) throw new HttpError(403, 'This account has been banned');
  req.user = user;
  next();
});

// Sets req.user when a valid token is present, never rejects.
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = bearer(req);
  if (token) {
    try {
      const user = await userFromToken(token);
      if (user && !user.isBanned) req.user = user;
    } catch { /* anonymous */ }
  }
  next();
});

export const requireAdmin = (req, _res, next) =>
  req.user?.role === 'admin' ? next() : next(new HttpError(403, 'Admin access required'));
