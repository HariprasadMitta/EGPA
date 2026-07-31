export function chunkText(text: string, maxChars = 500): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChars) {
      chunks.push(paragraph);
      continue;
    }
    let rest = paragraph;
    while (rest.length > maxChars) {
      let cut = rest.lastIndexOf(". ", maxChars);
      if (cut < maxChars * 0.5) cut = maxChars;
      chunks.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) chunks.push(rest);
  }
  return chunks;
}

// HF's feature-extraction endpoint returns a flat vector for models that
// pool internally, or a nested per-token matrix for ones that don't - mean
// pool defensively so either shape yields a single embedding vector.
export function toEmbeddingVector(raw: unknown): number[] {
  if (Array.isArray(raw) && typeof raw[0] === "number") {
    return raw as number[];
  }
  if (Array.isArray(raw) && Array.isArray(raw[0])) {
    const rows = raw as number[][];
    if (Array.isArray(rows[0][0])) {
      // Batched output for a single input: unwrap the outer batch dimension.
      return toEmbeddingVector(rows[0]);
    }
    const dim = rows[0].length;
    const pooled = new Array(dim).fill(0);
    for (const row of rows) {
      for (let i = 0; i < dim; i++) pooled[i] += row[i];
    }
    return pooled.map((v) => v / rows.length);
  }
  return [];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
