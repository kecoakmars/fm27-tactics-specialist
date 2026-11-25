import { NextResponse } from "next/server";
import {
  generateSemanticEmbedding,
  moderateCommunitySubmission,
} from "@fm27/ai-analyst";
import { exportFmf, parseFmf } from "@fm27/fm-codec";
import { DEFAULT_PATCH_VERSION } from "@fm27/fm-data";
import { computeTacticalBalance } from "@fm27/fm-engine";
import {
  CommunityScheduleSubmissionSchema,
  DualPhaseTacticSchema,
  type DualPhaseTactic,
} from "@fm27/shared-types";
import { z } from "zod";
import {
  base64ToUint8,
  createServerSupabaseClient,
  getCommunityMemoryStore,
  uint8ToBase64,
  type CommunityTacticRecord,
} from "../../../../lib/supabase-client";

const SubmitTacticBodySchema = z.object({
  kind: z.literal("tactic").default("tactic"),
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(4000),
  authorName: z.string().max(60).optional(),
  gameVersion: z.string().default(DEFAULT_PATCH_VERSION),
  fmfBase64: z.string().min(16).max(524_288).optional(),
  tactic: DualPhaseTacticSchema.optional(),
});

const SubmitShortlistBodySchema = z.object({
  kind: z.literal("shortlist"),
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  authorName: z.string().max(60).optional(),
  gameVersion: z.string().default(DEFAULT_PATCH_VERSION),
  wonderkidUids: z.array(z.number().int().positive()).min(1).max(100),
});

export async function POST(req: Request) {
  try {
    const rawBody = (await req.json()) as Record<string, unknown>;
    const kind = (rawBody.kind as string | undefined) ?? "tactic";

    if (kind === "schedule") {
      const parsed = CommunityScheduleSubmissionSchema.parse(rawBody);
      const moderation = await moderateCommunitySubmission({
        title: parsed.title,
        description: `Training focus: ${parsed.focusTags.join(", ")}`,
      });
      if (!moderation.isSafeContent) {
        return NextResponse.json(
          { error: "Submission rejected by safety moderation", moderation },
          { status: 422 },
        );
      }

      const store = getCommunityMemoryStore();
      const record = {
        id: `sched-${crypto.randomUUID()}`,
        authorName: String(rawBody.authorName || "Community Coach"),
        title: parsed.title,
        focusTags: parsed.focusTags,
        gameVersion: parsed.gameVersion,
        schedule: parsed.schedule,
        upvotesCount: 1,
        bookmarksCount: 0,
        createdAt: new Date().toISOString(),
      };
      store.schedules.unshift(record);
      return NextResponse.json({ ok: true, item: record, moderation }, { status: 201 });
    }

    if (kind === "shortlist") {
      const parsed = SubmitShortlistBodySchema.parse(rawBody);
      const moderation = await moderateCommunitySubmission({
        title: parsed.title,
        description: parsed.description,
      });
      if (!moderation.isSafeContent) {
        return NextResponse.json(
          { error: "Submission rejected by safety moderation", moderation },
          { status: 422 },
        );
      }

      const store = getCommunityMemoryStore();
      const record = {
        id: `sl-${crypto.randomUUID()}`,
        authorName: parsed.authorName || "Community Scout",
        title: parsed.title,
        description: parsed.description,
        wonderkidUids: Array.from(new Set(parsed.wonderkidUids)),
        gameVersion: parsed.gameVersion,
        upvotesCount: 1,
        bookmarksCount: 0,
        createdAt: new Date().toISOString(),
      };
      store.shortlists.unshift(record);
      return NextResponse.json({ ok: true, item: record, moderation }, { status: 201 });
    }

    // Default: Tactic submission (.fmf binary auto-parse or DualPhaseTactic JSON)
    const parsed = SubmitTacticBodySchema.parse(rawBody);
    let tactic: DualPhaseTactic;
    let fmfBytes: Uint8Array;

    if (parsed.fmfBase64) {
      fmfBytes = base64ToUint8(parsed.fmfBase64);
      const decoded = await parseFmf(fmfBytes, { patchVersion: parsed.gameVersion });
      tactic = {
        ...decoded,
        title: parsed.title,
        description: parsed.description,
        author: parsed.authorName || decoded.author || "Community Manager",
      };
    } else if (parsed.tactic) {
      tactic = {
        ...parsed.tactic,
        title: parsed.title,
        description: parsed.description,
        author: parsed.authorName || parsed.tactic.author || "Community Manager",
      };
      fmfBytes = exportFmf(tactic);
    } else {
      return NextResponse.json(
        { error: "Provide either fmfBase64 binary or tactic JSON" },
        { status: 400 },
      );
    }

    const balance = computeTacticalBalance(tactic);
    const [moderation, semantic] = await Promise.all([
      moderateCommunitySubmission({
        title: parsed.title,
        description: parsed.description,
        tactic,
      }),
      generateSemanticEmbedding(
        `${parsed.title} ${parsed.description} ${tactic.inFormation} ${tactic.outFormation}`,
      ),
    ]);

    const moderationStatus = moderation.isSafeContent ? "approved" : "rejected";
    if (moderationStatus === "rejected") {
      return NextResponse.json(
        {
          error: "Submission flagged as unsafe/spam by moderation",
          moderationStatus,
          moderation,
        },
        { status: 422 },
      );
    }

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    const supabase = createServerSupabaseClient(token);

    const id = `tac-${crypto.randomUUID()}`;
    const record: CommunityTacticRecord = {
      id,
      authorName: tactic.author || "Community Manager",
      title: parsed.title,
      description: parsed.description,
      gameVersion: parsed.gameVersion,
      ipFormation: tactic.inFormation,
      oopFormation: tactic.outFormation,
      playstyleTag: moderation.playstyleTag,
      mentality: tactic.mentality,
      tactic,
      balanceScore: balance.overallScore,
      guideQuality: moderation.guideQualityScore,
      upvotesCount: 1,
      bookmarksCount: 0,
      downloadsCount: 0,
      moderationStatus: "approved",
      embedding: semantic.embedding,
      fmfBase64: uint8ToBase64(fmfBytes),
      createdAt: new Date().toISOString(),
    };

    if (supabase && token) {
      const { data: userRes } = await supabase.auth.getUser(token);
      if (userRes.user) {
        const storagePath = `tactics/${userRes.user.id}/${id}.fmf`;
        await supabase.storage
          .from("fmf-files")
          .upload(storagePath, fmfBytes, {
            contentType: "application/octet-stream",
            upsert: true,
          });

        const { data: inserted } = await supabase
          .from("community_tactics")
          .insert({
            author_id: userRes.user.id,
            title: record.title,
            description: record.description,
            game_version: record.gameVersion,
            ip_formation: record.ipFormation,
            oop_formation: record.oopFormation,
            playstyle_tag: record.playstyleTag,
            mentality: record.mentality,
            tactic_json: record.tactic,
            fmf_storage_path: storagePath,
            balance_score: record.balanceScore,
            guide_quality: record.guideQuality,
            moderation_status: record.moderationStatus,
            embedding: record.embedding,
          })
          .select("id")
          .single();

        if (inserted?.id) {
          record.id = String(inserted.id);
        }
      }
    }

    getCommunityMemoryStore().tactics.unshift(record);

    return NextResponse.json(
      {
        ok: true,
        item: record,
        moderation,
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid submission payload" },
      { status: 400 },
    );
  }
}
