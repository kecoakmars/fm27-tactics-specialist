import { z } from "zod";
import { AttributeNameSchema } from "./squad.schema.js";

export const TrainingCategorySchema = z.enum([
  "general",
  "attacking",
  "defending",
  "possession",
  "tactical",
  "physical",
  "goalkeeping",
  "set_pieces",
  "match_prep",
  "rest",
]);

export const TrainingImpactSchema = z.object({
  condition: z.number().min(-25).max(25),
  fatigue: z.number().min(-25).max(25),
  happiness: z.number().min(-15).max(15),
  injuries: z.number().min(-15).max(25),
  sharpness: z.number().min(-15).max(25),
});

export const TrainingUnitAttributesSchema = z.object({
  attacking: z.array(AttributeNameSchema),
  midfield: z.array(AttributeNameSchema),
  defending: z.array(AttributeNameSchema),
  goalkeeping: z.array(AttributeNameSchema),
});

export const TrainingSessionSchema = z.object({
  code: z.string().min(2).max(40),
  name: z.string().min(2),
  category: TrainingCategorySchema,
  max_sessions_per_week: z.number().int().min(1).max(21),
  impact: TrainingImpactSchema,
  attributes: TrainingUnitAttributesSchema,
});

export const TrainingSessionsCatalogSchema = z.object({
  Sessions: z.array(TrainingSessionSchema).min(24),
});

export const DayOfWeekSchema = z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

export const DayScheduleSlotsSchema = z.object({
  day: DayOfWeekSchema,
  s1: z.string().min(2),
  s2: z.string().min(2),
  extra: z.string().min(2),
});

export const WeeklyScheduleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  focus_tags: z.array(z.string()).default([]),
  patchVersion: z.string().default("27.0"),
  days: z.array(DayScheduleSlotsSchema).length(7),
});

export const TrainingPresetsCatalogSchema = z.object({
  Presets: z.array(WeeklyScheduleSchema).min(4),
});

export const LoadMetricsSchema = z.object({
  conditionDelta: z.number(),
  fatigueDelta: z.number(),
  happinessDelta: z.number(),
  injuryRiskScore: z.number(),
  sharpnessDelta: z.number(),
  violations: z.array(
    z.object({
      code: z.string(),
      count: z.number().int(),
      maxAllowed: z.number().int(),
    }),
  ),
});

export type TrainingCategory = z.infer<typeof TrainingCategorySchema>;
export type TrainingImpact = z.infer<typeof TrainingImpactSchema>;
export type TrainingUnitAttributes = z.infer<typeof TrainingUnitAttributesSchema>;
export type TrainingSession = z.infer<typeof TrainingSessionSchema>;
export type TrainingSessionsCatalog = z.infer<typeof TrainingSessionsCatalogSchema>;
export type DayOfWeek = z.infer<typeof DayOfWeekSchema>;
export type DayScheduleSlots = z.infer<typeof DayScheduleSlotsSchema>;
export type WeeklySchedule = z.infer<typeof WeeklyScheduleSchema>;
export type TrainingPresetsCatalog = z.infer<typeof TrainingPresetsCatalogSchema>;
export type LoadMetrics = z.infer<typeof LoadMetricsSchema>;
