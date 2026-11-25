import { getCoachingKnowledge } from "@fm27/fm-data";
import type { CoachingFinding, DualPhaseTactic, Player } from "@fm27/shared-types";
import { reviewCoachingKnowledge, type CoachingUnitStarter } from "./coaching-review.js";
import { computeHeatmap18Zones, type Heatmap18ZoneResult } from "./heatmap-18zone.js";
import { normalizePlayer } from "./normalizer.js";

export interface SixPillarScores {
  attackingThreat: number;
  buildUpProgression: number;
  restDefenseStability: number;
  widthAndHalfSpaceCoverage: number;
  pressingCohesion: number;
  transitionResilience: number;
}

export interface StructuralGapAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  citations: string[];
  autoFix?: CoachingFinding["autoFix"];
}

export interface TacticalBalanceReport {
  overallScore: number;
  pillars: SixPillarScores;
  heatmap: Heatmap18ZoneResult;
  alerts: StructuralGapAlert[];
}

function clamp100(val: number): number {
  return Math.round(Math.max(0, Math.min(100, val)) * 10) / 10;
}

/**
 * Computes the 0-100 Tactical Balance Score across 6 tactical pillars and generates
 * spatial 18-zone + UEFA/FIFA CoachingKnowledge structural gap alerts.
 */
