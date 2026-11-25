import { getRoleProfiles, getTacticalStyles, getWonderkidsSeed } from "@fm27/fm-data";
import type {
  PaRange,
  PositionKey14,
  RoleFitRanking,
  SlotAssignment,
  Wonderkid,
} from "@fm27/shared-types";
import { computeSlotFit } from "./fit-calculator.js";
import { computePlayerStyleRating } from "./hungarian.js";
import { canonicalPositionKey, normalizePlayer } from "./normalizer.js";
import { scoreSingleRoleQuality } from "./role-evaluator.js";

const PA_MIDPOINT_SCORE: Record<PaRange, number> = {
  "145-175": 76,
  "150-180": 81,
  "155-185": 85,
  "160-190": 90,
  "170-200": 97,
};

function clamp100(val: number): number {
  return Math.round(Math.max(0, Math.min(100, val)) * 100) / 100;
}

/**
 * Computes PriceEfficiency (0..100) rewarding lower transfer fee relative to PA ceiling.
 */
export function computePriceEfficiency(priceEurM: number, potentialScore: number): number {
  // Exponential curve: <=5M approaches 98-100; 30M ~ 68; 80M ~ 35; 150M+ ~ 12
  const raw = 100 * Math.exp(-priceEurM / 68) * (0.75 + 0.25 * (potentialScore / 100));
  return clamp100(raw);
}

export interface WonderkidFilterOptions {
  position?: PositionKey14;
  maxAge?: number;
  maxBudgetEurM?: number;
  styleId?: string;
  limit?: number;
  patchVersion?: string;
}

/**
 * Ranks wonderkids against a target tactical slot using exact `MASTER_SPEC.md` formula:
 * `ValueRatio = 0.55 * RoleFit + 0.30 * PotentialScore + 0.15 * PriceEfficiency`
 */
export function rankWonderkidsForSlot(
  targetSlot: SlotAssignment,
  options: WonderkidFilterOptions = {},
  customCatalog?: readonly Wonderkid[],
): RoleFitRanking[] {
  const patchVersion = options.patchVersion ?? "27.0";
  const wonderkids = customCatalog ?? getWonderkidsSeed(patchVersion).Wonderkids;
  const rp = getRoleProfiles(patchVersion);
  const profileById = new Map(rp.Roles.map((r) => [r.Id, r]));
  const specialistSet = new Set(rp.SpecialistRoles);

  const stylesCatalog = getTacticalStyles(patchVersion);
  const activeStyle = options.styleId
    ? stylesCatalog.TacticalStyles.find(
        (s) =>
          s.Id.toLowerCase() === options.styleId!.toLowerCase() ||
          s.Name.toLowerCase() === options.styleId!.toLowerCase(),
      )
    : undefined;

  const inSlot = targetSlot.inPossession.positionId;
  const outSlot = targetSlot.outOfPossession.positionId;
  const inRole = profileById.get(targetSlot.inPossession.roleId) ?? rp.Roles[0]!;
  const outRole = profileById.get(targetSlot.outOfPossession.roleId) ?? rp.Roles[0]!;
  const targetCanonicalPos = options.position ?? canonicalPositionKey(inSlot);

  const rankings: RoleFitRanking[] = [];

  for (const wk of wonderkids) {
    if (options.maxAge !== undefined && wk.age > options.maxAge) continue;
    if (options.maxBudgetEurM !== undefined && wk.estimatedPriceEurM > options.maxBudgetEurM) {
      continue;
    }
    if (options.position && !wk.positions.includes(options.position)) continue;

    // Skip obvious GK <-> Outfield mismatches
    const wkIsGk = wk.positions.includes("GK");
    if ((targetCanonicalPos === "GK") !== wkIsGk) continue;

    const normalized = normalizePlayer(
      {
        uid: wk.uid,
        name: wk.name,
        age: wk.age,
        clubName: wk.club,
        nationality: wk.nationality,
        leftFoot: wk.leftFoot,
        rightFoot: wk.rightFoot,
        currentAbility: wk.currentAbilityEstimate,
        attributes: wk.attributes,
        positions: wk.positionFamiliarity,
      },
      patchVersion,
    );

    const inQ = scoreSingleRoleQuality(normalized, inSlot, inRole, specialistSet);
    const outQ = scoreSingleRoleQuality(normalized, outSlot, outRole, specialistSet);
    const rawFit = computeSlotFit(normalized, inSlot, outSlot, inQ, outQ);
    if (rawFit <= 0) continue;

    const blendedRoleFit = activeStyle
      ? 0.9 * rawFit + 0.1 * computePlayerStyleRating(normalized, activeStyle.Attributes)
      : rawFit;

    const roleFitScore = clamp100(blendedRoleFit);
    const potentialScore = PA_MIDPOINT_SCORE[wk.paRange] ?? 82;
    const priceEfficiency = computePriceEfficiency(wk.estimatedPriceEurM, potentialScore);

    const valueRatio = clamp100(
      0.55 * roleFitScore + 0.3 * potentialScore + 0.15 * priceEfficiency,
    );

    rankings.push({
      wonderkid: wk,
      targetSlotIndex: targetSlot.slotIndex,
      inSlot,
      outSlot,
      inRoleId: inRole.Id,
      outRoleId: outRole.Id,
      roleFitScore,
      potentialScore,
      priceEfficiency,
      valueRatio,
    });
  }

  rankings.sort((a, b) => b.valueRatio - a.valueRatio || b.roleFitScore - a.roleFitScore);
  return options.limit ? rankings.slice(0, options.limit) : rankings;
}
