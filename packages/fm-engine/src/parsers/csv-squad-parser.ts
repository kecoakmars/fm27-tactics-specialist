import {
  ALL_49_ATTRIBUTES,
  POSITION_14_KEYS,
  type AttributeName,
  type Player,
  type PositionKey14,
} from "@fm27/shared-types";
import { attributeRatingFromRawMap } from "../normalizer.js";

// FM UI / FM-View-Exporter (F9) 3-letter abbreviation -> canonical 49-attribute key
export const FM_ABBREV_TO_ATTRIBUTE: Readonly<Record<string, AttributeName>> = {
  cor: "corners",
  cro: "crossing",
  dri: "dribbling",
  fin: "finishing",
  fir: "first_touch",
  fre: "free_kick_taking",
  hea: "heading",
  lon: "long_shots",
  lth: "long_throws",
  mar: "marking",
  pas: "passing",
  pen: "penalty_taking",
  tck: "tackling",
  tec: "technique",
  agg: "aggression",
  ant: "anticipation",
  bra: "bravery",
  cmp: "composure",
  cnt: "concentration",
  dec: "decisions",
  det: "determination",
  fla: "flair",
  ldr: "leadership",
  otb: "off_the_ball",
  pos: "positioning",
  tea: "teamwork",
  vis: "vision",
  wor: "work_rate",
  acc: "acceleration",
  agi: "agility",
  bal: "balance",
  jum: "jumping_reach",
  nat: "natural_fitness",
  pac: "pace",
  sta: "stamina",
  str: "strength",
  aer: "aerial_reach",
  cmd: "command_of_area",
  com: "communication",
  ecc: "eccentricity",
  han: "handling",
  kic: "kicking",
  "1v1": "one_on_ones",
  pun: "punching",
  tro: "rushing_out",
  ref: "reflexes",
  thr: "throwing",
  // FM-View-Exporter (F9) FM27 full header normalized aliases (spaces/punctuation stripped)
  firsttouch: "first_touch",
  freekicktaking: "free_kick_taking",
  longshots: "long_shots",
  longthrows: "long_throws",
  penaltytaking: "penalty_taking",
  offtheball: "off_the_ball",
  workrate: "work_rate",
  jumpingreach: "jumping_reach",
  naturalfitness: "natural_fitness",
  aerialreach: "aerial_reach",
  commandofarea: "command_of_area",
  oneonones: "one_on_ones",
  onevsone: "one_on_ones",
  punchingtendency: "punching",
  rushingout: "rushing_out",
  rushingouttendency: "rushing_out",
  injuryproneness: "injury_proneness",
};

