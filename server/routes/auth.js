import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, me } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, registerSchema, loginSchema } from '../middleware/validate.js';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { message: 'Too many attempts. Try again in a few minutes.' }
});

const r = Router();
r.post('/register', limiter, validate(registerSchema), register);
r.post('/login', limiter, validate(loginSchema), login);
r.get('/me', requireAuth, me);
export default r;
