import { z } from "zod";
import { DualPhaseTacticSchema } from "./tactic.schema.js";
import { WeeklyScheduleSchema } from "./training.schema.js";

export const PlaystyleTagSchema = z.enum([
  "gegenpress",
  "possession",
  "counter",
  "wing_play",
  "balanced",
]);

export const ModerationStatusSchema = z.enum(["pending", "approved", "rejected"]);

export const ModerationDecisionSchema = z.object({
  isSafeContent: z.boolean(),
  safetyConfidence: z.number().min(0).max(1),
  playstyleTag: PlaystyleTagSchema,
  guideQualityScore: z.number().min(0).max(1),
});

export const CommunityTacticSubmissionSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(4000),
  gameVersion: z.string().default("27.0"),
  tactic: DualPhaseTacticSchema,
  balanceScore: z.number().min(0).max(100),
});

export const CommunityScheduleSubmissionSchema = z.object({
  title: z.string().min(3).max(120),
  focusTags: z.array(z.string()).min(1).max(6),
  gameVersion: z.string().default("27.0"),
  schedule: WeeklyScheduleSchema,
});

export const CommunityShortlistSubmissionSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  wonderkidIds: z.array(z.string().uuid()).min(1).max(100),
  gameVersion: z.string().default("27.0"),
});

export const CommunityFilterParamsSchema = z.object({
  category: z.enum(["tactics", "schedules", "shortlists"]).default("tactics"),
  gameVersion: z.string().optional(),
  ipFormation: z.string().optional(),
  oopFormation: z.string().optional(),
  playstyleTag: PlaystyleTagSchema.optional(),
  sortBy: z.enum(["trending", "top_upvoted", "newest"]).default("trending"),
  query: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().nonnegative().default(0),
});

export const AnalyticsEventPayloadSchema = z.object({
  entityType: z.enum(["tactic", "schedule", "shortlist", "wonderkid"]),
  entityId: z.string().min(1),
  eventType: z.enum(["view", "bookmark", "shortlist_add", "upvote", "download"]),
});

export type PlaystyleTag = z.infer<typeof PlaystyleTagSchema>;
export type ModerationStatus = z.infer<typeof ModerationStatusSchema>;
export type ModerationDecision = z.infer<typeof ModerationDecisionSchema>;
export type CommunityTacticSubmission = z.infer<typeof CommunityTacticSubmissionSchema>;
export type CommunityScheduleSubmission = z.infer<typeof CommunityScheduleSubmissionSchema>;
export type CommunityShortlistSubmission = z.infer<typeof CommunityShortlistSubmissionSchema>;
export type CommunityFilterParams = z.infer<typeof CommunityFilterParamsSchema>;
export type AnalyticsEventPayload = z.infer<typeof AnalyticsEventPayloadSchema>;
