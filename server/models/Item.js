import mongoose from 'mongoose';

export const CATEGORIES = [
  'phone', 'wallet', 'keys', 'bag', 'laptop',
  'id_card', 'bottle', 'clothing', 'other'
];

const itemSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['lost', 'found'], required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, enum: CATEGORIES, required: true },
    location: { type: String, required: true, trim: true, maxlength: 200 },
    dateOccurred: { type: Date, required: true },
    timeOccurred: { type: String, trim: true, default: '' }, // "HH:mm", optional
    imageUrl: { type: String, default: '' },
    // Server-side file path so the worker can read the image directly
    imageLocalPath: { type: String, default: '', select: false },

    textEmbedding: { type: [Number], default: [], select: false },
    imageEmbedding: { type: [Number], default: [], select: false },
    embeddingStatus: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending' },
    embeddingRetries: { type: Number, default: 0 },

    status: { type: String, enum: ['open', 'claimed', 'returned', 'expired'], default: 'open' },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    claimedAt: { type: Date, default: null },

    // Found items only: public question + private answer
    secretQuestion: { type: String, trim: true, default: '' },
    secretDetail: { type: String, select: false, default: '' },
    secretEmbedding: { type: [Number], default: [], select: false },

    duplicateOf: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
    reminderSent: { type: Boolean, default: false }
  },
  { timestamps: true }
);

itemSchema.index({ type: 1 });
itemSchema.index({ status: 1 });
itemSchema.index({ category: 1 });
itemSchema.index({ dateOccurred: 1 });

// Fields that must never leave the server in any API response.
export const PUBLIC_SELECT =
  '-secretDetail -secretEmbedding -textEmbedding -imageEmbedding -imageLocalPath';

export default mongoose.model('Item', itemSchema);
