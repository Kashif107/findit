import mongoose from 'mongoose';
import { z } from 'zod';
import { CATEGORIES } from '../models/Item.js';

export const validate = (schema) => (req, _res, next) => {
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return next(parsed.error);
  req.body = parsed.data;
  next();
};

export const validateObjectId = (param = 'id') => (req, res, next) =>
  mongoose.isValidObjectId(req.params[param]) ? next() : res.status(400).json({ message: 'Invalid id' });

const dateField = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date')
  .transform((v) => new Date(v))
  .refine((d) => d.getTime() <= Date.now() + 86400000, 'Date cannot be in the future');

const itemShape = {
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(5).max(2000),
  category: z.enum(CATEGORIES),
  location: z.string().trim().min(2).max(200),
  dateOccurred: dateField,
  timeOccurred: z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm'), z.literal('')]).optional(),
  secretQuestion: z.string().trim().max(200).optional(),
  secretDetail: z.string().trim().max(200).optional()
};

export const createItemSchema = z
  .object({ type: z.enum(['lost', 'found']), ...itemShape })
  .superRefine((v, ctx) => {
    if (v.type === 'found') {
      if (!v.secretQuestion) ctx.addIssue({ code: 'custom', path: ['secretQuestion'], message: 'Required for found items' });
      if (!v.secretDetail) ctx.addIssue({ code: 'custom', path: ['secretDetail'], message: 'Required for found items' });
    }
  });

export const updateItemSchema = z.object(itemShape).partial();
export const statusSchema = z.object({ status: z.literal('returned') });
export const claimSchema = z.object({ answer: z.string().trim().min(1, 'Answer is required').max(200) });

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  phone: z.string().trim().max(30).optional()
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72)
});
