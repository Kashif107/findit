import { Router } from 'express';
import { list, markRead } from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';

const r = Router();
r.get('/', requireAuth, list);
r.patch('/read', requireAuth, markRead);
export default r;
