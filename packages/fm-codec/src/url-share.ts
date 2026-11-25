import LZString from "lz-string";
import { getPitchCatalog } from "@fm27/fm-data";
import {
  DualPhaseTacticSchema,
  type DualPhaseTactic,
  type Duty,
} from "@fm27/shared-types";
import { detectFormationFromPositions, validatePlan } from "./tac-serializer.js";

const DUTY_TO_CODE: Record<Duty, number> = {
  Defend: 0,
  Support: 1,
  Attack: 2,
};

const CODE_TO_DUTY: Record<number, Duty> = {
  0: "Defend",
  1: "Support",
  2: "Attack",
};

// Compact tuple:
// [version=1, patchVersion, title, mentality, styleId|"", activeTiBits[], slots11[[inPos, inRole, inDutyCode, inPiBits[], inMark], [outPos, outRole, outPiBits[], outMark], playerName|""]]
type CompactSlotTuple = [
  [string, string, number, number[], number],
  [string, string, number[], number],
  string,
];

type CompactTacticTuple = [
  1,
  string,
  string,
  number,
  string,
  number[],
  CompactSlotTuple[],
];

export function encodeTacticToUrlParam(tactic: DualPhaseTactic): string {
  const parsed = DualPhaseTacticSchema.parse(tactic);
  validatePlan(parsed);

  const activeTiBits = Object.values(parsed.teamInstructions)
    .filter((b) => b > 0)
    .sort((a, b) => a - b);

  const compactSlots: CompactSlotTuple[] = parsed.slots.map((s) => [
    [
      s.inPossession.positionId,
      s.inPossession.roleId,
      DUTY_TO_CODE[s.inPossession.duty],
      s.inPossession.playerInstructionBits,
      s.inPossession.markingPositionMask,
    ],
    [
      s.outOfPossession.positionId,
      s.outOfPossession.roleId,
      s.outOfPossession.playerInstructionBits,
      s.outOfPossession.markingPositionMask,
    ],
    s.playerName ?? "",
  ]);

  const tuple: CompactTacticTuple = [
    1,
    parsed.patchVersion,
    parsed.title,
    parsed.mentality,
    parsed.styleId ?? "",
    activeTiBits,
    compactSlots,
  ];

  return LZString.compressToEncodedURIComponent(JSON.stringify(tuple));
}

export function encodeTacticToUrlHash(tactic: DualPhaseTactic): string {
  return `#t=${encodeTacticToUrlParam(tactic)}`;
}

export function decodeTacticFromUrlHash(hashOrUrl: string): DualPhaseTactic {
  let token = hashOrUrl.trim();
  const hashIdx = token.indexOf("#t=");
  if (hashIdx >= 0) {
    token = token.slice(hashIdx + 3);
  } else if (token.startsWith("t=")) {
    token = token.slice(2);
  }
  const ampIdx = token.indexOf("&");
  if (ampIdx >= 0) {
    token = token.slice(0, ampIdx);
  }

  const decompressed = LZString.decompressFromEncodedURIComponent(token);
  if (!decompressed) {
    throw new Error("Invalid or corrupted compressed tactic URL payload");
  }

  const tuple = JSON.parse(decompressed) as CompactTacticTuple;
  if (!Array.isArray(tuple) || tuple[0] !== 1 || !Array.isArray(tuple[6]) || tuple[6].length !== 11) {
    throw new Error("Unsupported compressed tactic tuple schema");
  }

  const [, patchVersion, title, mentality, styleId, activeTiBits, compactSlots] = tuple;
  const catalog = getPitchCatalog(patchVersion);

  const bitToGroup = new Map<number, string>();
  for (const g of catalog.Instructions) {
    for (const opt of g.Options) {
      if (opt.Bit > 0) bitToGroup.set(opt.Bit, g.Group);
    }
  }

  const teamInstructions: Record<string, number> = {};
  for (const bit of activeTiBits) {
    const group = bitToGroup.get(bit);
    if (group) teamInstructions[group] = bit;
  }

  const slots = compactSlots.map((cs, idx) => {
    const [inTuple, outTuple, playerName] = cs;
    return {
      slotIndex: idx,
      ...(playerName ? { playerName } : {}),
      inPossession: {
        positionId: inTuple[0],
        roleId: inTuple[1],
        duty: CODE_TO_DUTY[inTuple[2]] ?? "Support",
        playerInstructionBits: inTuple[3],
        markingPositionMask: inTuple[4],
      },
      outOfPossession: {
        positionId: outTuple[0],
        roleId: outTuple[1],
        duty: "Defend" as const,
        playerInstructionBits: outTuple[2],
        markingPositionMask: outTuple[3],
      },
    };
  });

  const inFormation = detectFormationFromPositions(
    slots.map((s) => s.inPossession.positionId),
    catalog,
  );
  const outFormation = detectFormationFromPositions(
    slots.map((s) => s.outOfPossession.positionId),
    catalog,
  );

  const tactic = DualPhaseTacticSchema.parse({
    title,
    description: "",
    author: "",
    patchVersion,
    ...(styleId ? { styleId } : {}),
    mentality,
    inFormation,
    outFormation,
    teamInstructions,
    slots,
  });

  validatePlan(tactic, catalog);
  return tactic;
}
