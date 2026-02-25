/**
 * Compute the cosine similarity between two embedding vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Compute the cosine distance between two embedding vectors.
 * Clamps similarity to [-1, 1] before computing distance.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function cosineDistance(a, b) {
  const similarity = cosineSimilarity(a, b);
  const clamped = Math.max(-1, Math.min(1, similarity));
  return 1 - clamped;
}

/**
 * Compute the average cosine distance over all C(n,2) unique pairs.
 * @param {number[][]} embeddings  — array of n embedding vectors
 * @returns {number}
 */
export function averageDistance(embeddings) {
  let total = 0;
  let count = 0;
  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      total += cosineDistance(embeddings[i], embeddings[j]);
      count++;
    }
  }
  return count === 0 ? 0 : total / count;
}

/**
 * Scale average cosine distance to a 0–100 score.
 * Formula: ((avgDist - 0.4) / 0.7) * 100, clamped to [0, 100].
 * Floor at d=0.4, ceiling at d=1.1.
 * @param {number} avgDist
 * @returns {number}
 */
export function scaleScore(avgDist) {
  const raw = ((avgDist - 0.4) / 0.7) * 100;
  return Math.max(0, Math.min(100, raw));
}
