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

/**
 * Authentic 204-byte FM27 set-piece & tactical preferences trailer verified against real FM27 `.fmf` exports.
 */
export const DEFAULT_PREFERENCES_204 = Uint8Array.from([
  0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
  0x00, 0x95, 0x24, 0x49, 0x10, 0x08, 0x60, 0x15, 0x00, 0x05, 0x05, 0x09, 0x07, 0x05, 0x25, 0x49,
  0x4a, 0x10, 0x08, 0x60, 0x15, 0x00, 0x0a, 0x0a, 0x09, 0x09, 0x0a, 0x95, 0x24, 0x49, 0x10, 0x08,
  0x60, 0x19, 0x00, 0x05, 0x05, 0x09, 0x07, 0x05, 0x95, 0x24, 0x49, 0x10, 0x08, 0x60, 0x19, 0x00,
  0x05, 0x05, 0x09, 0x07, 0x05, 0x25, 0x49, 0x4a, 0x10, 0x08, 0x60, 0x15, 0x00, 0x0a, 0x0a, 0x09,
  0x09, 0x0a, 0x95, 0x48, 0x49, 0x10, 0x08, 0x60, 0x19, 0x00, 0x05, 0x05, 0x09, 0x0a, 0x05, 0x25,
  0x51, 0x4a, 0x10, 0x08, 0x60, 0x15, 0x00, 0x0a, 0x0a, 0x09, 0x0a, 0x0a, 0x45, 0x52, 0x4a, 0x10,
  0x08, 0x60, 0x15, 0x00, 0x0f, 0x0f, 0x09, 0x0c, 0x0f, 0x25, 0x52, 0x4c, 0x10, 0x08, 0x88, 0x15,
  0x00, 0x0a, 0x0f, 0x09, 0x0c, 0x0a, 0x25, 0x52, 0x4c, 0x10, 0x08, 0x88, 0x15, 0x00, 0x0a, 0x0f,
  0x09, 0x0e, 0x0a, 0x25, 0x49, 0x4a, 0x10, 0x08, 0x60, 0x16, 0x00, 0x0f, 0x11, 0x09, 0x0e, 0x0f,
  0x49, 0x20, 0x4a, 0x42, 0x0a, 0x0a, 0x0b, 0x0a, 0x0a, 0x0a, 0x0a, 0x09, 0x0a, 0x04, 0x09, 0x00,
  0x07, 0x00, 0x07, 0x00, 0x09, 0x01, 0x07, 0x00, 0x07, 0x00, 0x09, 0x01, 0x0f, 0x09, 0x00, 0x07,
  0x00, 0x07, 0x00, 0x07, 0x00, 0x07, 0x00, 0x07, 0x00, 0x07, 0x00, 0x0f,
]);

