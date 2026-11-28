import { getPitchCatalog, getRoleProfiles } from "@fm27/fm-data";
import type { DualPhaseTactic, Player, SlotAssignment } from "@fm27/shared-types";
import { computeTacticalBalance, type TacticalBalanceReport } from "./balance-scorer.js";
import { computeSlotFit } from "./fit-calculator.js";
import { getPlayerInstructionPolicy } from "./instruction-planner.js";
import {
  averagePlayerAttributes,
  canonicalPositionKey,
  getPlayerAttribute,
  getPlayerSlotFamiliarity,
  normalizePlayer,
  type NormalizedPlayerProfile,
} from "./normalizer.js";
import { scoreSingleRoleQuality } from "./role-evaluator.js";
import { auditSquadAgainstTactic } from "./squad-audit.js";

export type TacticalIndicatorLevel = "low" | "moderate" | "high" | "extreme";
export type TacticalFamiliarityLevel =
  | "awkward"
  | "competent"
  | "accomplished"
  | "fluid";

export interface TacticalIntensityMetric {
  score: number;
  level: TacticalIndicatorLevel;
  drivers: string[];
  squadWarningId: string | null;
  squadWarningEn: string | null;
}

export interface TacticalComplexityMetric {
  score: number;
  level: TacticalIndicatorLevel;
  activeTeamInstructions: number;
  customPlayerInstructions: number;
  phaseShiftSlots: number;
  specialistRoleCount: number;
  squadWarningId: string | null;
  squadWarningEn: string | null;
}

export interface PlayerSlotEffectiveness {
  slotIndex: number;
  playerUid: number;
  playerName: string;
  inSlot: string;
  outSlot: string;
  inRoleId: string;
  outRoleId: string;
  score: number;
  bars: number;
  level: TacticalFamiliarityLevel;
  fmFamiliarityScore: number | null;
  roleSlotFitScore: number;
  hasFmFamiliarity: boolean;
  condition?: number;
  matchSharpness?: number;
}

export interface TacticalEffectivenessMetric {
  score: number;
  bars: number;
  level: TacticalFamiliarityLevel;
  structuralScore: number;
  naturalFamiliarityScore: number | null;
  hasSquadContext: boolean;
  hasFmFamiliarity: boolean;
  playerEffectiveness: PlayerSlotEffectiveness[];
  summaryNoteId: string;
  summaryNoteEn: string;
}

export interface TacticalMetricsReport {
  intensity: TacticalIntensityMetric;
  complexity: TacticalComplexityMetric;
  effectiveness: TacticalEffectivenessMetric;
}

const COMPLEX_ROLE_IDS = new Set<string>([
  "InvertedWingBack",
  "InsideWingBack",
  "InsideFullBack",
  "Libero",
  "HalfBack",
  "Regista",
  "RoamingPlaymaker",
  "Mezzala",
  "SegundoVolante",
  "Raumdeuter",
  "Trequartista",
  "CompleteForward",
  "FalseNine",
  "InvertedWinger",
  "ChannelMidfielder",
  "WideCentreBack",
  "BallPlayingCentreBack",
  "SweeperKeeper",
  "CompleteWingBack",
]);

function clamp100(val: number): number {
  return Math.round(Math.max(0, Math.min(100, val)) * 10) / 10;
}

export function scoreToFamiliarityBars(score: number): number {
  return Math.max(1, Math.min(10, Math.round(Math.max(0, Math.min(100, score)) / 10)));
}

function resolveIndicatorLevel(score: number): TacticalIndicatorLevel {
  if (score >= 78) return "extreme";
  if (score >= 58) return "high";
  if (score >= 36) return "moderate";
  return "low";
}

export function resolveFamiliarityLevel(score: number): TacticalFamiliarityLevel {
  if (score >= 80) return "fluid";
  if (score >= 65) return "accomplished";
  if (score >= 48) return "competent";
  return "awkward";
}

function scaleFmFamiliarityByteTo100(val: number): number {
  const clamped = Math.max(-100, Math.min(50, val));
  if (clamped <= 0) {
    return 15 + ((clamped + 100) / 100) * 27;
  }
  return 42 + (clamped / 50) * 54;
}

