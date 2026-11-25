import { getTrainingSessions } from "@fm27/fm-data";
import type {
  AttributeName,
  LoadMetrics,
  TrainingSession,
  WeeklySchedule,
} from "@fm27/shared-types";

export interface SessionRecommendation {
  session: TrainingSession;
  matchedAttributes: AttributeName[];
  relevanceScore: number;
}

/**
 * Recommends training sessions ordered by coverage of target/weakest squad or wonderkid attributes.
 */
export function recommendTrainingSessions(
  targetAttributes: readonly AttributeName[],
  options?: { unit?: "all" | "attacking" | "midfield" | "defending" | "goalkeeping"; patchVersion?: string },
): SessionRecommendation[] {
  const catalog = getTrainingSessions(options?.patchVersion);
  const unit = options?.unit ?? "all";
  const weightByAttr = new Map<AttributeName, number>();
  targetAttributes.forEach((attr, idx) => {
    // Earlier attributes in weakest list carry higher priority weight
    weightByAttr.set(attr, Math.max(1, targetAttributes.length - idx));
  });

  const recommendations: SessionRecommendation[] = [];

  for (const session of catalog.Sessions) {
    if (session.category === "rest" || session.code === "MATCH_DAY") continue;

    const covered = new Set<AttributeName>();
    const unitLists =
      unit === "all"
        ? [
            session.attributes.attacking,
            session.attributes.midfield,
            session.attributes.defending,
            session.attributes.goalkeeping,
          ]
        : [session.attributes[unit]];

    for (const list of unitLists) {
      for (const attr of list) {
        if (weightByAttr.has(attr)) covered.add(attr);
      }
    }

    if (covered.size === 0) continue;

    let score = 0;
    for (const attr of covered) {
      score += weightByAttr.get(attr) ?? 1;
    }
    // Slight efficiency bonus for lower injury impact
    const safetyAdjust = Math.max(0, 6 - session.impact.injuries) * 0.15;

    recommendations.push({
      session,
      matchedAttributes: Array.from(covered),
      relevanceScore: Math.round((score + safetyAdjust) * 100) / 100,
    });
  }

  return recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Evaluates cumulative weekly load metrics (`condition`, `fatigue`, `happiness`, `injuries`, `sharpness`)
 * and checks `max_sessions_per_week` constraints across a 7x3 `WeeklySchedule`.
 */
export function evaluateWeeklyScheduleLoad(
  schedule: WeeklySchedule,
  patchVersion?: string,
): LoadMetrics {
  const catalog = getTrainingSessions(patchVersion ?? schedule.patchVersion);
  const sessionByCode = new Map(catalog.Sessions.map((s) => [s.code, s]));

  let conditionDelta = 0;
  let fatigueDelta = 0;
  let happinessDelta = 0;
  let injuryRiskScore = 0;
  let sharpnessDelta = 0;

  const usageCounts = new Map<string, number>();

  for (const day of schedule.days) {
    for (const code of [day.s1, day.s2, day.extra]) {
      const session = sessionByCode.get(code);
      if (!session) continue;

      conditionDelta += session.impact.condition;
      fatigueDelta += session.impact.fatigue;
      happinessDelta += session.impact.happiness;
      injuryRiskScore += session.impact.injuries;
      sharpnessDelta += session.impact.sharpness;

      usageCounts.set(code, (usageCounts.get(code) ?? 0) + 1);
    }
  }

  const violations: LoadMetrics["violations"] = [];
  for (const [code, count] of usageCounts.entries()) {
    const session = sessionByCode.get(code);
    if (session && count > session.max_sessions_per_week) {
      violations.push({
        code,
        count,
        maxAllowed: session.max_sessions_per_week,
      });
    }
  }

  return {
    conditionDelta: Math.round(conditionDelta * 10) / 10,
    fatigueDelta: Math.round(fatigueDelta * 10) / 10,
    happinessDelta: Math.round(happinessDelta * 10) / 10,
    injuryRiskScore: Math.round(Math.max(0, injuryRiskScore) * 10) / 10,
    sharpnessDelta: Math.round(sharpnessDelta * 10) / 10,
    violations,
  };
}
