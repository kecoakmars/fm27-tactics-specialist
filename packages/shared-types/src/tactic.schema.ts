import { z } from "zod";

export const DutySchema = z.enum(["Defend", "Support", "Attack"]);

export const DutyMaskMap = {
  Defend: 0x200000,
  Support: 0x400000,
  Attack: 0x800000,
} as const;

export const SlotPhaseConfigSchema = z.object({
  positionId: z.string().min(2).max(5),
  roleId: z.string().min(2),
  duty: DutySchema,
  playerInstructionBits: z.array(z.number().int().min(1).max(42)).default([]),
  markingPositionMask: z.number().int().nonnegative().default(0),
});

export const SlotAssignmentSchema = z.object({
  slotIndex: z.number().int().min(0).max(10),
  playerUid: z.number().int().nonnegative().optional(),
  playerName: z.string().optional(),
  inPossession: SlotPhaseConfigSchema,
  outOfPossession: SlotPhaseConfigSchema,
});

export const DualPhaseTacticSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).default(""),
  author: z.string().max(80).default(""),
  patchVersion: z.string().default("27.0"),
  styleId: z.string().optional(),
  mentality: z.number().int().min(1).max(7).default(4),
  inFormation: z.string().min(3),
  outFormation: z.string().min(3),
  teamInstructions: z.record(z.string(), z.number().int().min(0).max(95)),
  slots: z.array(SlotAssignmentSchema).length(11),
});

export const Fm27JsonV1Schema = z.object({
  schemaVersion: z.literal(1),
  game: z.literal("FM27"),
  patchVersion: z.string().default("27.0"),
  exportedAt: z.string().datetime(),
  tactic: DualPhaseTacticSchema,
});

export const TacticalPrioritiesSchema = z.object({
  selectedStyleIds: z.array(z.string()).default([]),
  objective: z.enum(["WinNow", "Balanced", "ProtectLead", "Underdog"]).default("Balanced"),
  riskOffset: z.number().int().min(-2).max(2).default(0),
});

export const CoachingFindingSchema = z.object({
  ruleId: z.string(),
  title: z.string(),
  metric: z.string(),
  rating: z.number(),
  target: z.number(),
  delta: z.number(),
  sources: z.array(z.string()),
  autoFix: z
    .object({
      group: z.string(),
      fromBit: z.number().int(),
      toBit: z.number().int(),
      text: z.string(),
    })
    .optional(),
});

export const TacticPlanResultSchema = z.object({
  tactic: DualPhaseTacticSchema,
  startingFit: z.number(),
  coverFit: z.number(),
  squadFit: z.number(),
  styleFit: z.number().nullable(),
  coachingAdjustment: z.number(),
  instructionPenalty: z.number(),
  rankingFit: z.number(),
  nearTieWithNext: z.boolean().default(false),
  findings: z.array(CoachingFindingSchema).default([]),
});

export type Duty = z.infer<typeof DutySchema>;
export type SlotPhaseConfig = z.infer<typeof SlotPhaseConfigSchema>;
export type SlotAssignment = z.infer<typeof SlotAssignmentSchema>;
export type DualPhaseTactic = z.infer<typeof DualPhaseTacticSchema>;
export type Fm27JsonV1 = z.infer<typeof Fm27JsonV1Schema>;
export type TacticalPriorities = z.infer<typeof TacticalPrioritiesSchema>;
export type CoachingFinding = z.infer<typeof CoachingFindingSchema>;
export type TacticPlanResult = z.infer<typeof TacticPlanResultSchema>;