export const DEFAULT_PREFERENCES_152 = DEFAULT_PREFERENCES_204;

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
  if (def === 4 && wb === 0 && dm + mid === 2 && am === 3 && st === 1) return "4-2-3-1";
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
  catalog: PitchCatalog,
): void {
  const posMask = posMaskMap.get(slotCfg.positionId);
  const roleFlags = roleFlagMap.get(slotCfg.roleId);
  if (posMask === undefined || roleFlags === undefined) {
    throw new Error(`Unresolved mask/flags for ${slotCfg.positionId}:${slotCfg.roleId}`);
  }

  const defaultRoleId = catalog.Eligibility["0:0"][slotCfg.positionId]?.[phase]?.[0];
  const defaultRoleFlags = defaultRoleId ? roleFlagMap.get(defaultRoleId) : undefined;
  const writeDefaultEntryFirst =
    defaultRoleFlags !== undefined &&
    (slotCfg.positionId !== "GK" || phase === 1 || defaultRoleFlags !== roleFlags);

  writer.writeBytes(SLOT_HEADER);
  writer.writeInt32(posMask);
  writer.writeBytes(SLOT_VERSION);
  writer.writeInt32(writeDefaultEntryFirst ? 2 : 1);

  if (writeDefaultEntryFirst && defaultRoleFlags !== undefined) {
    writer.writeUint64(defaultRoleFlags);
    writer.writeBytes(PI_BLOCK_HEADER);
    writer.writeUint64(0n);
    writer.writeUint8(0xff);
    writer.writeInt32(0);
  }

  writer.writeUint64(roleFlags);
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

function resolveRoleIdFromFlags(
  cleanActiveFlags: bigint,
  entries: readonly { cleanRoleFlags: bigint }[],
  phase: 0 | 1,
  positionId: string,
  lookupMap: Map<bigint, string>,
  catalog: PitchCatalog,
  roleFlagById: Map<string, bigint>,
): string {
  const direct = lookupMap.get(cleanActiveFlags);
  if (direct) return direct;

  for (let e = entries.length - 1; e >= 0; e--) {
    const found = lookupMap.get(entries[e]!.cleanRoleFlags);
    if (found) return found;
  }

  // Fallback for real FM26/FM27 exports that carry extra high modifier bits on activeRoleFlags:
  // match the most-specific eligible role for this (positionId, phase) whose bitmask is contained in cleanActiveFlags.
  const eligibleIds = catalog.Eligibility["0:0"]?.[positionId]?.[phase] ?? [];
  let bestMatchId: string | null = null;
  let bestBitScore = -1n;
  for (const candId of eligibleIds) {
    const candFlags = roleFlagById.get(candId);
    if (candFlags !== undefined && candFlags > 0n && (cleanActiveFlags & candFlags) === candFlags) {
      if (candFlags > bestBitScore) {
        bestBitScore = candFlags;
        bestMatchId = candId;
      }
    }
  }
  if (bestMatchId) return bestMatchId;

  // Last-resort safe fallback to default eligible role for the slot rather than crashing the whole import
  if (eligibleIds.length > 0 && eligibleIds[0]) {
    return eligibleIds[0];
  }

  throw new Error(
    `Unknown Role.Flags ${cleanActiveFlags.toString()} in phase ${phase} at position ${positionId}`,
  );
}

function readBinarySlot(
  reader: BinaryReader,
  phase: 0 | 1,
  maskToPosId: Map<number, string>,
  ipFlagsToRoleId: Map<bigint, string>,
  oopFlagsToRoleId: Map<bigint, string>,
  catalog: PitchCatalog,
  roleFlagById: Map<string, bigint>,
): ParsedBinarySlot {
  reader.expectBytes(SLOT_HEADER, "SlotHeader");
  const posMask = reader.readInt32();
  reader.skip(3); // slot version (00 01 01)
  const entryCount = reader.readInt32();
  if (entryCount < 0 || entryCount > 64) {
    throw new Error(`Unexpected slot entryCount: ${entryCount}`);
  }

  const entries: Array<{
    cleanRoleFlags: bigint;
    piBitsMask: bigint;
    markPosMask: number;
  }> = [];

  for (let e = 0; e < entryCount; e++) {
    const entryRoleFlags = reader.readUint64();
    reader.skip(3); // 02 02 02 header
    const entryPiMask = reader.readUint64();
    reader.skip(1); // 0xFF target marker
    const entryMarkMask = reader.readInt32();
    entries.push({
      cleanRoleFlags: entryRoleFlags & CLEAR_DUTY_MASK,
      piBitsMask: entryPiMask,
      markPosMask: entryMarkMask,
    });
  }

  reader.skip(4); // int32(0) separator
  const activeRoleFlags = reader.readUint64();
  const cleanActiveFlags = activeRoleFlags & CLEAR_DUTY_MASK;

  // Match the active role entry from the end (handles ec=2 where entry[0] is default role & entry[1] is active role)
  let matchedEntry = entries.length > 0 ? entries[entries.length - 1]! : null;
  for (let e = entries.length - 1; e >= 0; e--) {
    if (entries[e]!.cleanRoleFlags === cleanActiveFlags) {
      matchedEntry = entries[e]!;
      break;
    }
  }

  const positionId = maskToPosId.get(posMask);
  if (!positionId) {
    throw new Error(`Unknown binary Position.Mask: ${posMask}`);
  }

  const lookupMap = phase === 0 ? ipFlagsToRoleId : oopFlagsToRoleId;
  const roleId = resolveRoleIdFromFlags(
    cleanActiveFlags,
    entries,
    phase,
    positionId,
    lookupMap,
    catalog,
    roleFlagById,
  );

  return {
    positionId,
    roleId,
    duty: phase === 0 ? extractDutyFromActiveRoleFlags(activeRoleFlags) : "Defend",
    playerInstructionBits: matchedEntry ? decodePlayerInstructionBits(matchedEntry.piBitsMask) : [],
    markingPositionMask: matchedEntry ? matchedEntry.markPosMask : 0,
  };
}

function seekPastPlanHeader(reader: BinaryReader, bytes: Uint8Array): void {
  // Case 1: raw PlanHeader starting directly with 22 44
  if (bytes.byteLength >= 8 && bytes[0] === 0x22 && bytes[1] === 0x44) {
    reader.skip(8);
    return;
  }

  // Case 2: standard TacticOuterHeader with `cat.` prefix at [2..5] followed by PlanHeader `22 44`
  if (
    bytes.byteLength >= 16 &&
    bytes[2] === 0x63 &&
    bytes[3] === 0x61 &&
    bytes[4] === 0x74 &&
    bytes[5] === 0x2e
  ) {
    // Scan for `22 44 00 1b` (or `22 44`) starting at offset 8 up to 32 bytes
    for (let off = 8; off <= Math.min(32, bytes.byteLength - 8); off++) {
      if (bytes[off] === 0x22 && bytes[off + 1] === 0x44) {
        reader.seek(off + 8);
        return;
      }
    }
    throw new Error("Found 'cat.' outer header, but missing PlanHeader (0x22 0x44)");
  }

  reader.expectBytes(TACTIC_OUTER_HEADER, "TacticOuterHeader");
  reader.expectBytes(PLAN_HEADER, "PlanHeader");
}

function hasValidSlotHeaderAt(
  bytes: Uint8Array,
  offset: number,
  maskToPosId: Map<number, string>,
): boolean {
  if (offset < 0 || offset + 14 > bytes.byteLength) return false;
  if (
    bytes[offset] !== SLOT_HEADER[0] ||
    bytes[offset + 1] !== SLOT_HEADER[1] ||
    bytes[offset + 2] !== SLOT_HEADER[2]
  ) {
    return false;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset + 3, 4);
  const mask = view.getInt32(0, true);
  return maskToPosId.has(mask);
}

function skipStyleSentinelBeforeSlots(
  reader: BinaryReader,
  bytes: Uint8Array,
  maskToPosId: Map<number, string>,
): void {
  const startOffset = reader.offset;
  if (bytes[startOffset] === 0xff) {
    try {
      reader.skip(1);
      // Length-prefixed style label ("" -> 00 00 00 00 in standard exports, or e.g. "Custom" in game saves)
      reader.readLengthPrefixedUtf8(256);
      // 4-byte reversed FourCC (e.g. "LLUN" = 4c 4c 55 4e, or preset FourCC like "IKIT")
      reader.skip(4);
      if (hasValidSlotHeaderAt(bytes, reader.offset, maskToPosId)) {
        return;
      }
    } catch {
      // Fall through to resilient SlotHeader scan below
    }
  }

  // Resilient scan for real FM26/FM27 exports with extra style metadata bytes before the 11 dual-phase slots
  const scanLimit = Math.min(bytes.byteLength - 14, startOffset + 512);
  for (let off = startOffset; off <= scanLimit; off++) {
    if (hasValidSlotHeaderAt(bytes, off, maskToPosId)) {
      reader.seek(off);
      return;
    }
  }

  const marker = bytes[startOffset] ?? 0;
  throw new Error(
    `Invalid style sentinel marker at offset ${startOffset}: expected 0xff or SlotHeader (44 00 02), got 0x${marker.toString(16).padStart(2, "0")}`,
  );
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

  // FM27 cross-phase pairing invariant:
  // At binary slot i, attackSlots11[i] is player i's IP config, orderByte is PHASE_ORDER[i],
  // and player i's OOP config is stored at defenceSlots11[PHASE_ORDER[i]].
  const attackSlots11: SlotPhaseConfig[] = orderedPairs.map((s) => s.inPossession);
  const defenceSlots11: SlotPhaseConfig[] = new Array<SlotPhaseConfig>(11);
  for (let playerIdx = 0; playerIdx < 11; playerIdx++) {
    const defSlotIdx = PHASE_ORDER[playerIdx]!;
    defenceSlots11[defSlotIdx] = orderedPairs[playerIdx]!.outOfPossession;
  }

  const writer = new BinaryWriter(2048);
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
    writeBinarySlot(writer, attackSlots11[i]!, 0, posMaskMap, roleFlagMap, catalog);
    writeBinarySlot(writer, defenceSlots11[i]!, 1, posMaskMap, roleFlagMap, catalog);
    writer.writeUint8(PHASE_ORDER[i]!);
  }

  writer.writeBytes(options?.trailingPreferences ?? DEFAULT_PREFERENCES_204);
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
  const roleFlagById = new Map<string, bigint>();
  const ipFlagsToRoleId = new Map<bigint, string>();
  const oopFlagsToRoleId = new Map<bigint, string>();
  for (const r of catalog.Roles) {
    const f = BigInt(r.Flags);
    roleFlagById.set(r.Id, f);
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
  seekPastPlanHeader(reader, bytes);

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

  skipStyleSentinelBeforeSlots(reader, bytes, maskToPosId);

  const attackParsed: ParsedBinarySlot[] = [];
  const defenceByRawIndex: ParsedBinarySlot[] = new Array<ParsedBinarySlot>(11);
  const phaseOrderRead: number[] = [];

  for (let i = 0; i < 11; i++) {
    const att = readBinarySlot(
      reader,
      0,
      maskToPosId,
      ipFlagsToRoleId,
      oopFlagsToRoleId,
      catalog,
      roleFlagById,
    );
    const def = readBinarySlot(
      reader,
      1,
      maskToPosId,
      ipFlagsToRoleId,
      oopFlagsToRoleId,
      catalog,
      roleFlagById,
    );
    const orderByte = reader.readUint8();
    attackParsed.push(att);
    defenceByRawIndex[i] = def;
    phaseOrderRead.push(orderByte);
  }

  // Pair attack slot `idx` with defence slot `phaseOrderRead[idx]` (when valid permutation of 0..10)
  const validPermutation =
    phaseOrderRead.every((n) => n >= 0 && n < 11) && new Set(phaseOrderRead).size === 11;

  const slots: SlotAssignment[] = attackParsed.map((att, idx) => {
    const defIdx = validPermutation ? phaseOrderRead[idx]! : idx;
    return {
      slotIndex: idx,
      inPossession: att,
      outOfPossession: defenceByRawIndex[defIdx]!,
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
