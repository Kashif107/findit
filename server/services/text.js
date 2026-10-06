// The exact string that gets embedded for an item.
export const embeddingText = (i) => `${i.title}. ${i.category}. ${i.description}. ${i.location}`;

// lowercase, trim, strip punctuation, collapse whitespace
export const normalizeAnswer = (s = '') =>
  String(s).toLowerCase().trim().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ');
