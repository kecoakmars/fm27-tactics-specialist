import { z } from "zod";

export const STAFF_TRAINING_CATEGORIES = [
  "defending_tactical",
  "defending_technical",
  "attacking_tactical",
  "attacking_technical",
  "possession_tactical",
  "possession_technical",
  "gk_shot_stopping",
  "gk_handling",
  "fitness_strength",
  "fitness_quickness",
] as const;

export const StaffCategoryIdSchema = z.enum(STAFF_TRAINING_CATEGORIES);

export const STAFF_ATTRIBUTE_NAMES = [
  "attacking",
  "defending",
  "fitness",
  "mental",
  "tactical",
  "technical",
  "working_with_youngsters",
  "gk_distribution",
  "gk_handling",
  "gk_shot_stopping",
  "determination",
  "level_of_discipline",
  "motivating",
  "tactical_knowledge",
  "judging_player_ability",
  "judging_player_potential",
] as const;

export const StaffAttributeNameSchema = z.enum(STAFF_ATTRIBUTE_NAMES);

export const StaffAttributesSchema = z.object({
  attacking: z.number().min(1).max(20),
  defending: z.number().min(1).max(20),
  fitness: z.number().min(1).max(20),
  mental: z.number().min(1).max(20),
  tactical: z.number().min(1).max(20),
  technical: z.number().min(1).max(20),
  working_with_youngsters: z.number().min(1).max(20).default(10),
  gk_distribution: z.number().min(1).max(20).default(1),
  gk_handling: z.number().min(1).max(20).default(1),
  gk_shot_stopping: z.number().min(1).max(20).default(1),
  determination: z.number().min(1).max(20),
  level_of_discipline: z.number().min(1).max(20),
  motivating: z.number().min(1).max(20),
  tactical_knowledge: z.number().min(1).max(20).default(10),
  judging_player_ability: z.number().min(1).max(20).default(10),
  judging_player_potential: z.number().min(1).max(20).default(10),
});

export const StaffRoleSchema = z.enum([
  "Manager",
  "Assistant Manager",
  "Coach",
  "Fitness Coach",
  "Goalkeeping Coach",
  "Head of Youth Development",
]);

export const StaffMemberSchema = z.object({
  uid: z.number().int().positive(),
  name: z.string().min(1),
  age: z.number().int().min(20).max(85),
  nationality: z.string().min(2),
  club: z.string().min(1),
  isFreeAgent: z.boolean(),
  preferredRole: StaffRoleSchema,
  wageEstimateEurWeekly: z.number().nonnegative(),
  attributes: StaffAttributesSchema,
});

export const StarThresholdSchema = z.object({
  minScore: z.number().nonnegative(),
  stars: z.number().min(0.5).max(5.0),
});

export const StaffCategoryFormulaSchema = z.object({
  id: StaffCategoryIdSchema,
  label: z.string().min(1),
  group: z.enum(["outfield", "goalkeeping", "fitness"]),
  ddmWeight: z.number().positive(),
  primaryWeights: z.record(StaffAttributeNameSchema, z.number().positive()),
  secondaryWeights: z.record(StaffAttributeNameSchema, z.number().positive()).default({}),
  maxRawScore: z.number().positive(),
  thresholds: z.array(StarThresholdSchema).length(10),
});

export const StaffFormulasCatalogSchema = z.object({
  ddmAttributes: z.tuple([
    z.literal("determination"),
    z.literal("level_of_discipline"),
    z.literal("motivating"),
  ]),
  categories: z.array(StaffCategoryFormulaSchema).length(10),
});

export const StaffSeedCatalogSchema = z.object({
  Staff: z.array(StaffMemberSchema).min(30),
});

export const StarRatingBreakdownSchema = z.object({
  categoryId: StaffCategoryIdSchema,
  rawScore: z.number(),
  normalizedPercent: z.number().min(0).max(100),
  stars: z.number().min(0.5).max(5.0),
});

export const StaffAssignmentPlanSchema = z.object({
  assignments: z.array(
    z.object({
      categoryId: StaffCategoryIdSchema,
      leadStaffUid: z.number().int().positive(),
      supportStaffUids: z.array(z.number().int().positive()),
      effectiveStars: z.number().min(0.5).max(5.0),
      workload: z.enum(["Light", "Average", "Heavy"]),
    }),
  ),
  averageStars: z.number().min(0.5).max(5.0),
});

export type StaffCategoryId = z.infer<typeof StaffCategoryIdSchema>;
export type StaffAttributeName = z.infer<typeof StaffAttributeNameSchema>;
export type StaffAttributes = z.infer<typeof StaffAttributesSchema>;
export type StaffRole = z.infer<typeof StaffRoleSchema>;
export type StaffMember = z.infer<typeof StaffMemberSchema>;
export type StaffCategoryFormula = z.infer<typeof StaffCategoryFormulaSchema>;
export type StaffFormulasCatalog = z.infer<typeof StaffFormulasCatalogSchema>;
export type StaffSeedCatalog = z.infer<typeof StaffSeedCatalogSchema>;
export type StarRatingBreakdown = z.infer<typeof StarRatingBreakdownSchema>;
export type StaffAssignmentPlan = z.infer<typeof StaffAssignmentPlanSchema>;
