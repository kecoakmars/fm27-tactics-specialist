import type { LineupPreference } from "@fm27/shared-types";
import { averagePlayerAttributes, type NormalizedPlayerProfile } from "./normalizer.js";

export const LOCKED_STARTER_BONUS = 10_000;
export const FORBIDDEN_SLOT_SCORE = -1_000_000;

/**
 * Exact 1-indexed augmenting-path Kuhn-Munkres (Hungarian) solver O(n^2 * m)
 * finding the globally optimal assignment of `rowCount` slots across `colCount` players
 * maximizing the sum of `scores[slotIdx][playerIdx]`.
 */
export function solveHungarianMax(scores: readonly (readonly number[])[]): number[] {
  const rowCount = scores.length;
  if (rowCount === 0) return [];
  const colCount = scores[0]?.length ?? 0;
  if (colCount < rowCount) {
    throw new Error(
      `Hungarian solver requires colCount (${colCount}) >= rowCount (${rowCount})`,
    );
  }

  const u = new Float64Array(rowCount + 1);
  const v = new Float64Array(colCount + 1);
  const p = new Int32Array(colCount + 1);
  const way = new Int32Array(colCount + 1);

  for (let i = 1; i <= rowCount; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Float64Array(colCount + 1).fill(Number.POSITIVE_INFINITY);
    const used = new Uint8Array(colCount + 1);

    do {
      used[j0] = 1;
      const i0 = p[j0]!;
      let delta = Number.POSITIVE_INFINITY;
      let j1 = 0;
      const rowScores = scores[i0 - 1]!;

      for (let j = 1; j <= colCount; j++) {
        if (used[j] === 1) continue;
        const cost = -(rowScores[j - 1] ?? FORBIDDEN_SLOT_SCORE);
        const cur = cost - u[i0]! - v[j]!;
        if (cur < minv[j]!) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j]! < delta) {
          delta = minv[j]!;
          j1 = j;
        }
      }

      for (let j = 0; j <= colCount; j++) {
        if (used[j] === 1) {
          const pj = p[j]!;
          u[pj] = u[pj]! + delta;
          v[j] = v[j]! - delta;
        } else {
          minv[j] = minv[j]! - delta;
        }
      }

      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0]!;
      p[j0] = p[j1]!;
      j0 = j1;
    } while (j0 !== 0);
  }

  const assignedPlayerPerSlot = new Array<number>(rowCount).fill(-1);
  for (let j = 1; j <= colCount; j++) {
    const slotOneBased = p[j]!;
    if (slotOneBased > 0) {
      assignedPlayerPerSlot[slotOneBased - 1] = j - 1;
    }
  }
  return assignedPlayerPerSlot;
}

export function computePlayerStyleRating(
  player: NormalizedPlayerProfile,
  styleAttributes?: readonly string[],
): number {
  if (!styleAttributes || styleAttributes.length === 0) {
    return 5 * player.ability;
  }
  return 5 * averagePlayerAttributes(player, styleAttributes);
}

/**
 * Builds the 11 x N assignment matrix blending `0.90 * Fit + 0.10 * styleRating`
 * on outfield slots when a tactical style is active, and adding `+10_000` for locked starters.
 */
export function buildAssignmentMatrix(params: {
  inSlots: readonly string[];
  rawFits: readonly (readonly (number | null)[])[];
  players: readonly NormalizedPlayerProfile[];
  styleAttributes?: readonly string[];
  preferencesByUid?: ReadonlyMap<number, LineupPreference>;
}): number[][] {
  const hasStyle = Boolean(params.styleAttributes && params.styleAttributes.length > 0);
  const styleRatings = params.players.map((p) =>
    computePlayerStyleRating(p, params.styleAttributes),
  );

  return params.inSlots.map((slotId, slotIdx) => {
    const rowFits = params.rawFits[slotIdx]!;
    return params.players.map((player, playerIdx) => {
      const fit = rowFits[playerIdx];
      if (fit === null || fit === undefined) return FORBIDDEN_SLOT_SCORE;

      let val = fit;
      if (slotId !== "GK" && val > 0 && hasStyle) {
        val = 0.9 * val + 0.1 * (styleRatings[playerIdx] ?? 0);
      }

      const pref = params.preferencesByUid?.get(player.uid);
      if (pref?.mustStart) {
        val += LOCKED_STARTER_BONUS;
      }
      return val;
    });
  });
}