export function computeTacticalBalance(
  tactic: DualPhaseTactic,
  squadPlayers?: readonly Player[],
): TacticalBalanceReport {
  const heatmap = computeHeatmap18Zones(tactic);
  const ip = heatmap.inPossession;
  const oop = heatmap.outOfPossession;

  const z = (cells: typeof ip, r: number, c: number) => cells[r * 3 + c]?.intensity ?? 0;

  // Spatial scores from 18-zone distribution
  const boxThreat = z(ip, 0, 1) * 0.55 + heatmap.zone14IntensityIp * 0.45;
  const attackDuties = tactic.slots.filter((s) => s.inPossession.duty === "Attack").length;
  const attackingThreat = clamp100(boxThreat * 0.65 + Math.min(100, attackDuties * 24) * 0.35);

  const centralBuild = (z(ip, 3, 1) + z(ip, 4, 1) + z(ip, 2, 1)) / 3;
  const buildUpProgression = clamp100(centralBuild * 0.75 + 22);

  const restDefHolders = tactic.slots.filter((s) => {
    const pos = s.inPossession.positionId;
    const role = s.inPossession.roleId;
    return (
      pos.startsWith("DC") ||
      (pos.startsWith("DM") && s.inPossession.duty !== "Attack") ||
      role === "InsideFullBack" ||
      role === "HalfBack"
    );
  }).length;
  const deepCentralIp = (z(ip, 3, 1) + z(ip, 4, 1)) * 0.5;
  const restDefenseStability = clamp100(
    Math.min(100, restDefHolders * 22) * 0.6 + deepCentralIp * 0.4,
  );

  const leftFlankIp = Math.max(z(ip, 1, 0), z(ip, 2, 0), z(ip, 3, 0));
  const rightFlankIp = Math.max(z(ip, 1, 2), z(ip, 2, 2), z(ip, 3, 2));
  const halfSpaceMean =
    (heatmap.leftHalfSpaceIntensityIp + heatmap.rightHalfSpaceIntensityIp) * 0.5;
  const widthAndHalfSpaceCoverage = clamp100(
    Math.min(leftFlankIp, rightFlankIp) * 0.55 + halfSpaceMean * 0.45,
  );

  const oopMidScreen = (z(oop, 3, 1) + z(oop, 4, 1)) * 0.5;
  const loe = tactic.teamInstructions.LineOfEngagement ?? 62;
  const defLine = tactic.teamInstructions.DefensiveLine ?? 0;
  const verticalCompactnessPenalty =
    loe === 61 && (defLine === 58 || defLine === 59) ? 22 : 0;
  const pressingCohesion = clamp100(oopMidScreen * 0.7 + 34 - verticalCompactnessPenalty);

  const distPenalty = Math.max(0, (heatmap.averageTransitionDistance - 12) * 2.2);
  const transitionResilience = clamp100(
    restDefenseStability * 0.55 + oopMidScreen * 0.45 - distPenalty,
  );

  const alerts: StructuralGapAlert[] = [];

  if (heatmap.zone14IntensityIp < 28) {
    alerts.push({
      id: "gap-zone14-vacuum",
      severity: "warning",
      title: "Low Zone 14 Occupation",
      detail:
        "Central pocket outside the penalty box lacks an attacking midfielder, inside forward, or late midfield runner.",
      citations: ["uefa-city-inter", "barca-cruyff"],
    });
  }

  if (Math.min(leftFlankIp, rightFlankIp) < 25) {
    const weakSide = leftFlankIp < rightFlankIp ? "Left" : "Right";
    alerts.push({
      id: `gap-flank-${weakSide.toLowerCase()}`,
      severity: "warning",
      title: `Isolated ${weakSide} Flank in Possession`,
      detail: `Attacking width on the ${weakSide.toLowerCase()} channel is sparse, making the opposition defensive block easier to shift centrally.`,
      citations: ["fifa-wing", "uefa-wide"],
    });
  }

  if (restDefHolders < 3) {
    alerts.push({
      id: "gap-rest-defense-count",
      severity: "critical",
      title: "Exposed Rest-Defense (< 3 Stay-Back Players)",
      detail:
        "Fewer than 3 outfield players hold central/deep positions in possession, leaving high vulnerability to rapid counter-attacks.",
      citations: ["fifa-rest-defence", "fa-transition"],
    });
  }

  if (verticalCompactnessPenalty > 0) {
    alerts.push({
      id: "gap-stretched-block",
      severity: "critical",
      title: "Stretched Vertical Block (High Press + Low Defensive Line)",
      detail:
        "Combining High Press with a Lower Defensive Line opens large central spaces between midfield and defense.",
      citations: ["uefa-sacchi", "uefa-arteta"],
    });
  }

  // Enrich with squad-aware CoachingKnowledge findings when squad players are assigned/available
  if (squadPlayers && squadPlayers.length >= 11) {
    const byUid = new Map(squadPlayers.map((p) => [p.uid, normalizePlayer(p, tactic.patchVersion)]));
    const fallbackList = squadPlayers.map((p) => normalizePlayer(p, tactic.patchVersion));
    const starters: CoachingUnitStarter[] = tactic.slots.map((s, idx) => ({
      player:
        (s.playerUid !== undefined ? byUid.get(s.playerUid) : undefined) ??
        fallbackList[idx % fallbackList.length]!,
      inSlot: s.inPossession.positionId,
      outSlot: s.outOfPossession.positionId,
      inRoleId: s.inPossession.roleId,
      outRoleId: s.outOfPossession.roleId,
    }));

    const ck = getCoachingKnowledge(tactic.patchVersion);
    const review = reviewCoachingKnowledge({
      starters,
      inSlots: tactic.slots.map((s) => s.inPossession.positionId),
      outSlots: tactic.slots.map((s) => s.outOfPossession.positionId),
      teamInstructions: tactic.teamInstructions,
      highPress: loe === 61,
      finalize: false,
      coachingKnowledge: ck,
      patchVersion: tactic.patchVersion,
    });

    for (const f of review.findings) {
      if (f.delta < -0.6 || f.autoFix) {
        alerts.push({
          id: `coaching-${f.ruleId}`,
          severity: f.delta < -1.5 ? "critical" : "warning",
          title: `${f.title} (${f.rating.toFixed(1)} vs target ${f.target})`,
          detail:
            ck.Rules.find((r) => r.Id === f.ruleId)?.Detail ??
            `Unit metric "${f.metric}" falls below target threshold.`,
          citations: f.sources,
          autoFix: f.autoFix,
        });
      }
    }
  }

  const pillars: SixPillarScores = {
    attackingThreat,
    buildUpProgression,
    restDefenseStability,
    widthAndHalfSpaceCoverage,
    pressingCohesion,
    transitionResilience,
  };

  const overallScore = clamp100(
    (pillars.attackingThreat +
      pillars.buildUpProgression +
      pillars.restDefenseStability +
      pillars.widthAndHalfSpaceCoverage +
      pillars.pressingCohesion +
      pillars.transitionResilience) /
      6,
  );

  return {
    overallScore,
    pillars,
    heatmap,
    alerts,
  };
}
