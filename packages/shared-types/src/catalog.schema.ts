import { z } from "zod";

export const Uint64StringSchema = z
  .string()
  .regex(/^\d+$/, "Expected unsigned 64-bit decimal integer string")
  .refine((val) => {
    try {
      const n = BigInt(val);
      return n > 0n && n <= 0xffffffffffffffffn;
    } catch {
      return false;
    }
  }, "Value must be a positive 64-bit unsigned integer");

export const PositionSchema = z.object({
  Id: z.string().min(2).max(5),
  Mask: z.number().int().positive(),
  X: z.number().min(0).max(100),
  Y: z.number().min(0).max(100),
});

export const RoleSchema = z.object({
  Id: z.string().min(2),
  Name: z.string().min(2),
  Flags: Uint64StringSchema,
});

export const PositionEligibilityTupleSchema = z.tuple([
  z.array(z.string().min(2)).min(1),
  z.array(z.string().min(2)).min(1),
]);

export const EligibilityMapSchema = z.object({
  "0:0": z.record(z.string(), PositionEligibilityTupleSchema),
  "0:1": z.record(z.string(), PositionEligibilityTupleSchema),
  "3:0": z.record(z.string(), PositionEligibilityTupleSchema),
  "3:1": z.record(z.string(), PositionEligibilityTupleSchema),
});

export const InstructionOptionSchema = z.object({
  Bit: z.number().int().min(0).max(95),
  Label: z.string().min(1),
});

export const TeamInstructionGroupSchema = z.object({
  Group: z.string().min(1),
  Label: z.string().min(1),
  Out: z.boolean(),
  Current: z.number().int().min(0).max(95),
  Options: z.array(InstructionOptionSchema).min(2),
});

export const ConflictPairSchema = z.tuple([
  z.number().int().min(1).max(95),
  z.number().int().min(1).max(95),
]);

export const PlayerInstructionOptionSchema = z.object({
  Bit: z.number().int().min(0).max(63),
  Label: z.string().min(1),
});

export const PlayerInstructionGroupSchema = z.object({
  Id: z.number().int().min(0).max(16),
  Label: z.string().min(1),
  Phase: z.union([z.literal(0), z.literal(1)]),
  Options: z.array(PlayerInstructionOptionSchema).min(2),
});

export const PitchCatalogSchema = z.object({
  Positions: z.array(PositionSchema).length(24),
  Roles: z.array(RoleSchema).min(78),
  Eligibility: EligibilityMapSchema,
  Instructions: z.array(TeamInstructionGroupSchema).length(29),
  Conflicts: z.array(ConflictPairSchema).min(1),
  PlayerInstructions: z.array(PlayerInstructionGroupSchema).length(17),
  PlayerInstructionPolicies: z.record(
    z.string(),
    z.string().regex(/^[0123]{43}$/, "Policy string must have exact 43 policy digits (0..3)"),
  ),
});

export const CoachingSourceSchema = z.object({
  Id: z.string().min(1),
  Publisher: z.string().min(1),
  Title: z.string().min(1),
  Date: z.string().min(1),
  Kind: z.string().min(1),
  Coach: z.string().optional(),
  Context: z.string().min(1),
  Url: z.string().url(),
  Observation: z.string().min(1),
});

export const CoachingRuleSchema = z.object({
  Id: z.string().min(1),
  Title: z.string().min(1),
  When: z.string().min(1),
  Metric: z.string().min(1),
  Target: z.number().positive().max(20),
  Weight: z.number().positive(),
  Sources: z.array(z.string().min(1)).min(1),
  Detail: z.string().min(1),
});

export const CoachingAdjustmentSchema = z.object({
  Metric: z.string().min(1),
  Style: z.string().min(1),
  Group: z.string().min(1),
  From: z.number().int().min(0).max(95),
  To: z.number().int().min(0).max(95),
  Below: z.number().positive().max(20),
  Prefix: z.string().min(1),
  Text: z.string().min(1),
});

export const CoachingKnowledgeSchema = z.object({
  Schema: z.number().int().positive(),
  Game: z.string().min(1),
  Sources: z.array(CoachingSourceSchema).min(23),
  Rules: z.array(CoachingRuleSchema).length(10),
  Adjustments: z.array(CoachingAdjustmentSchema).min(3),
});

