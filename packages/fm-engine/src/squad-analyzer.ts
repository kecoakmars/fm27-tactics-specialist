import { getPitchCatalog, getRoleProfiles, getTacticalStyles } from "@fm27/fm-data";
import type {
  DualPhaseTactic,
  DualShape,
  LineupPreference,
  Player,
  SlotAssignment,
  TacticalPriorities,
  TacticalStyle,
  TacticPlanResult,
} from "@fm27/shared-types";
import {
  reviewCoachingKnowledge,
  scoreInstructionDemands,
  type CoachingUnitStarter,
} from "./coaching-review.js";
import { computeSlotFit, satisfiesLineupLock } from "./fit-calculator.js";
import { detectFormation } from "./formation-detector.js";
import {
  buildAssignmentMatrix,
  computePlayerStyleRating,
  solveHungarianMax,
} from "./hungarian.js";
import {
  getWeightedTacticalStyles,
  planTeamInstructions,
  recommendPlayerInstructions,
  resolveTeamInstructionConflicts,
} from "./instruction-planner.js";
import { refineAssignment, type MutableSlotState } from "./local-refiner.js";
import {
  normalizeAndValidateSquad,
  type NormalizedPlayerProfile,
} from "./normalizer.js";
import {
  getCandidateRolesForSlot,
  inferDutyForRole,
  scoreSingleRoleQuality,
  selectBestRole,
} from "./role-evaluator.js";

export interface SquadAnalysisOptions {
  styleId?: string;
  priorities?: TacticalPriorities;
  lineupPreferences?: readonly LineupPreference[];
  patchVersion?: string;
}

function computeBenchCoverFit(params: {
  slotStates: readonly MutableSlotState[];
  players: readonly NormalizedPlayerProfile[];
  inSlots: readonly string[];
  outSlots: readonly string[];
  styleAttrSet: ReadonlySet<string>;
  patchVersion: string;
}): number {
  const starterSet = new Set(params.slotStates.map((s) => s.playerIndex));
  const benchPlayers = params.players.filter((_, idx) => !starterSet.has(idx));
  if (benchPlayers.length === 0) {
    return (
      params.slotStates.reduce((acc, s) => acc + s.fit, 0) / params.slotStates.length
    );
  }

  const slotCovers: number[] = [];
  for (let sIdx = 0; sIdx < params.slotStates.length; sIdx++) {
    const inSlot = params.inSlots[sIdx]!;
    const outSlot = params.outSlots[sIdx]!;
    const inCandidates = getCandidateRolesForSlot(inSlot, 0, params.inSlots, params.patchVersion);
    const outCandidates = getCandidateRolesForSlot(
      outSlot,
      1,
      params.outSlots,
      params.patchVersion,
    );

    let bestCover = 0;
    for (const bp of benchPlayers) {
      if ((inSlot === "GK") !== bp.isGoalkeeper) continue;
      const bIn = selectBestRole(bp, inSlot, inCandidates, params.styleAttrSet, params.patchVersion);
      const bOut = selectBestRole(
        bp,
        outSlot,
        outCandidates,
        params.styleAttrSet,
        params.patchVersion,
      );
      const fit = computeSlotFit(bp, inSlot, outSlot, bIn.roleQuality, bOut.roleQuality);
      if (fit > bestCover) bestCover = fit;
    }
    slotCovers.push(bestCover);
  }

  return slotCovers.reduce((a, b) => a + b, 0) / slotCovers.length;
}

