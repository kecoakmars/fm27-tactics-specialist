import { getStaffFormulas } from "@fm27/fm-data";
import type {
  StaffAssignmentPlan,
  StaffAttributes,
  StaffCategoryFormula,
  StaffCategoryId,
  StaffMember,
  StarRatingBreakdown,
} from "@fm27/shared-types";

export function calculateCategoryStarRating(
  attributes: StaffAttributes,
  formula: StaffCategoryFormula,
): StarRatingBreakdown {
  const ddmSum =
    attributes.determination + attributes.level_of_discipline + attributes.motivating;
  let rawScore = ddmSum * formula.ddmWeight;

  for (const [attrKey, weight] of Object.entries(formula.primaryWeights)) {
    const val = attributes[attrKey as keyof StaffAttributes] ?? 1;
    rawScore += val * weight;
  }
  for (const [attrKey, weight] of Object.entries(formula.secondaryWeights)) {
    const val = attributes[attrKey as keyof StaffAttributes] ?? 1;
    rawScore += val * weight;
  }

  let stars = 0.5;
  for (const threshold of formula.thresholds) {
    if (rawScore >= threshold.minScore) {
      stars = threshold.stars;
    }
  }

  const normalizedPercent =
    Math.round(Math.min(100, Math.max(0, (rawScore / formula.maxRawScore) * 100)) * 10) / 10;

  return {
    categoryId: formula.id,
    rawScore: Math.round(rawScore * 10) / 10,
    normalizedPercent,
    stars,
  };
}

/**
 * Evaluates all 10 FM27 training star categories (0.5..5.0 step 0.5) for a staff member.
 */
export function calculateAllStaffStars(
  attributes: StaffAttributes,
  patchVersion = "27.0",
): StarRatingBreakdown[] {
  const catalog = getStaffFormulas(patchVersion);
  return catalog.categories.map((formula) =>
    calculateCategoryStarRating(attributes, formula),
  );
}

/**
 * Optimal Staff Assignment & Workload Solver:
 * Assigns a dedicated Lead Coach (+ optional Support Coach when pool allows) across all
 * 10 training categories to maximize total stars while keeping coach workload Light/Average.
 */
export function optimizeStaffAssignments(
  staffPool: readonly StaffMember[],
  patchVersion = "27.0",
): StaffAssignmentPlan {
  if (staffPool.length === 0) {
    throw new Error("Cannot optimize staff assignments with an empty staff pool");
  }

  const formulas = getStaffFormulas(patchVersion).categories;
  const ratingsByStaff = new Map<number, Map<StaffCategoryId, StarRatingBreakdown>>();

  for (const member of staffPool) {
    const map = new Map<StaffCategoryId, StarRatingBreakdown>();
    for (const f of formulas) {
      map.set(f.id, calculateCategoryStarRating(member.attributes, f));
    }
    ratingsByStaff.set(member.uid, map);
  }

  const maxCategoriesForLightWorkload = staffPool.length >= 10 ? 1 : staffPool.length >= 5 ? 2 : 4;
  const assignedCount = new Map<number, number>();

  // Sort categories by scarcity (fewest 4.0+ star specialists first: GK & Fitness first!)
  const orderedFormulas = [...formulas].sort((a, b) => {
    const countA = staffPool.filter(
      (s) => (ratingsByStaff.get(s.uid)?.get(a.id)?.stars ?? 0) >= 4.0,
    ).length;
    const countB = staffPool.filter(
      (s) => (ratingsByStaff.get(s.uid)?.get(b.id)?.stars ?? 0) >= 4.0,
    ).length;
    return countA - countB;
  });

  const leadByCategory = new Map<StaffCategoryId, StaffMember>();

  for (const formula of orderedFormulas) {
    const ranked = [...staffPool].sort((a, b) => {
      const loadA = assignedCount.get(a.uid) ?? 0;
      const loadB = assignedCount.get(b.uid) ?? 0;
      const overCapA = loadA >= maxCategoriesForLightWorkload ? 1 : 0;
      const overCapB = loadB >= maxCategoriesForLightWorkload ? 1 : 0;
      if (overCapA !== overCapB) return overCapA - overCapB;

      const ratingA = ratingsByStaff.get(a.uid)!.get(formula.id)!;
      const ratingB = ratingsByStaff.get(b.uid)!.get(formula.id)!;
      if (ratingB.stars !== ratingA.stars) return ratingB.stars - ratingA.stars;
      if (ratingB.rawScore !== ratingA.rawScore) return ratingB.rawScore - ratingA.rawScore;
      return loadA - loadB;
    });

    const chosen = ranked[0]!;
    leadByCategory.set(formula.id, chosen);
    assignedCount.set(chosen.uid, (assignedCount.get(chosen.uid) ?? 0) + 1);
  }

  // Add idle/under-loaded support coaches to lighten heavy categories to Light/Average
  const supportByCategory = new Map<StaffCategoryId, number[]>();
  for (const member of staffPool) {
    if ((assignedCount.get(member.uid) ?? 0) > 0) continue;
    // Assign idle coach as support to the category where lead has highest load
    let targetCat: StaffCategoryId | null = null;
    let highestLeadLoad = 0;
    for (const f of formulas) {
      const lead = leadByCategory.get(f.id)!;
      const lLoad = assignedCount.get(lead.uid) ?? 1;
      if (lLoad >= highestLeadLoad) {
        highestLeadLoad = lLoad;
        targetCat = f.id;
      }
    }
    if (targetCat) {
      const list = supportByCategory.get(targetCat) ?? [];
      list.push(member.uid);
      supportByCategory.set(targetCat, list);
      assignedCount.set(member.uid, 1);
    }
  }

  const assignments: StaffAssignmentPlan["assignments"] = formulas.map((f) => {
    const lead = leadByCategory.get(f.id)!;
    const supports = supportByCategory.get(f.id) ?? [];
    const leadStars = ratingsByStaff.get(lead.uid)!.get(f.id)!.stars;
    const leadLoad = assignedCount.get(lead.uid) ?? 1;
    const effectiveLoad = Math.max(1, leadLoad - supports.length * 0.5);

    const workload: "Light" | "Average" | "Heavy" =
      effectiveLoad <= 1.5 ? "Light" : effectiveLoad <= 2.5 ? "Average" : "Heavy";

    return {
      categoryId: f.id,
      leadStaffUid: lead.uid,
      supportStaffUids: supports,
      effectiveStars: leadStars,
      workload,
    };
  });

  const averageStars =
    Math.round(
      (assignments.reduce((acc, a) => acc + a.effectiveStars, 0) / assignments.length) * 100,
    ) / 100;

  return {
    assignments,
    averageStars,
  };
}
