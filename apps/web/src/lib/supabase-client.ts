import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildDeterministicFallbackEmbedding } from "@fm27/ai-analyst";
import { exportFmf } from "@fm27/fm-codec";
import {
  DEFAULT_PATCH_VERSION,
  getTrainingPresets,
  getWonderkidsSeed,
} from "@fm27/fm-data";
import { computeTacticalBalance } from "@fm27/fm-engine";
import type {
  AnalyticsEventPayload,
  DualPhaseTactic,
  ModerationStatus,
  PlaystyleTag,
  TrendingWonderkidItem,
  WeeklySchedule,
} from "@fm27/shared-types";
import { buildPresetTactic } from "../stores/useTacticStore";

export interface CommunityTacticRecord {
  id: string;
  authorName: string;
  title: string;
  description: string;
  gameVersion: string;
  ipFormation: string;
  oopFormation: string;
  playstyleTag: PlaystyleTag;
  mentality: number;
  tactic: DualPhaseTactic;
  balanceScore: number;
  guideQuality: number;
  upvotesCount: number;
  bookmarksCount: number;
  downloadsCount: number;
  moderationStatus: ModerationStatus;
  embedding: number[];
  fmfBase64: string;
  createdAt: string;
}

export interface CommunityScheduleRecord {
  id: string;
  authorName: string;
  title: string;
  focusTags: string[];
  gameVersion: string;
  schedule: WeeklySchedule;
  upvotesCount: number;
  bookmarksCount: number;
  createdAt: string;
}

export interface CommunityShortlistRecord {
  id: string;
  authorName: string;
  title: string;
  description: string;
  wonderkidUids: number[];
  gameVersion: string;
  upvotesCount: number;
  bookmarksCount: number;
  createdAt: string;
}

export interface TimestampedAnalyticsEvent extends AnalyticsEventPayload {
  actorHash: string;
  createdAtMs: number;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

let browserClientSingleton: SupabaseClient | null = null;

export function getBrowserSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  if (!browserClientSingleton) {
    browserClientSingleton = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return browserClientSingleton;
}

export function createServerSupabaseClient(accessToken?: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  });
}

const EVENT_WEIGHTS: Record<AnalyticsEventPayload["eventType"], number> = {
  view: 1,
  bookmark: 4,
  shortlist_add: 6,
  upvote: 5,
  download: 3,
};

/**
 * Exact MASTER_SPEC.md 7-day weighted time-decay formula:
 * `TrendScore = sum_{e in 7d} W(e) / (1 + hours_since(e)/24)^1.5`
 */
export function computeSevenDayTrendScore(
  events: readonly { eventType: AnalyticsEventPayload["eventType"]; createdAtMs: number }[],
  nowMs = Date.now(),
): number {
  const sevenDaysMs = 7 * 24 * 3600 * 1000;
  let score = 0;
  for (const ev of events) {
    const ageMs = nowMs - ev.createdAtMs;
    if (ageMs < 0 || ageMs > sevenDaysMs) continue;
    const hoursSince = ageMs / 3_600_000;
    const weight = EVENT_WEIGHTS[ev.eventType] ?? 1;
    score += weight / Math.pow(1 + hoursSince / 24, 1.5);
  }
  return Math.round(score * 100) / 100;
}

function uint8ToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!);
  }
  return btoa(bin);
}

