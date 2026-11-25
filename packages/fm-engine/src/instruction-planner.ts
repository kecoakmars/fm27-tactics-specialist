import { getPitchCatalog, getTacticalStyles } from "@fm27/fm-data";
import type {
  PitchCatalog,
  TacticalPriorities,
  TacticalStyle,
} from "@fm27/shared-types";
import { computeLineMetric, type CoachingUnitStarter } from "./coaching-review.js";
import {
  averagePlayerAttributes,
  getPlayerAttribute,
  type NormalizedPlayerProfile,
} from "./normalizer.js";

export type InstructionBitPolicy = "0" | "1" | "2" | "3";

/**
 * Resolves Team Instruction conflicts using `PitchCatalog.Conflicts`
 * (disables secondary Underlap bit when colliding with primary Overlap bit).
 */
export function resolveTeamInstructionConflicts(
  bitsByGroup: Record<string, number>,
  catalog?: PitchCatalog,
): Record<string, number> {
  const cat = catalog ?? getPitchCatalog();
  const out = { ...bitsByGroup };
  const active = new Set<number>(Object.values(out).filter((b) => b > 0));

  for (const [primaryBit, conflictingBit] of cat.Conflicts) {
    if (active.has(primaryBit) && active.has(conflictingBit)) {
      for (const [group, bit] of Object.entries(out)) {
        if (bit === conflictingBit) {
          out[group] = 0;
          active.delete(conflictingBit);
        }
      }
    }
  }
  return out;
}

/**
 * Computes weighted styles (`0.66^i` geometric decay) for multi-style `TacticalPriorities`.
 */
export function getWeightedTacticalStyles(
  selectedStyleIds: readonly string[],
  patchVersion = "27.0",
): Array<{ style: TacticalStyle; weight: number }> {
  const stylesCatalog = getTacticalStyles(patchVersion);
  const byId = new Map<string, TacticalStyle>();
  for (const s of stylesCatalog.TacticalStyles) {
    byId.set(s.Id.toLowerCase(), s);
    byId.set(s.Name.toLowerCase(), s);
  }

  const seen = new Set<string>();
  const weighted: Array<{ style: TacticalStyle; weight: number }> = [];
  let idx = 0;

  for (const rawId of selectedStyleIds) {
    const style = byId.get(rawId.toLowerCase());
    if (!style || seen.has(style.Id)) continue;
    seen.add(style.Id);
    weighted.push({ style, weight: Math.pow(0.66, idx) });
    idx++;
  }

  return weighted;
}

/**
 * Builds adaptive Team Instructions & Mentality (`1..7`), overlaying `TacticalStyle` /
 * `TacticalPriorities`, post-evaluation squad tweaks, and conflict resolution.
 */
export function planTeamInstructions(params: {
  starters: readonly CoachingUnitStarter[];
  highPress: boolean;
  style?: TacticalStyle;
  priorities?: TacticalPriorities;
  patchVersion?: string;
}): { mentality: number; teamInstructions: Record<string, number> } {
  const patchVersion = params.patchVersion ?? "27.0";
  const catalog = getPitchCatalog(patchVersion);

  const buildCap = computeLineMetric("build", params.starters);
  const recoveryCap = computeLineMetric("recovery", params.starters);
  const pressCap = computeLineMetric("press", params.starters);
  const aerialCap = computeLineMetric("aerial", params.starters);

  // 1. Adaptive Baseline
  let mentality = buildCap >= 13 && params.highPress ? 5 : 4;
  const instructions: Record<string, number> = {
    LineOfEngagement: params.highPress ? 61 : 62,
  };

  if (buildCap >= 13) {
    instructions.PassingDirectness = 3;
  }
  if (recoveryCap < 11) {
    instructions.DefensiveLine = 58;
  } else if (params.highPress && recoveryCap >= 13.5) {
    instructions.DefensiveLine = 57;
  }
  if (aerialCap >= 14 && instructions.Crossing === undefined) {
    instructions.Crossing = 10;
  }

  // 2. Single TacticalStyle overlay
  if (params.style) {
    mentality = params.style.Mentality;
    for (const [grp, bit] of Object.entries(params.style.InstructionBits)) {
      instructions[grp] = bit;
    }
  }

  // 3. Multi-style TacticalPriorities overlay (0.66^i geometric vote)
  if (params.priorities && params.priorities.selectedStyleIds.length > 0) {
    const weighted = getWeightedTacticalStyles(params.priorities.selectedStyleIds, patchVersion);
    if (weighted.length > 0) {
      let wMentality = 0;
      let wSum = 0;
      const votesByGroup = new Map<string, Map<number, number>>();

      for (const { style, weight } of weighted) {
        wMentality += style.Mentality * weight;
        wSum += weight;
        for (const [grp, bit] of Object.entries(style.InstructionBits)) {
          let groupVotes = votesByGroup.get(grp);
          if (!groupVotes) {
            groupVotes = new Map<number, number>();
            votesByGroup.set(grp, groupVotes);
          }
          groupVotes.set(bit, (groupVotes.get(bit) ?? 0) + weight);
        }
      }

      if (wSum > 0) {
        mentality = Math.round(wMentality / wSum);
      }
      for (const [grp, groupVotes] of votesByGroup.entries()) {
        let bestBit = 0;
        let bestScore = -1;
        for (const [bit, score] of groupVotes.entries()) {
          if (score > bestScore) {
            bestScore = score;
            bestBit = bit;
          }
        }
        instructions[grp] = bestBit;
      }
    }
  }

  // Objective & Risk slider adjustments
  if (params.priorities) {
    if (params.priorities.objective === "WinNow") mentality += 1;
    else if (params.priorities.objective === "ProtectLead") {
      mentality -= 1;
      instructions.TimeWasting = 78;
    } else if (params.priorities.objective === "Underdog") {
      mentality -= 1;
      instructions.AttackingTransition = 54;
    }
    mentality += params.priorities.riskOffset;
  }

  mentality = Math.max(1, Math.min(7, mentality));

  // 4. Post-evaluation adaptive tweaks (SquadAnalysis.Evaluate IL_08BC-IL_0A26)
  const gk = params.starters.find((s) => s.inSlot === "GK")?.player;
  const pd = instructions.PassingDirectness ?? 0;
  if ((pd === 3 || pd === 4) && gk && getPlayerAttribute(gk, "kicking") >= 13 && buildCap >= 13) {
    instructions.GoalKicks = 44;
    if (buildCap >= 14) {
      instructions.GoalkeeperDistributionTarget = 35;
    }
  }

  if (params.highPress && pressCap >= 15) {
    instructions.PreventShortGKDistribution = 69;
  }
  if (recoveryCap >= 15 && instructions.DefensiveLine === 57) {
    instructions.DefensiveLineBehaviour = 76;
  }

  const outfieldStarters = params.starters.filter((s) => s.inSlot !== "GK");
  if (instructions.Patience === 17 && outfieldStarters.length > 0) {
    const meanLongShots =
      outfieldStarters.reduce(
        (acc, s) => acc + averagePlayerAttributes(s.player, ["long_shots"]),
        0,
      ) / outfieldStarters.length;
    if (meanLongShots < 12) {
      instructions.ShotsFromDistance = 16;
    }
  }

  return {
    mentality,
    teamInstructions: resolveTeamInstructionConflicts(instructions, catalog),
  };
}

