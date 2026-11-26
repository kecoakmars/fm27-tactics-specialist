import { getCoachingKnowledge } from "@fm27/fm-data";
import type { CoachingFinding, CoachingKnowledge, CoachingRule } from "@fm27/shared-types";
import { averagePlayerAttributes, type NormalizedPlayerProfile } from "./normalizer.js";

export interface CoachingUnitStarter {
  player: NormalizedPlayerProfile;
  inSlot: string;
  outSlot: string;
  inRoleId: string;
  outRoleId: string;
}

function clamp20(val: number): number {
  return Math.max(1, Math.min(20, val));
}

/**
 * WeakLink (0x06000983): `0.65 * mean + 0.35 * min` (returns 8.0 on empty list).
 */
export function weakLink(values: readonly number[]): number {
  if (values.length === 0) return 8.0;
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  for (const v of values) {
    sum += v;
    if (v < min) min = v;
  }
  return 0.65 * (sum / values.length) + 0.35 * min;
}

/**
 * Computes any of the 12 structural tactical unit metrics (0..20 scale) from the 11 starters.
 */
export function computeLineMetric(
  metric: string,
  starters: readonly CoachingUnitStarter[],
): number {
  const outfield = starters.filter((s) => s.inSlot !== "GK");

  switch (metric) {
    case "cover": {
      const holders = outfield.filter(
        (s) =>
          s.inSlot.startsWith("DC") ||
          s.inSlot.startsWith("DM") ||
          s.inRoleId === "InsideFullBack" ||
          s.inRoleId === "HalfBack" ||
          s.inRoleId === "DefensiveMidfielder",
      );
      const scores = holders.map((m) =>
        averagePlayerAttributes(m.player, [
          "positioning",
          "anticipation",
          "tackling",
          "concentration",
          "pace",
        ]),
      );
      const countBonus = holders.length >= 3 ? 0.6 : -1.0;
      return clamp20(weakLink(scores) + countBonus);
    }

    case "width": {
      const wide = outfield.filter(
        (s) =>
          (s.inSlot === "DL" && s.inRoleId !== "InsideFullBack" && s.inRoleId !== "InsideWingBack") ||
          (s.inSlot === "DR" && s.inRoleId !== "InsideFullBack" && s.inRoleId !== "InsideWingBack") ||
          s.inSlot === "WBL" ||
          s.inSlot === "WBR" ||
          s.inSlot === "ML" ||
          s.inSlot === "MR" ||
          s.inSlot === "AML" ||
          s.inSlot === "AMR" ||
          s.inRoleId.includes("Wide") ||
          (s.inRoleId.includes("Wing") && s.inRoleId !== "InsideWingBack"),
      );
      const scores = wide.map((m) =>
        averagePlayerAttributes(m.player, [
          "pace",
          "acceleration",
          "stamina",
          "crossing",
          "dribbling",
        ]),
      );
      const widthCountPenalty = wide.length < 2 ? -2.0 : wide.length === 2 ? -0.6 : 0;
      return clamp20(weakLink(scores) + widthCountPenalty);
    }

    case "press": {
      const pressers = outfield
        .filter((s) => !s.outSlot.startsWith("DC"))
        .map((m) =>
          averagePlayerAttributes(m.player, [
            "work_rate",
            "stamina",
            "aggression",
            "anticipation",
            "acceleration",
          ]),
        );
      return clamp20(weakLink(pressers));
    }

    case "screen": {
      const screeners = outfield
        .filter((s) => s.outSlot.startsWith("DM") || s.outSlot.startsWith("MC"))
        .map((m) =>
          averagePlayerAttributes(m.player, [
            "positioning",
            "tackling",
            "anticipation",
            "concentration",
            "teamwork",
          ]),
        );
      return clamp20(weakLink(screeners));
    }

    case "build": {
      const builders = starters
        .filter(
          (s) =>
            s.inSlot === "GK" ||
            s.inSlot.startsWith("DC") ||
            s.inSlot.startsWith("DM"),
        )
        .map((m) =>
          averagePlayerAttributes(m.player, [
            "passing",
            "first_touch",
            "composure",
            "decisions",
            "vision",
          ]),
        );
      return clamp20(weakLink(builders));
    }

    case "wingbacks": {
      const wbs = outfield
        .filter(
          (s) =>
            s.inSlot === "WBL" ||
            s.inSlot === "WBR" ||
            s.inSlot === "DL" ||
            s.inSlot === "DR",
        )
        .map((m) =>
          averagePlayerAttributes(m.player, [
            "stamina",
            "work_rate",
            "pace",
            "crossing",
            "positioning",
          ]),
        );
      return clamp20(weakLink(wbs));
    }

    case "partnership": {
      const attackers = outfield
        .filter((s) => s.inSlot.startsWith("ST") || s.inSlot.startsWith("AM"))
        .map((m) =>
          averagePlayerAttributes(m.player, [
            "off_the_ball",
            "vision",
            "passing",
            "teamwork",
            "finishing",
          ]),
        );
      return clamp20(weakLink(attackers));
    }

    case "counter":
    case "runs": {
      const runners = [...outfield]
        .sort(
          (a, b) =>
            averagePlayerAttributes(b.player, ["pace", "acceleration", "off_the_ball", "dribbling"]) -
            averagePlayerAttributes(a.player, ["pace", "acceleration", "off_the_ball", "dribbling"]),
        )
        .slice(0, 4)
        .map((m) =>
          averagePlayerAttributes(m.player, [
            "pace",
            "acceleration",
            "off_the_ball",
            "anticipation",
          ]),
        );
      return clamp20(weakLink(runners));
    }

    case "aerial": {
      const targets = outfield
        .filter((s) => s.inSlot.startsWith("ST") || s.inSlot.startsWith("AM"))
        .map((m) =>
          averagePlayerAttributes(m.player, [
            "jumping_reach",
            "heading",
            "strength",
            "bravery",
          ]),
        );
      return targets.length > 0 ? clamp20(Math.max(...targets)) : 8.0;
    }

    case "recovery": {
      const cbs = outfield
        .filter((s) => s.outSlot.startsWith("DC"))
        .map((m) =>
          averagePlayerAttributes(m.player, [
            "pace",
            "acceleration",
            "anticipation",
            "positioning",
          ]),
        );
      return clamp20(weakLink(cbs));
    }

    case "direct":
    case "delivery":
    default: {
      const crossers = [...outfield]
        .sort(
          (a, b) =>
            averagePlayerAttributes(b.player, ["crossing", "passing", "vision", "technique"]) -
            averagePlayerAttributes(a.player, ["crossing", "passing", "vision", "technique"]),
        )
        .slice(0, 4)
        .map((m) =>
          averagePlayerAttributes(m.player, ["crossing", "passing", "vision", "technique"]),
        );
      return clamp20(weakLink(crossers));
    }
  }
}

