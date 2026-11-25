import { getPitchCatalog } from "@fm27/fm-data";
import {
  DutyMaskMap,
  type DualPhaseTactic,
  type Duty,
  type PitchCatalog,
  type SlotAssignment,
  type SlotPhaseConfig,
} from "@fm27/shared-types";
import { BinaryReader } from "./binary-reader.js";
import { BinaryWriter } from "./binary-writer.js";

export const TACTIC_OUTER_HEADER = [
  0x03, 0x01, 0x63, 0x61, 0x74, 0x2e, 0x22, 0x00,
] as const;

export const PLAN_HEADER = [
  0x22, 0x44, 0x00, 0x1b, 0x00, 0x01, 0x00, 0x01,
] as const;

export const MENTALITY_TEMPLATE = [0x04, 0x02, 0x04, 0x07, 0x02, 0x03] as const;
export const LLUN_SENTINEL = [0xff, 0x00, 0x00, 0x00, 0x00, 0x4c, 0x4c, 0x55, 0x4e] as const;
export const SLOT_HEADER = [0x44, 0x00, 0x02] as const;
export const SLOT_VERSION = [0x00, 0x01, 0x01] as const;
export const PI_BLOCK_HEADER = [0x02, 0x02, 0x02] as const;
export const PHASE_ORDER = [
  0x00, 0x01, 0x02, 0x03, 0x04, 0x09, 0x05, 0x06, 0x07, 0x08, 0x0a,
] as const;

export const DEFAULT_PREFERENCES_152 = new Uint8Array(152);

const CLEAR_DUTY_MASK = ~0x400e00000n;
const DEFEND_DUTY_BIT = BigInt(DutyMaskMap.Defend); // 0x200000n
const SUPPORT_DUTY_BIT = BigInt(DutyMaskMap.Support); // 0x400000n
const ATTACK_DUTY_BIT = BigInt(DutyMaskMap.Attack); // 0x800000n

export function validatePhase(
  slots: readonly SlotPhaseConfig[],
  phase: 0 | 1,
  catalog: PitchCatalog,
): void {
  if (slots.length !== 11) {
    throw new Error(
      `Phase ${phase === 0 ? "In-Possession" : "Out-of-Possession"} must have exact 11 slots (got ${slots.length})`,
    );
  }
  const posSet = new Set(catalog.Positions.map((p) => p.Id));
  const roleSet = new Set(catalog.Roles.map((r) => r.Id));
  const seenPositions = new Set<string>();

  for (const s of slots) {
    if (!posSet.has(s.positionId)) {
      throw new Error(`Invalid positionId "${s.positionId}" in phase ${phase}`);
    }
    if (seenPositions.has(s.positionId)) {
      throw new Error(`Duplicate positionId "${s.positionId}" in phase ${phase}`);
    }
    seenPositions.add(s.positionId);

    if (!roleSet.has(s.roleId)) {
      throw new Error(`Unknown roleId "${s.roleId}" in phase ${phase}`);
    }
    const isOopRole = s.roleId.startsWith("OP");
    if (phase === 0 && isOopRole) {
      throw new Error(`Out-of-possession role "${s.roleId}" cannot be used in In-Possession phase`);
    }
    if (phase === 1 && !isOopRole) {
      throw new Error(`In-possession role "${s.roleId}" cannot be used in Out-of-Possession phase`);
    }
  }

  if (!seenPositions.has("GK")) {
    throw new Error(`Phase ${phase} is missing mandatory GK slot`);
  }
}

