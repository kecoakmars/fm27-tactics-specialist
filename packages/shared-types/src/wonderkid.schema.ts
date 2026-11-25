import { z } from "zod";
import {
  PlayerAttributesSchema,
  PositionFamiliaritySchema,
  PositionKey14Schema,
} from "./squad.schema.js";

export const PaRangeSchema = z.enum([
  "150-180",
  "160-190",
  "170-200",
  "145-175",
  "155-185",
]);

export const WonderkidSchema = z.object({
  uid: z.number().int().positive(),
  name: z.string().min(2),
  age: z.number().int().min(15).max(21),
  club: z.string().min(1),
  nationality: z.string().min(2),
  positions: z.array(PositionKey14Schema).min(1),
  preferredFoot: z.enum(["Right", "Left", "Either"]),
  leftFoot: z.number().min(1).max(20),
  rightFoot: z.number().min(1).max(20),
  estimatedPriceEurM: z.number().nonnegative(),
  paRange: PaRangeSchema,
  currentAbilityEstimate: z.number().min(80).max(185),
  attributes: PlayerAttributesSchema,
  positionFamiliarity: PositionFamiliaritySchema,
  isCurated: z.boolean().default(true),
});

export const WonderkidsSeedCatalogSchema = z.object({
  Wonderkids: z.array(WonderkidSchema).min(150),
});

export const RoleFitRankingSchema = z.object({
  wonderkid: WonderkidSchema,
  targetSlotIndex: z.number().int().min(0).max(10),
  inSlot: z.string(),
  outSlot: z.string(),
  inRoleId: z.string(),
  outRoleId: z.string(),
  roleFitScore: z.number().min(0).max(100),
  potentialScore: z.number().min(0).max(100),
  priceEfficiency: z.number().min(0).max(100),
  valueRatio: z.number().min(0).max(100),
});

export const TrendingWonderkidItemSchema = z.object({
  wonderkid: WonderkidSchema,
  trendScore: z.number().nonnegative(),
  rank: z.number().int().positive(),
  rankDelta: z.number().int().default(0),
  views7d: z.number().int().nonnegative().default(0),
  shortlists7d: z.number().int().nonnegative().default(0),
});

export type PaRange = z.infer<typeof PaRangeSchema>;
export type Wonderkid = z.infer<typeof WonderkidSchema>;
export type WonderkidsSeedCatalog = z.infer<typeof WonderkidsSeedCatalogSchema>;
export type RoleFitRanking = z.infer<typeof RoleFitRankingSchema>;
export type TrendingWonderkidItem = z.infer<typeof TrendingWonderkidItemSchema>;