export function coachingRuleApplies(
  rule: CoachingRule,
  context: {
    inSlots: readonly string[];
    outSlots: readonly string[];
    teamInstructions: Readonly<Record<string, number>>;
    highPress: boolean;
  },
): boolean {
  const ti = context.teamInstructions;
  const loe = ti.LineOfEngagement ?? 62;
  const pd = ti.PassingDirectness ?? 0;
  const tp = ti.TriggerPress ?? 0;
  const aw = ti.AttackingWidth ?? 0;
  const prog = ti.ProgressThrough ?? 0;

  switch (rule.When) {
    case "all":
      if (rule.Id === "width" && (aw === 52 || aw === 53)) return false;
      return true;
    case "high":
      return context.highPress || loe === 61 || tp === 65 || tp === 66;
    case "block":
      return loe === 62 || loe === 63;
    case "short":
      return pd === 3 || pd === 4 || ti.BuildUpStrategy === 7;
    case "wingbacks": {
      const cbCount = context.inSlots.filter((s) => s.startsWith("DC")).length;
      const hasWb = context.inSlots.includes("WBL") || context.inSlots.includes("WBR");
      return cbCount >= 3 || hasWb;
    }
    case "two-forwards": {
      const stCount = context.inSlots.filter((s) => s.startsWith("ST")).length;
      const hasAm = context.inSlots.some((s) => s === "AMC" || s === "AMCL" || s === "AMCR");
      return stCount >= 2 || (stCount >= 1 && hasAm);
    }
    case "counter":
      return ti.AttackingTransition === 54;
    case "direct":
      return pd === 1 || pd === 2 || ti.BuildUpStrategy === 8;
    case "wide":
      return (
        aw === 50 ||
        aw === 51 ||
        ti.Patience === 9 ||
        prog === 21 ||
        prog === 22 ||
        prog === 24
      );
    default:
      return true;
  }
}

export interface CoachingReviewOutput {
  coachingAdjustment: number;
  findings: CoachingFinding[];
  adjustedTeamInstructions: Record<string, number>;
}

/**
 * Evaluates all active coaching rules using `6 * tanh(sum(w*(r-t)) / (3.5*sum(w)))`
 * and optionally applies auto-adjustments when `finalize === true`.
 */
