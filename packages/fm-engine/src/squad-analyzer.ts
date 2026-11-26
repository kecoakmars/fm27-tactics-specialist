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
  getSolverCandidateRolesForSlot,
  inferDutyForRole,
  isOopOutletRole,
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
  styleId?: string;
  preferredRoles?: readonly string[];
  highPress: boolean;
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

  const preferredRoleSet = new Set(params.preferredRoles ?? []);
  const benchGks = benchPlayers.filter((bp) => bp.isGoalkeeper);
  const benchOutfielders = benchPlayers.filter((bp) => !bp.isGoalkeeper);

  let gkCover = 45;
  const gkSlotIdx = params.inSlots.findIndex((s) => s === "GK");
  if (gkSlotIdx >= 0 && benchGks.length > 0) {
    const inSlot = params.inSlots[gkSlotIdx]!;
    const outSlot = params.outSlots[gkSlotIdx]!;
    let bestGk = 0;
    for (const bp of benchGks) {
      const inCandidates = getSolverCandidateRolesForSlot(inSlot, 0, params.inSlots, {
        styleId: params.styleId,
        preferredRoles: params.preferredRoles,
        highPress: params.highPress,
        player: bp,
        patchVersion: params.patchVersion,
      });
      const outCandidates = getSolverCandidateRolesForSlot(outSlot, 1, params.outSlots, {
        styleId: params.styleId,
        preferredRoles: params.preferredRoles,
        highPress: params.highPress,
        player: bp,
        patchVersion: params.patchVersion,
      });
      const bIn = selectBestRole(
        bp,
        inSlot,
        inCandidates,
        params.styleAttrSet,
        params.patchVersion,
        preferredRoleSet,
      );
      const bOut = selectBestRole(
        bp,
        outSlot,
        outCandidates,
        params.styleAttrSet,
        params.patchVersion,
        preferredRoleSet,
      );
      const fit = computeSlotFit(bp, inSlot, outSlot, bIn.roleQuality, bOut.roleQuality);
      if (fit > bestGk) bestGk = fit;
    }
    gkCover = bestGk;
  }

  // Evaluate unique 1-to-1 outfield bench cover (SetAssignment RVA 0x026EA8 — no cloning 1 player across 4 slots)
  const outfieldSlotIndices = params.inSlots
    .map((s, idx) => ({ s, idx }))
    .filter((x) => x.s !== "GK")
    .map((x) => x.idx);

  if (benchOutfielders.length === 0) {
    return (gkCover + 10 * 45) / 11;
  }

  const benchFitMatrix: number[][] = outfieldSlotIndices.map((sIdx) => {
    const inSlot = params.inSlots[sIdx]!;
    const outSlot = params.outSlots[sIdx]!;
    return benchOutfielders.map((bp) => {
      const inCandidates = getSolverCandidateRolesForSlot(inSlot, 0, params.inSlots, {
        styleId: params.styleId,
        preferredRoles: params.preferredRoles,
        highPress: params.highPress,
        player: bp,
        patchVersion: params.patchVersion,
      });
      const outCandidates = getSolverCandidateRolesForSlot(outSlot, 1, params.outSlots, {
        styleId: params.styleId,
        preferredRoles: params.preferredRoles,
        highPress: params.highPress,
        player: bp,
        patchVersion: params.patchVersion,
      });
      const bIn = selectBestRole(
        bp,
        inSlot,
        inCandidates,
        params.styleAttrSet,
        params.patchVersion,
        preferredRoleSet,
      );
      const bOut = selectBestRole(
        bp,
        outSlot,
        outCandidates,
        params.styleAttrSet,
        params.patchVersion,
        preferredRoleSet,
      );
      return Math.max(0, computeSlotFit(bp, inSlot, outSlot, bIn.roleQuality, bOut.roleQuality));
    });
  });

  let outfieldCoverSum = 0;
  if (benchOutfielders.length >= outfieldSlotIndices.length) {
    const assigned = solveHungarianMax(benchFitMatrix);
    for (let r = 0; r < outfieldSlotIndices.length; r++) {
      const bIdx = assigned[r]!;
      outfieldCoverSum += benchFitMatrix[r]?.[bIdx] ?? 45;
    }
  } else {
    // Fewer than 10 bench outfielders: assign each bench player to at most 1 slot first (optimal subset),
    // then score remaining uncovered slots conservatively (45.0) to reflect thin positional depth.
    const usedBench = new Set<number>();
    const usedRow = new Set<number>();
    while (usedBench.size < benchOutfielders.length && usedRow.size < outfieldSlotIndices.length) {
      let bestVal = -1;
      let bestR = -1;
      let bestB = -1;
      for (let r = 0; r < outfieldSlotIndices.length; r++) {
        if (usedRow.has(r)) continue;
        for (let b = 0; b < benchOutfielders.length; b++) {
          if (usedBench.has(b)) continue;
          const v = benchFitMatrix[r]![b]!;
          if (v > bestVal) {
            bestVal = v;
            bestR = r;
            bestB = b;
          }
        }
      }
      if (bestR < 0 || bestB < 0) break;
      usedRow.add(bestR);
      usedBench.add(bestB);
      outfieldCoverSum += bestVal;
    }
    const uncoveredCount = outfieldSlotIndices.length - usedRow.size;
    outfieldCoverSum += uncoveredCount * 45;
  }

  return (gkCover + outfieldCoverSum) / 11;
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
  const preferredRoleSet = new Set(params.style?.PreferredRoles ?? []);
  const hasStyleOrPriorities = params.combinedStyleAttributes.length > 0;
  const effectiveHighPress = shape.HighPress || Boolean(params.style?.HighPress);

  // Build candidate roles & best role/fit matrix (11 x N)
  const rawFits: (number | null)[][] = [];
  const chosenInRoles: (ReturnType<typeof selectBestRole> | null)[][] = [];
  const chosenOutRoles: (ReturnType<typeof selectBestRole> | null)[][] = [];

  for (let sIdx = 0; sIdx < 11; sIdx++) {
    const inSlot = shape.InSlots[sIdx]!;
    const outSlot = shape.OutSlots[sIdx]!;
    const allInCandidates = getCandidateRolesForSlot(inSlot, 0, shape.InSlots, patchVersion);
    const allOutCandidates = getCandidateRolesForSlot(outSlot, 1, shape.OutSlots, patchVersion);

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

      const solverIn = getSolverCandidateRolesForSlot(inSlot, 0, shape.InSlots, {
        styleId: params.style?.Id,
        preferredRoles: params.style?.PreferredRoles,
        highPress: effectiveHighPress,
        player,
        patchVersion,
      });
      const solverOut = getSolverCandidateRolesForSlot(outSlot, 1, shape.OutSlots, {
        styleId: params.style?.Id,
        preferredRoles: params.style?.PreferredRoles,
        highPress: effectiveHighPress,
        player,
        patchVersion,
      });

      const filteredIn = pref?.lockedInRole
        ? allInCandidates.filter((r) => r.Id === pref.lockedInRole)
        : solverIn;
      const filteredOut = pref?.lockedOutRole
        ? allOutCandidates.filter((r) => r.Id === pref.lockedOutRole)
        : solverOut;

      if (filteredIn.length === 0 || filteredOut.length === 0) {
        fitRow.push(null);
        inRoleRow.push(null);
        outRoleRow.push(null);
        continue;
      }

      const bestIn = selectBestRole(
        player,
        inSlot,
        filteredIn,
        styleAttrSet,
        patchVersion,
        preferredRoleSet,
      );
      const bestOut = selectBestRole(
        player,
        outSlot,
        filteredOut,
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
    outSlots: shape.OutSlots,
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
        getSolverCandidateRolesForSlot(shape.InSlots[sIdx]!, 0, shape.InSlots, {
          styleId: params.style?.Id,
          preferredRoles: params.style?.PreferredRoles,
          highPress: effectiveHighPress,
          player,
          patchVersion,
        }),
        styleAttrSet,
        patchVersion,
        preferredRoleSet,
      );
      const fallbackOut = selectBestRole(
        player,
        shape.OutSlots[sIdx]!,
        getSolverCandidateRolesForSlot(shape.OutSlots[sIdx]!, 1, shape.OutSlots, {
          styleId: params.style?.Id,
          preferredRoles: params.style?.PreferredRoles,
          highPress: effectiveHighPress,
          player,
          patchVersion,
        }),
        styleAttrSet,
        patchVersion,
        preferredRoleSet,
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

  // Cap OOP Outlet roles across XI to at most 1 counter-outlet player
  const outletSlots = slotStates
    .filter((s) => isOopOutletRole(s.outRole.Id))
    .sort((a, b) => b.outRoleQuality - a.outRoleQuality);
  if (outletSlots.length > 1) {
    for (const extra of outletSlots.slice(1)) {
      const p = players[extra.playerIndex]!;
      const nonOutletOut = getCandidateRolesForSlot(
        extra.outSlot,
        1,
        shape.OutSlots,
        patchVersion,
      ).filter((r) => !isOopOutletRole(r.Id));
      if (nonOutletOut.length > 0) {
        const nextOut = selectBestRole(
          p,
          extra.outSlot,
          nonOutletOut,
          styleAttrSet,
          patchVersion,
          preferredRoleSet,
        );
        extra.outRole = nextOut.role;
        extra.outRoleQuality = nextOut.roleQuality;
        extra.fit = computeSlotFit(
          p,
          extra.inSlot,
          extra.outSlot,
          extra.inRoleQuality,
          extra.outRoleQuality,
        );
      }
    }
  }

  const initialStarters: CoachingUnitStarter[] = slotStates.map((s) => ({
    player: players[s.playerIndex]!,
    inSlot: s.inSlot,
    outSlot: s.outSlot,
    inRoleId: s.inRole.Id,
    outRoleId: s.outRole.Id,
  }));

  const planned = planTeamInstructions({
    starters: initialStarters,
    highPress: effectiveHighPress,
    style: params.style,
    priorities: params.priorities,
    patchVersion,
  });

  // Local Coaching-Aware Refinement across both Style and Auto modes
  slotStates = refineAssignment({
    initialStates: slotStates,
    players,
    inSlots: shape.InSlots,
    outSlots: shape.OutSlots,
    teamInstructions: planned.teamInstructions,
    highPress: effectiveHighPress,
    styleId: params.style?.Id,
    preferredRoles: params.style?.PreferredRoles,
    styleAttributes: params.combinedStyleAttributes,
    preferencesByUid: params.preferencesByUid,
    patchVersion,
  });

  const finalStarters: CoachingUnitStarter[] = slotStates.map((s) => ({
    player: players[s.playerIndex]!,
    inSlot: s.inSlot,
    outSlot: s.outSlot,
    inRoleId: s.inRole.Id,
    outRoleId: s.outRole.Id,
  }));

  const finalPlanned = planTeamInstructions({
    starters: finalStarters,
    highPress: effectiveHighPress,
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
    highPress: effectiveHighPress,
    finalize: true,
    patchVersion,
  });

  const { instructionPenalty, pressCost } = scoreInstructionDemands(
    coaching.adjustedTeamInstructions,
    finalStarters,
    effectiveHighPress,
  );

  const startingFit =
    slotStates.reduce((acc, s) => acc + s.fit, 0) / slotStates.length;
  const coverFit = computeBenchCoverFit({
    slotStates,
    players,
    inSlots: shape.InSlots,
    outSlots: shape.OutSlots,
    styleId: params.style?.Id,
    preferredRoles: params.style?.PreferredRoles,
    highPress: effectiveHighPress,
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

  // Roster star-utilization adjustment: prevent narrow/asymmetric shapes from benching top-CA natural stars
  const top6Outfield = [...players]
    .filter((p) => !p.isGoalkeeper)
    .sort((a, b) => b.ability - a.ability)
    .slice(0, 6);
  const topWideStars = top6Outfield.filter(
    (p) => (p.positions.AML ?? 0) >= 16 || (p.positions.AMR ?? 0) >= 16,
  ).length;
  const hasWideAttackSlots =
    shape.InSlots.includes("AML") && shape.InSlots.includes("AMR");
  const rosterShapeSynergy =
    topWideStars >= 2 ? (hasWideAttackSlots ? 0.6 : -0.9) : 0;

  const rankingFit =
    styleFit !== null
      ? 0.9 * squadFit +
        0.1 * styleFit +
        coaching.coachingAdjustment -
        instructionPenalty +
        rosterShapeSynergy
      : squadFit +
        0.25 * coaching.coachingAdjustment -
        instructionPenalty +
        rosterShapeSynergy;

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
export function selectPrimarySquadPlayers<
  T extends
    | Player
    | {
        uid: number;
        name: string;
        clubUid?: number;
        clubName?: string;
        age?: number;
        nationality?: string;
        rawNumbers: Record<string, number | undefined>;
      },
>(squadPlayers: readonly T[], lineupPreferences?: readonly LineupPreference[]): readonly T[] {
  const lockedUids = new Set((lineupPreferences ?? []).map((p) => p.playerUid));
  const firstTeam = squadPlayers.filter(
    (p) => ("teamSlot" in p && p.teamSlot === "First Team") || lockedUids.has(p.uid),
  );
  if (firstTeam.length >= 11 && firstTeam.length < squadPlayers.length) {
    let gkCount = 0;
    let outfieldCount = 0;
    for (const p of firstTeam) {
      if ("positions" in p) {
        const gkFam = p.positions.GK ?? 0;
        if (gkFam >= 15) {
          gkCount++;
        } else {
          outfieldCount++;
        }
      } else {
        outfieldCount++;
      }
    }
    if (gkCount >= 1 && outfieldCount >= 10) {
      return firstTeam;
    }
  }
  return squadPlayers;
}

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
  const primaryPlayers = selectPrimarySquadPlayers(squadPlayers, options.lineupPreferences);
  const normalizedPlayers = normalizeAndValidateSquad(
    primaryPlayers,
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
 * preserving valid assigned starters (when locks are satisfied) and running multi-slot role & instruction
 * optimization when `improve: true`.
 */
export function gradeImportedTactic(
  tactic: DualPhaseTactic,
  squadPlayers: ReadonlyArray<Player>,
  options?: {
    improve?: boolean;
    lineupPreferences?: readonly LineupPreference[];
    patchVersion?: string;
  },
): TacticPlanResult {
  const patchVersion = options?.patchVersion ?? tactic.patchVersion ?? "27.0";
  const lineupPrefs = options?.lineupPreferences ?? [];
  const primaryPlayers = selectPrimarySquadPlayers(squadPlayers, lineupPrefs);
  const normalized = normalizeAndValidateSquad(primaryPlayers, lineupPrefs, patchVersion);
  const rp = getRoleProfiles(patchVersion);
  const profileById = new Map(rp.Roles.map((r) => [r.Id, r]));
  const specialistSet = new Set(rp.SpecialistRoles);
  const catalog = getPitchCatalog(patchVersion);
  const stylesCatalog = getTacticalStyles(patchVersion);
  const styleObj = tactic.styleId
    ? stylesCatalog.TacticalStyles.find(
        (s) =>
          s.Id.toLowerCase() === tactic.styleId!.toLowerCase() ||
          s.Name.toLowerCase() === tactic.styleId!.toLowerCase(),
      )
    : undefined;

  const preferencesByUid = new Map<number, LineupPreference>();
  for (const pref of lineupPrefs) {
    preferencesByUid.set(pref.playerUid, pref);
  }
  const mustStartUids = lineupPrefs
    .filter((p) => p.mustStart)
    .map((p) => p.playerUid);
  const byUid = new Map(normalized.map((p, idx) => [p.uid, idx]));

  const resolveAssignedIndices = (
    candidate: DualPhaseTactic,
    rawFits: (number | null)[][],
  ): number[] => {
    const inSlots = candidate.slots.map((s) => s.inPossession.positionId);
    const outSlots = candidate.slots.map((s) => s.outOfPossession.positionId);

    const explicitIndices = candidate.slots
      .map((s) => (s.playerUid !== undefined ? byUid.get(s.playerUid) : undefined))
      .filter((idx): idx is number => idx !== undefined);

    if (new Set(explicitIndices).size === 11) {
      const assignedUidSet = new Set(explicitIndices.map((idx) => normalized[idx]!.uid));
      const allMustStartsIncluded = mustStartUids.every(
        (uid) => !byUid.has(uid) || assignedUidSet.has(uid),
      );
      const allLocksSatisfied = explicitIndices.every((pIdx, sIdx) => {
        const p = normalized[pIdx]!;
        const pref = preferencesByUid.get(p.uid);
        if (!satisfiesLineupLock(pref, inSlots[sIdx]!, outSlots[sIdx]!)) return false;
        return (rawFits[sIdx]?.[pIdx] ?? -1000) > -500;
      });
      if (allMustStartsIncluded && allLocksSatisfied) {
        return explicitIndices;
      }
    }

    const matrix = buildAssignmentMatrix({
      inSlots,
      outSlots,
      rawFits,
      players: normalized,
      styleAttributes: styleObj?.Attributes,
      preferencesByUid,
    });
    return solveHungarianMax(matrix);
  };

  const measure = (candidate: DualPhaseTactic): TacticPlanResult => {
    const inSlots = candidate.slots.map((s) => s.inPossession.positionId);
    const outSlots = candidate.slots.map((s) => s.outOfPossession.positionId);

    const rawFits: (number | null)[][] = candidate.slots.map((slot) => {
      const inRole = profileById.get(slot.inPossession.roleId) ?? rp.Roles[0]!;
      const outRole = profileById.get(slot.outOfPossession.roleId) ?? rp.Roles[0]!;
      return normalized.map((p) => {
        const pref = preferencesByUid.get(p.uid);
        if (
          !satisfiesLineupLock(
            pref,
            slot.inPossession.positionId,
            slot.outOfPossession.positionId,
          )
        ) {
          return null;
        }
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

    const assigned = resolveAssignedIndices(candidate, rawFits);
    const starters: CoachingUnitStarter[] = assigned.map((pIdx, sIdx) => ({
      player: normalized[pIdx]!,
      inSlot: inSlots[sIdx]!,
      outSlot: outSlots[sIdx]!,
      inRoleId: candidate.slots[sIdx]!.inPossession.roleId,
      outRoleId: candidate.slots[sIdx]!.outOfPossession.roleId,
    }));

    const startingFit =
      assigned.reduce((acc, pIdx, sIdx) => acc + (rawFits[sIdx]?.[pIdx] ?? 0), 0) / 11;

    const highPress =
      (candidate.teamInstructions.LineOfEngagement ?? 62) === 61 ||
      Boolean(styleObj?.HighPress);
    const coaching = reviewCoachingKnowledge({
      starters,
      inSlots,
      outSlots,
      teamInstructions: candidate.teamInstructions,
      styleName: styleObj?.Name,
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

  // Multi-pass Steepest-Ascent Optimization across all 11 starters' IP/OOP roles & duties
  let currentTactic: DualPhaseTactic = {
    ...bestResult.tactic,
    teamInstructions: resolveTeamInstructionConflicts(
      bestResult.tactic.teamInstructions,
      catalog,
    ),
  };
  bestResult = measure(currentTactic);

  for (let round = 0; round < 14; round++) {
    let roundBest: TacticPlanResult | null = null;
    const inSlots = currentTactic.slots.map((s) => s.inPossession.positionId);
    const outSlots = currentTactic.slots.map((s) => s.outOfPossession.positionId);
    const highPress =
      (currentTactic.teamInstructions.LineOfEngagement ?? 62) === 61 ||
      Boolean(styleObj?.HighPress);
    const activeOutletCount = currentTactic.slots.filter((s) =>
      isOopOutletRole(s.outOfPossession.roleId),
    ).length;

    for (let sIdx = 0; sIdx < 11; sIdx++) {
      const slot = currentTactic.slots[sIdx]!;
      const starterIdx = slot.playerUid !== undefined ? byUid.get(slot.playerUid) : undefined;
      const starterPlayer = starterIdx !== undefined ? normalized[starterIdx] : undefined;
      const pref = slot.playerUid !== undefined ? preferencesByUid.get(slot.playerUid) : undefined;

      if (!pref?.lockedInRole) {
        const ipAlts = getSolverCandidateRolesForSlot(
          slot.inPossession.positionId,
          0,
          inSlots,
          {
            styleId: currentTactic.styleId,
            preferredRoles: styleObj?.PreferredRoles,
            highPress,
            player: starterPlayer,
            patchVersion,
          },
        );
        for (const altRole of ipAlts) {
          if (altRole.Id === slot.inPossession.roleId) continue;
          const nextPi = starterPlayer
            ? recommendPlayerInstructions(
                starterPlayer,
                0,
                slot.inPossession.positionId,
                altRole.Id,
                patchVersion,
              )
            : slot.inPossession.playerInstructionBits;
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
                      playerInstructionBits: nextPi,
                    },
                  }
                : s,
            ),
          };
          const res = measure(neighbor);
          if (res.rankingFit > (roundBest?.rankingFit ?? bestResult.rankingFit) + 0.025) {
            roundBest = res;
          }
        }
      }

      if (!pref?.lockedOutRole) {
        const oopAlts = getSolverCandidateRolesForSlot(
          slot.outOfPossession.positionId,
          1,
          outSlots,
          {
            styleId: currentTactic.styleId,
            preferredRoles: styleObj?.PreferredRoles,
            highPress,
            player: starterPlayer,
            patchVersion,
          },
        );
        for (const altRole of oopAlts) {
          if (altRole.Id === slot.outOfPossession.roleId) continue;
          if (
            isOopOutletRole(altRole.Id) &&
            !isOopOutletRole(slot.outOfPossession.roleId) &&
            activeOutletCount >= 1
          ) {
            continue;
          }
          const nextPi = starterPlayer
            ? recommendPlayerInstructions(
                starterPlayer,
                1,
                slot.outOfPossession.positionId,
                altRole.Id,
                patchVersion,
              )
            : slot.outOfPossession.playerInstructionBits;
          const neighbor: DualPhaseTactic = {
            ...currentTactic,
            slots: currentTactic.slots.map((s, idx) =>
              idx === sIdx
                ? {
                    ...s,
                    outOfPossession: {
                      ...s.outOfPossession,
                      roleId: altRole.Id,
                      playerInstructionBits: nextPi,
                    },
                  }
                : s,
            ),
          };
          const res = measure(neighbor);
          if (res.rankingFit > (roundBest?.rankingFit ?? bestResult.rankingFit) + 0.025) {
            roundBest = res;
          }
        }
      }
    }

    if (!roundBest) break;
    bestResult = roundBest;
    currentTactic = roundBest.tactic;
  }

  return bestResult;
}