function evaluateSingleShape(params: {
  shape: DualShape;
  players: readonly NormalizedPlayerProfile[];
  style?: TacticalStyle;
  priorities?: TacticalPriorities;
  combinedStyleAttributes: readonly string[];
  preferencesByUid: ReadonlyMap<number, LineupPreference>;
  patchVersion: string;
}): TacticPlanResult {
  const { shape, players, patchVersion } = params;
  const styleAttrSet = new Set(params.combinedStyleAttributes);
  const hasStyleOrPriorities = params.combinedStyleAttributes.length > 0;

  // Build candidate roles & best role/fit matrix (11 x N)
  const rawFits: (number | null)[][] = [];
  const chosenInRoles: (ReturnType<typeof selectBestRole> | null)[][] = [];
  const chosenOutRoles: (ReturnType<typeof selectBestRole> | null)[][] = [];

  for (let sIdx = 0; sIdx < 11; sIdx++) {
    const inSlot = shape.InSlots[sIdx]!;
    const outSlot = shape.OutSlots[sIdx]!;
    const inCandidates = getCandidateRolesForSlot(inSlot, 0, shape.InSlots, patchVersion);
    const outCandidates = getCandidateRolesForSlot(outSlot, 1, shape.OutSlots, patchVersion);

    const fitRow: (number | null)[] = [];
    const inRoleRow: (ReturnType<typeof selectBestRole> | null)[] = [];
    const outRoleRow: (ReturnType<typeof selectBestRole> | null)[] = [];

    for (const player of players) {
      const pref = params.preferencesByUid.get(player.uid);
      if (!satisfiesLineupLock(pref, inSlot, outSlot)) {
        fitRow.push(null);
        inRoleRow.push(null);
        outRoleRow.push(null);
        continue;
      }

      const filteredIn = pref?.lockedInRole
        ? inCandidates.filter((r) => r.Id === pref.lockedInRole)
        : inCandidates;
      const filteredOut = pref?.lockedOutRole
        ? outCandidates.filter((r) => r.Id === pref.lockedOutRole)
        : outCandidates;

      if (filteredIn.length === 0 || filteredOut.length === 0) {
        fitRow.push(null);
        inRoleRow.push(null);
        outRoleRow.push(null);
        continue;
      }

      const bestIn = selectBestRole(player, inSlot, filteredIn, styleAttrSet, patchVersion);
      const bestOut = selectBestRole(player, outSlot, filteredOut, styleAttrSet, patchVersion);
      const fit = computeSlotFit(
        player,
        inSlot,
        outSlot,
        bestIn.roleQuality,
        bestOut.roleQuality,
      );

      fitRow.push(fit);
      inRoleRow.push(bestIn);
      outRoleRow.push(bestOut);
    }

    rawFits.push(fitRow);
    chosenInRoles.push(inRoleRow);
    chosenOutRoles.push(outRoleRow);
  }

  // Global optimal Starting XI via Kuhn-Munkres (Hungarian)
  const matrix = buildAssignmentMatrix({
    inSlots: shape.InSlots,
    rawFits,
    players,
    styleAttributes: hasStyleOrPriorities ? params.combinedStyleAttributes : undefined,
    preferencesByUid: params.preferencesByUid,
  });

  const assignedIndices = solveHungarianMax(matrix);
  let slotStates: MutableSlotState[] = assignedIndices.map((pIdx, sIdx) => {
    const inSel = chosenInRoles[sIdx]?.[pIdx];
    const outSel = chosenOutRoles[sIdx]?.[pIdx];
    const fit = rawFits[sIdx]?.[pIdx] ?? -1000;
    if (!inSel || !outSel) {
      const player = players[pIdx]!;
      const fallbackIn = selectBestRole(
        player,
        shape.InSlots[sIdx]!,
        getCandidateRolesForSlot(shape.InSlots[sIdx]!, 0, shape.InSlots, patchVersion),
        styleAttrSet,
        patchVersion,
      );
      const fallbackOut = selectBestRole(
        player,
        shape.OutSlots[sIdx]!,
        getCandidateRolesForSlot(shape.OutSlots[sIdx]!, 1, shape.OutSlots, patchVersion),
        styleAttrSet,
        patchVersion,
      );
      return {
        slotIndex: sIdx,
        inSlot: shape.InSlots[sIdx]!,
        outSlot: shape.OutSlots[sIdx]!,
        playerIndex: pIdx,
        inRole: fallbackIn.role,
        outRole: fallbackOut.role,
        inRoleQuality: fallbackIn.roleQuality,
        outRoleQuality: fallbackOut.roleQuality,
        fit: computeSlotFit(
          player,
          shape.InSlots[sIdx]!,
          shape.OutSlots[sIdx]!,
          fallbackIn.roleQuality,
          fallbackOut.roleQuality,
        ),
      };
    }

    return {
      slotIndex: sIdx,
      inSlot: shape.InSlots[sIdx]!,
      outSlot: shape.OutSlots[sIdx]!,
      playerIndex: pIdx,
      inRole: inSel.role,
      outRole: outSel.role,
      inRoleQuality: inSel.roleQuality,
      outRoleQuality: outSel.roleQuality,
      fit,
    };
  });

  const initialStarters: CoachingUnitStarter[] = slotStates.map((s) => ({
    player: players[s.playerIndex]!,
    inSlot: s.inSlot,
    outSlot: s.outSlot,
    inRoleId: s.inRole.Id,
    outRoleId: s.outRole.Id,
  }));

  const planned = planTeamInstructions({
    starters: initialStarters,
    highPress: shape.HighPress || Boolean(params.style?.HighPress),
    style: params.style,
    priorities: params.priorities,
    patchVersion,
  });

  // Local Coaching-Aware Refinement when style/priorities active
  if (hasStyleOrPriorities) {
    slotStates = refineAssignment({
      initialStates: slotStates,
      players,
      inSlots: shape.InSlots,
      outSlots: shape.OutSlots,
      teamInstructions: planned.teamInstructions,
      highPress: shape.HighPress || Boolean(params.style?.HighPress),
      styleAttributes: params.combinedStyleAttributes,
      preferencesByUid: params.preferencesByUid,
      patchVersion,
    });
  }

  const finalStarters: CoachingUnitStarter[] = slotStates.map((s) => ({
    player: players[s.playerIndex]!,
    inSlot: s.inSlot,
    outSlot: s.outSlot,
    inRoleId: s.inRole.Id,
    outRoleId: s.outRole.Id,
  }));

  const finalPlanned = planTeamInstructions({
    starters: finalStarters,
    highPress: shape.HighPress || Boolean(params.style?.HighPress),
    style: params.style,
    priorities: params.priorities,
    patchVersion,
  });

  const coaching = reviewCoachingKnowledge({
    starters: finalStarters,
    inSlots: shape.InSlots,
    outSlots: shape.OutSlots,
    teamInstructions: finalPlanned.teamInstructions,
    styleName: params.style?.Name,
    highPress: shape.HighPress || Boolean(params.style?.HighPress),
    finalize: true,
    patchVersion,
  });

  const { instructionPenalty, pressCost } = scoreInstructionDemands(
    coaching.adjustedTeamInstructions,
    finalStarters,
    shape.HighPress || Boolean(params.style?.HighPress),
  );

  const startingFit =
    slotStates.reduce((acc, s) => acc + s.fit, 0) / slotStates.length;
  const coverFit = computeBenchCoverFit({
    slotStates,
    players,
    inSlots: shape.InSlots,
    outSlots: shape.OutSlots,
    styleAttrSet,
    patchVersion,
  });

  const squadFit = 0.94 * startingFit + 0.06 * coverFit - pressCost;

  const outfieldStarters = slotStates.filter((s) => s.inSlot !== "GK");
  const styleFit = hasStyleOrPriorities
    ? outfieldStarters.reduce(
        (acc, s) =>
          acc +
          computePlayerStyleRating(
            players[s.playerIndex]!,
            params.combinedStyleAttributes,
          ),
        0,
      ) / outfieldStarters.length
    : null;

  const rankingFit =
    styleFit !== null
      ? 0.9 * squadFit + 0.1 * styleFit + coaching.coachingAdjustment - instructionPenalty
      : squadFit;

  const slots: SlotAssignment[] = slotStates.map((s, idx) => {
    const p = players[s.playerIndex]!;
    return {
      slotIndex: idx,
      playerUid: p.uid,
      playerName: p.name,
      inPossession: {
        positionId: s.inSlot,
        roleId: s.inRole.Id,
        duty: inferDutyForRole(s.inRole.Id, 0),
        playerInstructionBits: recommendPlayerInstructions(
          p,
          0,
          s.inSlot,
          s.inRole.Id,
          patchVersion,
        ),
        markingPositionMask: 0,
      },
      outOfPossession: {
        positionId: s.outSlot,
        roleId: s.outRole.Id,
        duty: "Defend",
        playerInstructionBits: recommendPlayerInstructions(
          p,
          1,
          s.outSlot,
          s.outRole.Id,
          patchVersion,
        ),
        markingPositionMask: 0,
      },
    };
  });

  const styleLabel = params.style?.Name ?? "Auto";
  const tactic: DualPhaseTactic = {
    title: `${styleLabel} ${shape.InPossessionName} -> ${shape.OutOfPossessionName}`,
    description: `Generated deterministic FM27 dual-phase tactic (${shape.InPossessionName} IP / ${shape.OutOfPossessionName} OOP).`,
    author: "FM27 Engine",
    patchVersion,
    ...(params.style ? { styleId: params.style.Id } : {}),
    mentality: finalPlanned.mentality,
    inFormation: detectFormation(shape.InSlots, { patchVersion }),
    outFormation: detectFormation(shape.OutSlots, { patchVersion }),
    teamInstructions: resolveTeamInstructionConflicts(coaching.adjustedTeamInstructions),
    slots,
  };

  return {
    tactic,
    startingFit: Math.round(startingFit * 100) / 100,
    coverFit: Math.round(coverFit * 100) / 100,
    squadFit: Math.round(squadFit * 100) / 100,
    styleFit: styleFit !== null ? Math.round(styleFit * 100) / 100 : null,
    coachingAdjustment: Math.round(coaching.coachingAdjustment * 100) / 100,
    instructionPenalty: Math.round(instructionPenalty * 100) / 100,
    rankingFit: Math.round(rankingFit * 100) / 100,
    nearTieWithNext: false,
    findings: coaching.findings,
  };
}

