import { describe, expect, it } from "vitest";
import {
  AI_MODELS,
  cosineSimilarity,
  EMBEDDING_DIMENSION,
  generateSemanticEmbedding,
  moderateCommunitySubmission,
  resolveAdvisorModel,
} from "@fm27/ai-analyst";
import { POST as postTacticalReview } from "@/app/api/ai/tactical-review/route";
import { buildPresetTactic } from "@/stores/useTacticStore";

describe("Phase 3 — @fm27/ai-analyst & SSE /api/ai/tactical-review Suite", () => {
  it("resolves exact Gemini API model constants (gemini-4-hydrogen, gemini-4-neon, gemini-3.5-flash-lite)", () => {
    expect(resolveAdvisorModel("standard")).toBe("gemini-4-hydrogen");
    expect(resolveAdvisorModel("deep")).toBe("gemini-4-neon");
    expect(resolveAdvisorModel("micro")).toBe("gemini-3.5-flash-lite");
    expect(AI_MODELS.COMMUNITY_DECISION).toBe("models/gemini-decision-1");
    expect(AI_MODELS.SEMANTIC_EMBEDDING).toBe("gemini-embedding-2");
  });

  it("streams SSE events from POST /api/ai/tactical-review with graceful deterministic fallback when GEMINI_API_KEY is unset", async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const tactic = buildPresetTactic("Gegenpress");
      const req = new Request("http://localhost:3000/api/ai/tactical-review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.5",
        },
        body: JSON.stringify({
          prompt: "Sesuaikan untuk Tim Underdog saat tandang",
          tactic,
          tier: "standard",
        }),
      });

      const res = await postTacticalReview(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");

      const bodyText = await res.text();
      expect(bodyText).toContain("event: delta");
      expect(bodyText).toContain("event: done");
      expect(bodyText).toContain("Audit Deterministik FM27");
      expect(bodyText).toContain("Adaptasi Underdog");
    } finally {
      if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
    }
  });

  it("evaluates community moderation fallback and 768-dim semantic embeddings cleanly offline", async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const tactic = buildPresetTactic("TikiTaka");
      const decision = await moderateCommunitySubmission({
        title: "Barcelona Tiki-Taka 4-3-3",
        description:
          "Detailed positional play guide covering Half-Back rest-defense, Inside Forwards, and short build-up through thirds.",
        tactic,
      });

      expect(decision.isSafeContent).toBe(true);
      expect(decision.playstyleTag).toBe("possession");
      expect(decision.guideQualityScore).toBeGreaterThan(0);

      const spamDecision = await moderateCommunitySubmission({
        title: "Free Crypto Airdrop Casino",
        description: "Click link for telegram pump spam",
      });
      expect(spamDecision.isSafeContent).toBe(false);

      const embA = await generateSemanticEmbedding("taktik 3 bek aman buat tim papan tengah");
      const embB = await generateSemanticEmbedding("taktik 3 bek aman bertahan");
      expect(embA.embedding).toHaveLength(EMBEDDING_DIMENSION);
      expect(cosineSimilarity(embA.embedding, embB.embedding)).toBeGreaterThan(0.3);
    } finally {
      if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
    }
  });
});
