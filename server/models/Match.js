import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
  lostItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  foundItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  score: { type: Number, required: true },
  breakdown: {
    text: { type: Number, default: 0 },
    image: { type: Number, default: null },
    category: { type: Number, default: 0 },
    time: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now }
});

matchSchema.index({ lostItem: 1, foundItem: 1 }, { unique: true });
matchSchema.index({ lostItem: 1, score: -1 });
matchSchema.index({ foundItem: 1, score: -1 });

export default mongoose.model('Match', matchSchema);
