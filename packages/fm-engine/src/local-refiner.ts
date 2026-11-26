import { getRoleProfiles } from "@fm27/fm-data";
import type { LineupPreference, RoleProfileEntry } from "@fm27/shared-types";
import {
  reviewCoachingKnowledge,
  scoreInstructionDemands,
  type CoachingUnitStarter,
} from "./coaching-review.js";
import { computeSlotFit, satisfiesLineupLock } from "./fit-calculator.js";
import { computeCentralPairFootBias, computePlayerStyleRating } from "./hungarian.js";
import type { NormalizedPlayerProfile } from "./normalizer.js";
import {
  getSolverCandidateRolesForSlot,
  isOopOutletRole,
  scoreSingleRoleQuality,
  selectBestRole,
} from "./role-evaluator.js";

export interface MutableSlotState {
  slotIndex: number;
  inSlot: string;
  outSlot: string;
  playerIndex: number;
  inRole: RoleProfileEntry;
  outRole: RoleProfileEntry;
  inRoleQuality: number;
  outRoleQuality: number;
  fit: number;
}

/**
 * Evaluates the local refinement objective J (0x06000F55):
 * `J = 0.846 * mean(Fit_XI) + 0.10 * mean(StyleRating_Outfield) + CoachingReview(finalize: false)`
 */
export function evaluateRefinementObjective(params: {
  slotStates: readonly MutableSlotState[];
  players: readonly NormalizedPlayerProfile[];
  inSlots: readonly string[];
  outSlots: readonly string[];
  teamInstructions: Readonly<Record<string, number>>;
  highPress: boolean;
  styleAttributes?: readonly string[];
  patchVersion?: string;
}): number {
  const meanFit =
    params.slotStates.reduce((acc, s) => acc + s.fit, 0) / params.slotStates.length;

  const outfieldStates = params.slotStates.filter((s) => s.inSlot !== "GK");
  const meanStyleRating =
    outfieldStates.length > 0
      ? outfieldStates.reduce(
          (acc, s) =>
            acc +
            computePlayerStyleRating(
              params.players[s.playerIndex]!,
              params.styleAttributes,
            ),
          0,
        ) / outfieldStates.length
      : 0;

  const starters: CoachingUnitStarter[] = params.slotStates.map((s) => ({
    player: params.players[s.playerIndex]!,
    inSlot: s.inSlot,
    outSlot: s.outSlot,
    inRoleId: s.inRole.Id,
    outRoleId: s.outRole.Id,
  }));

  const review = reviewCoachingKnowledge({
    starters,
    inSlots: params.inSlots,
    outSlots: params.outSlots,
    teamInstructions: params.teamInstructions,
    highPress: params.highPress,
    finalize: false,
    patchVersion: params.patchVersion,
  });

  const { instructionPenalty, pressCost } = scoreInstructionDemands(
    params.teamInstructions,
    starters,
    params.highPress,
  );

  const meanStarterAbility =
    outfieldStates.length > 0
      ? outfieldStates.reduce(
          (acc, s) => acc + params.players[s.playerIndex]!.ability,
          0,
        ) / outfieldStates.length
      : 0;

  const meanFootSideBias =
    outfieldStates.length > 0
      ? outfieldStates.reduce(
          (acc, s) =>
            acc + computeCentralPairFootBias(s.inSlot, params.players[s.playerIndex]!),
          0,
        ) / outfieldStates.length
      : 0;

  return (
    0.846 * (meanFit - pressCost) +
    0.1 * meanStyleRating +
    0.25 * meanStarterAbility +
    meanFootSideBias +
    review.coachingAdjustment -
    instructionPenalty
  );
}

/**
 * Local Coaching-Aware Refinement (SquadAnalysis.Refine, RVA 0x026AE4):
 * 1) Tests single bench substitution (-12 Fit gate) & pairwise outfield swap (-18 Fit gate)
 * 2) Greedily optimizes IP & OOP roles across all 11 starters against J
 */