export function base64ToUint8(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

interface LocalCommunityMemoryState {
  tactics: CommunityTacticRecord[];
  schedules: CommunityScheduleRecord[];
  shortlists: CommunityShortlistRecord[];
  events: TimestampedAnalyticsEvent[];
  rateLimitBucket: Map<string, number>;
}

const globalRef = globalThis as unknown as {
  __fm27CommunityStore?: LocalCommunityMemoryState;
};

function createSeededMemoryStore(): LocalCommunityMemoryState {
  const now = Date.now();
  const seeds: Array<{
    id: string;
    author: string;
    styleId: string;
    shapeId: string;
    tag: PlaystyleTag;
    title: string;
    desc: string;
    upvotes: number;
    bookmarks: number;
    downloads: number;
    hoursAgo: number;
  }> = [
    {
      id: "tac-seed-gegenpress-433",
      author: "KloppLab",
      styleId: "Gegenpress",
      shapeId: "shape-03-433-4141",
      tag: "gegenpress",
      title: "High-Octane 4-3-3 -> 4-1-4-1 Rest-Defense Press",
      desc: "Aggressive counter-press in Zone 14 and half-spaces while dropping wingers into a compact 4-1-4-1 mid-high block out of possession.",
      upvotes: 142,
      bookmarks: 64,
      downloads: 418,
      hoursAgo: 8,
    },
    {
      id: "tac-seed-boxmid-3241",
      author: "PositionalPlay",
      styleId: "ControlPossession",
      shapeId: "shape-01-4231-442",
      tag: "possession",
      title: "Patient Control 4-2-3-1 -> 4-4-2 Dual-Pivot",
      desc: "Short build-up progression overloading central lanes with calm rest-defense stability and compact 4-4-2 OOP pressing traps.",
      upvotes: 118,
      bookmarks: 53,
      downloads: 309,
      hoursAgo: 18,
    },
    {
      id: "tac-seed-underdog-3421",
      author: "MidTableMaster",
      styleId: "FluidCounterAttack",
      shapeId: "shape-09-3421-5221",
      tag: "counter",
      title: "Safe 3-Back Mid-Table Counter (3-4-2-1 -> 5-2-2-1)",
      desc: "Taktik 3 bek aman buat tim papan tengah & underdog: wing-backs drop into a 5-2-2-1 low-mid block and spring vertical transitions.",
      upvotes: 96,
      bookmarks: 47,
      downloads: 275,
      hoursAgo: 26,
    },
    {
      id: "tac-seed-wingplay-424",
      author: "TouchlineChalk",
      styleId: "WingPlay",
      shapeId: "shape-07-424-442",
      tag: "wing_play",
      title: "Direct Touchline Overload 4-2-4 -> 4-4-2",
      desc: "Maximizes natural width, early crosses, and overlapping fullbacks with dual strikers attacking the penalty spot.",
      upvotes: 74,
      bookmarks: 29,
      downloads: 190,
      hoursAgo: 42,
    },
  ];

  const tactics: CommunityTacticRecord[] = seeds.map((s) => {
    const built = buildPresetTactic(s.styleId, s.shapeId, DEFAULT_PATCH_VERSION);
    const tactic: DualPhaseTactic = {
      ...built,
      title: s.title,
      description: s.desc,
      author: s.author,
    };
    const balance = computeTacticalBalance(tactic);
    const fmfBytes = exportFmf(tactic);
    const createdAt = new Date(now - s.hoursAgo * 3_600_000).toISOString();

    return {
      id: s.id,
      authorName: s.author,
      title: s.title,
      description: s.desc,
      gameVersion: DEFAULT_PATCH_VERSION,
      ipFormation: tactic.inFormation,
      oopFormation: tactic.outFormation,
      playstyleTag: s.tag,
      mentality: tactic.mentality,
      tactic,
      balanceScore: balance.overallScore,
      guideQuality: 0.88,
      upvotesCount: s.upvotes,
      bookmarksCount: s.bookmarks,
      downloadsCount: s.downloads,
      moderationStatus: "approved",
      embedding: buildDeterministicFallbackEmbedding(
        `${s.title} ${s.desc} ${tactic.inFormation} ${tactic.outFormation} ${s.tag}`,
      ),
      fmfBase64: uint8ToBase64(fmfBytes),
      createdAt,
    };
  });

  const presets = getTrainingPresets(DEFAULT_PATCH_VERSION).Presets;
  const schedules: CommunityScheduleRecord[] = presets.slice(0, 3).map((p, idx) => ({
    id: `sched-seed-${p.id}`,
    authorName: "HarvestLab",
    title: p.name,
    focusTags: p.focus_tags,
    gameVersion: DEFAULT_PATCH_VERSION,
    schedule: p,
    upvotesCount: 84 - idx * 17,
    bookmarksCount: 39 - idx * 8,
    createdAt: new Date(now - (idx + 1) * 14 * 3_600_000).toISOString(),
  }));

  const wkCatalog = getWonderkidsSeed(DEFAULT_PATCH_VERSION).Wonderkids;
  const shortlists: CommunityShortlistRecord[] = [
    {
      id: "sl-seed-elite-170",
      authorName: "ScoutNetwork",
      title: "Elite 170-200 PA Generational Gems",
      description:
        "Highest-ceiling U-21 wonderkids ready for Champions League rotation across spine positions.",
      wonderkidUids: wkCatalog
        .filter((w) => w.paRange === "170-200")
        .slice(0, 12)
        .map((w) => w.uid),
      gameVersion: DEFAULT_PATCH_VERSION,
      upvotesCount: 131,
      bookmarksCount: 72,
      createdAt: new Date(now - 12 * 3_600_000).toISOString(),
    },
    {
      id: "sl-seed-bargains-under12m",
      authorName: "MoneyballFM",
      title: "South American & Eastern European Bargains (< EUR 12M)",
      description:
        "High ValueRatio U-20 prospects available under EUR 12M for mid-budget clubs.",
      wonderkidUids: wkCatalog
        .filter((w) => w.estimatedPriceEurM <= 12)
        .slice(0, 15)
        .map((w) => w.uid),
      gameVersion: DEFAULT_PATCH_VERSION,
      upvotesCount: 109,
      bookmarksCount: 58,
      createdAt: new Date(now - 28 * 3_600_000).toISOString(),
    },
  ];

  // Seed realistic 7-day wonderkid events so TrendScore time-decay runs live immediately
  const events: TimestampedAnalyticsEvent[] = [];
  wkCatalog.slice(0, 30).forEach((wk, idx) => {
    const count = Math.max(2, 12 - Math.floor(idx / 3));
    for (let k = 0; k < count; k++) {
      events.push({
        entityType: "wonderkid",
        entityId: String(wk.uid),
        eventType: k % 3 === 0 ? "shortlist_add" : k % 2 === 0 ? "bookmark" : "view",
        actorHash: `seed-${idx}-${k}`,
        createdAtMs: now - (idx * 3 + k * 4) * 3_600_000,
      });
    }
  });

  return {
    tactics,
    schedules,
    shortlists,
    events,
    rateLimitBucket: new Map(),
  };
}

export function getCommunityMemoryStore(): LocalCommunityMemoryState {
  if (!globalRef.__fm27CommunityStore) {
    globalRef.__fm27CommunityStore = createSeededMemoryStore();
  }
  return globalRef.__fm27CommunityStore;
}

export function computeLocalTrendingWonderkids(
  patchVersion = DEFAULT_PATCH_VERSION,
  limit = 24,
): TrendingWonderkidItem[] {
  const store = getCommunityMemoryStore();
  const catalog = getWonderkidsSeed(patchVersion).Wonderkids;
  const nowMs = Date.now();
  const sevenDaysMs = 7 * 24 * 3600 * 1000;

  const eventsByUid = new Map<string, TimestampedAnalyticsEvent[]>();
  for (const ev of store.events) {
    if (ev.entityType !== "wonderkid") continue;
    if (nowMs - ev.createdAtMs > sevenDaysMs) continue;
    const list = eventsByUid.get(ev.entityId) ?? [];
    list.push(ev);
    eventsByUid.set(ev.entityId, list);
  }

  const rows = catalog.map((wk) => {
    const evs = eventsByUid.get(String(wk.uid)) ?? [];
    const trendScore = computeSevenDayTrendScore(evs, nowMs);
    const views7d = evs.filter((e) => e.eventType === "view").length;
    const shortlists7d = evs.filter((e) => e.eventType === "shortlist_add").length;
    const rankDelta = (wk.uid % 5) - 2;
    return {
      wonderkid: wk,
      trendScore,
      rank: 1,
      rankDelta,
      views7d,
      shortlists7d,
    };
  });

  rows.sort(
    (a, b) =>
      b.trendScore - a.trendScore ||
      b.shortlists7d - a.shortlists7d ||
      a.wonderkid.uid - b.wonderkid.uid,
  );

  return rows.slice(0, limit).map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));
}

export { uint8ToBase64 };