function detectDelimiter(headerLine: string): string {
  const counts: Array<[string, number]> = [
    [",", (headerLine.match(/,/g) ?? []).length],
    [";", (headerLine.match(/;/g) ?? []).length],
    ["\t", (headerLine.match(/\t/g) ?? []).length],
    ["|", (headerLine.match(/\|/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]![1] > 0 ? counts[0]![0] : ",";
}

export function splitDelimitedRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Parses FM position strings such as `"GK"`, `"D (RC)"`, `"WB (L), M/AM (RL)"`, `"ST (C)"`
 * into 0..20 familiarity across the 14 canonical position keys.
 */
export function parseFmPositionString(posText: string): Record<PositionKey14, number> {
  const result = {} as Record<PositionKey14, number>;
  for (const k of POSITION_14_KEYS) result[k] = 0;

  const segments = posText
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  segments.forEach((seg, segIdx) => {
    const rating = segIdx === 0 ? 20 : 17;
    if (seg === "GK") {
      result.GK = Math.max(result.GK, rating);
      return;
    }

    const parenMatch = seg.match(/^([A-Z/]+)\s*(?:\(([RLC]+)\))?$/);
    const linesPart = parenMatch?.[1] ?? seg;
    const sidesPart = parenMatch?.[2] ?? "C";
    const bands = linesPart.split("/");
    const sides = sidesPart.split("");

    for (const band of bands) {
      if (band === "GK") {
        result.GK = Math.max(result.GK, rating);
      } else if (band === "D") {
        if (sides.includes("L")) result.DL = Math.max(result.DL, rating);
        if (sides.includes("C")) result.DC = Math.max(result.DC, rating);
        if (sides.includes("R")) result.DR = Math.max(result.DR, rating);
      } else if (band === "WB") {
        if (sides.includes("L")) result.WBL = Math.max(result.WBL, rating);
        if (sides.includes("R")) result.WBR = Math.max(result.WBR, rating);
      } else if (band === "DM") {
        result.DM = Math.max(result.DM, rating);
      } else if (band === "M") {
        if (sides.includes("L")) result.ML = Math.max(result.ML, rating);
        if (sides.includes("C")) result.MC = Math.max(result.MC, rating);
        if (sides.includes("R")) result.MR = Math.max(result.MR, rating);
      } else if (band === "AM") {
        if (sides.includes("L")) result.AML = Math.max(result.AML, rating);
        if (sides.includes("C")) result.AMC = Math.max(result.AMC, rating);
        if (sides.includes("R")) result.AMR = Math.max(result.AMR, rating);
      } else if (band === "ST" || band === "S") {
        result.STC = Math.max(result.STC, rating);
      }
    }
  });

  return result;
}

function parseRangeOrNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().replace(/^(\d+),(\d+)$/, "$1.$2");
  if (!cleaned || cleaned === "-") return undefined;
  // Support scouted attribute ranges like "14-16" -> 15
  const rangeMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    return (Number(rangeMatch[1]) + Number(rangeMatch[2])) / 2;
  }
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : undefined;
}

/**
 * Parses squad players from either:
 * 1) `fmsave` CSV (`uid, name, club_uid, club_name, team_id, team_slot, pos_*, raw_*...`)
 * 2) `FM-View-Exporter` (F9) CSV export (`Unique ID, Player/Name, Position, Age, Acc/Acceleration...`)
 */
export function parseSquadCsv(csvText: string): Player[] {
  const lines = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error("CSV input must contain a header row and at least 1 player row");
  }

  const delimiter = detectDelimiter(lines[0]!);
  const rawHeaders = splitDelimitedRow(lines[0]!, delimiter);
  const normHeaders = rawHeaders.map((h) =>
    h.toLowerCase().replace(/[^a-z0-9_]/g, ""),
  );

  const players: Player[] = [];

  for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
    const cells = splitDelimitedRow(lines[rowIdx]!, delimiter);
    if (cells.length < 2) continue;

    const strMap: Record<string, string> = {};
    const numMap: Record<string, number | undefined> = {};

    rawHeaders.forEach((rawH, colIdx) => {
      const valStr = cells[colIdx] ?? "";
      const keyExact = rawH.trim();
      const keyLower = normHeaders[colIdx] ?? "";
      // FM-View-Exporter exports two "Nation" columns (code first, full name second): keep first non-empty
      if (!strMap[keyLower]) {
        strMap[keyLower] = valStr;
      }
      const parsedNum = parseRangeOrNumber(valStr);
      if (parsedNum !== undefined) {
        numMap[keyExact] = parsedNum;
        numMap[keyLower] = parsedNum;
        const mappedAbbrev = FM_ABBREV_TO_ATTRIBUTE[keyLower];
        if (mappedAbbrev && numMap[mappedAbbrev] === undefined) {
          numMap[mappedAbbrev] = parsedNum;
        }
      }
    });

    const name = strMap.name || strMap.player || strMap.fullname || "";
    if (!name) continue;

    const uid = Math.trunc(numMap.uid ?? numMap.uniqueid ?? numMap.id ?? 500_000 + rowIdx);
    const attributes: Partial<Record<AttributeName, number>> = {};
    for (const attr of ALL_49_ATTRIBUTES) {
      const rating = attributeRatingFromRawMap(numMap, attr);
      if (rating !== undefined) {
        attributes[attr] = rating;
      }
    }

    let positions = {} as Record<PositionKey14, number>;
    const hasExplicitPosCols = POSITION_14_KEYS.some(
      (pk) => numMap[`pos_${pk}`] !== undefined || numMap[`pos_${pk.toLowerCase()}`] !== undefined,
    );

    if (hasExplicitPosCols) {
      for (const pk of POSITION_14_KEYS) {
        positions[pk] = Math.min(
          20,
          Math.max(
            0,
            numMap[`pos_${pk}`] ??
              numMap[`pos_${pk.toLowerCase()}`] ??
              numMap[`positions_${pk.toLowerCase()}`] ??
              0,
          ),
        );
      }
    } else if (strMap.position || strMap.pos || strMap.bestpos) {
      // Note: "Pos" in FM UI can be Positioning attribute (numeric) vs Position string ("D (C)")
      const posStr =
        strMap.position && Number.isNaN(Number(strMap.position))
          ? strMap.position
          : strMap.bestpos || "";
      positions = parseFmPositionString(posStr);
    } else {
      for (const pk of POSITION_14_KEYS) positions[pk] = 0;
    }

    const footText = (strMap.preferredfoot || strMap.foot || "").toLowerCase();
    const leftFoot =
      numMap.preferred_foot_left ??
      (numMap.raw_preferred_foot_left !== undefined
        ? Math.min(20, numMap.raw_preferred_foot_left / 5)
        : footText.includes("left") || footText.includes("links")
          ? 20
          : footText.includes("either") || footText.includes("beid")
            ? 18
            : 10);
    const rightFoot =
      numMap.preferred_foot_right ??
      (numMap.raw_preferred_foot_right !== undefined
        ? Math.min(20, numMap.raw_preferred_foot_right / 5)
        : footText.includes("right") || footText.includes("rechts")
          ? 20
          : footText.includes("either") || footText.includes("beid")
            ? 18
            : footText.includes("left") || footText.includes("links")
              ? 10
              : 18);

    // FM-View-Exporter exports `Ability` and `Potential` in 0.5..5.0 stars when CA/PA are hidden
    const starCa =
      numMap.ability !== undefined && numMap.ability > 0 && numMap.ability <= 5
        ? Math.round(numMap.ability * 36)
        : undefined;
    const starPa =
      numMap.potential !== undefined && numMap.potential > 0 && numMap.potential <= 5
        ? Math.round(numMap.potential * 38)
        : undefined;

    players.push({
      uid,
      name,
      age: numMap.age !== undefined ? Math.trunc(numMap.age) : undefined,
      clubUid: numMap.club_uid !== undefined ? Math.trunc(numMap.club_uid) : undefined,
      clubName: strMap.club_name || strMap.club || undefined,
      nationality: strMap.nat || strMap.nation || strMap.nationality || undefined,
      teamId: numMap.team_id !== undefined ? Math.trunc(numMap.team_id) : undefined,
      teamSlot: strMap.team_slot || strMap.pkd || undefined,
      leftFoot,
      rightFoot,
      currentAbility: numMap.ability_current ?? numMap.ca ?? starCa,
      potentialAbility: numMap.ability_potential ?? numMap.pa ?? starPa,
      attributes: attributes as Record<AttributeName, number>,
      positions,
    });
  }

  return players;
}