export function refineAssignment(params: {
  initialStates: readonly MutableSlotState[];
  players: readonly NormalizedPlayerProfile[];
  inSlots: readonly string[];
  outSlots: readonly string[];
  teamInstructions: Readonly<Record<string, number>>;
  highPress: boolean;
  styleId?: string;
  preferredRoles?: readonly string[];
  styleAttributes?: readonly string[];
  preferencesByUid?: ReadonlyMap<number, LineupPreference>;
  patchVersion?: string;
}): MutableSlotState[] {
  const patchVersion = params.patchVersion ?? "27.0";
  const rp = getRoleProfiles(patchVersion);
  const specialistSet = new Set(rp.SpecialistRoles);
  const styleAttrSet = new Set(params.styleAttributes ?? []);
  const preferredRoleSet = new Set(params.preferredRoles ?? []);

  const states = params.initialStates.map((s) => ({ ...s }));
  const starterIndices = new Set(states.map((s) => s.playerIndex));
  const benchIndices = params.players
    .map((_, idx) => idx)
    .filter((idx) => !starterIndices.has(idx));

  const buildStateForPlayer = (slotIdx: number, playerIdx: number): MutableSlotState | null => {
    const player = params.players[playerIdx]!;
    const inSlot = params.inSlots[slotIdx]!;
    const outSlot = params.outSlots[slotIdx]!;
    const pref = params.preferencesByUid?.get(player.uid);
    if (!satisfiesLineupLock(pref, inSlot, outSlot)) return null;

    const inCandidates = getSolverCandidateRolesForSlot(inSlot, 0, params.inSlots, {
      styleId: params.styleId,
      preferredRoles: params.preferredRoles,
      highPress: params.highPress,
      player,
      patchVersion,
    });
    const outCandidates = getSolverCandidateRolesForSlot(outSlot, 1, params.outSlots, {
      styleId: params.styleId,
      preferredRoles: params.preferredRoles,
      highPress: params.highPress,
      player,
      patchVersion,
    });
    if (inCandidates.length === 0 || outCandidates.length === 0) return null;

    const bestIn = selectBestRole(
      player,
      inSlot,
      inCandidates,
      styleAttrSet,
      patchVersion,
      preferredRoleSet,
    );
    const bestOut = selectBestRole(
      player,
      outSlot,
      outCandidates,
      styleAttrSet,
      patchVersion,
      preferredRoleSet,
    );
    const fit = computeSlotFit(
      player,
      inSlot,
      outSlot,
      bestIn.roleQuality,
      bestOut.roleQuality,
    );

    return {
      slotIndex: slotIdx,
      inSlot,
      outSlot,
      playerIndex: playerIdx,
      inRole: bestIn.role,
      outRole: bestOut.role,
      inRoleQuality: bestIn.roleQuality,
      outRoleQuality: bestOut.roleQuality,
      fit,
    };
  };

  let currentJ = evaluateRefinementObjective({
    slotStates: states,
    players: params.players,
    inSlots: params.inSlots,
    outSlots: params.outSlots,
    teamInstructions: params.teamInstructions,
    highPress: params.highPress,
    styleAttributes: params.styleAttributes,
    patchVersion,
  });

  // Step 1: Best single bench substitution or starter pair swap
  let bestCandidateStates: MutableSlotState[] | null = null;
  let bestCandidateJ = currentJ;

  for (let sIdx = 0; sIdx < states.length; sIdx++) {
    const currentSlot = states[sIdx]!;
    if (currentSlot.inSlot === "GK") continue;
    const starterPlayer = params.players[currentSlot.playerIndex]!;
    if (params.preferencesByUid?.get(starterPlayer.uid)?.mustStart) continue;

    // Top 2 bench candidates for this slot within -12.0 Fit gate
    const benchCandidates = benchIndices
      .map((bIdx) => buildStateForPlayer(sIdx, bIdx))
      .filter((st): st is MutableSlotState => st !== null && st.fit >= currentSlot.fit - 12.0)
      .sort((a, b) => b.fit - a.fit)
      .slice(0, 2);

    for (const benchState of benchCandidates) {
      const trial = states.map((s, idx) => (idx === sIdx ? benchState : s));
      const j = evaluateRefinementObjective({
        slotStates: trial,
        players: params.players,
        inSlots: params.inSlots,
        outSlots: params.outSlots,
        teamInstructions: params.teamInstructions,
        highPress: params.highPress,
        styleAttributes: params.styleAttributes,
        patchVersion,
      });
      if (j > bestCandidateJ + 0.0001) {
        bestCandidateJ = j;
        bestCandidateStates = trial;
      }
    }
  }

  // Pairwise outfield starter swaps within -18.0 combined Fit gate
  for (let i = 0; i < states.length; i++) {
    if (states[i]!.inSlot === "GK") continue;
    for (let k = i + 1; k < states.length; k++) {
      if (states[k]!.inSlot === "GK") continue;
      const swappedI = buildStateForPlayer(i, states[k]!.playerIndex);
      const swappedK = buildStateForPlayer(k, states[i]!.playerIndex);
      if (!swappedI || !swappedK) continue;

      if (swappedI.fit + swappedK.fit < states[i]!.fit + states[k]!.fit - 18.0) continue;

      const trial = states.map((s, idx) => {
        if (idx === i) return swappedI;
        if (idx === k) return swappedK;
        return s;
      });
      const j = evaluateRefinementObjective({
        slotStates: trial,
        players: params.players,
        inSlots: params.inSlots,
        outSlots: params.outSlots,
        teamInstructions: params.teamInstructions,
        highPress: params.highPress,
        styleAttributes: params.styleAttributes,
        patchVersion,
      });
      if (j > bestCandidateJ + 0.0001) {
        bestCandidateJ = j;
        bestCandidateStates = trial;
      }
    }
  }

  if (bestCandidateStates) {
    for (let i = 0; i < states.length; i++) {
      states[i] = bestCandidateStates[i]!;
    }
    currentJ = bestCandidateJ;
  }

  // Step 2: Greedy Role Re-Optimization across IP (phase 0) then OOP (phase 1)
  for (const phase of [0, 1] as const) {
    for (let sIdx = 0; sIdx < states.length; sIdx++) {
      const slot = states[sIdx]!;
      const player = params.players[slot.playerIndex]!;
      const pref = params.preferencesByUid?.get(player.uid);
      if (phase === 0 && pref?.lockedInRole) continue;
      if (phase === 1 && pref?.lockedOutRole) continue;

      const posId = phase === 0 ? slot.inSlot : slot.outSlot;
      const shapeArr = phase === 0 ? params.inSlots : params.outSlots;
      const candidates = getSolverCandidateRolesForSlot(posId, phase, shapeArr, {
        styleId: params.styleId,
        preferredRoles: params.preferredRoles,
        highPress: params.highPress,
        player,
        patchVersion,
      });

      for (const candidateRole of candidates) {
        if (phase === 0 && candidateRole.Id === slot.inRole.Id) continue;
        if (phase === 1 && candidateRole.Id === slot.outRole.Id) continue;
        if (phase === 1 && isOopOutletRole(candidateRole.Id)) {
          const otherOutlets = states.filter(
            (st, idx) => idx !== sIdx && isOopOutletRole(st.outRole.Id),
          ).length;
          if (otherOutlets >= 1) continue;
        }

        const newQ = scoreSingleRoleQuality(player, posId, candidateRole, specialistSet);
        const nextInQ = phase === 0 ? newQ : slot.inRoleQuality;
        const nextOutQ = phase === 1 ? newQ : slot.outRoleQuality;
        const nextFit = computeSlotFit(player, slot.inSlot, slot.outSlot, nextInQ, nextOutQ);

        const updatedSlot: MutableSlotState = {
          ...slot,
          inRole: phase === 0 ? candidateRole : slot.inRole,
          outRole: phase === 1 ? candidateRole : slot.outRole,
          inRoleQuality: nextInQ,
          outRoleQuality: nextOutQ,
          fit: nextFit,
        };

        const trial = states.map((s, idx) => (idx === sIdx ? updatedSlot : s));
        const j = evaluateRefinementObjective({
          slotStates: trial,
          players: params.players,
          inSlots: params.inSlots,
          outSlots: params.outSlots,
          teamInstructions: params.teamInstructions,
          highPress: params.highPress,
          styleAttributes: params.styleAttributes,
          patchVersion,
        });

        if (j > currentJ + 0.0001) {
          states[sIdx] = updatedSlot;
          currentJ = j;
        }
      }
    }
  }

  return states;
}
