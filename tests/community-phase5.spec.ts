import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { exportFmf, parseFmf } from "@fm27/fm-codec";
import { POST as postAnalyticsEvent } from "../apps/web/src/app/api/analytics/event/route.js";
import { POST as postCommunitySubmit } from "../apps/web/src/app/api/community/submit/route.js";
import { GET as getCommunityTrending } from "../apps/web/src/app/api/community/trending/route.js";
import {
  base64ToUint8,
  computeSevenDayTrendScore,
  uint8ToBase64,
} from "../apps/web/src/lib/supabase-client.js";
import { buildPresetTactic } from "../apps/web/src/stores/useTacticStore.js";

describe("Phase 5 — Supabase Migrations, 7-Day Decay Math & End-to-End .fmf Gallery Flow", () => {
  it("verifies 0001-0003 Supabase SQL migrations enforce RLS, approved-only reads, HNSW, and 7d time-decay", () => {
    const migDir = path.resolve(process.cwd(), "supabase/migrations");
    const m1 = fs.readFileSync(path.join(migDir, "0001_initial_schema.sql"), "utf8");
    const m2 = fs.readFileSync(path.join(migDir, "0002_rls_policies.sql"), "utf8");
    const m3 = fs.readFileSync(
      path.join(migDir, "0003_trending_and_vectors.sql"),
      "utf8",
    );

    expect(m1).toContain("embedding vector(768)");
    expect(m1).toContain("trg_sync_user_interaction_counters");
    expect(m2).toContain("moderation_status = 'approved'");
    expect(m2).toContain("can_record_analytics_event");
    expect(m3).toContain("using hnsw (embedding vector_cosine_ops)");
    expect(m3).toContain("power(1.0 + (re.hours_since / 24.0), 1.5)");
    expect(m3).toContain("when 'shortlist_add' then 6.0");
  });

  it("computes exact 7-day weighted time-decay TrendScore", () => {
    const now = 1_800_000_000_000;
    const score = computeSevenDayTrendScore(
      [
        { eventType: "shortlist_add", createdAtMs: now }, // 6 / 1^1.5 = 6
        { eventType: "upvote", createdAtMs: now - 24 * 3_600_000 }, // 5 / 2^1.5 = 1.7677...
        { eventType: "shortlist_add", createdAtMs: now - 8 * 24 * 3_600_000 }, // >7d ignored = 0
      ],
      now,
    );
    expect(score).toBeCloseTo(6 + 5 / Math.pow(2, 1.5), 1);
  });

  it("executes end-to-end .fmf binary upload -> auto-parse & moderation -> semantic search -> detail -> .fmf round-trip", async () => {
    const sourceTactic = buildPresetTactic(
      "WingPlay",
      "shape-07-424-442",
      "27.0",
    );
    const fmfBytes = exportFmf(sourceTactic);

    // 1. Submit real binary .fmf
    const submitRes = await postCommunitySubmit(
      new Request("http://localhost/api/community/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "tactic",
          title: "Phase5 Touchline Wing Play 4-2-4",
          description:
            "Wide touchline overlaps with dual strikers attacking early crosses and compact 4-4-2 out-of-possession block.",
          authorName: "TestArchitect",
          gameVersion: "27.0",
          fmfBase64: uint8ToBase64(fmfBytes),
        }),
      }),
    );
    expect(submitRes.status).toBe(201);
    const submitData = (await submitRes.json()) as {
      ok: boolean;
      item: { id: string; playstyleTag: string; fmfBase64: string; ipFormation: string };
    };
    expect(submitData.ok).toBe(true);
    expect(submitData.item.playstyleTag).toBe("wing_play");

    // 2. Reject spam/unsafe submission with 422
    const spamRes = await postCommunitySubmit(
      new Request("http://localhost/api/community/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "tactic",
          title: "Free Crypto Airdrop Casino",
          description: "Join telegram pump casino spam link right now!",
          fmfBase64: uint8ToBase64(fmfBytes),
        }),
      }),
    );
    expect(spamRes.status).toBe(422);

    // 3. Upvote + verify anti-spam deduplication
    const up1 = await postAnalyticsEvent(
      new Request("http://localhost/api/analytics/event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.42",
        },
        body: JSON.stringify({
          entityType: "tactic",
          entityId: submitData.item.id,
          eventType: "upvote",
        }),
      }),
    );
    expect(up1.status).toBe(201);

    const upDuplicate = await postAnalyticsEvent(
      new Request("http://localhost/api/analytics/event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.42",
        },
        body: JSON.stringify({
          entityType: "tactic",
          entityId: submitData.item.id,
          eventType: "upvote",
        }),
      }),
    );
    const dupJson = (await upDuplicate.json()) as { deduplicated?: boolean };
    expect(dupJson.deduplicated).toBe(true);

    // 4. Semantic natural-language search ("taktik 3 bek aman buat tim papan tengah")
    const searchRes = await getCommunityTrending(
      new Request(
        "http://localhost/api/community/trending?query=" +
          encodeURIComponent("taktik 3 bek aman buat tim papan tengah"),
      ),
    );
    expect(searchRes.status).toBe(200);
    const searchData = (await searchRes.json()) as {
      tactics: Array<{ id: string; title: string }>;
      wonderkids: Array<{ rank: number }>;
    };
    expect(searchData.tactics[0]!.title).toContain("3-Back");
    expect(searchData.wonderkids.length).toBeGreaterThan(0);

    // 5. Fetch detail & decode downloaded .fmf binary back into DualPhaseTactic
    const detailRes = await getCommunityTrending(
      new Request(
        `http://localhost/api/community/trending?id=${encodeURIComponent(submitData.item.id)}`,
      ),
    );
    expect(detailRes.status).toBe(200);
    const detailJson = (await detailRes.json()) as {
      item: { fmfBase64: string; upvotesCount: number };
    };
    expect(detailJson.item.upvotesCount).toBe(2);

    const downloadedFmf = base64ToUint8(detailJson.item.fmfBase64);
    const roundTripped = await parseFmf(downloadedFmf);
    expect(roundTripped.inFormation).toBe(sourceTactic.inFormation);
    expect(roundTripped.outFormation).toBe(sourceTactic.outFormation);
  });
});
