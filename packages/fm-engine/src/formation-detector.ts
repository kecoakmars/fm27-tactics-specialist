import { getPitchCatalog } from "@fm27/fm-data";
import type { PitchCatalog } from "@fm27/shared-types";

/**
 * Auto-detects canonical formation strings (e.g. `4-2-3-1`, `4-3-3 DM`, `3-4-2-1`, `5-2-2-1`)
 * from 11 active `PitchCatalog.Positions` IDs for both In-Possession and Out-of-Possession.
 */
export function detectFormation(
  positionIds: readonly string[],
  options?: { catalog?: PitchCatalog; patchVersion?: string },
): string {
  const catalog = options?.catalog ?? getPitchCatalog(options?.patchVersion);
  const validPos = new Set(catalog.Positions.map((p) => p.Id));

  let def = 0;
  let wb = 0;
  let dm = 0;
  let mid = 0;
  let am = 0;
  let st = 0;

  for (const id of positionIds) {
    if (!validPos.has(id) || id === "GK") continue;
    if (id === "DC" || id === "DCL" || id === "DCR" || id === "DL" || id === "DR") {
      def++;
    } else if (id === "WBL" || id === "WBR") {
      wb++;
    } else if (id === "DMC" || id === "DML" || id === "DMR") {
      dm++;
    } else if (id === "MC" || id === "MCL" || id === "MCR" || id === "ML" || id === "MR") {
      mid++;
    } else if (
      id === "AMC" ||
      id === "AMCL" ||
      id === "AMCR" ||
      id === "AML" ||
      id === "AMR"
    ) {
      am++;
    } else if (id === "ST" || id === "STL" || id === "STR") {
      st++;
    }
  }

  // Back-3 with Wing-Backs convention (3-4-2-1, 3-5-2, 3-4-3)
  if (def === 3 && wb === 2) {
    if (dm === 0 && mid === 2 && am === 2 && st === 1) return "3-4-2-1";
    if (dm === 1 && mid === 2 && am === 0 && st === 2) return "3-5-2";
    if (dm === 2 && mid === 0 && am === 2 && st === 1) return "3-4-2-1";
    if (dm + mid === 2 && am + st === 3) return am === 2 ? "3-4-2-1" : "3-4-3";
    const midBand = wb + dm + mid;
    return am > 0 && st > 0 ? `3-${midBand}-${am}-${st}` : `3-${midBand}-${am + st}`;
  }

  // Standard 4-3-3 DM (1 DMC + 2 MC + AML/AMR/ST)
  if (def === 4 && wb === 0 && dm === 1 && mid === 2 && am === 2 && st === 1) {
    return "4-3-3 DM";
  }

  // Standard 4-3-1-2 Narrow Diamond (1 DMC + 2 MC + 1 AMC + 2 ST)
  if (def === 4 && wb === 0 && dm === 1 && mid === 2 && am === 1 && st === 2) {
    return "4-3-1-2";
  }

  // Standard 5-3-2 (5 DEF + 1 DMC + 2 MC + 2 ST)
  if (def === 5 && wb === 0 && dm === 1 && mid === 2 && am === 0 && st === 2) {
    return "5-3-2";
  }

  // Merge AML/AMR with single ST into 3-forward band when midfield already has 3+ players
  if (am === 2 && st === 1 && dm + mid >= 3) {
    if (dm > 0 && mid > 0) return `${def + wb}-${dm + mid}-3`;
    return `${def + wb}-${dm + mid}-3`;
  }

  const lines = [def + wb, dm, mid, am, st].filter((n) => n > 0);
  return lines.join("-") || "Custom";
}