export function reviewCoachingKnowledge(params: {
  starters: readonly CoachingUnitStarter[];
  inSlots: readonly string[];
  outSlots: readonly string[];
  teamInstructions: Readonly<Record<string, number>>;
  styleName?: string;
  highPress: boolean;
  finalize: boolean;
  coachingKnowledge?: CoachingKnowledge;
  patchVersion?: string;
}): CoachingReviewOutput {
  const ck = params.coachingKnowledge ?? getCoachingKnowledge(params.patchVersion);
  const adjustedTi: Record<string, number> = { ...params.teamInstructions };

  const activeRules = ck.Rules.filter((r) =>
    coachingRuleApplies(r, {
      inSlots: params.inSlots,
      outSlots: params.outSlots,
      teamInstructions: adjustedTi,
      highPress: params.highPress,
    }),
  );

  let weightedDeltaSum = 0;
  let totalWeight = 0;
  const findings: CoachingFinding[] = [];

  // Map available auto-adjustments by metric for quick attachment
  const pendingFixesByMetric = new Map<
    string,
    { group: string; fromBit: number; toBit: number; text: string }
  >();

  for (const adj of ck.Adjustments) {
    const metricVal = computeLineMetric(adj.Metric, params.starters);
    const currentGroupBit = adjustedTi[adj.Group] ?? 0;
    const styleMatches = !params.styleName || params.styleName === adj.Style || currentGroupBit === adj.From;

    if (styleMatches && currentGroupBit === adj.From && metricVal < adj.Below) {
      pendingFixesByMetric.set(adj.Metric, {
        group: adj.Group,
        fromBit: adj.From,
        toBit: adj.To,
        text: `${adj.Prefix}: ${adj.Text}`,
      });
      if (params.finalize) {
        adjustedTi[adj.Group] = adj.To;
      }
    }
  }

  for (const rule of activeRules) {
    const rating = computeLineMetric(rule.Metric, params.starters);
    const delta = rating - rule.Target;
    weightedDeltaSum += rule.Weight * delta;
    totalWeight += rule.Weight;

    findings.push({
      ruleId: rule.Id,
      title: rule.Title,
      metric: rule.Metric,
      rating: Math.round(rating * 100) / 100,
      target: rule.Target,
      delta: Math.round(delta * 100) / 100,
      sources: rule.Sources,
      autoFix: pendingFixesByMetric.get(rule.Metric),
    });
  }

  const normalized = totalWeight > 0 ? weightedDeltaSum / (3.5 * totalWeight) : 0;
  const coachingAdjustment = 6.0 * Math.tanh(normalized);

  return {
    coachingAdjustment,
    findings,
    adjustedTeamInstructions: adjustedTi,
  };
}

/**
 * ScoreInstructionDemands (0x06000316): computes penalty when team instruction demands
 * exceed squad physical/technical capacities (PressCapacity < 13, Recovery < 12.5, etc.).
 */
export function scoreInstructionDemands(
  teamInstructions: Readonly<Record<string, number>>,
  starters: readonly CoachingUnitStarter[],
  highPress: boolean,
): { instructionPenalty: number; pressCost: number } {
  const pressCap = computeLineMetric("press", starters);
  const recoveryCap = computeLineMetric("recovery", starters);
  const buildCap = computeLineMetric("build", starters);
  const runsCap = computeLineMetric("runs", starters);
  const aerialCap = computeLineMetric("aerial", starters);
  const coverCap = computeLineMetric("cover", starters);

  let penalty = 0;
  let pressCost = 0;

  const loe = teamInstructions.LineOfEngagement ?? 62;
  const defLine = teamInstructions.DefensiveLine ?? 0;
  const trigPress = teamInstructions.TriggerPress ?? 0;

  // 1. Pressing & High Line vs PressCapacity (< 13) & Recovery (< 12.5)
  if (highPress || loe === 61 || trigPress === 65 || trigPress === 66) {
    if (pressCap < 13) {
      const deficit = 13 - pressCap;
      pressCost = deficit * (trigPress === 65 ? 0.9 : 0.6);
      penalty += deficit * (trigPress === 65 ? 0.85 : 0.55);
    }
  }
  if (defLine === 56 || defLine === 57) {
    if (recoveryCap < 12.5) {
      penalty += (12.5 - recoveryCap) * (defLine === 56 ? 1.0 : 0.65);
    }
  }

  // 2. Short Passing / Play Through Press vs BuildUp (< 12.5)
  const pd = teamInstructions.PassingDirectness ?? 0;
  if (pd === 3 || pd === 4 || teamInstructions.BuildUpStrategy === 7) {
    if (buildCap < 12.5) {
      penalty += (12.5 - buildCap) * 0.6;
    }
  }

  // 3. High Tempo vs BuildUp (< 12.0)
  const tempo = teamInstructions.Tempo ?? 0;
  if ((tempo === 46 || tempo === 47) && buildCap < 12.0) {
    penalty += (12.0 - buildCap) * 0.45;
  }

  // 4. Pass Into Space vs Runs (< 12.5)
  if (teamInstructions.PassReception === 5 && runsCap < 12.5) {
    penalty += (12.5 - runsCap) * 0.5;
  }

  // 5. Floated / Early Crosses vs Aerial (< 12.5)
  if (
    (teamInstructions.Crossing === 10 || teamInstructions.Patience === 9) &&
    aerialCap < 12.5
  ) {
    penalty += (12.5 - aerialCap) * 0.5;
  }

  // 6. Counter-Press vs Cover (< 12.0)
  if (teamInstructions.DefensiveTransition === 70 && coverCap < 12.0) {
    penalty += (12.0 - coverCap) * 0.55;
  }

  return { instructionPenalty: penalty, pressCost };
}
