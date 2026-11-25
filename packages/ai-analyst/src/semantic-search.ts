import { AI_MODELS, getGenAiClientV1 } from "./client.js";

export const EMBEDDING_DIMENSION = 768;

/**
 * Deterministic 768-dim L2-normalized token hash projection used only when `GEMINI_API_KEY` is absent.
 */
export function buildDeterministicFallbackEmbedding(text: string): number[] {
  const vec = new Float64Array(EMBEDDING_DIMENSION);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    let h1 = 2166136261;
    let h2 = 16777619;
    for (let i = 0; i < token.length; i++) {
      const code = token.charCodeAt(i);
      h1 ^= code;
      h1 = Math.imul(h1, 16777619);
      h2 ^= code * 31;
      h2 = Math.imul(h2, 1099511627 & 0x7fffffff);
    }
    const idx = Math.abs(h1) % EMBEDDING_DIMENSION;
    const sign = (h2 & 1) === 0 ? 1 : -1;
    vec[idx] = (vec[idx] ?? 0) + sign;
  }

  let normSq = 0;
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    normSq += vec[i]! * vec[i]!;
  }
  const norm = normSq > 0 ? Math.sqrt(normSq) : 1;
  return Array.from(vec, (v) => Math.round((v / norm) * 1e6) / 1e6);
}

/**
 * Generates a 768-dimensional semantic vector using `gemini-embedding-2` for Supabase `pgvector` search.
 */
export async function generateSemanticEmbedding(text: string): Promise<{
  embedding: number[];
  fallback: boolean;
}> {
  const client = getGenAiClientV1();
  if (!client) {
    return {
      embedding: buildDeterministicFallbackEmbedding(text),
      fallback: true,
    };
  }

  try {
    const res = await client.models.embedContent({
      model: AI_MODELS.SEMANTIC_EMBEDDING,
      contents: text,
      config: {
        outputDimensionality: EMBEDDING_DIMENSION,
      },
    });

    const values = res.embeddings?.[0]?.values;
    if (!values || values.length !== EMBEDDING_DIMENSION) {
      return {
        embedding: buildDeterministicFallbackEmbedding(text),
        fallback: true,
      };
    }
    return { embedding: values, fallback: false };
  } catch {
    return {
      embedding: buildDeterministicFallbackEmbedding(text),
      fallback: true,
    };
  }
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
