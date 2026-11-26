import { getPitchCatalog, getRoleProfiles } from "@fm27/fm-data";
import type { Duty, PitchCatalog, RoleProfileEntry } from "@fm27/shared-types";
import { averagePlayerAttributes, type NormalizedPlayerProfile } from "./normalizer.js";

const DEFEND_DUTY_ROLE_IDS = new Set<string>([
  "Goalkeeper",
  "NoNonsenseGoalkeeper",
  "NoNonsenseCentreBack",
  "DefensiveMidfielder",
  "HalfBack",
  "InsideFullBack",
]);

const ATTACK_DUTY_ROLE_IDS = new Set<string>([
  "AdvancedWingBack",
  "OverlappingCentreBack",
  "InsideForward",
  "WideForward",
  "SecondStriker",
  "ChannelForward",
  "CentreForward",
  "Poacher",
]);

export function inferDutyForRole(roleId: string, phase: 0 | 1): Duty {
  if (phase === 1) return "Defend";
  if (DEFEND_DUTY_ROLE_IDS.has(roleId)) return "Defend";
  if (ATTACK_DUTY_ROLE_IDS.has(roleId)) return "Attack";
  return "Support";
}

/**
 * Resolves the `<cbKey>:<dmKey>` key (`0:0`, `0:1`, `3:0`, `3:1`) for `PitchCatalog.Eligibility`
 * based on active CB count (>=3 -> "3") and DM count (===1 -> "1").
 */
export function resolveEligibilityKey(
  shapeSlots: readonly string[],
  catalog?: PitchCatalog,
): "0:0" | "0:1" | "3:0" | "3:1" {
  const cat = catalog ?? getPitchCatalog();
  const maskByPos = new Map(cat.Positions.map((p) => [p.Id, p.Mask]));

  let cbCount = 0;
  let dmCount = 0;
  for (const slotId of shapeSlots) {
    const mask = maskByPos.get(slotId) ?? 0;
    if ((mask & 16) !== 0) cbCount++;
    if ((mask & 128) !== 0) dmCount++;
  }

  const cbKey = cbCount >= 3 ? "3" : "0";
  const dmKey = dmCount === 1 ? "1" : "0";
  return `${cbKey}:${dmKey}`;
}

export function getCandidateRolesForSlot(
  slotId: string,
  phase: 0 | 1,
  shapeSlots: readonly string[],
  patchVersion = "27.0",
): RoleProfileEntry[] {
  const catalog = getPitchCatalog(patchVersion);
  const roleProfiles = getRoleProfiles(patchVersion);
  const profileById = new Map(roleProfiles.Roles.map((r) => [r.Id, r]));

  const eligKey = resolveEligibilityKey(shapeSlots, catalog);
  const tuple = catalog.Eligibility[eligKey][slotId];
  if (!tuple) return [];

  const roleIds = phase === 0 ? tuple[0] : tuple[1];
  const entries: RoleProfileEntry[] = [];
  for (const rId of roleIds) {
    const entry = profileById.get(rId);
    if (entry) entries.push(entry);
  }
  return entries;
}

export function scoreSingleRoleQuality(
  player: NormalizedPlayerProfile,
  slotId: string,
  role: RoleProfileEntry,
  specialistSet: ReadonlySet<string>,
): number {
  let q = averagePlayerAttributes(player, role.Keys);

  // Inverted-Foot rule exclusively for InsideForward:
  // AML rewards stronger right foot (-0.12 * (L - R)); AMR rewards stronger left foot (+0.12 * (L - R))
  if (role.Id === "InsideForward") {
    const footDelta = player.leftFoot - player.rightFoot;
    const sign = slotId === "AML" ? -0.12 : 0.12;
    q += footDelta * sign;
  }

  // Specialist role complexity gate (-0.45), except WingBack when deployed natively at WBL/WBR
  if (
    specialistSet.has(role.Id) &&
    !(role.Id === "WingBack" && (slotId === "WBL" || slotId === "WBR"))
  ) {
    q -= 0.45;
  }

  return q;
}

export interface BestRoleSelection {
  role: RoleProfileEntry;
  roleQuality: number;
  selectionScore: number;
}

/**
 * Selects the best role for `player` on `slotId` using:
 * - Mean of 5 key attributes
 * - InsideForward inverted-foot bonus
 * - -0.45 specialist complexity threshold
 * - +0.20 * |role.Keys ∩ styleAttributes| tie-breaker (excluded from returned `roleQuality`!)
 */
const NICHE_IP_SOLVER_ROLES = new Set<string>([
  "NoNonsenseGoalkeeper",
  "NoNonsenseCentreBack",
  "OverlappingCentreBack",
  "PlaymakingWingBack",
  "PlaymakingWinger",
  "WideCentralMidfielder",
  "ChannelMidfielder",
  "BoxToBoxPlaymaker",
  "FreeRole",
]);

const DIRECT_DEFENSIVE_STYLE_IDS = new Set<string>([
  "RouteOne",
  "ParkTheBus",
  "Catenaccio",
  "DirectCounterAttack",
]);

const COUNTER_OUTLET_STYLE_IDS = new Set<string>([
  "FluidCounterAttack",
  "DirectCounterAttack",
  "RouteOne",
  "Catenaccio",
  "ParkTheBus",
]);

