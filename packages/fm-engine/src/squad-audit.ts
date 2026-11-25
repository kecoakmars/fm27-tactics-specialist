import { getRoleProfiles } from "@fm27/fm-data";
import type {
  AttributeName,
  DualPhaseTactic,
  Player,
  SlotAuditItem,
  SquadAuditResult,
} from "@fm27/shared-types";
import { computeSlotFit } from "./fit-calculator.js";
import { solveHungarianMax } from "./hungarian.js";
import {
  getPlayerAttribute,
  normalizeAndValidateSquad,
} from "./normalizer.js";
import {
  getCandidateRolesForSlot,
  scoreSingleRoleQuality,
} from "./role-evaluator.js";

/**
 * Audits an active `DualPhaseTactic` against `squadPlayers`, highlighting Role Fit per starter,
 * the 3 weakest positions, key attribute gaps, internal replacements, and better role options.
 */
export function auditSquadAgainstTactic(
  tactic: DualPhaseTactic,
  squadPlayers: readonly Player[],
): SquadAuditResult {
  const patchVersion = tactic.patchVersion || "27.0";
  const normalized = normalizeAndValidateSquad(squadPlayers, [], patchVersion);
  const rp = getRoleProfiles(patchVersion);
  const profileById = new Map(rp.Roles.map((r) => [r.Id, r]));
  const specialistSet = new Set(rp.SpecialistRoles);

  const inSlots = tactic.slots.map((s) => s.inPossession.positionId);
  const outSlots = tactic.slots.map((s) => s.outOfPossession.positionId);

  // Use explicit playerUid assignments if all 11 starters are uniquely assigned; otherwise solve via Hungarian
  const byUid = new Map(normalized.map((p, idx) => [p.uid, idx]));
  const explicitIndices = tactic.slots
    .map((s) => (s.playerUid !== undefined ? byUid.get(s.playerUid) : undefined))
    .filter((idx): idx is number => idx !== undefined);

  let starterPlayerIndices: number[];
  if (new Set(explicitIndices).size === 11) {
    starterPlayerIndices = explicitIndices;
  } else {
    const fitMatrix = tactic.slots.map((slot) => {
      const inRole = profileById.get(slot.inPossession.roleId) ?? rp.Roles[0]!;
      const outRole = profileById.get(slot.outOfPossession.roleId) ?? rp.Roles[0]!;
      return normalized.map((p) => {
        const inQ = scoreSingleRoleQuality(p, slot.inPossession.positionId, inRole, specialistSet);
        const outQ = scoreSingleRoleQuality(
          p,
          slot.outOfPossession.positionId,
          outRole,
          specialistSet,
        );
        return computeSlotFit(
          p,
          slot.inPossession.positionId,
          slot.outOfPossession.positionId,
          inQ,
          outQ,
        );
      });
    });
    starterPlayerIndices = solveHungarianMax(fitMatrix);
  }

  const starterIdxSet = new Set(starterPlayerIndices);
  const benchPlayers = normalized.filter((_, idx) => !starterIdxSet.has(idx));

  const deficitCounter = new Map<AttributeName, number>();
  const starterAudits: SlotAuditItem[] = tactic.slots.map((slot, sIdx) => {
    const player = normalized[starterPlayerIndices[sIdx]!]!;
    const inPos = slot.inPossession.positionId;
    const outPos = slot.outOfPossession.positionId;
    const inRole = profileById.get(slot.inPossession.roleId) ?? rp.Roles[0]!;
    const outRole = profileById.get(slot.outOfPossession.roleId) ?? rp.Roles[0]!;

    const inQ = scoreSingleRoleQuality(player, inPos, inRole, specialistSet);
    const outQ = scoreSingleRoleQuality(player, outPos, outRole, specialistSet);
    const fitScore = Math.round(computeSlotFit(player, inPos, outPos, inQ, outQ) * 100) / 100;

    // Identify key attribute gaps (< 14 target)
    const combinedKeys = Array.from(new Set([...inRole.Keys, ...outRole.Keys])) as AttributeName[];
    const keyAttributeGaps = combinedKeys
      .map((attr) => {
        const val = Math.round(getPlayerAttribute(player, attr) * 10) / 10;
        const target = 14;
        if (val < target) {
          deficitCounter.set(attr, (deficitCounter.get(attr) ?? 0) + (target - val));
        }
        return { attribute: attr, value: val, target };
      })
      .filter((g) => g.value < g.target)
      .sort((a, b) => a.value - b.value)
      .slice(0, 4);

    // Internal bench replacements that improve Fit
    const betterInternalReplacements = benchPlayers
      .map((bp) => {
        const bInQ = scoreSingleRoleQuality(bp, inPos, inRole, specialistSet);
        const bOutQ = scoreSingleRoleQuality(bp, outPos, outRole, specialistSet);
        const projectedFit =
          Math.round(computeSlotFit(bp, inPos, outPos, bInQ, bOutQ) * 100) / 100;
        return {
          playerUid: bp.uid,
          playerName: bp.name,
          projectedFit,
          fitGain: Math.round((projectedFit - fitScore) * 100) / 100,
        };
      })
      .filter((r) => r.fitGain > 0.2)
      .sort((a, b) => b.fitGain - a.fitGain)
      .slice(0, 3);

    // Better alternative roles for the current starter
    const betterRoleAlternatives: SlotAuditItem["betterRoleAlternatives"] = [];
    for (const altIn of getCandidateRolesForSlot(inPos, 0, inSlots, patchVersion)) {
      if (altIn.Id === inRole.Id) continue;
      const altInQ = scoreSingleRoleQuality(player, inPos, altIn, specialistSet);
      const proj = Math.round(computeSlotFit(player, inPos, outPos, altInQ, outQ) * 100) / 100;
      if (proj > fitScore + 0.3) {
        betterRoleAlternatives.push({ phase: "IP", roleId: altIn.Id, projectedFit: proj });
      }
    }
    for (const altOut of getCandidateRolesForSlot(outPos, 1, outSlots, patchVersion)) {
      if (altOut.Id === outRole.Id) continue;
      const altOutQ = scoreSingleRoleQuality(player, outPos, altOut, specialistSet);
      const proj = Math.round(computeSlotFit(player, inPos, outPos, inQ, altOutQ) * 100) / 100;
      if (proj > fitScore + 0.3) {
        betterRoleAlternatives.push({ phase: "OOP", roleId: altOut.Id, projectedFit: proj });
      }
    }
    betterRoleAlternatives.sort((a, b) => b.projectedFit - a.projectedFit);

    return {
      slotIndex: sIdx,
      playerUid: player.uid,
      playerName: player.name,
      inSlot: inPos,
      outSlot: outPos,
      inRoleId: inRole.Id,
      outRoleId: outRole.Id,
      fitScore,
      inRoleQuality: Math.round(inQ * 100) / 100,
      outRoleQuality: Math.round(outQ * 100) / 100,
      keyAttributeGaps,
      betterInternalReplacements,
      betterRoleAlternatives: betterRoleAlternatives.slice(0, 3),
    };
  });

  const overallSquadFit =
    Math.round((starterAudits.reduce((acc, a) => acc + a.fitScore, 0) / 11) * 100) / 100;

  const weakestThreeSlotIndices = [...starterAudits]
    .sort((a, b) => a.fitScore - b.fitScore)
    .slice(0, 3)
    .map((a) => a.slotIndex);

  const weakestTeamAttributes = [...deficitCounter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([attr]) => attr);

  return {
    overallSquadFit,
    starterAudits,
    weakestThreeSlotIndices,
    weakestTeamAttributes,
  };
}