export const RoleProfileEntrySchema = z.object({
  Id: z.string().min(2),
  Name: z.string().min(2),
  Phase: z.enum(["IP", "OOP"]),
  Keys: z.tuple([z.string(), z.string(), z.string(), z.string(), z.string()]),
  Aliases: z.array(z.string()).optional(),
});

export const RoleProfilesCatalogSchema = z.object({
  AllAttributes: z.array(z.string().min(1)).length(49),
  Goalkeeping: z.array(z.string().min(1)).length(11),
  LowerIsBetter: z.array(z.string().min(1)).length(4),
  PersonalityKeys: z.array(z.string().min(1)).length(8),
  PositionKeys: z.array(z.string().min(1)).length(14),
  SpecialistRoles: z.array(z.string().min(1)).length(6),
  Roles: z.array(RoleProfileEntrySchema).min(32),
});

export const MentalityItemSchema = z.object({
  Value: z.number().int().min(1).max(7),
  Id: z.string().min(1),
  Label: z.string().min(1),
});

export const DualShapeSchema = z.object({
  Id: z.string().min(1),
  InPossessionName: z.string().min(3),
  OutOfPossessionName: z.string().min(3),
  InSlots: z.array(z.string().min(2)).length(11),
  OutSlots: z.array(z.string().min(2)).length(11),
  HighPress: z.boolean(),
});

export const TacticalStyleSchema = z.object({
  Id: z.string().min(1),
  Name: z.string().min(1),
  Mentality: z.number().int().min(1).max(7),
  MentalityLabel: z.string().min(1),
  DefensiveBlock: z.enum(["high", "mid", "low"]),
  HighPress: z.boolean(),
  Attributes: z.array(z.string().min(1)).min(4),
  Allows: z.array(z.string().min(1)).min(1),
  InstructionBits: z.record(z.string(), z.number().int().min(0).max(95)),
  PreferredRoles: z.array(z.string().min(2)).optional(),
});

export const TacticalStylesCatalogSchema = z.object({
  Mentalities: z.array(MentalityItemSchema).length(7),
  TacticalStyles: z.array(TacticalStyleSchema).length(13),
  Shapes: z.array(DualShapeSchema).length(8),
  StyleShapes: z.array(DualShapeSchema).length(16),
});

export const PatchManifestSchema = z.object({
  patchVersion: z.string().regex(/^\d+\.\d+(\.\d+)?$/),
  game: z.literal("FM27"),
  releasedAt: z.string().min(10),
  generatedAt: z.string().datetime(),
  sourceMode: z.enum(["gdrive-rea", "legacy-install", "seed-defaults"]),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  checksums: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
});

export type Position = z.infer<typeof PositionSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type EligibilityMap = z.infer<typeof EligibilityMapSchema>;
export type TeamInstructionGroup = z.infer<typeof TeamInstructionGroupSchema>;
export type PlayerInstructionGroup = z.infer<typeof PlayerInstructionGroupSchema>;
export type ConflictPair = z.infer<typeof ConflictPairSchema>;
export type PitchCatalog = z.infer<typeof PitchCatalogSchema>;
export type CoachingSource = z.infer<typeof CoachingSourceSchema>;
export type CoachingRule = z.infer<typeof CoachingRuleSchema>;
export type CoachingAdjustment = z.infer<typeof CoachingAdjustmentSchema>;
export type CoachingKnowledge = z.infer<typeof CoachingKnowledgeSchema>;
export type RoleProfileEntry = z.infer<typeof RoleProfileEntrySchema>;
export type RoleProfilesCatalog = z.infer<typeof RoleProfilesCatalogSchema>;
export type MentalityItem = z.infer<typeof MentalityItemSchema>;
export type DualShape = z.infer<typeof DualShapeSchema>;
export type TacticalStyle = z.infer<typeof TacticalStyleSchema>;
export type TacticalStylesCatalog = z.infer<typeof TacticalStylesCatalogSchema>;
export type PatchManifest = z.infer<typeof PatchManifestSchema>;
