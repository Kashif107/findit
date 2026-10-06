import { Router } from 'express';
import { stats, listItems, deleteAnyItem, banUser } from '../controllers/adminController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validateObjectId } from '../middleware/validate.js';

const r = Router();
r.use(requireAuth, requireAdmin);
r.get('/stats', stats);
r.get('/items', listItems);
r.delete('/items/:id', validateObjectId(), deleteAnyItem);
r.patch('/users/:id/ban', validateObjectId(), banUser);
export default r;