function readFmCorridorByte(fam: readonly number[], posId: string): number | null {
  if (fam.length < 9) return null;
  const canon = canonicalPositionKey(posId);
  if (canon === "GK") {
    return fam[1] !== undefined && fam[1] > -100 ? fam[1]! : null;
  }
  // Outfield slots require outfield familiarity block (byte[2] > -100 or byte[3] > -100)
  if ((fam[2] ?? -100) === -100 && (fam[3] ?? -100) === -100) {
    return null;
  }
  const dc = fam[2] ?? 0;
  const fb = fam[3] ?? 0;
  const cm = fam[4] ?? 0;
  const st = fam[5] ?? 0;
  const am = fam[6] ?? 0;
  const sec = fam[7] ?? 0;

  switch (canon) {
    case "DC":
      return dc;
    case "DL":
    case "DR":
      return fb;
    case "WBL":
    case "WBR":
      return fb * 0.72 + am * 0.28;
    case "DM":
      return cm * 0.58 + fb * 0.42;
    case "MC":
      return cm;
    case "ML":
    case "MR":
      return am * 0.52 + cm * 0.48;
    case "AMC":
      return am;
    case "AML":
    case "AMR":
      return am * 0.65 + sec * 0.35;
    case "STC":
      return st * 0.7 + sec * 0.3;
    default:
      return cm;
  }
}

function computeRawIntensityScore(
  tactic: DualPhaseTactic,
  avgTransitionDistance: number,
): { score: number; drivers: string[] } {
  const ti = tactic.teamInstructions;
  let intensityRaw = 36;
  const drivers: string[] = [];

  intensityRaw += (tactic.mentality - 4) * 5.5;
  if (tactic.mentality >= 6) drivers.push("Attacking Mentality");
  else if (tactic.mentality <= 2) drivers.push("Defensive Mentality");

  const tempo = ti.Tempo ?? 0;
  if (tempo === 46) {
    intensityRaw += 14;
    drivers.push("Much Higher Tempo");
  } else if (tempo === 47) {
    intensityRaw += 8;
    drivers.push("Higher Tempo");
  } else if (tempo === 48) {
    intensityRaw -= 6;
  } else if (tempo === 49) {
    intensityRaw -= 11;
  }

  const loe = ti.LineOfEngagement ?? 62;
  if (loe === 61) {
    intensityRaw += 11;
    drivers.push("High Press");
  } else if (loe === 63) {
    intensityRaw -= 7;
  }

  const defLine = ti.DefensiveLine ?? 0;
  if (defLine === 56) {
    intensityRaw += 8;
    drivers.push("Much Higher Line");
  } else if (defLine === 57) {
    intensityRaw += 4;
  } else if (defLine === 58) {
    intensityRaw -= 3;
  } else if (defLine === 59) {
    intensityRaw -= 6;
  }

  if (ti.DefensiveLineBehaviour === 76) intensityRaw += 5;
  else if (ti.DefensiveLineBehaviour === 77) intensityRaw -= 4;

  const triggerPress = ti.TriggerPress ?? 0;
  if (triggerPress === 65) {
    intensityRaw += 15;
    drivers.push("Trigger Press Much More Often");
  } else if (triggerPress === 66) {
    intensityRaw += 9;
    drivers.push("Trigger Press More Often");
  } else if (triggerPress === 67) {
    intensityRaw -= 6;
  } else if (triggerPress === 68) {
    intensityRaw -= 11;
  }

  if (ti.DefensiveTransition === 70) {
    intensityRaw += 12;
    drivers.push("Counter-Press");
  } else if (ti.DefensiveTransition === 71) {
    intensityRaw -= 6;
  }

  if (ti.AttackingTransition === 54) {
    intensityRaw += 6;
    drivers.push("Counter-Attack");
  } else if (ti.AttackingTransition === 55) {
    intensityRaw -= 4;
  }

  if (ti.Tackling === 72) {
    intensityRaw += 6;
    drivers.push("Get Stuck In");
  } else if (ti.Tackling === 73) {
    intensityRaw -= 3;
  }

  if (ti.PreventShortGKDistribution === 69) intensityRaw += 5;
  if (ti.GoalkeeperDistributionSpeed === 42) intensityRaw += 3;
  else if (ti.GoalkeeperDistributionSpeed === 43) intensityRaw -= 3;
  if (ti.TimeWasting === 78) intensityRaw -= 6;

  const attackDuties = tactic.slots.filter((s) => s.inPossession.duty === "Attack").length;
  intensityRaw += Math.max(0, attackDuties - 3) * 2.5;
  intensityRaw += Math.min(10, Math.max(0, (avgTransitionDistance - 6) * 0.8));

  const pressMorePiCount = tactic.slots.filter((s) =>
    s.outOfPossession.playerInstructionBits.includes(29),
  ).length;
  intensityRaw += Math.min(6, pressMorePiCount * 1.5);

  return { score: clamp100(intensityRaw), drivers };
}

