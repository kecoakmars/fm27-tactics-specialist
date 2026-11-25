import { NextResponse } from "next/server";
import {
  cosineSimilarity,
  generateSemanticEmbedding,
} from "@fm27/ai-analyst";
import { DEFAULT_PATCH_VERSION } from "@fm27/fm-data";
import {
  CommunityFilterParamsSchema,
  PlaystyleTagSchema,
} from "@fm27/shared-types";
import {
  computeLocalTrendingWonderkids,
  computeSevenDayTrendScore,
  createServerSupabaseClient,
  getCommunityMemoryStore,
} from "../../../../lib/supabase-client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const singleId = searchParams.get("id");
  const store = getCommunityMemoryStore();

  if (singleId) {
    const tactic = store.tactics.find(
      (t) => t.id === singleId && t.moderationStatus === "approved",
    );
    if (tactic) {
      return NextResponse.json({ kind: "tactic", item: tactic });
    }
    const schedule = store.schedules.find((s) => s.id === singleId);
    if (schedule) {
      return NextResponse.json({ kind: "schedule", item: schedule });
    }
    const shortlist = store.shortlists.find((s) => s.id === singleId);
    if (shortlist) {
      return NextResponse.json({ kind: "shortlist", item: shortlist });
    }
    return NextResponse.json({ error: "Community item not found" }, { status: 404 });
  }

  const patch = searchParams.get("patch") || searchParams.get("gameVersion") || DEFAULT_PATCH_VERSION;
  const rawPlaystyle = searchParams.get("playstyleTag") || undefined;
  const parsedPlaystyle = rawPlaystyle
    ? PlaystyleTagSchema.safeParse(rawPlaystyle)
    : undefined;

  const filters = CommunityFilterParamsSchema.parse({
    category:
      (searchParams.get("category") as "tactics" | "schedules" | "shortlists") ||
      "tactics",
    gameVersion: searchParams.get("gameVersion") || undefined,
    ipFormation: searchParams.get("ipFormation") || undefined,
    oopFormation: searchParams.get("oopFormation") || undefined,
    playstyleTag: parsedPlaystyle?.success ? parsedPlaystyle.data : undefined,
    sortBy:
      (searchParams.get("sortBy") as "trending" | "top_upvoted" | "newest") ||
      "trending",
    query: searchParams.get("query") || undefined,
    limit: Number(searchParams.get("limit") || 20),
    offset: Number(searchParams.get("offset") || 0),
  });

  // 1. Trending Wonderkids (Supabase materialized view when configured, else live 7d decay)
  let wonderkids = computeLocalTrendingWonderkids(patch, 24);
  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      const { data } = await supabase
        .from("weekly_trending_wonderkids")
        .select("uid, trend_score, views_7d, shortlists_7d, rank")
        .eq("game_version", patch)
        .order("rank", { ascending: true })
        .limit(24);
      if (data && data.length > 0) {
        const byUid = new Map(wonderkids.map((w) => [w.wonderkid.uid, w.wonderkid]));
        const mapped = data
          .map((row) => {
            const wk = byUid.get(Number(row.uid));
            if (!wk) return null;
            return {
              wonderkid: wk,
              trendScore: Number(row.trend_score),
              rank: Number(row.rank),
              rankDelta: 0,
              views7d: Number(row.views_7d),
              shortlists7d: Number(row.shortlists_7d),
            };
          })
          .filter((x): x is NonNullable<typeof x> => Boolean(x));
        if (mapped.length > 0) wonderkids = mapped;
      }
    } catch {
      // keep local 7d decay fallback
    }
  }

  // 2. Filter & Semantic Search Tactics
  let tactics = store.tactics.filter((t) => t.moderationStatus === "approved");
  if (filters.gameVersion) {
    tactics = tactics.filter((t) => t.gameVersion === filters.gameVersion);
  }
  if (filters.ipFormation) {
    tactics = tactics.filter((t) => t.ipFormation === filters.ipFormation);
  }
  if (filters.oopFormation) {
    tactics = tactics.filter((t) => t.oopFormation === filters.oopFormation);
  }
  if (filters.playstyleTag) {
    tactics = tactics.filter((t) => t.playstyleTag === filters.playstyleTag);
  }

  if (filters.query && filters.query.trim().length > 0) {
    const qLower = filters.query.trim().toLowerCase();
    const { embedding: qVec } = await generateSemanticEmbedding(filters.query);

    const scored = tactics.map((item) => {
      const sim = cosineSimilarity(qVec, item.embedding);
      const hay =
        `${item.title} ${item.description} ${item.ipFormation} ${item.oopFormation} ${item.playstyleTag}`.toLowerCase();
      const lexicalBoost = qLower
        .split(/\s+/)
        .filter((tok) => tok.length >= 2 && hay.includes(tok)).length * 0.12;
      return { item, score: sim + lexicalBoost };
    });

    scored.sort((a, b) => b.score - a.score);
    tactics = scored.filter((s) => s.score > 0.02 || scored.indexOf(s) < 3).map((s) => s.item);
  } else if (filters.sortBy === "top_upvoted") {
    tactics = [...tactics].sort((a, b) => b.upvotesCount - a.upvotesCount);
  } else if (filters.sortBy === "newest") {
    tactics = [...tactics].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  } else {
    const nowMs = Date.now();
    tactics = [...tactics].sort((a, b) => {
      const evA = store.events.filter(
        (e) => e.entityType === "tactic" && e.entityId === a.id,
      );
      const evB = store.events.filter(
        (e) => e.entityType === "tactic" && e.entityId === b.id,
      );
      const scoreA =
        a.upvotesCount * 1.5 + computeSevenDayTrendScore(evA, nowMs);
      const scoreB =
        b.upvotesCount * 1.5 + computeSevenDayTrendScore(evB, nowMs);
      return scoreB - scoreA;
    });
  }

  let schedules = [...store.schedules];
  let shortlists = [...store.shortlists];
  if (filters.gameVersion) {
    schedules = schedules.filter((s) => s.gameVersion === filters.gameVersion);
    shortlists = shortlists.filter((s) => s.gameVersion === filters.gameVersion);
  }

  return NextResponse.json({
    wonderkids,
    tactics: tactics.slice(filters.offset, filters.offset + filters.limit),
    schedules: schedules.slice(filters.offset, filters.offset + filters.limit),
    shortlists: shortlists.slice(filters.offset, filters.offset + filters.limit),
  });
}
