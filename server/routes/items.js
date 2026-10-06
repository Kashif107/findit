import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createItem, getItems, myItems, getItem, updateItem, deleteItem, setStatus, getMatches
} from '../controllers/itemController.js';
import { claimItem } from '../controllers/claimController.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import {
  validate, validateObjectId, createItemSchema, updateItemSchema, statusSchema, claimSchema
} from '../middleware/validate.js';

const claimLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { message: 'Too many claim requests. Try again later.' }
});

const r = Router();
r.post('/', requireAuth, upload.single('image'), validate(createItemSchema), createItem);
r.get('/', getItems);
r.get('/mine', requireAuth, myItems); // before /:id
r.get('/:id', validateObjectId(), optionalAuth, getItem);
r.patch('/:id', validateObjectId(), requireAuth, validate(updateItemSchema), updateItem);
r.delete('/:id', validateObjectId(), requireAuth, deleteItem);
r.patch('/:id/status', validateObjectId(), requireAuth, validate(statusSchema), setStatus);
r.get('/:id/matches', validateObjectId(), requireAuth, getMatches);
r.post('/:id/claim', validateObjectId(), claimLimiter, requireAuth, validate(claimSchema), claimItem);
export default r;