export function validatePlan(tactic: DualPhaseTactic, catalog?: PitchCatalog): void {
  const cat = catalog ?? getPitchCatalog(tactic.patchVersion);
  validatePhase(
    tactic.slots.map((s) => s.inPossession),
    0,
    cat,
  );
  validatePhase(
    tactic.slots.map((s) => s.outOfPossession),
    1,
    cat,
  );

  if (tactic.mentality < 1 || tactic.mentality > 7) {
    throw new Error(`Mentality must be between 1 and 7 (got ${tactic.mentality})`);
  }

  const groupMap = new Map<string, Set<number>>();
  for (const g of cat.Instructions) {
    groupMap.set(g.Group, new Set(g.Options.map((o) => o.Bit)));
  }

  const activeBits = new Set<number>();
  for (const [group, bit] of Object.entries(tactic.teamInstructions)) {
    const validBits = groupMap.get(group);
    if (!validBits || !validBits.has(bit)) {
      throw new Error(`Invalid Team Instruction bit ${bit} for group "${group}"`);
    }
    if (bit > 0) activeBits.add(bit);
  }

  for (const [bitA, bitB] of cat.Conflicts) {
    if (activeBits.has(bitA) && activeBits.has(bitB)) {
      throw new Error(
        `Conflicting Team Instructions detected: bits ${bitA} and ${bitB} cannot both be active`,
      );
    }
  }
}

export function computeActiveRoleFlags(
  rawRoleFlags: bigint,
  duty: Duty,
  phase: 0 | 1,
): bigint {
  const clean = rawRoleFlags & CLEAR_DUTY_MASK;
  if (phase !== 0) return clean;
  if (duty === "Defend") return clean | DEFEND_DUTY_BIT;
  if (duty === "Attack") return clean | ATTACK_DUTY_BIT;
  return clean | SUPPORT_DUTY_BIT;
}

export function extractDutyFromActiveRoleFlags(activeFlags: bigint): Duty {
  if ((activeFlags & DEFEND_DUTY_BIT) !== 0n) return "Defend";
  if ((activeFlags & ATTACK_DUTY_BIT) !== 0n) return "Attack";
  return "Support";
}

function encodePlayerInstructionBits(bits: readonly number[]): bigint {
  let mask = 0n;
  for (const b of bits) {
    if (b > 0 && b <= 42) {
      mask |= 1n << BigInt(b);
    }
  }
  return mask;
}

function decodePlayerInstructionBits(mask: bigint): number[] {
  const bits: number[] = [];
  for (let b = 1; b <= 42; b++) {
    if ((mask & (1n << BigInt(b))) !== 0n) {
      bits.push(b);
    }
  }
  return bits;
}

export function detectFormationFromPositions(
  positionIds: readonly string[],
  catalog: PitchCatalog,
): string {
  const validPos = new Set(catalog.Positions.map((p) => p.Id));
  let def = 0;
  let wb = 0;
  let dm = 0;
  let mid = 0;
  let am = 0;
  let st = 0;

  for (const id of positionIds) {
    if (!validPos.has(id) || id === "GK") continue;
    if (id === "DC" || id === "DCL" || id === "DCR" || id === "DL" || id === "DR") def++;
    else if (id === "WBL" || id === "WBR") wb++;
    else if (id === "DMC" || id === "DML" || id === "DMR") dm++;
    else if (id === "MC" || id === "MCL" || id === "MCR" || id === "ML" || id === "MR") mid++;
    else if (
      id === "AMC" ||
      id === "AMCL" ||
      id === "AMCR" ||
      id === "AML" ||
      id === "AMR"
    ) {
      am++;
    } else if (id === "ST" || id === "STL" || id === "STR") st++;
  }

  if (def === 3 && wb === 2) {
    if (dm === 0 && mid === 2 && am === 2 && st === 1) return "3-4-2-1";
    if (dm === 1 && mid === 2 && am === 0 && st === 2) return "3-5-2";
    if (dm === 2 && mid === 0 && am === 2 && st === 1) return "3-4-2-1";
    if (dm + mid === 2 && am + st === 3) return am === 2 ? "3-4-2-1" : "3-4-3";
    const midBand = wb + dm + mid;
    return am > 0 && st > 0 ? `3-${midBand}-${am}-${st}` : `3-${midBand}-${am + st}`;
  }
  if (def === 4 && wb === 0 && dm === 1 && mid === 2 && am === 2 && st === 1) return "4-3-3 DM";
  if (def === 4 && wb === 0 && dm === 1 && mid === 2 && am === 1 && st === 2) return "4-3-1-2";
  if (def === 5 && wb === 0 && dm === 1 && mid === 2 && am === 0 && st === 2) return "5-3-2";
  if (am === 2 && st === 1 && dm + mid >= 3) return `${def + wb}-${dm + mid}-3`;

  const lines = [def + wb, dm, mid, am, st].filter((n) => n > 0);
  return lines.join("-") || "Custom";
}

