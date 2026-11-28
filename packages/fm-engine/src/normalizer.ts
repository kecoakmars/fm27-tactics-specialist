import { getRoleProfiles } from "@fm27/fm-data";
import type {
  AttributeName,
  LineupPreference,
  Player,
  PositionKey14,
} from "@fm27/shared-types";

export interface NormalizedPlayerProfile {
  uid: number;
  name: string;
  clubUid?: number;
  clubName?: string;
  age?: number;
  nationality?: string;
  attributes: Record<string, number>;
  positions: Record<PositionKey14, number>;
  leftFoot: number;
  rightFoot: number;
  ability: number; // 0..20 scale
  overallAttributes: number; // 0..20 scale
  fullProfile: boolean;
  isGoalkeeper: boolean;
  isUsableOutfielder: boolean;
  tacticalFamiliarity?: readonly number[];
  condition?: number;
  matchSharpness?: number;
}

export function canonicalPositionKey(slot: string): PositionKey14 {
  switch (slot.toUpperCase()) {
    case "DCL":
    case "DCR":
    case "DC":
      return "DC";
    case "DMC":
    case "DML":
    case "DMR":
    case "DMCR":
    case "DM":
      return "DM";
    case "MCL":
    case "MCR":
    case "MC":
      return "MC";
    case "AMCL":
    case "AMCR":
    case "AMC":
      return "AMC";
    case "ST":
    case "STL":
    case "STR":
    case "STC":
      return "STC";
    case "GK":
      return "GK";
    case "DL":
      return "DL";
    case "DR":
      return "DR";
    case "ML":
      return "ML";
    case "MR":
      return "MR";
    case "AML":
      return "AML";
    case "AMR":
      return "AMR";
    case "WBL":
      return "WBL";
    case "WBR":
      return "WBR";
    default:
      return "MC";
  }
}

function readBounded(
  map: Record<string, number | undefined>,
  key: string,
  max: number,
): number | undefined {
  const v = map[key];
  if (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max) {
    return v;
  }
  return undefined;
}

function scaleBounded(
  map: Record<string, number | undefined>,
  key: string,
  ceiling: number,
  divisor: number,
): number | undefined {
  const v = map[key];
  if (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= ceiling) {
    return Math.min(20, v / divisor);
  }
  return undefined;
}

/**
 * Converts a raw dictionary of numbers (`raw_<attr>` 0..125 or `<attr>` 1..20)
 * for a single attribute into FM's 0..20 scale: `min(20, raw / 5)`.
 */
export function attributeRatingFromRawMap(
  numbers: Record<string, number | undefined>,
  key: string,
): number | undefined {
  const raw =
    scaleBounded(numbers, `raw_${key}`, 125, 5) ??
    scaleBounded(numbers, `raw_attributes_${key}`, 125, 5);
  if (raw !== undefined) return raw;
  return readBounded(numbers, `attributes_${key}`, 20) ?? readBounded(numbers, key, 20);
}

export function getPlayerAttribute(player: NormalizedPlayerProfile, key: string): number {
  return player.attributes[key] ?? player.ability;
}

export function averagePlayerAttributes(
  player: NormalizedPlayerProfile,
  keys: readonly string[],
): number {
  if (keys.length === 0) return player.ability;
  let sum = 0;
  for (const k of keys) {
    sum += getPlayerAttribute(player, k);
  }
  return sum / keys.length;
}

export function getPlayerSlotFamiliarity(
  player: NormalizedPlayerProfile,
  slot: string,
): number {
  const key = canonicalPositionKey(slot);
  return player.positions[key] ?? 0;
}

function computeOverallAttributes(
  attributes: Record<string, number>,
  personality: Record<string, number | undefined> | undefined,
  isGk: boolean,
  fallbackAbility: number,
  patchVersion = "27.0",
): number {
  const rp = getRoleProfiles(patchVersion);
  const gkSet = new Set(rp.Goalkeeping);
  const lowerSet = new Set(rp.LowerIsBetter);

  let weightedSum = 0;
  let weightTotal = 0;

  for (const [k, v] of Object.entries(attributes)) {
    const adjusted = lowerSet.has(k) ? Math.max(1, 21 - v) : v;
    const isGkAttr = gkSet.has(k);
    const weight = isGk === isGkAttr ? 1.0 : 0.2;
    weightedSum += adjusted * weight;
    weightTotal += weight;
  }

  if (personality) {
    for (const pKey of rp.PersonalityKeys) {
      const pVal =
        readBounded(personality, pKey, 20) ??
        readBounded(personality, `personality_${pKey}`, 20);
      if (pVal !== undefined) {
        const adjusted = lowerSet.has(pKey) ? Math.max(1, 21 - pVal) : pVal;
        weightedSum += adjusted * 0.15;
        weightTotal += 0.15;
      }
    }
  }

  return weightTotal > 0 ? weightedSum / weightTotal : fallbackAbility;
}

/**
 * Normalizes a structured `Player` or raw numeric dictionary into a `NormalizedPlayerProfile`.
 */
