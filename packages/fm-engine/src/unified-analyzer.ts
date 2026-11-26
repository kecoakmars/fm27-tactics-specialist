import { getPatchData, type PatchBundle } from "@fm27/fm-data";
import type {
  AttributeName,
  DayOfWeek,
  DualPhaseTactic,
  Duty,
  LoadMetrics,
  PaRange,
  Player,
  SquadAuditResult,
  StaffAssignmentPlan,
  StaffCategoryId,
  StaffMember,
  StaffRole,
  TacticPlanResult,
  TrainingCategory,
  WeeklySchedule,
  Wonderkid,
} from "@fm27/shared-types";
import {
  computeTacticalBalance,
  type StructuralGapAlert,
  type TacticalBalanceReport,
} from "./balance-scorer.js";
import { computeSlotFit } from "./fit-calculator.js";
import { computeHeatmap18Zones, type Heatmap18ZoneResult } from "./heatmap-18zone.js";
import { normalizePlayer } from "./normalizer.js";
import { scoreSingleRoleQuality } from "./role-evaluator.js";
import {
  analyzeSquadAndGenerateTactics,
  gradeImportedTactic,
  selectPrimarySquadPlayers,
  type SquadAnalysisOptions,
} from "./squad-analyzer.js";
import { auditSquadAgainstTactic } from "./squad-audit.js";
import {
  calculateCategoryStarRating,
  optimizeStaffAssignments,
} from "./staff-calculator.js";
import { evaluateWeeklyScheduleLoad } from "./training-recommender.js";
import { rankWonderkidsForSlot } from "./wonderkid-ranker.js";

export type UnifiedAnalysisMode = "fmf-only" | "squad-only" | "combined";
export type TrainingUnitKey = "attacking" | "midfield" | "defending" | "goalkeeping";
export type LiveOrSeedDataSource = "Live dari File Save .fm" | "Dataset Seed Statis FM27";

export interface AlternativeShapeRecommendation {
  shapeId: string;
  styleId?: string;
  styleName?: string;
  inPossessionName: string;
  outOfPossessionName: string;
  highPress: boolean;
  compatibilityScore: number;
  rationale: string;
  tactic?: DualPhaseTactic;
}

export interface UnifiedTacticAdvice {
  activeTactic: DualPhaseTactic;
  recommendedTactic: DualPhaseTactic;
  heatmap: Heatmap18ZoneResult;
  balance: TacticalBalanceReport;
  structuralAdjustments: StructuralGapAlert[];
  alternativeShapes: AlternativeShapeRecommendation[];
  gradedPlan: TacticPlanResult | null;
  baselineRankingFit: number | null;
}

export interface SquadBlueprintSlot {
  slotIndex: number;
  inPositionId: string;
  outPositionId: string;
  inDuty: Duty;
  inRoleId: string;
  inRoleName: string;
  outRoleId: string;
  outRoleName: string;
  inKeyAttributes: [AttributeName, AttributeName, AttributeName, AttributeName, AttributeName];
  outKeyAttributes: [AttributeName, AttributeName, AttributeName, AttributeName, AttributeName];
  priorityKeyAttributes: [AttributeName, AttributeName, AttributeName, AttributeName, AttributeName];
  minTargetAttribute: number;
  idealTargetAttribute: number;
}

export interface UnifiedSquadSection {
  kind: "blueprint" | "audit";
  hasClubSquad: boolean;
  honestNote: string | null;
  blueprint: SquadBlueprintSlot[];
  audit: SquadAuditResult | null;
}

export interface AttributeFrequencyItem {
  attribute: AttributeName;
  count: number;
}

export interface SelectedTrainingSessionExplain {
  code: string;
  name: string;
  category: TrainingCategory;
  countUsed: number;
  maxSessionsPerWeek: number;
  trainedAttributes: AttributeName[];
  reason: string;
}

export interface UnifiedTrainingPlan {
  schedule: WeeklySchedule;
  loadMetrics: LoadMetrics;
  unitAttributeFrequencies: Record<TrainingUnitKey, AttributeFrequencyItem[]>;
  selectedSessions: SelectedTrainingSessionExplain[];
}

export interface StaffCandidateSummary {
  uid: number;
  name: string;
  club: string;
  nationality: string;
  age: number;
  isFreeAgent: boolean;
  preferredRole: StaffRole;
  wageEstimateEurWeekly: number;
  stars: number;
  rawScore: number;
}

export interface StaffCategoryRecommendation {
  categoryId: StaffCategoryId;
  label: string;
  group: "outfield" | "goalkeeping" | "fitness";
  priorityWeight: number;
  rationale: string;
  clubCurrentStars: number | null;
  clubLeadStaffUid: number | null;
  clubLeadStaffName: string | null;
  isWeakClubCategory: boolean;
  topStaff: StaffCandidateSummary[];
  topFreeAgents: StaffCandidateSummary[];
}

export interface UnifiedStaffPlan {
  dataSource: LiveOrSeedDataSource;
  hasClubStaff: boolean;
  clubAssignment: StaffAssignmentPlan | null;
  weakestClubCategories: StaffCategoryId[];
  categories: StaffCategoryRecommendation[];
}

export interface WonderkidKeyAttributeValue {
  attribute: AttributeName;
  value: number;
}

export interface WonderkidSlotCandidate {
  uid: number;
  name: string;
  age: number;
  club: string;
  nationality: string;
  paRange: PaRange;
  estimatedPriceEurM: number;
  roleFitScore: number;
  potentialScore: number;
  priceEfficiency: number;
  valueRatio: number;
  projectedFitGain: number | null;
  keyAttributes: WonderkidKeyAttributeValue[];
}

export interface WonderkidSlotPlan {
  slotIndex: number;
  inPositionId: string;
  outPositionId: string;
  inRoleId: string;
  inRoleName: string;
  outRoleId: string;
  outRoleName: string;
  isPriorityWeakSlot: boolean;
  currentStarterName: string | null;
  currentStarterFit: number | null;
  candidates: WonderkidSlotCandidate[];
}

export interface UnifiedWonderkidPlan {
  dataSource: LiveOrSeedDataSource;
  prioritySlotIndices: number[];
  slots: WonderkidSlotPlan[];
}

export interface UnifiedReport {
  mode: UnifiedAnalysisMode;
  deterministicBadge: "100% Data Deterministik (Non-AI)";
  patchVersion: string;
  tacticAdvice: UnifiedTacticAdvice;
  squadBlueprintOrAudit: UnifiedSquadSection;
  trainingPlan: UnifiedTrainingPlan;
  staffPlan: UnifiedStaffPlan;
  wonderkidPlan: UnifiedWonderkidPlan;
}

