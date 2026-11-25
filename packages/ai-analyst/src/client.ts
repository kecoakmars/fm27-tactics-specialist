import { GoogleGenAI } from "@google/genai";

/**
 * Centralized Gemini model registry (single file touched on future model upgrades per MASTER_SPEC §11).
 */
export const AI_MODELS = {
  TACTICAL_DEFAULT: "gemini-4-hydrogen",
  DEEP_MATCH_AUDIT: "gemini-4-neon",
  MICRO_TOOLTIP: "gemini-3.5-flash-lite",
  COMMUNITY_DECISION: "models/gemini-decision-1",
  SEMANTIC_EMBEDDING: "gemini-embedding-2",
} as const;

export type TacticalAdvisorModelTier = "standard" | "deep" | "micro";

export function resolveAdvisorModel(tier: TacticalAdvisorModelTier = "standard"): string {
  if (tier === "deep") return AI_MODELS.DEEP_MATCH_AUDIT;
  if (tier === "micro") return AI_MODELS.MICRO_TOOLTIP;
  return AI_MODELS.TACTICAL_DEFAULT;
}

let cachedV1Client: GoogleGenAI | null = null;
let cachedV1BetaClient: GoogleGenAI | null = null;

export function hasGeminiApiKey(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key.length > 0);
}

export function getGenAiClientV1(): GoogleGenAI | null {
  if (!hasGeminiApiKey()) return null;
  if (!cachedV1Client) {
    cachedV1Client = new GoogleGenAI({ apiVersion: "v1" });
  }
  return cachedV1Client;
}

export function getGenAiClientV1Beta(): GoogleGenAI | null {
  if (!hasGeminiApiKey()) return null;
  if (!cachedV1BetaClient) {
    cachedV1BetaClient = new GoogleGenAI({ apiVersion: "v1beta" });
  }
  return cachedV1BetaClient;
}

// Lightweight in-memory sliding window rate-limit guard (per client key/IP)
const requestBuckets = new Map<string, number[]>();

export function checkAiRateLimit(
  bucketKey: string,
  maxRequests = 20,
  windowMs = 60_000,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const prev = requestBuckets.get(bucketKey) ?? [];
  const recent = prev.filter((ts) => now - ts < windowMs);

  if (recent.length >= maxRequests) {
    const oldest = recent[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    requestBuckets.set(bucketKey, recent);
    return { allowed: false, retryAfterSeconds };
  }

  recent.push(now);
  requestBuckets.set(bucketKey, recent);
  return { allowed: true, retryAfterSeconds: 0 };
}
