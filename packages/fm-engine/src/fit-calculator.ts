import type { LineupPreference } from "@fm27/shared-types";
import { getPlayerSlotFamiliarity, type NormalizedPlayerProfile } from "./normalizer.js";

/**
 * Exact FM27 dual-phase slot fit calculator (SquadAnalysis.Fit, RVA 0x02560C):
 * - posScore = 0.65 * ((inFam + outFam) / 2) + 0.35 * min(inFam, outFam)
 * - roleMean = (inRoleQuality + outRoleQuality) / 2
 * - raw (standard)    = 0.55 * posScore + 0.35 * roleMean + 0.10 * Ability
 * - raw (fullProfile) = 0.46 * posScore + 0.26 * roleMean + 0.18 * Ability + 0.10 * OverallAttributes
 * - Fit = 5 * raw - 1.5 * max(0, 14 - min(inFam, outFam)) - (gkMismatch ? 1000 : 0)
 */
export function computeSlotFit(
  player: NormalizedPlayerProfile,
  inSlot: string,
  outSlot: string,
  inRoleQuality: number,
  outRoleQuality: number,
): number {
  const inFam = getPlayerSlotFamiliarity(player, inSlot);
  const outFam = getPlayerSlotFamiliarity(player, outSlot);
  const minFam = Math.min(inFam, outFam);

  const posScore = 0.65 * ((inFam + outFam) * 0.5) + 0.35 * minFam;
  const roleMean = (inRoleQuality + outRoleQuality) * 0.5;

  const raw = player.fullProfile
    ? 0.46 * posScore +
      0.26 * roleMean +
      0.18 * player.ability +
      0.1 * player.overallAttributes
    : 0.55 * posScore + 0.35 * roleMean + 0.1 * player.ability;

  const outOfPositionPenalty = 1.5 * Math.max(0, 14 - minFam);
  const slotIsGk = inSlot === "GK";
  const gkMismatchPenalty = slotIsGk !== player.isGoalkeeper ? 1000 : 0;

  return 5 * raw - outOfPositionPenalty - gkMismatchPenalty;
}

/**
 * Checks whether a user `LineupPreference` forbids placing `player` into `(inSlot, outSlot, inRoleId, outRoleId)`.
 */
export function satisfiesLineupLock(
  preference: LineupPreference | undefined,
  inSlot: string,
  outSlot: string,
  inRoleId?: string,
  outRoleId?: string,
): boolean {
  if (!preference) return true;
  if (preference.lockedInSlot && preference.lockedInSlot !== inSlot) return false;
  if (preference.lockedOutSlot && preference.lockedOutSlot !== outSlot) return false;
  if (preference.lockedInRole && inRoleId && preference.lockedInRole !== inRoleId) return false;
  if (preference.lockedOutRole && outRoleId && preference.lockedOutRole !== outRoleId) {
    return false;
  }
  return true;
}
