import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { AnalyticsEventPayloadSchema } from "@fm27/shared-types";
import {
  createServerSupabaseClient,
  getCommunityMemoryStore,
} from "../../../../lib/supabase-client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = AnalyticsEventPayloadSchema.parse(body);

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "local-client";
    const ua = req.headers.get("user-agent") || "browser";
    const actorHash = createHash("sha256")
      .update(`${ip}:${ua}`)
      .digest("hex")
      .slice(0, 32);

    const store = getCommunityMemoryStore();
    const dedupeKey = `${actorHash}:${parsed.entityType}:${parsed.entityId}:${parsed.eventType}`;
    const nowMs = Date.now();
    const lastTs = store.rateLimitBucket.get(dedupeKey);

    if (lastTs && nowMs - lastTs < 15_000) {
      return NextResponse.json(
        { ok: true, deduplicated: true },
        { status: 200 },
      );
    }

    if (store.rateLimitBucket.size > 2000) {
      store.rateLimitBucket.clear();
    }
    store.rateLimitBucket.set(dedupeKey, nowMs);
    store.events.push({
      ...parsed,
      actorHash,
      createdAtMs: nowMs,
    });
    if (store.events.length > 5000) {
      store.events.splice(0, store.events.length - 4000);
    }

    // Update gallery item counters atomically in memory store
    if (parsed.entityType === "tactic") {
      const target = store.tactics.find((t) => t.id === parsed.entityId);
      if (target) {
        if (parsed.eventType === "upvote") target.upvotesCount += 1;
        if (parsed.eventType === "bookmark") target.bookmarksCount += 1;
        if (parsed.eventType === "download") target.downloadsCount += 1;
      }
    } else if (parsed.entityType === "schedule") {
      const target = store.schedules.find((s) => s.id === parsed.entityId);
      if (target) {
        if (parsed.eventType === "upvote") target.upvotesCount += 1;
        if (parsed.eventType === "bookmark") target.bookmarksCount += 1;
      }
    } else if (parsed.entityType === "shortlist") {
      const target = store.shortlists.find((s) => s.id === parsed.entityId);
      if (target) {
        if (parsed.eventType === "upvote") target.upvotesCount += 1;
        if (parsed.eventType === "bookmark") target.bookmarksCount += 1;
      }
    }

    const supabase = createServerSupabaseClient();
    if (supabase) {
      await supabase.from("analytics_events").insert({
        entity_type: parsed.entityType,
        entity_id: parsed.entityId,
        event_type: parsed.eventType,
        actor_hash: actorHash,
      });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid analytics payload" },
      { status: 400 },
    );
  }
}
