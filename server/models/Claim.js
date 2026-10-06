import mongoose from 'mongoose';

// One row per attempt: drives wrong-attempt rate limiting and doubles as an audit trail.
const claimSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  claimant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answerCorrect: { type: Boolean, required: true },
  attemptedAt: { type: Date, default: Date.now }
});

claimSchema.index({ item: 1, claimant: 1, attemptedAt: -1 });

export default mongoose.model('Claim', claimSchema);