export function normalizePlayer(
  input:
    | Player
    | {
        uid: number;
        name: string;
        clubUid?: number;
        clubName?: string;
        age?: number;
        nationality?: string;
        rawNumbers: Record<string, number | undefined>;
      },
  patchVersion = "27.0",
): NormalizedPlayerProfile {
  const rp = getRoleProfiles(patchVersion);

  if ("rawNumbers" in input) {
    const nums = input.rawNumbers;
    const attributes: Record<string, number> = {};
    for (const attr of rp.AllAttributes) {
      const val = attributeRatingFromRawMap(nums, attr);
      if (val !== undefined) attributes[attr] = val;
    }

    const positions = {} as Record<PositionKey14, number>;
    for (const pos of rp.PositionKeys as PositionKey14[]) {
      positions[pos] =
        readBounded(nums, `pos_${pos}`, 20) ??
        readBounded(nums, `positions_${pos}`, 20) ??
        0;
    }

    const leftFoot =
      readBounded(nums, "preferred_foot_left", 20) ??
      scaleBounded(nums, "raw_preferred_foot_left", 100, 5) ??
      10;
    const rightFoot =
      readBounded(nums, "preferred_foot_right", 20) ??
      scaleBounded(nums, "raw_preferred_foot_right", 100, 5) ??
      10;

    const attrValues = Object.values(attributes);
    const meanAttr =
      attrValues.length > 0
        ? attrValues.reduce((a, b) => a + b, 0) / attrValues.length
        : 10;
    const ability = scaleBounded(nums, "ability_current", 255, 10) ?? meanAttr;
    const isGoalkeeper = positions.GK >= 15;
    const maxOutfieldPos = Math.max(
      ...Object.entries(positions)
        .filter(([k]) => k !== "GK")
        .map(([, v]) => v),
    );
    const isUsableOutfielder = !isGoalkeeper && maxOutfieldPos >= 10;
    const fullProfile = attrValues.length >= 25;
    const overallAttributes = computeOverallAttributes(
      attributes,
      nums,
      isGoalkeeper,
      ability,
      patchVersion,
    );

    return {
      uid: input.uid,
      name: input.name,
      clubUid: input.clubUid,
      clubName: input.clubName,
      age: input.age,
      nationality: input.nationality,
      attributes,
      positions,
      leftFoot,
      rightFoot,
      ability,
      overallAttributes,
      fullProfile,
      isGoalkeeper,
      isUsableOutfielder,
    };
  }

  const attributes: Record<string, number> = {};
  for (const [k, v] of Object.entries(input.attributes)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      attributes[k as AttributeName] = Math.min(20, v);
    }
  }

  const positions = {} as Record<PositionKey14, number>;
  for (const pos of rp.PositionKeys as PositionKey14[]) {
    positions[pos] = Math.min(20, Math.max(0, input.positions[pos] ?? 0));
  }

  const attrValues = Object.values(attributes);
  const meanAttr =
    attrValues.length > 0
      ? attrValues.reduce((a, b) => a + b, 0) / attrValues.length
      : 10;
  const ability =
    input.currentAbility !== undefined && input.currentAbility > 0
      ? Math.min(20, input.currentAbility / 10)
      : meanAttr;

  const isGoalkeeper = positions.GK >= 15;
  const maxOutfieldPos = Math.max(
    ...Object.entries(positions)
      .filter(([k]) => k !== "GK")
      .map(([, v]) => v),
  );
  const isUsableOutfielder = !isGoalkeeper && maxOutfieldPos >= 10;
  const fullProfile = attrValues.length >= 25;
  const overallAttributes = computeOverallAttributes(
    attributes,
    input.personality,
    isGoalkeeper,
    ability,
    patchVersion,
  );

  return {
    uid: input.uid,
    name: input.name,
    clubUid: input.clubUid,
    clubName: input.clubName,
    age: input.age,
    nationality: input.nationality,
    attributes,
    positions,
    leftFoot: input.leftFoot,
    rightFoot: input.rightFoot,
    ability,
    overallAttributes,
    fullProfile,
    isGoalkeeper,
    isUsableOutfielder,
    ...(input.tacticalFamiliarity ? { tacticalFamiliarity: input.tacticalFamiliarity } : {}),
    ...(input.condition !== undefined ? { condition: input.condition } : {}),
    ...(input.matchSharpness !== undefined ? { matchSharpness: input.matchSharpness } : {}),
  };
}

/**
 * Validates squad eligibility (>= 1 GK with GK>=15, >= 10 usable outfielders, <= 11 starter locks).
 */
export function normalizeAndValidateSquad(
  players: ReadonlyArray<
    | Player
    | {
        uid: number;
        name: string;
        clubUid?: number;
        clubName?: string;
        age?: number;
        nationality?: string;
        rawNumbers: Record<string, number | undefined>;
      }
  >,
  lineupPreferences: readonly LineupPreference[] = [],
  patchVersion = "27.0",
): NormalizedPlayerProfile[] {
  const normalized = players.map((p) => normalizePlayer(p, patchVersion));
  const usableGks = normalized.filter((p) => p.isGoalkeeper);
  const usableOutfielders = normalized.filter((p) => p.isUsableOutfielder);

  if (usableGks.length < 1) {
    throw new Error("Squad requires at least 1 eligible Goalkeeper (GK familiarity >= 15/20)");
  }
  if (usableOutfielders.length < 10) {
    throw new Error(
      `Squad requires at least 10 usable outfielders (found ${usableOutfielders.length})`,
    );
  }
  if (normalized.length < 11) {
    throw new Error(`Squad requires at least 11 players (found ${normalized.length})`);
  }

  const lockedStarterCount = lineupPreferences.filter((lp) => lp.mustStart).length;
  if (lockedStarterCount > 11) {
    throw new Error(`Cannot lock more than 11 starters (got ${lockedStarterCount})`);
  }

  return normalized;
}
