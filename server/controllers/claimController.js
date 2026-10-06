import Item from '../models/Item.js';
import Claim from '../models/Claim.js';
import Match from '../models/Match.js';
import User from '../models/User.js';
import cfg from '../config/matching.js';
import { HttpError, asyncHandler } from '../middleware/error.js';
import { embedText } from '../services/embeddings.js';
import { dot } from '../services/matching.js';
import { normalizeAnswer } from '../services/text.js';
import { notify } from '../services/notify.js';

async function answerIsCorrect(item, answer) {
  const given = normalizeAnswer(answer);
  const truth = normalizeAnswer(item.secretDetail);
  if (given && given === truth) return true;
  // Fallback: semantic similarity, so "a golden retriever" still matches "golden retriever puppy"
  if (given && item.secretEmbedding?.length) {
    try {
      return dot(await embedText(given), item.secretEmbedding) > cfg.claimEmbeddingThreshold;
    } catch (err) {
      console.error('[claim] embedding fallback failed:', err.message);
    }
  }
  return false;
}

export const claimItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id).select('+secretDetail +secretEmbedding');
  if (!item) throw new HttpError(404, 'Item not found');
  if (item.type !== 'found') throw new HttpError(400, 'Only found items can be claimed');
  if (String(item.postedBy) === String(req.user._id)) throw new HttpError(400, 'You cannot claim your own post');
  if (item.status !== 'open') throw new HttpError(409, 'This item has already been claimed');

  // Only owners of a matching lost post may claim (blocks drive-by guessing)
  const myLost = await Item.find({ postedBy: req.user._id, type: 'lost' }).distinct('_id');
  if (!(await Match.exists({ foundItem: item._id, lostItem: { $in: myLost } }))) {
    throw new HttpError(403, 'Only the owner of a matching lost post can claim this item');
  }

  // Cooldown: 3 wrong attempts inside the window locks this user out of this item
  const since = new Date(Date.now() - cfg.claimCooldownMs);
  const wrong = await Claim.find({
    item: item._id, claimant: req.user._id, answerCorrect: false, attemptedAt: { $gte: since }
  }).sort({ attemptedAt: -1 }).limit(cfg.maxWrongAttempts);

  if (wrong.length >= cfg.maxWrongAttempts) {
    const retryAfter = Math.max(1, Math.ceil((wrong[0].attemptedAt.getTime() + cfg.claimCooldownMs - Date.now()) / 1000));
    res.set('Retry-After', String(retryAfter));
    throw new HttpError(429, `Too many wrong attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`, { retryAfterSeconds: retryAfter });
  }

  if (!(await answerIsCorrect(item, req.body.answer))) {
    await Claim.create({ item: item._id, claimant: req.user._id, answerCorrect: false });
    const attemptsLeft = cfg.maxWrongAttempts - wrong.length - 1;
    throw new HttpError(400, attemptsLeft > 0
      ? `That answer is not correct. ${attemptsLeft} attempt(s) left.`
      : 'That answer is not correct. You are locked out of this item for 1 hour.', { attemptsLeft });
  }

  // Atomic: exactly one claimant can flip open -> claimed
  const won = await Item.findOneAndUpdate(
    { _id: item._id, status: 'open' },
    { status: 'claimed', claimedBy: req.user._id, claimedAt: new Date() },
    { new: true }
  );
  if (!won) throw new HttpError(409, 'Someone else claimed this item first');

  await Claim.create({ item: item._id, claimant: req.user._id, answerCorrect: true });
  const finder = await User.findById(item.postedBy).select('name email phone');
  await notify(item.postedBy, {
    type: 'claim-update',
    message: `${req.user.name} correctly answered your question and claimed "${item.title}". Their contact details are on the post.`,
    itemId: item._id
  });
  res.json({
    message: 'Ownership verified',
    contact: { name: finder.name, email: finder.email, phone: finder.phone }
  });
});