/**
 * Evaluates per-player tactical effectiveness (0-100 & 1-10 FM27 segments) for a specific slot,
 * combining real `.fm` monthly familiarity bytes (when available) with live IP/OOP role & instruction fit.
 */
export function computePlayerSlotEffectiveness(
  player: Player | NormalizedPlayerProfile,
  slot: SlotAssignment,
  tactic: DualPhaseTactic,
  options?: { intensityScore?: number },
): PlayerSlotEffectiveness {
  const patchVersion = tactic.patchVersion || "27.0";
  const norm =
    "isGoalkeeper" in player ? player : normalizePlayer(player, patchVersion);
  const rp = getRoleProfiles(patchVersion);
  const specialistSet = new Set(rp.SpecialistRoles);
  const roleById = new Map(rp.Roles.map((r) => [r.Id, r]));

  const inPos = slot.inPossession.positionId;
  const outPos = slot.outOfPossession.positionId;
  const inRole = roleById.get(slot.inPossession.roleId) ?? rp.Roles[0]!;
  const outRole = roleById.get(slot.outOfPossession.roleId) ?? rp.Roles[0]!;

  const inQ = scoreSingleRoleQuality(norm, inPos, inRole, specialistSet);
  const outQ = scoreSingleRoleQuality(norm, outPos, outRole, specialistSet);
  const rawFit = computeSlotFit(norm, inPos, outPos, inQ, outQ);
  const roleSlotFitScore = clamp100(Math.max(8, rawFit));

  const intensityScore = options?.intensityScore ?? computeRawIntensityScore(tactic, 8).score;
  let instructionDelta = 0;
  if (inPos !== "GK") {
    const workStamina = averagePlayerAttributes(norm, ["stamina", "work_rate"]);
    if (intensityScore >= 72 && workStamina < 11.5) {
      instructionDelta -= 3.5;
    } else if (intensityScore >= 70 && workStamina >= 15) {
      instructionDelta += 1.5;
    }

    const isComplexRole =
      COMPLEX_ROLE_IDS.has(slot.inPossession.roleId) ||
      COMPLEX_ROLE_IDS.has(slot.outOfPossession.roleId);
    if (isComplexRole) {
      const iq = averagePlayerAttributes(norm, ["decisions", "vision", "teamwork"]);
      if (iq < 11.8) instructionDelta -= 3.5;
      else if (iq >= 15.2) instructionDelta += 1.5;
    }
  }
  const adjustedFit = clamp100(roleSlotFitScore + instructionDelta);

  let fmFamiliarityScore: number | null = null;
  if (norm.tacticalFamiliarity && norm.tacticalFamiliarity.length === 9) {
    const inCorr = readFmCorridorByte(norm.tacticalFamiliarity, inPos);
    const outCorr = readFmCorridorByte(norm.tacticalFamiliarity, outPos);
    if (inCorr !== null && outCorr !== null) {
      const corrAvg = inCorr * 0.55 + outCorr * 0.45;
      const corrPct = scaleFmFamiliarityByteTo100(corrAvg);
      const genPct = scaleFmFamiliarityByteTo100(norm.tacticalFamiliarity[0] ?? 0);
      const sharpMod =
        norm.matchSharpness !== undefined ? (norm.matchSharpness - 88) * 0.08 : 0;
      fmFamiliarityScore = clamp100(corrPct * 0.76 + genPct * 0.24 + sharpMod);
    } else {
      fmFamiliarityScore = 10;
    }
  }

  const inPosFam = getPlayerSlotFamiliarity(norm, inPos);
  const outPosFam = getPlayerSlotFamiliarity(norm, outPos);
  const minPos20 = Math.min(inPosFam, outPosFam);
  const posGate = Math.min(1, Math.max(0.15, minPos20 / 14));

  let score: number;
  if (fmFamiliarityScore !== null) {
    score = clamp100(
      (fmFamiliarityScore * 0.66 + adjustedFit * 0.34) * (0.35 + 0.65 * posGate),
    );
  } else {
    const posFamPct = Math.min(100, Math.max(0, ((inPosFam + outPosFam) / 40) * 100));
    score = clamp100(adjustedFit * 0.68 + posFamPct * 0.32);
  }

  return {
    slotIndex: slot.slotIndex,
    playerUid: norm.uid,
    playerName: norm.name,
    inSlot: inPos,
    outSlot: outPos,
    inRoleId: slot.inPossession.roleId,
    outRoleId: slot.outOfPossession.roleId,
    score,
    bars: scoreToFamiliarityBars(score),
    level: resolveFamiliarityLevel(score),
    fmFamiliarityScore,
    roleSlotFitScore: adjustedFit,
    hasFmFamiliarity: fmFamiliarityScore !== null,
    ...(norm.condition !== undefined ? { condition: norm.condition } : {}),
    ...(norm.matchSharpness !== undefined ? { matchSharpness: norm.matchSharpness } : {}),
  };
}

