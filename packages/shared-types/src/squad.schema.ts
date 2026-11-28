import { z } from "zod";

export const ALL_49_ATTRIBUTES = [
  "corners",
  "crossing",
  "dribbling",
  "finishing",
  "first_touch",
  "free_kick_taking",
  "heading",
  "long_shots",
  "long_throws",
  "marking",
  "passing",
  "penalty_taking",
  "tackling",
  "technique",
  "aggression",
  "anticipation",
  "bravery",
  "composure",
  "concentration",
  "decisions",
  "determination",
  "flair",
  "leadership",
  "off_the_ball",
  "positioning",
  "teamwork",
  "vision",
  "work_rate",
  "acceleration",
  "agility",
  "balance",
  "jumping_reach",
  "natural_fitness",
  "pace",
  "stamina",
  "strength",
  "aerial_reach",
  "command_of_area",
  "communication",
  "eccentricity",
  "handling",
  "kicking",
  "one_on_ones",
  "punching",
  "reflexes",
  "rushing_out",
  "throwing",
  "dirtiness",
  "injury_proneness",
] as const;

export const POSITION_14_KEYS = [
  "GK",
  "DL",
  "DC",
  "DR",
  "DM",
  "ML",
  "MC",
  "MR",
  "AML",
  "AMC",
  "AMR",
  "STC",
  "WBL",
  "WBR",
] as const;

export const AttributeNameSchema = z.enum(ALL_49_ATTRIBUTES);
export const PositionKey14Schema = z.enum(POSITION_14_KEYS);

export const PlayerAttributesSchema = z.record(AttributeNameSchema, z.number().min(0).max(20));
export const PositionFamiliaritySchema = z.record(PositionKey14Schema, z.number().min(0).max(20));

export const PlayerSchema = z.object({
  uid: z.number().int().nonnegative(),
  name: z.string().min(1),
  age: z.number().int().min(14).max(50).optional(),
  clubUid: z.number().int().nonnegative().optional(),
  clubName: z.string().optional(),
  nationality: z.string().optional(),
  teamId: z.number().int().optional(),
  teamSlot: z.string().optional(),
  leftFoot: z.number().min(0).max(20).default(10),
  rightFoot: z.number().min(0).max(20).default(10),
  currentAbility: z.number().min(0).max(200).optional(),
  potentialAbility: z.number().min(0).max(200).optional(),
  attributes: PlayerAttributesSchema,
  positions: PositionFamiliaritySchema,
  personality: z.record(z.string(), z.number().min(0).max(20)).optional(),
  tacticalFamiliarity: z.array(z.number().int().min(-100).max(60)).length(9).optional(),
  condition: z.number().min(0).max(100).optional(),
  matchSharpness: z.number().min(0).max(100).optional(),
});

export const LineupPreferenceSchema = z.object({
  playerUid: z.number().int().nonnegative(),
  mustStart: z.boolean().default(true),
  lockedInSlot: z.string().optional(),
  lockedInRole: z.string().optional(),
  lockedOutSlot: z.string().optional(),
  lockedOutRole: z.string().optional(),
});

export const SlotAuditItemSchema = z.object({
  slotIndex: z.number().int().min(0).max(10),
  playerUid: z.number().int().nonnegative(),
  playerName: z.string(),
  inSlot: z.string(),
  outSlot: z.string(),
  inRoleId: z.string(),
  outRoleId: z.string(),
  fitScore: z.number(),
  inRoleQuality: z.number(),
  outRoleQuality: z.number(),
  keyAttributeGaps: z.array(
    z.object({
      attribute: AttributeNameSchema,
      value: z.number(),
      target: z.number(),
    }),
  ),
  betterInternalReplacements: z.array(
    z.object({
      playerUid: z.number().int().nonnegative(),
      playerName: z.string(),
      projectedFit: z.number(),
      fitGain: z.number(),
    }),
  ),
  betterRoleAlternatives: z.array(
    z.object({
      phase: z.enum(["IP", "OOP"]),
      roleId: z.string(),
      projectedFit: z.number(),
    }),
  ),
});

export const SquadAuditResultSchema = z.object({
  overallSquadFit: z.number(),
  starterAudits: z.array(SlotAuditItemSchema).length(11),
  weakestThreeSlotIndices: z.array(z.number().int().min(0).max(10)).max(3),
  weakestTeamAttributes: z.array(AttributeNameSchema),
});

export type AttributeName = z.infer<typeof AttributeNameSchema>;
export type PositionKey14 = z.infer<typeof PositionKey14Schema>;
export type PlayerAttributes = z.infer<typeof PlayerAttributesSchema>;
export type PositionFamiliarity = z.infer<typeof PositionFamiliaritySchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type LineupPreference = z.infer<typeof LineupPreferenceSchema>;
export type SlotAuditItem = z.infer<typeof SlotAuditItemSchema>;
export type SquadAuditResult = z.infer<typeof SquadAuditResultSchema>;