function writeBinarySlot(
  writer: BinaryWriter,
  slotCfg: SlotPhaseConfig,
  phase: 0 | 1,
  posMaskMap: Map<string, number>,
  roleFlagMap: Map<string, bigint>,
): void {
  const posMask = posMaskMap.get(slotCfg.positionId);
  const roleFlags = roleFlagMap.get(slotCfg.roleId);
  if (posMask === undefined || roleFlags === undefined) {
    throw new Error(`Unresolved mask/flags for ${slotCfg.positionId}:${slotCfg.roleId}`);
  }

  writer.writeBytes(SLOT_HEADER);
  writer.writeInt32(posMask);
  writer.writeBytes(SLOT_VERSION);
  writer.writeInt32(1); // 1 role-instruction entry
  writer.writeUint64(roleFlags);

  // 16-byte PlayerInstructions block
  writer.writeBytes(PI_BLOCK_HEADER);
  writer.writeUint64(encodePlayerInstructionBits(slotCfg.playerInstructionBits));
  writer.writeUint8(0xff);
  writer.writeInt32(slotCfg.markingPositionMask);

  writer.writeInt32(0); // separator
  writer.writeUint64(computeActiveRoleFlags(roleFlags, slotCfg.duty, phase));
}

interface ParsedBinarySlot {
  positionId: string;
  roleId: string;
  duty: Duty;
  playerInstructionBits: number[];
  markingPositionMask: number;
}

function readBinarySlot(
  reader: BinaryReader,
  phase: 0 | 1,
  maskToPosId: Map<number, string>,
  ipFlagsToRoleId: Map<bigint, string>,
  oopFlagsToRoleId: Map<bigint, string>,
): ParsedBinarySlot {
  reader.expectBytes(SLOT_HEADER, "SlotHeader");
  const posMask = reader.readInt32();
  reader.skip(3); // slot version (00 01 01)
  const entryCount = reader.readInt32();
  if (entryCount < 1 || entryCount > 8) {
    throw new Error(`Unexpected slot entryCount: ${entryCount}`);
  }

  let baseRoleFlags = 0n;
  let piBitsMask = 0n;
  let markPosMask = 0;

  for (let e = 0; e < entryCount; e++) {
    const entryRoleFlags = reader.readUint64();
    reader.skip(3); // 02 02 02 header
    const entryPiMask = reader.readUint64();
    reader.skip(1); // 0xFF target marker
    const entryMarkMask = reader.readInt32();
    if (e === 0) {
      baseRoleFlags = entryRoleFlags;
      piBitsMask = entryPiMask;
      markPosMask = entryMarkMask;
    }
  }

  reader.skip(4); // int32(0) separator
  const activeRoleFlags = reader.readUint64();
  const cleanActiveFlags = activeRoleFlags & CLEAR_DUTY_MASK;

  const positionId = maskToPosId.get(posMask);
  if (!positionId) {
    throw new Error(`Unknown binary Position.Mask: ${posMask}`);
  }

  const lookupMap = phase === 0 ? ipFlagsToRoleId : oopFlagsToRoleId;
  const roleId = lookupMap.get(cleanActiveFlags) ?? lookupMap.get(baseRoleFlags & CLEAR_DUTY_MASK);
  if (!roleId) {
    throw new Error(
      `Unknown Role.Flags ${cleanActiveFlags.toString()} in phase ${phase} at position ${positionId}`,
    );
  }

  return {
    positionId,
    roleId,
    duty: phase === 0 ? extractDutyFromActiveRoleFlags(activeRoleFlags) : "Defend",
    playerInstructionBits: decodePlayerInstructionBits(piBitsMask),
    markingPositionMask: markPosMask,
  };
}