/**
 * Evaluates a bench or squad player's best effectiveness across compatible slots in `tactic`
 * (or their assigned slot if currently in the starting 11).
 */
export function computePlayerBestTacticEffectiveness(
  player: Player,
  tactic: DualPhaseTactic,
): PlayerSlotEffectiveness {
  const assignedSlot = tactic.slots.find((s) => s.playerUid === player.uid);
  if (assignedSlot) {
    return computePlayerSlotEffectiveness(player, assignedSlot, tactic);
  }

  const norm = normalizePlayer(player, tactic.patchVersion || "27.0");
  let best: PlayerSlotEffectiveness | null = null;
  for (const slot of tactic.slots) {
    const isGkSlot = slot.inPossession.positionId === "GK";
    if (isGkSlot !== norm.isGoalkeeper) continue;
    const cand = computePlayerSlotEffectiveness(norm, slot, tactic);
    if (!best || cand.score > best.score) {
      best = cand;
    }
  }
  return best ?? computePlayerSlotEffectiveness(norm, tactic.slots[0]!, tactic);
}

/**
 * Computes deterministic Intensity, Complexity, and Per-Player Effectiveness (Familiarity)
 * indicators for a DualPhaseTactic, enriched with live `.fm` familiarity & squad attributes.
 */
export function computeTacticalMetrics(
  tactic: DualPhaseTactic,
  squadPlayers?: readonly Player[],
  existingBalance?: TacticalBalanceReport,
): TacticalMetricsReport {
  const catalog = getPitchCatalog(tactic.patchVersion);
  const balance =
    existingBalance ??
    computeTacticalBalance(
      tactic,
      squadPlayers && squadPlayers.length >= 11 ? squadPlayers : undefined,
    );
  const ti = tactic.teamInstructions;

  // --- 1. INTENSITY (0..100) ---
  const { score: intensityScore, drivers } = computeRawIntensityScore(
    tactic,
    balance.heatmap.averageTransitionDistance,
  );
  const intensityLevel = resolveIndicatorLevel(intensityScore);

  // --- 2. COMPLEXITY (0..100) ---
  let activeTeamInstructions = 0;
  for (const group of catalog.Instructions) {
    const bit = ti[group.Group] ?? group.Current;
    if (bit <= 0) continue;
    if (group.Group === "LineOfEngagement" && bit === 62) continue;
    const opt = group.Options.find((o) => o.Bit === bit);
    const lbl = opt?.Label.toLowerCase() ?? "";
    if (lbl === "standard" || lbl === "balanced" || lbl === "mixed" || lbl === "mixed crosses") {
      continue;
    }
    activeTeamInstructions += 1;
  }

  let customPlayerInstructions = 0;
  let phaseShiftSlots = 0;
  let specialistRoleCount = 0;

  for (const slot of tactic.slots) {
    if (slot.inPossession.positionId !== slot.outOfPossession.positionId) {
      phaseShiftSlots += 1;
    }
    if (
      COMPLEX_ROLE_IDS.has(slot.inPossession.roleId) ||
      COMPLEX_ROLE_IDS.has(slot.outOfPossession.roleId)
    ) {
      specialistRoleCount += 1;
    }

    for (const bit of slot.inPossession.playerInstructionBits) {
      const pol = getPlayerInstructionPolicy(
        catalog.PlayerInstructionPolicies,
        0,
        slot.inPossession.positionId,
        slot.inPossession.roleId,
        bit,
      );
      if (pol !== "3") customPlayerInstructions += 1;
    }
    for (const bit of slot.outOfPossession.playerInstructionBits) {
      const pol = getPlayerInstructionPolicy(
        catalog.PlayerInstructionPolicies,
        1,
        slot.outOfPossession.positionId,
        slot.outOfPossession.roleId,
        bit,
      );
      if (pol !== "3") customPlayerInstructions += 1;
    }
  }

  const complexityRaw =
    14 +
    activeTeamInstructions * 4.2 +
    Math.min(20, customPlayerInstructions * 1.4) +
    phaseShiftSlots * 2.8 +
    specialistRoleCount * 4.0 +
    Math.min(12, Math.max(0, (balance.heatmap.averageTransitionDistance - 5) * 0.9));

  const complexityScore = clamp100(complexityRaw);
  const complexityLevel = resolveIndicatorLevel(complexityScore);

  // --- 3. EFFECTIVENESS / PER-PLAYER FAMILIARITY (0..100 & 10 BARS) ---
  const criticalAlertCount = balance.alerts.filter((a) => a.severity === "critical").length;
  const structuralScore = clamp100(balance.overallScore - criticalAlertCount * 3.5);

  let naturalFamiliarityScore: number | null = null;
  let intensityWarningId: string | null = null;
  let intensityWarningEn: string | null = null;
  let complexityWarningId: string | null = null;
  let complexityWarningEn: string | null = null;
  const playerEffectiveness: PlayerSlotEffectiveness[] = [];

  const hasSquadContext = Boolean(squadPlayers && squadPlayers.length >= 11);

  if (hasSquadContext && squadPlayers) {
    const audit = auditSquadAgainstTactic(tactic, squadPlayers);
    const byUid = new Map(
      squadPlayers.map((p) => [p.uid, normalizePlayer(p, tactic.patchVersion)]),
    );

    const starterProfiles = audit.starterAudits
      .map((sa) => ({
        sa,
        profile: byUid.get(sa.playerUid),
      }))
      .filter(
        (
          x,
        ): x is {
          sa: (typeof audit.starterAudits)[number];
          profile: NonNullable<ReturnType<typeof byUid.get>>;
        } => Boolean(x.profile),
      );

    for (const item of starterProfiles) {
      const slotObj = tactic.slots[item.sa.slotIndex] ?? {
        slotIndex: item.sa.slotIndex,
        playerUid: item.sa.playerUid,
        playerName: item.sa.playerName,
        inPossession: {
          positionId: item.sa.inSlot,
          roleId: item.sa.inRoleId,
          duty: "Support" as const,
          playerInstructionBits: [],
          markingPositionMask: 0,
        },
        outOfPossession: {
          positionId: item.sa.outSlot,
          roleId: item.sa.outRoleId,
          duty: "Defend" as const,
          playerInstructionBits: [],
          markingPositionMask: 0,
        },
      };
      playerEffectiveness.push(
        computePlayerSlotEffectiveness(item.profile, slotObj, tactic, {
          intensityScore,
        }),
      );
    }

    if (playerEffectiveness.length > 0) {
      naturalFamiliarityScore = clamp100(
        playerEffectiveness.reduce((acc, pe) => acc + pe.score, 0) /
          playerEffectiveness.length,
      );

      const outfieldStarters = starterProfiles.filter((x) => x.sa.inSlot !== "GK");
      if (outfieldStarters.length > 0) {
        const avgStamina =
          outfieldStarters.reduce(
            (acc, x) => acc + averagePlayerAttributes(x.profile, ["stamina", "work_rate"]),
            0,
          ) / outfieldStarters.length;
        const injuryProneCount = outfieldStarters.filter(
          (x) => getPlayerAttribute(x.profile, "injury_proneness") >= 14,
        ).length;

        if (intensityScore >= 72 && (avgStamina < 13.2 || injuryProneCount >= 3)) {
          intensityWarningId = `Intensitas tinggi untuk stamina/work rate skuad (${avgStamina.toFixed(1)})${injuryProneCount >= 3 ? ` · ${injuryProneCount} pemain rawan cedera` : ""}`;
          intensityWarningEn = `High intensity vs squad stamina/work rate (${avgStamina.toFixed(1)})${injuryProneCount >= 3 ? ` · ${injuryProneCount} injury-prone starters` : ""}`;
        }

        const avgTacticalIq =
          outfieldStarters.reduce(
            (acc, x) => acc + averagePlayerAttributes(x.profile, ["decisions", "teamwork"]),
            0,
          ) / outfieldStarters.length;

        if (complexityScore >= 68 && avgTacticalIq < 12.8) {
          complexityWarningId = `Instruksi cukup rumit untuk rata-rata Decisions/Teamwork skuad (${avgTacticalIq.toFixed(1)})`;
          complexityWarningEn = `High tactical complexity vs squad Decisions/Teamwork (${avgTacticalIq.toFixed(1)})`;
        }
      }
    }
  }

  const hasFmFamiliarity = playerEffectiveness.some((pe) => pe.hasFmFamiliarity);
  // Team Effectiveness = exact average of the 11 Starters when squad is loaded; structural score otherwise
  const effectivenessScore =
    naturalFamiliarityScore !== null ? naturalFamiliarityScore : structuralScore;
  const effectivenessBars = scoreToFamiliarityBars(effectivenessScore);
  const effectivenessLevel = resolveFamiliarityLevel(effectivenessScore);

  const lowestStarter =
    playerEffectiveness.length > 0
      ? [...playerEffectiveness].sort((a, b) => a.score - b.score)[0]!
      : null;
  const lowestShortName = lowestStarter
    ? lowestStarter.playerName.split(" ").slice(-1)[0] ?? lowestStarter.playerName
    : "";

  const summaryNoteId =
    naturalFamiliarityScore !== null
      ? `${hasFmFamiliarity ? "Rata-rata Familiarity .fm 11 starter" : "Rata-rata kesiapan 11 starter"}${lowestStarter ? ` · Terendah: ${lowestShortName} (${lowestStarter.bars}/10)` : ""}`
      : `Skor struktur taktik (${structuralScore.toFixed(0)}) · Muat save .fm untuk Efektivitas per pemain`;
  const summaryNoteEn =
    naturalFamiliarityScore !== null
      ? `${hasFmFamiliarity ? "11-starter .fm Familiarity average" : "11-starter readiness average"}${lowestStarter ? ` · Lowest: ${lowestShortName} (${lowestStarter.bars}/10)` : ""}`
      : `Structural tactic score (${structuralScore.toFixed(0)}) · Load .fm save for per-player Effectiveness`;

  return {
    intensity: {
      score: intensityScore,
      level: intensityLevel,
      drivers: drivers.slice(0, 4),
      squadWarningId: intensityWarningId,
      squadWarningEn: intensityWarningEn,
    },
    complexity: {
      score: complexityScore,
      level: complexityLevel,
      activeTeamInstructions,
      customPlayerInstructions,
      phaseShiftSlots,
      specialistRoleCount,
      squadWarningId: complexityWarningId,
      squadWarningEn: complexityWarningEn,
    },
    effectiveness: {
      score: effectivenessScore,
      bars: effectivenessBars,
      level: effectivenessLevel,
      structuralScore,
      naturalFamiliarityScore,
      hasSquadContext,
      hasFmFamiliarity,
      playerEffectiveness,
      summaryNoteId,
      summaryNoteEn,
    },
  };
}