/**
 * Full SquadAnalysis.Analyze orchestrator evaluating 8 default Shapes (pure auto) or
 * 16 StyleShapes (with TacticalStyle / TacticalPriorities), sorting descending by `rankingFit`,
 * and marking `nearTieWithNext` when `#1 - #2 < 0.1`.
 */
export function analyzeSquadAndGenerateTactics(
  squadPlayers: ReadonlyArray<
    | Player
    | {
        uid: number;
        name: string;
        clubUid?: number;
        clubName?: string;
        age?: number;
        nationality?: string;
        rawNumbers: Record<string, number | undefined>;
      }
  >,
  options: SquadAnalysisOptions = {},
): TacticPlanResult[] {
  const patchVersion = options.patchVersion ?? "27.0";
  const normalizedPlayers = normalizeAndValidateSquad(
    squadPlayers,
    options.lineupPreferences ?? [],
    patchVersion,
  );

  const stylesCatalog = getTacticalStyles(patchVersion);
  const style = options.styleId
    ? stylesCatalog.TacticalStyles.find(
        (s) =>
          s.Id.toLowerCase() === options.styleId!.toLowerCase() ||
          s.Name.toLowerCase() === options.styleId!.toLowerCase(),
      )
    : undefined;

  const weightedPriorities = options.priorities?.selectedStyleIds.length
    ? getWeightedTacticalStyles(options.priorities.selectedStyleIds, patchVersion)
    : [];

  const combinedAttrSet = new Set<string>(style?.Attributes ?? []);
  for (const { style: ws } of weightedPriorities) {
    for (const a of ws.Attributes) combinedAttrSet.add(a);
  }
  const combinedStyleAttributes = Array.from(combinedAttrSet);

  const candidateShapes =
    style || weightedPriorities.length > 0
      ? style
        ? stylesCatalog.StyleShapes.filter((sh) => style.Allows.includes(sh.Id))
        : stylesCatalog.StyleShapes
      : stylesCatalog.Shapes;

  const shapesToRun = candidateShapes.length > 0 ? candidateShapes : stylesCatalog.Shapes;

  const preferencesByUid = new Map<number, LineupPreference>();
  for (const pref of options.lineupPreferences ?? []) {
    preferencesByUid.set(pref.playerUid, pref);
  }

  const results = shapesToRun
    .map((shape) =>
      evaluateSingleShape({
        shape,
        players: normalizedPlayers,
        style,
        priorities: options.priorities,
        combinedStyleAttributes,
        preferencesByUid,
        patchVersion,
      }),
    )
    .sort((a, b) => b.rankingFit - a.rankingFit);

  if (results.length >= 2 && results[0]!.rankingFit - results[1]!.rankingFit < 0.1) {
    results[0]!.nearTieWithNext = true;
  }

  return results;
}