/**
 * Serializes a validated DualPhaseTactic into exact FM27 `.tac` (`cat.`) binary bytes.
 */
export function encodeTacPayload(
  tactic: DualPhaseTactic,
  options?: { catalog?: PitchCatalog; trailingPreferences?: Uint8Array },
): Uint8Array {
  const catalog = options?.catalog ?? getPitchCatalog(tactic.patchVersion);
  validatePlan(tactic, catalog);

  const posMaskMap = new Map(catalog.Positions.map((p) => [p.Id, p.Mask]));
  const roleFlagMap = new Map(catalog.Roles.map((r) => [r.Id, BigInt(r.Flags)]));

  // Normalize slot order so GK is always at index 0 (FM27 .tac binary invariant)
  const gkSlot = tactic.slots.find((s) => s.inPossession.positionId === "GK");
  const outfieldSlots = tactic.slots.filter((s) => s.inPossession.positionId !== "GK");
  if (!gkSlot || outfieldSlots.length !== 10) {
    throw new Error("Tactic must contain 1 GK slot and 10 outfield slots");
  }
  const orderedPairs = [gkSlot, ...outfieldSlots];

  // Build attackSlots11[i] and defenceSlots11[defIdx] so PhaseOrder[defIdx] === i pairs the same player!
  const attackSlots11: SlotPhaseConfig[] = orderedPairs.map((s) => s.inPossession);
  const defenceSlots11: SlotPhaseConfig[] = new Array<SlotPhaseConfig>(11);
  for (let k = 0; k < 11; k++) {
    const playerIdx = PHASE_ORDER[k]!;
    defenceSlots11[k] = orderedPairs[playerIdx]!.outOfPossession;
  }

  const writer = new BinaryWriter(1536);
  writer.writeBytes(TACTIC_OUTER_HEADER);
  writer.writeBytes(PLAN_HEADER);
  writer.writeLengthPrefixedUtf8(tactic.title);
  writer.writeZeroes(12);

  const mentalityBytes = Uint8Array.from(MENTALITY_TEMPLATE);
  mentalityBytes[2] = tactic.mentality;
  writer.writeBytes(mentalityBytes);

  // 96-bit (12-byte) Team Instructions bitfield (ensure LineOfEngagement defaults to 62 if unset)
  const mergedInstructions: Record<string, number> = {
    LineOfEngagement: 62,
    ...tactic.teamInstructions,
  };
  const teamBits = new Uint8Array(12);
  for (const bit of Object.values(mergedInstructions)) {
    if (bit > 0 && bit < 96) {
      const byteIndex = bit >>> 3;
      teamBits[byteIndex] = (teamBits[byteIndex] ?? 0) | (1 << (bit & 7));
    }
  }
  writer.writeBytes(teamBits);
  writer.writeBytes(LLUN_SENTINEL);

  for (let i = 0; i < 11; i++) {
    writeBinarySlot(writer, attackSlots11[i]!, 0, posMaskMap, roleFlagMap);
    const defIdx = PHASE_ORDER.indexOf(i as (typeof PHASE_ORDER)[number]);
    writeBinarySlot(writer, defenceSlots11[defIdx]!, 1, posMaskMap, roleFlagMap);
    writer.writeUint8(PHASE_ORDER[i]!);
  }

  writer.writeBytes(options?.trailingPreferences ?? DEFAULT_PREFERENCES_152);
  return writer.toUint8Array();
}

