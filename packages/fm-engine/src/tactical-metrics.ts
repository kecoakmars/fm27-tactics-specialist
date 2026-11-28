import { getPitchCatalog } from "@fm27/fm-data";
import type { DualPhaseTactic, Player } from "@fm27/shared-types";
import { computeTacticalBalance, type TacticalBalanceReport } from "./balance-scorer.js";
import { getPlayerInstructionPolicy } from "./instruction-planner.js";
import {
  averagePlayerAttributes,
  getPlayerAttribute,
  getPlayerSlotFamiliarity,
  normalizePlayer,
} from "./normalizer.js";
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

export interface TacticalEffectivenessMetric {
  score: number;
  level: TacticalFamiliarityLevel;
  structuralScore: number;
  naturalFamiliarityScore: number | null;
  hasSquadContext: boolean;
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

function resolveIndicatorLevel(score: number): TacticalIndicatorLevel {
  if (score >= 78) return "extreme";
  if (score >= 58) return "high";
  if (score >= 36) return "moderate";
  return "low";
}

function resolveFamiliarityLevel(score: number): TacticalFamiliarityLevel {
  if (score >= 82) return "fluid";
  if (score >= 68) return "accomplished";
  if (score >= 52) return "competent";
  return "awkward";
}

/**
 * Computes deterministic Intensity, Complexity, and Effectiveness (Natural Familiarity)
 * indicators for a DualPhaseTactic, optionally enriched with live squad attributes.
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
  intensityRaw += Math.min(10, Math.max(0, (balance.heatmap.averageTransitionDistance - 6) * 0.8));

  const pressMorePiCount = tactic.slots.filter((s) =>
    s.outOfPossession.playerInstructionBits.includes(29),
  ).length;
  intensityRaw += Math.min(6, pressMorePiCount * 1.5);

  const intensityScore = clamp100(intensityRaw);
  const intensityLevel = resolveIndicatorLevel(intensityScore);

  // --- 2. COMPLEXITY (0..100) ---
  let activeTeamInstructions = 0;
  for (const group of catalog.Instructions) {
    const bit = ti[group.Group] ?? group.Current;
    if (bit <= 0) continue;
    if (group.Group === "LineOfEngagement" && bit === 62) continue; // Mid block baseline
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

  // --- 3. EFFECTIVENESS / NATURAL FAMILIARITY (0..100) ---
  const criticalAlertCount = balance.alerts.filter((a) => a.severity === "critical").length;
  const structuralScore = clamp100(balance.overallScore - criticalAlertCount * 3.5);

  let naturalFamiliarityScore: number | null = null;
  let intensityWarningId: string | null = null;
  let intensityWarningEn: string | null = null;
  let complexityWarningId: string | null = null;
  let complexityWarningEn: string | null = null;

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
      .filter((x): x is { sa: (typeof audit.starterAudits)[number]; profile: NonNullable<ReturnType<typeof byUid.get>> } =>
        Boolean(x.profile),
      );

    if (starterProfiles.length > 0) {
      const posFamAvg20 =
        starterProfiles.reduce((acc, item) => {
          const inFam = getPlayerSlotFamiliarity(item.profile, item.sa.inSlot);
          const outFam = getPlayerSlotFamiliarity(item.profile, item.sa.outSlot);
          return acc + (inFam + outFam) * 0.5;
        }, 0) / starterProfiles.length;

      const posFamPct = Math.min(100, Math.max(0, (posFamAvg20 / 20) * 100));
      naturalFamiliarityScore = clamp100(audit.overallSquadFit * 0.65 + posFamPct * 0.35);

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

  const effectivenessScore =
    naturalFamiliarityScore !== null
      ? clamp100(structuralScore * 0.45 + naturalFamiliarityScore * 0.55)
      : structuralScore;
  const effectivenessLevel = resolveFamiliarityLevel(effectivenessScore);

  const summaryNoteId =
    naturalFamiliarityScore !== null
      ? `Gabungan struktur 6 pilar (${structuralScore.toFixed(0)}) & kesiapan alami skuad (${naturalFamiliarityScore.toFixed(0)})`
      : `Skor struktur taktik (${structuralScore.toFixed(0)}) · Muat save .fm untuk Familiarity skuad`;
  const summaryNoteEn =
    naturalFamiliarityScore !== null
      ? `Combines 6-pillar balance (${structuralScore.toFixed(0)}) & natural squad familiarity (${naturalFamiliarityScore.toFixed(0)})`
      : `Structural tactic score (${structuralScore.toFixed(0)}) · Load .fm save for squad familiarity`;

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
      level: effectivenessLevel,
      structuralScore,
      naturalFamiliarityScore,
      hasSquadContext,
      summaryNoteId,
      summaryNoteEn,
    },
  };
}