const AERIAL_TARGET_STYLE_IDS = new Set<string>([
  "RouteOne",
  "DirectCounterAttack",
  "WingPlay",
  "FluidCounterAttack",
  "ParkTheBus",
  "Catenaccio",
]);

export function isOopOutletRole(roleId: string): boolean {
  return roleId.startsWith("OP") && roleId.includes("Outlet");
}

export interface SolverRoleFilterOptions {
  styleId?: string;
  preferredRoles?: readonly string[];
  highPress?: boolean;
  player?: NormalizedPlayerProfile;
  patchVersion?: string;
}

/**
 * Returns curated tactical role candidates for automatic formation/role recommendation,
 * matching Doctor W's ~30 core `SquadAnalysis.Roles` discipline:
 * - Prevents OOP `Outlet` roles from turning all forwards/wingers into non-pressing passengers
 *   in High-Press / Balanced / Possession systems.
 * - Prevents niche hoofball/gimmick IP roles (`NoNonsenseCentreBack`, `ChannelMidfielder`, etc.)
 *   from overriding standard roles unless suited to the active style or player archetype.
 */
export function getSolverCandidateRolesForSlot(
  slotId: string,
  phase: 0 | 1,
  shapeSlots: readonly string[],
  options: SolverRoleFilterOptions = {},
): RoleProfileEntry[] {
  const patchVersion = options.patchVersion ?? "27.0";
  const all = getCandidateRolesForSlot(slotId, phase, shapeSlots, patchVersion);
  if (all.length <= 1) return all;

  const preferredSet = new Set(options.preferredRoles ?? []);
  const styleId = options.styleId ?? "";
  const isDirectDefensive = DIRECT_DEFENSIVE_STYLE_IDS.has(styleId);
  const allowsCounterOutlet =
    !options.highPress && COUNTER_OUTLET_STYLE_IDS.has(styleId);

  const filtered = all.filter((role) => {
    if (preferredSet.has(role.Id)) return true;

    if (phase === 1) {
      if (isOopOutletRole(role.Id) && !allowsCounterOutlet) {
        return false;
      }
      return true;
    }

    if (
      (role.Id === "NoNonsenseCentreBack" || role.Id === "NoNonsenseGoalkeeper") &&
      !isDirectDefensive
    ) {
      return false;
    }

    if (NICHE_IP_SOLVER_ROLES.has(role.Id)) {
      return false;
    }

    if (role.Id === "TargetForward") {
      if (styleId && !AERIAL_TARGET_STYLE_IDS.has(styleId) && !preferredSet.has("TargetForward")) {
        return false;
      }
      if (options.player) {
        const jr = options.player.attributes.jumping_reach ?? options.player.ability;
        const hd = options.player.attributes.heading ?? options.player.ability;
        if (jr < 15 || hd < 15) return false;
      }
    }

    if (role.Id === "FalseNine" && options.player) {
      const vis = options.player.attributes.vision ?? options.player.ability;
      const pas = options.player.attributes.passing ?? options.player.ability;
      if (vis < 15 || pas < 15) return false;
    }

    return true;
  });

  return filtered.length > 0 ? filtered : all;
}

export function selectBestRole(
  player: NormalizedPlayerProfile,
  slotId: string,
  candidateRoles: readonly RoleProfileEntry[],
  styleAttributes?: ReadonlySet<string>,
  patchVersion = "27.0",
  preferredRoles?: ReadonlySet<string>,
): BestRoleSelection {
  if (candidateRoles.length === 0) {
    throw new Error(`No candidate roles available for slot "${slotId}"`);
  }
  const rp = getRoleProfiles(patchVersion);
  const specialistSet = new Set(rp.SpecialistRoles);

  let bestRole = candidateRoles[0]!;
  let bestSelectionScore = Number.NEGATIVE_INFINITY;
  let bestPureQuality = 0;

  for (const role of candidateRoles) {
    const q = scoreSingleRoleQuality(player, slotId, role, specialistSet);
    let overlap = 0;
    if (styleAttributes && styleAttributes.size > 0) {
      for (const k of role.Keys) {
        if (styleAttributes.has(k)) overlap++;
      }
    }
    let selectionBonus = 0.2 * overlap;
    if (preferredRoles && preferredRoles.has(role.Id)) {
      selectionBonus += 0.25;
    }
    if (preferredRoles && (slotId === "AML" || slotId === "AMR")) {
      const footDelta = player.leftFoot - player.rightFoot;
      if (role.Id === "Winger") {
        selectionBonus += (slotId === "AML" ? 0.08 : -0.08) * footDelta;
      } else if (role.Id === "InsideWinger") {
        selectionBonus += (slotId === "AML" ? -0.1 : 0.1) * footDelta;
      }
    }
    const selectionScore = q + selectionBonus;
    if (selectionScore > bestSelectionScore) {
      bestSelectionScore = selectionScore;
      bestRole = role;
      bestPureQuality = q;
    }
  }

  return {
    role: bestRole,
    roleQuality: bestPureQuality,
    selectionScore: bestSelectionScore,
  };
}