/**
 * Deserializes FM27 `.tac` (`cat.`) binary bytes back into a DualPhaseTactic.
 */
export function decodeTacPayload(
  bytes: Uint8Array,
  options?: { patchVersion?: string; catalog?: PitchCatalog },
): DualPhaseTactic {
  const patchVersion = options?.patchVersion ?? "27.0";
  const catalog = options?.catalog ?? getPitchCatalog(patchVersion);

  const maskToPosId = new Map(catalog.Positions.map((p) => [p.Mask, p.Id]));
  const ipFlagsToRoleId = new Map<bigint, string>();
  const oopFlagsToRoleId = new Map<bigint, string>();
  for (const r of catalog.Roles) {
    const f = BigInt(r.Flags);
    if (r.Id.startsWith("OP")) {
      oopFlagsToRoleId.set(f, r.Id);
    } else {
      ipFlagsToRoleId.set(f, r.Id);
    }
  }

  const bitToGroup = new Map<number, string>();
  for (const g of catalog.Instructions) {
    for (const o of g.Options) {
      if (o.Bit > 0) bitToGroup.set(o.Bit, g.Group);
    }
  }

  const reader = new BinaryReader(bytes);
  reader.expectBytes(TACTIC_OUTER_HEADER, "TacticOuterHeader");
  reader.expectBytes(PLAN_HEADER, "PlanHeader");

  const title = reader.readLengthPrefixedUtf8() || "Imported FM27 Tactic";
  reader.skip(12); // reserved zeroes

  const mentalityBlock = reader.readBytes(6);
  const rawMentality = mentalityBlock[2] ?? 4;
  const mentality = Math.max(1, Math.min(7, rawMentality));

  const teamBitBytes = reader.readBytes(12);
  const teamInstructions: Record<string, number> = {};
  for (let bit = 1; bit < 96; bit++) {
    const byteVal = teamBitBytes[bit >>> 3] ?? 0;
    if ((byteVal & (1 << (bit & 7))) !== 0) {
      const groupName = bitToGroup.get(bit);
      if (groupName) {
        teamInstructions[groupName] = bit;
      }
    }
  }

  reader.expectBytes(LLUN_SENTINEL, "LLUN Sentinel");

  const attackParsed: ParsedBinarySlot[] = [];
  const defenceByRawIndex: ParsedBinarySlot[] = new Array<ParsedBinarySlot>(11);
  const phaseOrderRead: number[] = [];

  for (let i = 0; i < 11; i++) {
    const att = readBinarySlot(reader, 0, maskToPosId, ipFlagsToRoleId, oopFlagsToRoleId);
    const def = readBinarySlot(reader, 1, maskToPosId, ipFlagsToRoleId, oopFlagsToRoleId);
    const orderByte = reader.readUint8();
    attackParsed.push(att);
    // In WriteTacPayload: at iteration i, defenceSlots11[defIdx] was written where PhaseOrder[defIdx] == i
    defenceByRawIndex[i] = def;
    phaseOrderRead.push(orderByte);
  }

  // Reconstruct paired slots: for iteration i, att is attackSlots11[i] and def written in the same pair
  // already corresponds to PhaseOrder[defIdx] == i -> the exact same player!
  void phaseOrderRead;
  const slots: SlotAssignment[] = attackParsed.map((att, idx) => ({
    slotIndex: idx,
    inPossession: att,
    outOfPossession: defenceByRawIndex[idx]!,
  }));

  const inFormation = detectFormationFromPositions(
    slots.map((s) => s.inPossession.positionId),
    catalog,
  );
  const outFormation = detectFormationFromPositions(
    slots.map((s) => s.outOfPossession.positionId),
    catalog,
  );

  return {
    title,
    description: "",
    author: "",
    patchVersion,
    mentality,
    inFormation,
    outFormation,
    teamInstructions,
    slots,
  };
}