/**
 * Grades an imported `.fmf` / manual `DualPhaseTactic` against a squad using FixedRoleFit + Hungarian,
 * and optionally runs up to 3 steepest-ascent hill-climbing rounds (`> 0.12` gain threshold).
 */
export function gradeImportedTactic(
  tactic: DualPhaseTactic,
  squadPlayers: ReadonlyArray<Player>,
  options?: { improve?: boolean; patchVersion?: string },
): TacticPlanResult {
  const patchVersion = options?.patchVersion ?? tactic.patchVersion ?? "27.0";
  const normalized = normalizeAndValidateSquad(squadPlayers, [], patchVersion);
  const rp = getRoleProfiles(patchVersion);
  const profileById = new Map(rp.Roles.map((r) => [r.Id, r]));
  const specialistSet = new Set(rp.SpecialistRoles);
  const catalog = getPitchCatalog(patchVersion);

  const measure = (candidate: DualPhaseTactic): TacticPlanResult => {
    const inSlots = candidate.slots.map((s) => s.inPossession.positionId);
    const outSlots = candidate.slots.map((s) => s.outOfPossession.positionId);

    const rawFits: number[][] = candidate.slots.map((slot) => {
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

    const assigned = solveHungarianMax(rawFits);
    const starters: CoachingUnitStarter[] = assigned.map((pIdx, sIdx) => ({
      player: normalized[pIdx]!,
      inSlot: inSlots[sIdx]!,
      outSlot: outSlots[sIdx]!,
      inRoleId: candidate.slots[sIdx]!.inPossession.roleId,
      outRoleId: candidate.slots[sIdx]!.outOfPossession.roleId,
    }));

    const startingFit =
      assigned.reduce((acc, pIdx, sIdx) => acc + (rawFits[sIdx]?.[pIdx] ?? 0), 0) / 11;

    const highPress = (candidate.teamInstructions.LineOfEngagement ?? 62) === 61;
    const coaching = reviewCoachingKnowledge({
      starters,
      inSlots,
      outSlots,
      teamInstructions: candidate.teamInstructions,
      highPress,
      finalize: false,
      patchVersion,
    });

    const { instructionPenalty, pressCost } = scoreInstructionDemands(
      candidate.teamInstructions,
      starters,
      highPress,
    );
    const squadFit = startingFit - pressCost;
    const rankingFit = squadFit + coaching.coachingAdjustment - instructionPenalty;

    const assignedTactic: DualPhaseTactic = {
      ...candidate,
      slots: candidate.slots.map((slot, sIdx) => {
        const p = normalized[assigned[sIdx]!]!;
        return {
          ...slot,
          playerUid: p.uid,
          playerName: p.name,
        };
      }),
    };

    return {
      tactic: assignedTactic,
      startingFit: Math.round(startingFit * 100) / 100,
      coverFit: Math.round(startingFit * 100) / 100,
      squadFit: Math.round(squadFit * 100) / 100,
      styleFit: null,
      coachingAdjustment: Math.round(coaching.coachingAdjustment * 100) / 100,
      instructionPenalty: Math.round(instructionPenalty * 100) / 100,
      rankingFit: Math.round(rankingFit * 100) / 100,
      nearTieWithNext: false,
      findings: coaching.findings,
    };
  };

  let bestResult = measure(tactic);
  if (!options?.improve) return bestResult;

  // Up to 3 rounds of Steepest-Ascent Hill Climbing (> 0.12 net gain gate)
  let currentTactic = bestResult.tactic;
  for (let round = 0; round < 3; round++) {
    let roundBest: TacticPlanResult | null = null;
    const inSlots = currentTactic.slots.map((s) => s.inPossession.positionId);
    const outSlots = currentTactic.slots.map((s) => s.outOfPossession.positionId);

    for (let sIdx = 0; sIdx < 11; sIdx++) {
      const slot = currentTactic.slots[sIdx]!;
      const ipAlts = getCandidateRolesForSlot(
        slot.inPossession.positionId,
        0,
        inSlots,
        patchVersion,
      );
      for (const altRole of ipAlts) {
        if (altRole.Id === slot.inPossession.roleId) continue;
        const neighbor: DualPhaseTactic = {
          ...currentTactic,
          slots: currentTactic.slots.map((s, idx) =>
            idx === sIdx
              ? {
                  ...s,
                  inPossession: {
                    ...s.inPossession,
                    roleId: altRole.Id,
                    duty: inferDutyForRole(altRole.Id, 0),
                  },
                }
              : s,
          ),
        };
        const res = measure(neighbor);
        if (res.rankingFit > (roundBest?.rankingFit ?? bestResult.rankingFit) + 0.12) {
          roundBest = res;
        }
      }

      const oopAlts = getCandidateRolesForSlot(
        slot.outOfPossession.positionId,
        1,
        outSlots,
        patchVersion,
      );
      for (const altRole of oopAlts) {
        if (altRole.Id === slot.outOfPossession.roleId) continue;
        const neighbor: DualPhaseTactic = {
          ...currentTactic,
          slots: currentTactic.slots.map((s, idx) =>
            idx === sIdx
              ? {
                  ...s,
                  outOfPossession: { ...s.outOfPossession, roleId: altRole.Id },
                }
              : s,
          ),
        };
        const res = measure(neighbor);
        if (res.rankingFit > (roundBest?.rankingFit ?? bestResult.rankingFit) + 0.12) {
          roundBest = res;
        }
      }
    }

    for (const grp of catalog.Instructions.slice(0, 8)) {
      for (const opt of grp.Options) {
        if ((currentTactic.teamInstructions[grp.Group] ?? 0) === opt.Bit) continue;
        const nextTi = resolveTeamInstructionConflicts(
          { ...currentTactic.teamInstructions, [grp.Group]: opt.Bit },
          catalog,
        );
        const neighbor: DualPhaseTactic = { ...currentTactic, teamInstructions: nextTi };
        const res = measure(neighbor);
        if (res.rankingFit > (roundBest?.rankingFit ?? bestResult.rankingFit) + 0.12) {
          roundBest = res;
        }
      }
    }

    if (!roundBest) break;
    bestResult = roundBest;
    currentTactic = roundBest.tactic;
  }

  return bestResult;
}