export interface AnalyzeUnifiedParams {
  tactic?: DualPhaseTactic | null;
  squad?: readonly Player[] | null;
  clubStaff?: readonly StaffMember[] | null;
  worldWonderkids?: readonly Wonderkid[] | null;
  worldStaffPool?: readonly StaffMember[] | null;
  dataset?: PatchBundle;
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

function classifyPositionUnit(positionId: string): TrainingUnitKey {
  if (positionId === "GK") return "goalkeeping";
  if (
    positionId === "DC" ||
    positionId === "DCL" ||
    positionId === "DCR" ||
    positionId === "DL" ||
    positionId === "DR" ||
    positionId === "WBL" ||
    positionId === "WBR"
  ) {
    return "defending";
  }
  if (
    positionId === "DMC" ||
    positionId === "DML" ||
    positionId === "DMR" ||
    positionId === "MC" ||
    positionId === "MCL" ||
    positionId === "MCR" ||
    positionId === "ML" ||
    positionId === "MR"
  ) {
    return "midfield";
  }
  return "attacking";
}

function buildModeACoachingAlerts(
  tactic: DualPhaseTactic,
  dataset: PatchBundle,
  existingAlerts: readonly StructuralGapAlert[],
): StructuralGapAlert[] {
  const merged = [...existingAlerts];
  const seenIds = new Set(merged.map((a) => a.id));
  const ti = tactic.teamInstructions;

  for (const adj of dataset.coachingKnowledge.Adjustments) {
    const activeBit = ti[adj.Group] ?? 0;
    if (activeBit !== adj.From) continue;

    const rule = dataset.coachingKnowledge.Rules.find((r) => r.Metric === adj.Metric);
    const id = `ck-adj-${adj.Metric}-${adj.Group}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    merged.push({
      id,
      severity: "info",
      title: `${adj.Prefix} (Target Metric ${adj.Metric} ≥ ${adj.Below})`,
      detail: rule
        ? `${rule.Detail} Fallback adjustment ready if squad "${adj.Metric}" < ${adj.Below}.`
        : `${adj.Text} (applies when unit "${adj.Metric}" < ${adj.Below}).`,
      citations: rule?.Sources ?? [],
      autoFix: {
        group: adj.Group,
        fromBit: adj.From,
        toBit: adj.To,
        text: `${adj.Prefix}: ${adj.Text}`,
      },
    });
  }

  return merged;
}

function rankAlternativeStyleShapesForTactic(
  tactic: DualPhaseTactic,
  dataset: PatchBundle,
): AlternativeShapeRecommendation[] {
  const styles = dataset.tacticalStyles.TacticalStyles;
  const matchedStyle = tactic.styleId
    ? styles.find(
        (s) =>
          s.Id.toLowerCase() === tactic.styleId!.toLowerCase() ||
          s.Name.toLowerCase() === tactic.styleId!.toLowerCase(),
      )
    : styles.find((s) => tactic.title.toLowerCase().includes(s.Name.toLowerCase()));

  const isHighPress =
    (tactic.teamInstructions.LineOfEngagement ?? 62) === 61 ||
    (tactic.teamInstructions.TriggerPress ?? 0) === 65;

  const allowedSet = new Set(matchedStyle?.Allows ?? []);
  const activeInSet = new Set(tactic.slots.map((s) => s.inPossession.positionId));
  const activeOutSet = new Set(tactic.slots.map((s) => s.outOfPossession.positionId));

  const scored = dataset.tacticalStyles.StyleShapes.map((shape) => {
    const sameNames =
      shape.InPossessionName === tactic.inFormation &&
      shape.OutOfPossessionName === tactic.outFormation;

    let inOverlap = 0;
    let outOverlap = 0;
    for (const p of shape.InSlots) if (activeInSet.has(p)) inOverlap++;
    for (const p of shape.OutSlots) if (activeOutSet.has(p)) outOverlap++;

    const exactSameSlots = inOverlap === 11 && outOverlap === 11;
    let score = 55;
    if (allowedSet.has(shape.Id)) score += 22;
    if (shape.HighPress === isHighPress) score += 12;
    score += ((inOverlap + outOverlap) / 22) * 14;
    if (shape.InPossessionName !== shape.OutOfPossessionName) score += 4;
    if (exactSameSlots) score -= 35;
    else if (sameNames) score -= 8;

    const reasons: string[] = [];
    if (matchedStyle && allowedSet.has(shape.Id)) {
      reasons.push(`Kompatibel penuh dengan gaya ${matchedStyle.Name}`);
    }
    reasons.push(
      shape.HighPress
        ? "Blok tinggi agresif untuk menekan transisi lawan"
        : "Struktur mid/low-block kompak menjaga rest-defense",
    );
    reasons.push(`Kemiripan slot ${Math.round(((inOverlap + outOverlap) / 22) * 100)}%`);

    return {
      shapeId: shape.Id,
      ...(matchedStyle ? { styleId: matchedStyle.Id, styleName: matchedStyle.Name } : {}),
      inPossessionName: shape.InPossessionName,
      outOfPossessionName: shape.OutOfPossessionName,
      highPress: shape.HighPress,
      compatibilityScore: round1(Math.max(10, Math.min(99, score))),
      rationale: reasons.join(" · "),
    };
  });

  scored.sort(
    (a, b) =>
      b.compatibilityScore - a.compatibilityScore || a.shapeId.localeCompare(b.shapeId),
  );
  return scored.slice(0, 3);
}

function buildSquadBlueprint(
  tactic: DualPhaseTactic,
  dataset: PatchBundle,
): SquadBlueprintSlot[] {
  const roleById = new Map(dataset.roleProfiles.Roles.map((r) => [r.Id, r]));
  const pitchRoleNameById = new Map(dataset.pitchCatalog.Roles.map((r) => [r.Id, r.Name]));
  const minTarget = tactic.mentality >= 5 ? 14 : 13;
  const idealTarget = tactic.mentality >= 5 ? 16 : 15;

  return tactic.slots.map((slot, idx) => {
    const inProfile = roleById.get(slot.inPossession.roleId) ?? dataset.roleProfiles.Roles[0]!;
    const outProfile =
      roleById.get(slot.outOfPossession.roleId) ?? dataset.roleProfiles.Roles[0]!;

    const inKeys = [...inProfile.Keys] as [
      AttributeName,
      AttributeName,
      AttributeName,
      AttributeName,
      AttributeName,
    ];
    const outKeys = [...outProfile.Keys] as [
      AttributeName,
      AttributeName,
      AttributeName,
      AttributeName,
      AttributeName,
    ];

    const mergedUnique: AttributeName[] = [];
    for (let k = 0; k < 5; k++) {
      const a = inKeys[k]!;
      const b = outKeys[k]!;
      if (!mergedUnique.includes(a)) mergedUnique.push(a);
      if (!mergedUnique.includes(b)) mergedUnique.push(b);
    }
    const priorityFive = mergedUnique.slice(0, 5) as [
      AttributeName,
      AttributeName,
      AttributeName,
      AttributeName,
      AttributeName,
    ];

    return {
      slotIndex: slot.slotIndex ?? idx,
      inPositionId: slot.inPossession.positionId,
      outPositionId: slot.outOfPossession.positionId,
      inDuty: slot.inPossession.duty,
      inRoleId: slot.inPossession.roleId,
      inRoleName:
        pitchRoleNameById.get(slot.inPossession.roleId) ?? inProfile.Name,
      outRoleId: slot.outOfPossession.roleId,
      outRoleName:
        pitchRoleNameById.get(slot.outOfPossession.roleId) ?? outProfile.Name,
      inKeyAttributes: inKeys,
      outKeyAttributes: outKeys,
      priorityKeyAttributes: priorityFive,
      minTargetAttribute: minTarget,
      idealTargetAttribute: idealTarget,
    };
  });
}

function buildUnifiedTrainingPlan(params: {
  tactic: DualPhaseTactic;
  audit: SquadAuditResult | null;
  dataset: PatchBundle;
  patchVersion: string;
}): UnifiedTrainingPlan {
  const { tactic, audit, dataset, patchVersion } = params;
  const roleById = new Map(dataset.roleProfiles.Roles.map((r) => [r.Id, r]));

  const unitCounters: Record<TrainingUnitKey, Map<AttributeName, number>> = {
    attacking: new Map(),
    midfield: new Map(),
    defending: new Map(),
    goalkeeping: new Map(),
  };

  // 1. Count exact attribute frequencies across all 22 IP & OOP roles per unit
  for (const slot of tactic.slots) {
    const inUnit = classifyPositionUnit(slot.inPossession.positionId);
    const outUnit = classifyPositionUnit(slot.outOfPossession.positionId);
    const inRole = roleById.get(slot.inPossession.roleId);
    const outRole = roleById.get(slot.outOfPossession.roleId);

    if (inRole) {
      for (const key of inRole.Keys as AttributeName[]) {
        unitCounters[inUnit].set(key, (unitCounters[inUnit].get(key) ?? 0) + 1);
      }
    }
    if (outRole) {
      for (const key of outRole.Keys as AttributeName[]) {
        unitCounters[outUnit].set(key, (unitCounters[outUnit].get(key) ?? 0) + 1);
      }
    }
  }

  // 2. When real squad audit exists (Mode B / Mode C), boost weakest XI attributes per unit
  if (audit) {
    for (const starter of audit.starterAudits) {
      const unit = classifyPositionUnit(starter.inSlot);
      for (const gap of starter.keyAttributeGaps) {
        const boost = Math.max(1, Math.round((gap.target - gap.value) * 1.5));
        unitCounters[unit].set(
          gap.attribute,
          (unitCounters[unit].get(gap.attribute) ?? 0) + boost,
        );
      }
    }
  }

  const unitAttributeFrequencies = {} as Record<TrainingUnitKey, AttributeFrequencyItem[]>;
  for (const unit of ["attacking", "midfield", "defending", "goalkeeping"] as const) {
    unitAttributeFrequencies[unit] = [...unitCounters[unit].entries()]
      .map(([attribute, count]) => ({ attribute, count }))
      .sort((a, b) => b.count - a.count || a.attribute.localeCompare(b.attribute));
  }

  // 3. Score all sessions in `training-sessions.json`
  const sessions = dataset.trainingSessions.Sessions;
  const sessionByCode = new Map(sessions.map((s) => [s.code, s]));

  const scoredCandidates = sessions
    .filter(
      (s) =>
        s.code !== "REST" &&
        s.code !== "RECOVERY" &&
        s.code !== "MATCH_DAY" &&
        s.code !== "MATCH_TACTICS",
    )
    .map((session) => {
      let rawScore = 0;
      const matched = new Set<AttributeName>();
      const unitHits: string[] = [];

      for (const unit of ["attacking", "midfield", "defending", "goalkeeping"] as const) {
        let unitGain = 0;
        for (const attr of session.attributes[unit]) {
          const w = unitCounters[unit].get(attr) ?? 0;
          if (w > 0) {
            unitGain += w;
            matched.add(attr);
          }
        }
        if (unitGain > 0) {
          const unitWeight = unit === "goalkeeping" ? 1.25 : 1.0;
          rawScore += unitGain * unitWeight;
          unitHits.push(unit);
        }
      }

      const safetyBonus = Math.max(0, 7 - session.impact.injuries) * 0.25;
      const sharpnessBonus = Math.max(0, session.impact.sharpness) * 0.15;
      const score = round2(rawScore + safetyBonus + sharpnessBonus);

      return {
        session,
        score,
        matchedAttributes: [...matched].sort(),
        unitHits,
      };
    })
    .filter((c) => c.matchedAttributes.length > 0)
    .sort((a, b) => b.score - a.score || a.session.code.localeCompare(b.session.code));

  // 4. Construct compliant 7x3 schedule strictly obeying `max_sessions_per_week`
  const usageCounts = new Map<string, number>();
  const canPlace = (code: string, maxCapOverride?: number): boolean => {
    const sess = sessionByCode.get(code);
    if (!sess) return false;
    const used = usageCounts.get(code) ?? 0;
    const cap =
      maxCapOverride !== undefined
        ? Math.min(sess.max_sessions_per_week, maxCapOverride)
        : sess.max_sessions_per_week;
    return used < cap;
  };
  const markUsed = (code: string): string => {
    usageCounts.set(code, (usageCounts.get(code) ?? 0) + 1);
    return code;
  };

  // Reserve Match Day, Sunday Recovery, and Friday Match Prep first
  markUsed("MATCH_DAY");
  markUsed("RECOVERY");
  const friS1 = canPlace("MATCH_TACTICS") ? markUsed("MATCH_TACTICS") : markUsed("REST");
  const friExtra = canPlace("SET_PIECES", 1) ? markUsed("SET_PIECES") : markUsed("REST");
  const wedExtra = canPlace("RECOVERY", 2) ? markUsed("RECOVERY") : markUsed("REST");

  // Fill 12 active training slots across Mon(3), Tue(3), Wed(2), Thu(3), Fri(1)
  // First pass caps each session at min(2, max_sessions_per_week) for rich tactical variety across units
  const pickedSlots: string[] = [];
  const targetSlotCount = 12;

  for (const maxPerSessionPass of [1, 2, 3]) {
    for (const cand of scoredCandidates) {
      if (pickedSlots.length >= targetSlotCount) break;
      // Limit high-injury physical drills to at most 2 total slots
      const cap =
        cand.session.category === "physical"
          ? Math.min(maxPerSessionPass, 1)
          : maxPerSessionPass;
      if (canPlace(cand.session.code, cap)) {
        pickedSlots.push(markUsed(cand.session.code));
      }
    }
    if (pickedSlots.length >= targetSlotCount) break;
  }

  while (pickedSlots.length < targetSlotCount) {
    pickedSlots.push(markUsed("REST"));
  }

  const daysOrder: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const days: WeeklySchedule["days"] = [
    { day: daysOrder[0]!, s1: pickedSlots[0]!, s2: pickedSlots[1]!, extra: pickedSlots[2]! },
    { day: daysOrder[1]!, s1: pickedSlots[3]!, s2: pickedSlots[4]!, extra: pickedSlots[5]! },
    { day: daysOrder[2]!, s1: pickedSlots[6]!, s2: pickedSlots[7]!, extra: wedExtra },
    { day: daysOrder[3]!, s1: pickedSlots[8]!, s2: pickedSlots[9]!, extra: pickedSlots[10]! },
    { day: daysOrder[4]!, s1: friS1, s2: pickedSlots[11]!, extra: friExtra },
    { day: daysOrder[5]!, s1: "MATCH_DAY", s2: "REST", extra: "REST" },
    { day: daysOrder[6]!, s1: "RECOVERY", s2: "REST", extra: "REST" },
  ];

  // Fix exact usage counts from finalized days
  const finalCounts = new Map<string, number>();
  for (const d of days) {
    for (const c of [d.s1, d.s2, d.extra]) {
      finalCounts.set(c, (finalCounts.get(c) ?? 0) + 1);
    }
  }

  const schedule: WeeklySchedule = {
    id: `unified-${tactic.inFormation.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name: `${tactic.title.slice(0, 48)} — 7x3 Microcycle`,
    description: audit
      ? `Jadwal deterministik penambal atribut terlemah XI (${audit.weakestTeamAttributes.slice(0, 4).join(", ")}) & 22 role IP/OOP.`
      : `Jadwal deterministik berbasis frekuensi atribut kunci 22 role IP/OOP (${tactic.inFormation} -> ${tactic.outFormation}).`,
    focus_tags: ["deterministic", tactic.inFormation, tactic.outFormation],
    patchVersion,
    days,
  };

  const loadMetrics = evaluateWeeklyScheduleLoad(schedule, patchVersion);

  const candByCode = new Map(scoredCandidates.map((c) => [c.session.code, c]));
  const selectedSessions: SelectedTrainingSessionExplain[] = [];
  for (const [code, countUsed] of finalCounts.entries()) {
    if (code === "REST" || code === "MATCH_DAY") continue;
    const sess = sessionByCode.get(code);
    if (!sess) continue;
    const cand = candByCode.get(code);
    const trained =
      cand?.matchedAttributes.slice(0, 5) ??
      Array.from(
        new Set([
          ...sess.attributes.attacking,
          ...sess.attributes.midfield,
          ...sess.attributes.defending,
          ...sess.attributes.goalkeeping,
        ]),
      ).slice(0, 5);

    const reason =
      code === "RECOVERY"
        ? "Menekan akumulasi fatigue & risiko cedera pasca-laga / tengah pekan."
        : code === "MATCH_TACTICS"
          ? `Meningkatkan kohesi transisi dual-phase (${tactic.inFormation} -> ${tactic.outFormation}).`
          : code === "SET_PIECES"
            ? "Memaksimalkan eksekusi bola mati pra-pertandingan tanpa membebani kondisi fisik."
            : `Melatih atribut prioritas taktik: ${trained.join(", ")}.`;

    selectedSessions.push({
      code: sess.code,
      name: sess.name,
      category: sess.category,
      countUsed,
      maxSessionsPerWeek: sess.max_sessions_per_week,
      trainedAttributes: trained,
      reason,
    });
  }

  selectedSessions.sort(
    (a, b) => b.countUsed - a.countUsed || a.code.localeCompare(b.code),
  );

  return {
    schedule,
    loadMetrics,
    unitAttributeFrequencies,
    selectedSessions,
  };
}

function buildUnifiedStaffPlan(params: {
  tactic: DualPhaseTactic;
  audit: SquadAuditResult | null;
  clubStaff: readonly StaffMember[] | null | undefined;
  worldStaffPool: readonly StaffMember[] | null | undefined;
  dataset: PatchBundle;
  patchVersion: string;
}): UnifiedStaffPlan {
  const { tactic, audit, clubStaff, worldStaffPool, dataset, patchVersion } = params;
  const ti = tactic.teamInstructions;
  const loe = ti.LineOfEngagement ?? 62;
  const pd = ti.PassingDirectness ?? 0;
  const tempo = ti.Tempo ?? 0;
  const isHighPress = loe === 61 || (ti.TriggerPress ?? 0) === 65;
  const isShortPossession = pd === 3 || pd === 4 || ti.BuildUpStrategy === 7;
  const isHighTempo = tempo === 46 || tempo === 47 || ti.AttackingTransition === 54;

  const attackDuties = tactic.slots.filter((s) => s.inPossession.duty === "Attack").length;
  const bpdOrBpGk = tactic.slots.filter(
    (s) =>
      s.inPossession.roleId.includes("BallPlaying") ||
      s.inPossession.roleId.includes("Playmaker"),
  ).length;

  const weightMap = new Map<StaffCategoryId, { weight: number; rationale: string }>([
    [
      "possession_tactical",
      {
        weight: 68 + (isShortPossession ? 18 : 4) + bpdOrBpGk * 2,
        rationale: isShortPossession
          ? "Passing pendek & build-up menuntut antisipasi, visi, dan keputusan posisi tinggi."
          : "Menjaga struktur progresi bola dari lini belakang ke tengah.",
      },
    ],
    [
      "possession_technical",
      {
        weight: 66 + (isShortPossession ? 16 : 4) + bpdOrBpGk * 2,
        rationale: "First touch, passing, dan teknik kontrol di ruang sempit.",
      },
    ],
    [
      "defending_tactical",
      {
        weight: 70 + (isHighPress ? 14 : 12),
        rationale: isHighPress
          ? "Koordinasi jebakan offside, antisipasi counter-press, dan posisi rest-defense."
          : "Disiplin bentuk blok pertahanan OOP & penjagaan ruang.",
      },
    ],
    [
      "defending_technical",
      {
        weight: 64 + (ti.Tackling === 73 ? 14 : 6),
        rationale: "Kualitas tekel bersih, marking, dan duel 1v1.",
      },
    ],
    [
      "attacking_tactical",
      {
        weight: 67 + attackDuties * 3 + (tactic.mentality >= 5 ? 8 : 2),
        rationale: ` Pergerakan tanpa bola & sinkronisasi ${attackDuties} slot ber-duty Attack.`,
      },
    ],
    [
      "attacking_technical",
      {
        weight: 65 + attackDuties * 3,
        rationale: "Penyelesaian akhir, umpan silang, dan eksekusi di sepertiga akhir.",
      },
    ],
    [
      "fitness_quickness",
      {
        weight: 66 + (isHighPress ? 18 : 0) + (isHighTempo ? 10 : 0),
        rationale:
          isHighPress || isHighTempo
            ? "Akselerasi, pace, & pemulihan sprint krusial untuk pressing/transisi cepat."
            : "Menjaga kelincahan & kecepatan transisi.",
      },
    ],
    [
      "fitness_strength",
      {
        weight: 62 + (isHighPress ? 12 : 6),
        rationale: "Stamina, natural fitness, dan ketahanan duel fisik sepanjang 90 menit.",
      },
    ],
    [
      "gk_handling",
      {
        weight:
          58 +
          (tactic.slots.some((s) => s.inPossession.roleId === "BallPlayingGoalkeeper")
            ? 18
            : 4),
        rationale: "Distribusi kaki kiper & tangkapan bola atas untuk memulai build-up.",
      },
    ],
    [
      "gk_shot_stopping",
      {
        weight:
          60 +
          (tactic.slots.some((s) => s.outOfPossession.roleId === "OPSweeperKeeper") ? 14 : 6),
        rationale: "Refleks & duel 1-lawan-1 mengawal ruang di belakang garis pertahanan.",
      },
    ],
  ]);

  if (audit) {
    for (const weakAttr of audit.weakestTeamAttributes.slice(0, 4)) {
      if (weakAttr === "pace" || weakAttr === "acceleration" || weakAttr === "agility") {
        const cur = weightMap.get("fitness_quickness")!;
        weightMap.set("fitness_quickness", { ...cur, weight: cur.weight + 10 });
      } else if (weakAttr === "stamina" || weakAttr === "strength") {
        const cur = weightMap.get("fitness_strength")!;
        weightMap.set("fitness_strength", { ...cur, weight: cur.weight + 10 });
      } else if (weakAttr === "passing" || weakAttr === "first_touch" || weakAttr === "technique") {
        const cur = weightMap.get("possession_technical")!;
        weightMap.set("possession_technical", { ...cur, weight: cur.weight + 10 });
      } else if (weakAttr === "positioning" || weakAttr === "anticipation") {
        const cur = weightMap.get("defending_tactical")!;
        weightMap.set("defending_tactical", { ...cur, weight: cur.weight + 10 });
      } else if (weakAttr === "tackling" || weakAttr === "marking") {
        const cur = weightMap.get("defending_technical")!;
        weightMap.set("defending_technical", { ...cur, weight: cur.weight + 10 });
      } else if (weakAttr === "finishing" || weakAttr === "crossing") {
        const cur = weightMap.get("attacking_technical")!;
        weightMap.set("attacking_technical", { ...cur, weight: cur.weight + 10 });
      }
    }
  }

  const hasClubStaff = Boolean(clubStaff && clubStaff.length > 0);
  const clubAssignment = hasClubStaff
    ? optimizeStaffAssignments(clubStaff!, patchVersion)
    : null;
  const clubStaffByUid = new Map((clubStaff ?? []).map((s) => [s.uid, s]));
  const clubAssignByCat = new Map(
    (clubAssignment?.assignments ?? []).map((a) => [a.categoryId, a]),
  );

  // Determine 3 weakest club star categories when clubStaff is present
  const weakestClubCategories: StaffCategoryId[] = clubAssignment
    ? [...clubAssignment.assignments]
        .sort(
          (a, b) =>
            a.effectiveStars - b.effectiveStars ||
            (weightMap.get(b.categoryId)?.weight ?? 0) -
              (weightMap.get(a.categoryId)?.weight ?? 0),
        )
        .slice(0, 3)
        .map((a) => a.categoryId)
    : [];
  const weakCatSet = new Set(weakestClubCategories);

  const hasLiveStaffPool = Boolean(worldStaffPool && worldStaffPool.length > 0);
  const dataSource: LiveOrSeedDataSource = hasLiveStaffPool
    ? "Live dari File Save .fm"
    : "Dataset Seed Statis FM27";
  const rawPool = hasLiveStaffPool ? worldStaffPool! : dataset.staffSeed.Staff;
  const candidatePool =
    clubStaffByUid.size > 0
      ? rawPool.filter((m) => !clubStaffByUid.has(m.uid))
      : rawPool;

  const categories: StaffCategoryRecommendation[] = dataset.staffFormulas.categories.map(
    (formula) => {
      const meta = weightMap.get(formula.id) ?? {
        weight: 60,
        rationale: "Kategori latihan standar klub.",
      };
      const clubItem = clubAssignByCat.get(formula.id);
      const isWeak = weakCatSet.has(formula.id);
      const effectivePriority = Math.min(
        100,
        meta.weight + (isWeak ? 15 : 0),
      );

      const evaluated = candidatePool
        .map((member) => {
          const rating = calculateCategoryStarRating(member.attributes, formula);
          return {
            uid: member.uid,
            name: member.name,
            club: member.club,
            nationality: member.nationality,
            age: member.age,
            isFreeAgent: member.isFreeAgent,
            preferredRole: member.preferredRole,
            wageEstimateEurWeekly: member.wageEstimateEurWeekly,
            stars: rating.stars,
            rawScore: rating.rawScore,
          };
        })
        .sort(
          (a, b) =>
            b.stars - a.stars ||
            b.rawScore - a.rawScore ||
            a.wageEstimateEurWeekly - b.wageEstimateEurWeekly ||
            a.uid - b.uid,
        );

      return {
        categoryId: formula.id,
        label: formula.label,
        group: formula.group,
        priorityWeight: effectivePriority,
        rationale: meta.rationale,
        clubCurrentStars: clubItem?.effectiveStars ?? null,
        clubLeadStaffUid: clubItem?.leadStaffUid ?? null,
        clubLeadStaffName: clubItem
          ? clubStaffByUid.get(clubItem.leadStaffUid)?.name ?? null
          : null,
        isWeakClubCategory: isWeak,
        topStaff: evaluated.slice(0, 3),
        topFreeAgents: evaluated.filter((s) => s.isFreeAgent).slice(0, 3),
      };
    },
  );

  categories.sort(
    (a, b) =>
      Number(b.isWeakClubCategory) - Number(a.isWeakClubCategory) ||
      b.priorityWeight - a.priorityWeight ||
      a.categoryId.localeCompare(b.categoryId),
  );

  return {
    dataSource,
    hasClubStaff,
    clubAssignment,
    weakestClubCategories,
    categories,
  };
}

function buildUnifiedWonderkidPlan(params: {
  tactic: DualPhaseTactic;
  audit: SquadAuditResult | null;
  squad: readonly Player[] | null | undefined;
  worldWonderkids: readonly Wonderkid[] | null | undefined;
  dataset: PatchBundle;
  patchVersion: string;
}): UnifiedWonderkidPlan {
  const { tactic, audit, squad, worldWonderkids, dataset, patchVersion } = params;
  const hasLiveWonderkids = Boolean(worldWonderkids && worldWonderkids.length > 0);
  const dataSource: LiveOrSeedDataSource = hasLiveWonderkids
    ? "Live dari File Save .fm"
    : "Dataset Seed Statis FM27";
  const clubPlayerUids = new Set((squad ?? []).map((p) => p.uid));
  const clubNamesLower = new Set(
    (squad ?? [])
      .map((p) => p.clubName?.trim().toLowerCase())
      .filter((x): x is string => Boolean(x)),
  );
  const baseWonderkids = hasLiveWonderkids
    ? worldWonderkids!
    : dataset.wonderkidsSeed.Wonderkids;
  const eligibleWonderkids =
    clubPlayerUids.size > 0
      ? baseWonderkids.filter(
          (wk) =>
            !clubPlayerUids.has(wk.uid) &&
            !clubNamesLower.has(wk.club.trim().toLowerCase()),
        )
      : baseWonderkids;
  const roleById = new Map(dataset.roleProfiles.Roles.map((r) => [r.Id, r]));
  const pitchRoleNameById = new Map(dataset.pitchCatalog.Roles.map((r) => [r.Id, r.Name]));
  const specialistSet = new Set(dataset.roleProfiles.SpecialistRoles);

  const prioritySlotIndices = audit
    ? [...audit.weakestThreeSlotIndices]
    : [0, 1, 2].filter((idx) => idx < tactic.slots.length);
  const prioritySet = new Set(prioritySlotIndices);
  const auditBySlot = new Map(
    (audit?.starterAudits ?? []).map((item) => [item.slotIndex, item]),
  );

  const slots: WonderkidSlotPlan[] = tactic.slots.map((slot, idx) => {
    const slotIdx = slot.slotIndex ?? idx;
    const inProfile = roleById.get(slot.inPossession.roleId) ?? dataset.roleProfiles.Roles[0]!;
    const outProfile =
      roleById.get(slot.outOfPossession.roleId) ?? dataset.roleProfiles.Roles[0]!;
    const starterAudit = auditBySlot.get(slotIdx);

    const ranked = rankWonderkidsForSlot(
      { ...slot, slotIndex: slotIdx },
      {
        styleId: tactic.styleId,
        limit: 3,
        patchVersion,
      },
      eligibleWonderkids,
    );

    const candidates: WonderkidSlotCandidate[] = ranked.map((r) => {
      // Verify direct computeSlotFit consistency alongside wonderkid-ranker
      const normWk = normalizePlayer(
        {
          uid: r.wonderkid.uid,
          name: r.wonderkid.name,
          age: r.wonderkid.age,
          clubName: r.wonderkid.club,
          nationality: r.wonderkid.nationality,
          leftFoot: r.wonderkid.leftFoot,
          rightFoot: r.wonderkid.rightFoot,
          currentAbility: r.wonderkid.currentAbilityEstimate,
          attributes: r.wonderkid.attributes,
          positions: r.wonderkid.positionFamiliarity,
        },
        patchVersion,
      );
      const inQ = scoreSingleRoleQuality(
        normWk,
        slot.inPossession.positionId,
        inProfile,
        specialistSet,
      );
      const outQ = scoreSingleRoleQuality(
        normWk,
        slot.outOfPossession.positionId,
        outProfile,
        specialistSet,
      );
      const directFit = round2(
        Math.max(
          0,
          Math.min(
            100,
            computeSlotFit(
              normWk,
              slot.inPossession.positionId,
              slot.outOfPossession.positionId,
              inQ,
              outQ,
            ),
          ),
        ),
      );
      const roleFitScore = r.roleFitScore || directFit;

      const keyAttributes: WonderkidKeyAttributeValue[] = (
        inProfile.Keys as readonly AttributeName[]
      ).map((attr) => ({
        attribute: attr,
        value: r.wonderkid.attributes[attr] ?? 10,
      }));

      return {
        uid: r.wonderkid.uid,
        name: r.wonderkid.name,
        age: r.wonderkid.age,
        club: r.wonderkid.club,
        nationality: r.wonderkid.nationality,
        paRange: r.wonderkid.paRange,
        estimatedPriceEurM: r.wonderkid.estimatedPriceEurM,
        roleFitScore,
        potentialScore: r.potentialScore,
        priceEfficiency: r.priceEfficiency,
        valueRatio: r.valueRatio,
        projectedFitGain:
          starterAudit !== undefined
            ? round2(roleFitScore - starterAudit.fitScore)
            : null,
        keyAttributes,
      };
    });

    return {
      slotIndex: slotIdx,
      inPositionId: slot.inPossession.positionId,
      outPositionId: slot.outOfPossession.positionId,
      inRoleId: slot.inPossession.roleId,
      inRoleName: pitchRoleNameById.get(slot.inPossession.roleId) ?? inProfile.Name,
      outRoleId: slot.outOfPossession.roleId,
      outRoleName: pitchRoleNameById.get(slot.outOfPossession.roleId) ?? outProfile.Name,
      isPriorityWeakSlot: Boolean(audit && prioritySet.has(slotIdx)),
      currentStarterName: starterAudit?.playerName ?? null,
      currentStarterFit: starterAudit?.fitScore ?? null,
      candidates,
    };
  });

  // In squad modes (Mode B / Mode C), surface the 3 weakest club slots first
  if (audit) {
    slots.sort((a, b) => {
      const rankA = prioritySlotIndices.indexOf(a.slotIndex);
      const rankB = prioritySlotIndices.indexOf(b.slotIndex);
      if (rankA !== -1 && rankB !== -1) return rankA - rankB;
      if (rankA !== -1) return -1;
      if (rankB !== -1) return 1;
      return a.slotIndex - b.slotIndex;
    });
  }

  return {
    dataSource,
    prioritySlotIndices,
    slots,
  };
}

function selectPrimarySolverSquad(squad: readonly Player[]): readonly Player[] {
  const firstTeam = squad.filter((p) => p.teamSlot === "First Team");
  if (firstTeam.length >= 11) {
    const gks = firstTeam.filter((p) => (p.positions.GK ?? 0) >= 15);
    const outfielders = firstTeam.filter(
      (p) =>
        (p.positions.GK ?? 0) < 15 &&
        Math.max(
          ...Object.entries(p.positions)
            .filter(([k]) => k !== "GK")
            .map(([, v]) => v),
        ) >= 10,
    );
    if (gks.length >= 1 && outfielders.length >= 10) {
      return firstTeam;
    }
  }
  return squad;
}

const UNDERDOG_REACTIVE_STYLE_IDS = new Set<string>([
  "ParkTheBus",
  "RouteOne",
  "Catenaccio",
  "DirectCounterAttack",
]);

function solveAll13StylesBy16Shapes(
  squad: readonly Player[],
  dataset: PatchBundle,
  patchVersion: string,
  options?: Pick<SquadAnalysisOptions, "lineupPreferences" | "priorities">,
): Array<{
  styleId: string;
  styleName: string;
  plan: TacticPlanResult;
  selectionScore: number;
  rationale: string;
}> {
  const normalized = squad.map((p) => normalizePlayer(p, patchVersion));
  const sortedByAbility = [...normalized].sort((a, b) => b.ability - a.ability);
  const top11 = sortedByAbility.slice(0, 11);
  const top6Outfield = sortedByAbility.filter((p) => !p.isGoalkeeper).slice(0, 6);
  const avgTop11Ability =
    top11.length > 0
      ? top11.reduce((acc, p) => acc + p.ability, 0) / top11.length
      : 12;

  const starWideAttackers = top6Outfield.filter(
    (p) => (p.positions.AML ?? 0) >= 16 || (p.positions.AMR ?? 0) >= 16,
  ).length;
  const starPlaymaker10s = top6Outfield.filter(
    (p) => (p.positions.AMC ?? 0) >= 18,
  ).length;
  const naturalStrikers = normalized.filter(
    (p) => !p.isGoalkeeper && (p.positions.STC ?? 0) >= 17 && p.ability >= avgTop11Ability - 1.5,
  ).length;
  const naturalWingbacks = normalized.filter(
    (p) => ((p.positions.WBL ?? 0) >= 16 || (p.positions.WBR ?? 0) >= 16) && p.ability >= avgTop11Ability - 1.5,
  ).length;

  const allCandidates: Array<{
    styleId: string;
    styleName: string;
    plan: TacticPlanResult;
    selectionScore: number;
    rationale: string;
  }> = [];

  for (const style of dataset.tacticalStyles.TacticalStyles) {
    const plans = analyzeSquadAndGenerateTactics(squad, {
      styleId: style.Id,
      priorities: options?.priorities,
      lineupPreferences: options?.lineupPreferences,
      patchVersion,
    });
    for (const plan of plans) {
      let alignment = 0;
      const notes: string[] = [];

      // 1. Club quality vs tactical ambition alignment
      if (avgTop11Ability >= 14.2) {
        if (UNDERDOG_REACTIVE_STYLE_IDS.has(style.Id)) {
          alignment -= 4.5;
        } else if (style.Id === "Balanced" || style.Id === "PatientMidBlock") {
          alignment -= 1.6;
        } else if (style.Id === "HighTempoPress") {
          alignment -= 1.4;
        } else if (style.Id === "ControlPossession" || style.Id === "Gegenpress") {
          alignment += 1.1;
        } else if (
          style.Id === "VerticalTikiTaka" ||
          style.Id === "FluidCounterAttack"
        ) {
          alignment += 0.6;
        } else if (style.Id === "TikiTaka") {
          alignment += 0.2;
        }
      } else if (avgTop11Ability < 11.5) {
        if (style.Id === "TikiTaka" || style.Id === "ControlPossession") {
          alignment -= 2.0;
        }
      }

      const inSlots = plan.tactic.slots.map((s) => s.inPossession.positionId);
      const hasWingers = inSlots.includes("AML") && inSlots.includes("AMR");
      const hasCentral10 = inSlots.includes("AMC") || inSlots.includes("AMCL");
      const strikerCount = inSlots.filter((s) => s.startsWith("ST")).length;
      const cbCount = inSlots.filter((s) => s.startsWith("DC")).length;

      // 2. Natural star roster structure synergy (prevent benching elite wingers / #10s or forcing 2-ST with 1 striker)
      if (starWideAttackers >= 2) {
        if (hasWingers) {
          alignment += 1.2;
          notes.push("memaksimalkan winger/inside-forward bintang");
        } else {
          alignment -= 1.8;
        }
      }
      if (starPlaymaker10s >= 1 && hasCentral10) {
        alignment += 0.9;
        notes.push("mengakomodasi No. 10 kreatif utama");
      }
      if (strikerCount >= 2 && naturalStrikers < 2) {
        alignment -= 1.6;
      }
      if (cbCount >= 3 && naturalWingbacks < 2) {
        alignment -= 1.2;
      }

      // 3. Reward starters' average CA retention (prevent benching top stars)
      const starterUids = new Set(plan.tactic.slots.map((s) => s.playerUid));
      const starterAvgAbility =
        normalized
          .filter((p) => starterUids.has(p.uid))
          .reduce((acc, p) => acc + p.ability, 0) / 11;
      alignment += (starterAvgAbility - avgTop11Ability) * 1.8;

      notes.push(`StartFit ${plan.startingFit.toFixed(1)}`);
      notes.push(`Cover ${plan.coverFit.toFixed(1)}`);

      allCandidates.push({
        styleId: style.Id,
        styleName: style.Name,
        plan,
        selectionScore: round2(plan.rankingFit + alignment),
        rationale: `${style.Name} · ${notes.join(" · ")}`,
      });
    }
  }

  allCandidates.sort(
    (a, b) =>
      b.selectionScore - a.selectionScore ||
      b.plan.rankingFit - a.plan.rankingFit ||
      b.plan.squadFit - a.plan.squadFit ||
      a.plan.tactic.title.localeCompare(b.plan.tactic.title),
  );
  return allCandidates;
}

export function solveBestTacticsAcrossAllStyles(
  squadPlayers: readonly Player[],
  options: Pick<SquadAnalysisOptions, "lineupPreferences" | "priorities" | "patchVersion"> = {},
): TacticPlanResult[] {
  const patchVersion = options.patchVersion ?? "27.0";
  const dataset = getPatchData(patchVersion);
  const primary = selectPrimarySquadPlayers(squadPlayers, options.lineupPreferences);
  const evaluated = solveAll13StylesBy16Shapes(primary, dataset, patchVersion, options);
  const seen = new Set<string>();
  const topPlans: TacticPlanResult[] = [];
  for (const item of evaluated) {
    const key = `${item.styleId}:${item.plan.tactic.inFormation}->${item.plan.tactic.outFormation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    topPlans.push(item.plan);
    if (topPlans.length >= 16) break;
  }
  if (topPlans.length >= 2 && topPlans[0]!.rankingFit - topPlans[1]!.rankingFit < 0.1) {
    topPlans[0] = { ...topPlans[0]!, nearTieWithNext: true };
  }
  return topPlans;
}

/**
 * Pure, 100% deterministic (0% AI) Unified 5-Tab Orchestrator supporting:
 * - Mode A (`fmf-only`): `.fmf` tactic imported without club squad
 * - Mode B (`squad-only`): club squad (`.fm`/CSV/HTML) without `.fmf` -> Hungarian 13 styles x 16 StyleShapes
 * - Mode C (`combined`): club squad + `.fmf` tactic audited & graded together
 */
export function analyzeUnified(params: AnalyzeUnifiedParams): UnifiedReport {
  const hasTactic = Boolean(params.tactic && params.tactic.slots.length === 11);
  const hasSquad = Boolean(params.squad && params.squad.length >= 11);

  if (!hasTactic && !hasSquad) {
    throw new Error(
      "analyzeUnified requires either a valid 11-slot tactic (.fmf) or at least 11 squad players (.fm/CSV)",
    );
  }

  const patchVersion =
    params.tactic?.patchVersion ?? params.dataset?.manifest.patchVersion ?? "27.0";
  const dataset = params.dataset ?? getPatchData(patchVersion);

  const mode: UnifiedAnalysisMode =
    hasTactic && hasSquad ? "combined" : hasTactic ? "fmf-only" : "squad-only";
  const effectiveSquad = hasSquad ? selectPrimarySolverSquad(params.squad!) : undefined;

  let activeTactic: DualPhaseTactic;
  let recommendedTactic: DualPhaseTactic;
  let gradedPlan: TacticPlanResult | null = null;
  let baselineRankingFit: number | null = null;
  let alternativeShapes: AlternativeShapeRecommendation[];

  if (mode === "fmf-only") {
    activeTactic = params.tactic!;
    recommendedTactic = params.tactic!;
    alternativeShapes = rankAlternativeStyleShapesForTactic(activeTactic, dataset);
  } else if (mode === "squad-only") {
    const squad = effectiveSquad!;
    const allEvaluated = solveAll13StylesBy16Shapes(squad, dataset, patchVersion);
    const winner = allEvaluated[0]!;
    activeTactic = winner.plan.tactic;
    recommendedTactic = winner.plan.tactic;
    gradedPlan = winner.plan;
    baselineRankingFit = winner.plan.rankingFit;

    const seenFormationKeys = new Set<string>([
      `${winner.plan.tactic.inFormation}->${winner.plan.tactic.outFormation}`,
    ]);
    alternativeShapes = [];
    for (const item of allEvaluated.slice(1)) {
      const formKey = `${item.plan.tactic.inFormation}->${item.plan.tactic.outFormation}`;
      if (seenFormationKeys.has(formKey)) continue;
      seenFormationKeys.add(formKey);
      const matchedShape = dataset.tacticalStyles.StyleShapes.find(
        (sh) =>
          sh.InPossessionName === item.plan.tactic.inFormation &&
          sh.OutOfPossessionName === item.plan.tactic.outFormation,
      );
      alternativeShapes.push({
        shapeId: matchedShape?.Id ?? `alt-${alternativeShapes.length + 1}`,
        styleId: item.styleId,
        styleName: item.styleName,
        inPossessionName: item.plan.tactic.inFormation,
        outOfPossessionName: item.plan.tactic.outFormation,
        highPress:
          matchedShape?.HighPress ??
          (item.plan.tactic.teamInstructions.LineOfEngagement ?? 62) === 61,
        compatibilityScore: item.plan.rankingFit,
        rationale: item.rationale,
        tactic: item.plan.tactic,
      });
      if (alternativeShapes.length >= 3) break;
    }
  } else {
    // Mode C: Combined (.fmf tactic + real club squad)
    const squad = effectiveSquad!;
    const baseline = gradeImportedTactic(params.tactic!, squad, {
      improve: false,
      patchVersion,
    });
    const improved = gradeImportedTactic(params.tactic!, squad, {
      improve: true,
      patchVersion,
    });
    activeTactic = baseline.tactic;
    recommendedTactic = improved.tactic;
    gradedPlan = improved;
    baselineRankingFit = baseline.rankingFit;

    const squadPlans = analyzeSquadAndGenerateTactics(squad, {
      styleId: params.tactic!.styleId ?? "Balanced",
      patchVersion,
    });
    alternativeShapes = squadPlans
      .filter(
        (p) =>
          p.tactic.inFormation !== activeTactic.inFormation ||
          p.tactic.outFormation !== activeTactic.outFormation,
      )
      .slice(0, 3)
      .map((p, idx) => {
        const matchedShape = dataset.tacticalStyles.StyleShapes.find(
          (sh) =>
            sh.InPossessionName === p.tactic.inFormation &&
            sh.OutOfPossessionName === p.tactic.outFormation,
        );
        return {
          shapeId: matchedShape?.Id ?? `squad-alt-${idx + 1}`,
          inPossessionName: p.tactic.inFormation,
          outOfPossessionName: p.tactic.outFormation,
          highPress:
            matchedShape?.HighPress ??
            (p.tactic.teamInstructions.LineOfEngagement ?? 62) === 61,
          compatibilityScore: p.rankingFit,
          rationale: `RankingFit ${p.rankingFit.toFixed(1)} vs aktif ${baseline.rankingFit.toFixed(1)}`,
          tactic: p.tactic,
        };
      });
    if (alternativeShapes.length < 3) {
      const extras = rankAlternativeStyleShapesForTactic(activeTactic, dataset);
      for (const ex of extras) {
        if (alternativeShapes.length >= 3) break;
        if (!alternativeShapes.some((a) => a.shapeId === ex.shapeId)) {
          alternativeShapes.push(ex);
        }
      }
    }
  }

  const heatmap = computeHeatmap18Zones(activeTactic, { catalog: dataset.pitchCatalog });
  const rawBalance = computeTacticalBalance(activeTactic, effectiveSquad);
  const structuralAdjustments =
    mode === "fmf-only"
      ? buildModeACoachingAlerts(activeTactic, dataset, rawBalance.alerts)
      : rawBalance.alerts;
  const balance: TacticalBalanceReport = {
    ...rawBalance,
    alerts: structuralAdjustments,
  };

  const blueprint = buildSquadBlueprint(activeTactic, dataset);
  const audit = effectiveSquad ? auditSquadAgainstTactic(activeTactic, effectiveSquad) : null;

  const squadBlueprintOrAudit: UnifiedSquadSection = hasSquad
    ? {
        kind: "audit",
        hasClubSquad: true,
        honestNote: null,
        blueprint,
        audit,
      }
    : {
        kind: "blueprint",
        hasClubSquad: false,
        honestNote:
          "Data skuad klub (.fm / CSV / HTML) belum diunggah — menampilkan Squad Requirement Blueprint (5 atribut kunci per posisi IP/OOP dari role-profiles.json). Unggah data skuad klub untuk membuka Role Fit starter nyata, 3 posisi terlemah, dan pengganti internal.",
        blueprint,
        audit: null,
      };

  const trainingPlan = buildUnifiedTrainingPlan({
    tactic: activeTactic,
    audit,
    dataset,
    patchVersion,
  });

  const staffPlan = buildUnifiedStaffPlan({
    tactic: activeTactic,
    audit,
    clubStaff: params.clubStaff,
    worldStaffPool: params.worldStaffPool,
    dataset,
    patchVersion,
  });

  const wonderkidPlan = buildUnifiedWonderkidPlan({
    tactic: activeTactic,
    audit,
    squad: params.squad,
    worldWonderkids: params.worldWonderkids,
    dataset,
    patchVersion,
  });

  return {
    mode,
    deterministicBadge: "100% Data Deterministik (Non-AI)",
    patchVersion,
    tacticAdvice: {
      activeTactic,
      recommendedTactic,
      heatmap,
      balance,
      structuralAdjustments,
      alternativeShapes,
      gradedPlan,
      baselineRankingFit,
    },
    squadBlueprintOrAudit,
    trainingPlan,
    staffPlan,
    wonderkidPlan,
  };
}