/**
 * Reads the 43-character policy digit (`'0'`=Allowed, `'1'`=Hidden, `'2'`=Disallowed, `'3'`=Preset)
 * for `<phase>:<positionId>:<roleId>` at `bit` (`1..42`).
 */
export function getPlayerInstructionPolicy(
  policyTable: Readonly<Record<string, string>>,
  phase: 0 | 1,
  positionId: string,
  roleId: string,
  bit: number,
): InstructionBitPolicy {
  if (bit <= 0 || bit >= 43) return "1";
  const key = `${phase}:${positionId}:${roleId}`;
  const mask = policyTable[key];
  if (!mask || bit >= mask.length) return "0";
  const ch = mask[bit];
  if (ch === "1" || ch === "2" || ch === "3") return ch;
  return "0";
}

/**
 * Computes effective Player Instruction bits = Role Presets (`'3'`) U (Requested ∩ Allowed (`'0'`)).
 */
export function computeEffectivePlayerInstructionBits(
  policyTable: Readonly<Record<string, string>>,
  phase: 0 | 1,
  positionId: string,
  roleId: string,
  requestedBits: readonly number[],
): number[] {
  const effective = new Set<number>();
  for (let b = 1; b < 43; b++) {
    if (getPlayerInstructionPolicy(policyTable, phase, positionId, roleId, b) === "3") {
      effective.add(b);
    }
  }
  for (const b of requestedBits) {
    if (
      b > 0 &&
      b < 43 &&
      getPlayerInstructionPolicy(policyTable, phase, positionId, roleId, b) === "0"
    ) {
      effective.add(b);
    }
  }
  return Array.from(effective).sort((a, b) => a - b);
}

/**
 * Recommends personal Player Instructions (`Bit 3, 4, 13, 14, 19, 29, 32`) based on player attributes
 * and merges them with role presets via the 43-bit policy table.
 */
export function recommendPlayerInstructions(
  player: NormalizedPlayerProfile,
  phase: 0 | 1,
  positionId: string,
  roleId: string,
  patchVersion = "27.0",
): number[] {
  const catalog = getPitchCatalog(patchVersion);
  const policyTable = catalog.PlayerInstructionPolicies;
  const requested: number[] = [];

  const tryAdd = (bit: number) => {
    if (getPlayerInstructionPolicy(policyTable, phase, positionId, roleId, bit) === "0") {
      requested.push(bit);
    }
  };

  if (phase === 0) {
    if (
      getPlayerAttribute(player, "passing") >= 15 &&
      getPlayerAttribute(player, "vision") >= 15 &&
      getPlayerAttribute(player, "decisions") >= 14
    ) {
      tryAdd(3); // Take more risks
    } else if (
      getPlayerAttribute(player, "passing") < 11 ||
      getPlayerAttribute(player, "composure") < 11
    ) {
      tryAdd(4); // Take fewer risks
    }

    if (
      getPlayerAttribute(player, "dribbling") >= 15 &&
      getPlayerAttribute(player, "agility") >= 14 &&
      getPlayerAttribute(player, "acceleration") >= 14
    ) {
      tryAdd(13); // Dribble more
    } else if (getPlayerAttribute(player, "dribbling") < 10) {
      tryAdd(14); // Dribble less
    }

    if (getPlayerAttribute(player, "long_shots") < 11 && !positionId.startsWith("ST")) {
      tryAdd(19); // Shoot less often
    }
  } else {
    if (
      getPlayerAttribute(player, "work_rate") >= 15 &&
      getPlayerAttribute(player, "stamina") >= 14 &&
      getPlayerAttribute(player, "aggression") >= 13
    ) {
      tryAdd(29); // Trigger press more often
    }

    if (
      getPlayerAttribute(player, "tackling") < 10 ||
      (getPlayerAttribute(player, "decisions") < 10 &&
        getPlayerAttribute(player, "aggression") >= 15)
    ) {
      tryAdd(32); // Ease off tackles
    }
  }

  return computeEffectivePlayerInstructionBits(policyTable, phase, positionId, roleId, requested);
}
