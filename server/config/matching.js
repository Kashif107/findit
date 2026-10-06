// Single source of truth for every tunable in the matching and claim logic.
export default {
  // Candidate filtering
  candidateWindowDays: 30, // max gap between the two dateOccurred values
  foundBeforeLostToleranceDays: 1, // found may precede lost by at most this much

  // Weights when BOTH posts have images
  weightsWithImage: { text: 0.35, image: 0.35, category: 0.15, time: 0.15 },
  // Weights otherwise (image signal unavailable)
  weightsTextOnly: { text: 0.65, category: 0.2, time: 0.15 },

  threshold: 0.55,
  topK: 5,

  // Time decay in days. Smaller = items are expected to be found sooner.
  defaultDecayDays: 7,
  decayByCategory: { phone: 5, bottle: 14 },

  // Duplicate warning (same-type posts)
  duplicateThreshold: 0.9,

  // Claim verification
  claimEmbeddingThreshold: 0.8,
  maxWrongAttempts: 3,
  claimCooldownMs: 60 * 60 * 1000, // 1 hour
  claimReleaseHours: 72,

  // Lifecycle
  expireAfterDays: 60,
  reminderAfterDays: 7,

  // Embedding retries
  maxEmbeddingRetries: 3
};
