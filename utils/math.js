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
 * Scale average cosine distance to a 0–100 score using a sigmoid curve.
 * center: avgDist that maps to score 50 (calibrated to known data points).
 * steepness: controls how steeply scores spread around the center.
 * @param {number} avgDist
 * @returns {number}
 */
export function scaleScore(avgDist) {
  const center = 0.63;
  const steepness = 10.5;
  return 1 / (1 + Math.exp(-steepness * (avgDist - center))) * 100;
}
