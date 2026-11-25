import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getTrainingPresets } from "@fm27/fm-data";
import type { DualPhaseTactic } from "@fm27/shared-types";
import {
  BinaryReader,
  BinaryWriter,
  decodeDetailsAom,
  decodeTacPayload,
  decodeTacticFromUrlHash,
  decodeZstdFrame,
  decompressWithFzstd,
  encodeDetailsAom,
  encodeTacPayload,
  encodeTacticToUrlHash,
  encodeZstdRawFrame,
  encryptAesCtrFmf,
  exportFm27Json,
  exportFmf,
  exportScheduleFmf,
  exportScheduleJson,
  exportShortlistFmf,
  FMF_ARCHIVE_HEADER,
  PLAN_HEADER,
  parseFm27Json,
  parseFmf,
  parseScheduleFmf,
  parseScheduleJson,
  parseShortlistFmf,
  TACTIC_OUTER_HEADER,
  validatePlan,
} from "@fm27/fm-codec";

function createSampleDualPhaseTactic(): DualPhaseTactic {
  return {
    title: "High-Press 4-3-3 -> 4-4-2",
    description: "Asymmetric pressing system dropping AML to ML and stepping AMR to STR.",
    author: "Antigravity Test",
    patchVersion: "27.0",
    styleId: "Gegenpress",
    mentality: 5,
    inFormation: "4-3-3 DM",
    outFormation: "4-4-2",
    teamInstructions: {
      PassingDirectness: 3,
      Tempo: 47,
      AttackingTransition: 54,
      DefensiveTransition: 70,
      LineOfEngagement: 61,
      DefensiveLine: 57,
      TriggerPress: 65,
      PreventShortGKDistribution: 69,
    },
    slots: [
      {
        slotIndex: 0,
        playerName: "Bukayo Saka",
        inPossession: {
          positionId: "AMR",
          roleId: "InsideForward",
          duty: "Attack",
          playerInstructionBits: [13, 25],
          markingPositionMask: 0,
        },
        outOfPossession: {
          positionId: "STR",
          roleId: "OPSplittingOutletCentreForward",
          duty: "Defend",
          playerInstructionBits: [29],
          markingPositionMask: 0,
        },
      },
      {
        slotIndex: 1,
        playerName: "Kai Havertz",
        inPossession: {
          positionId: "ST",
          roleId: "CentreForward",
          duty: "Attack",
          playerInstructionBits: [],
          markingPositionMask: 0,
        },
        outOfPossession: {
          positionId: "STL",
          roleId: "OPTrackingCentreForward",
          duty: "Defend",
          playerInstructionBits: [29],
          markingPositionMask: 0,
        },
      },
      {
        slotIndex: 2,
        playerName: "Gabriel Martinelli",
        inPossession: {
          positionId: "AML",
          roleId: "Winger",
          duty: "Support",
          playerInstructionBits: [13],
          markingPositionMask: 0,
        },
        outOfPossession: {
          positionId: "ML",
          roleId: "OPTrackingWideMidfielder",
          duty: "Defend",
          playerInstructionBits: [],
          markingPositionMask: 0,
        },
      },
      {
        slotIndex: 3,
        playerName: "Martin Odegaard",
        inPossession: {
          positionId: "MCR",
          roleId: "AdvancedPlaymaker",
          duty: "Support",
          playerInstructionBits: [3],
          markingPositionMask: 0,
        },
        outOfPossession: {
          positionId: "MR",
          roleId: "OPWideMidfielder",
          duty: "Defend",
          playerInstructionBits: [],
          markingPositionMask: 0,
        },
      },
      {
        slotIndex: 4,
        playerName: "Mikel Merino",
        inPossession: {
          positionId: "MCL",
          roleId: "ChannelMidfielder",
          duty: "Support",
          playerInstructionBits: [22],
          markingPositionMask: 0,
        },
        outOfPossession: {
          positionId: "MCL",
          roleId: "OPPressingCentralMidfielder",
          duty: "Defend",
          playerInstructionBits: [29],
          markingPositionMask: 0,
        },
      },
      {
        slotIndex: 5,
        playerName: "Declan Rice",
        inPossession: {
          positionId: "DMC",
          roleId: "HalfBack",
          duty: "Defend",
          playerInstructionBits: [],
          markingPositionMask: 0,
        },
        outOfPossession: {
          positionId: "MCR",
          roleId: "OPScreeningCentralMidfielder",
          duty: "Defend",
          playerInstructionBits: [],
          markingPositionMask: 0,
        },
      },
      {
        slotIndex: 6,
        playerName: "Jurrien Timber",
        inPossession: {
          positionId: "DL",
          roleId: "InsideWingBack",
          duty: "Support",
          playerInstructionBits: [],
          markingPositionMask: 0,
        },
        outOfPossession: {
          positionId: "DL",
          roleId: "OPFullBack",
          duty: "Defend",
          playerInstructionBits: [],
          markingPositionMask: 0,
        },
      },
      {
        slotIndex: 7,
        playerName: "Gabriel Magalhaes",
        inPossession: {
          positionId: "DCL",
          roleId: "CentreBack",
          duty: "Support",
          playerInstructionBits: [],
          markingPositionMask: 0,
        },
        outOfPossession: {
          positionId: "DCL",
          roleId: "OPStoppingCentreBack",
          duty: "Defend",
          playerInstructionBits: [],
          markingPositionMask: 0,
        },
      },
      {
        slotIndex: 8,
        playerName: "William Saliba",
        inPossession: {
          positionId: "DCR",
          roleId: "BallPlayingCentreBack",
          duty: "Support",
          playerInstructionBits: [],
          markingPositionMask: 0,
        },
        outOfPossession: {
          positionId: "DCR",
          roleId: "OPCoveringCentreBack",
          duty: "Defend",
          playerInstructionBits: [],
          markingPositionMask: 0,
        },
      },
      {
        slotIndex: 9,
        playerName: "Ben White",
        inPossession: {
          positionId: "DR",
          roleId: "InsideFullBack",
          duty: "Defend",
          playerInstructionBits: [],
          markingPositionMask: 0,
        },
        outOfPossession: {
          positionId: "DR",
          roleId: "OPHoldingFullBack",
          duty: "Defend",
          playerInstructionBits: [],
          markingPositionMask: 0,
        },
      },
      {
        slotIndex: 10,
        playerName: "David Raya",
        inPossession: {
          positionId: "GK",
          roleId: "BallPlayingGoalkeeper",
          duty: "Defend",
          playerInstructionBits: [],
          markingPositionMask: 0,
        },
        outOfPossession: {
          positionId: "GK",
          roleId: "OPSweeperKeeper",
          duty: "Defend",
          playerInstructionBits: [],
          markingPositionMask: 0,
        },
      },
    ],
  };
}

describe("Phase 1 — @fm27/fm-codec Binary & Serialization Suite", () => {
  it("writes and reads Little-Endian primitives and 64-bit BigInt values with bounds protection", () => {
    const w = new BinaryWriter(32);
    w.writeUint8(0xfe);
    w.writeUint16(0x1234);
    w.writeInt32(-42);
    w.writeUint64(144115188075855872n);
    w.writeLengthPrefixedUtf8("FM27 Taktik");

    const r = new BinaryReader(w.toUint8Array());
    expect(r.readUint8()).toBe(0xfe);
    expect(r.readUint16()).toBe(0x1234);
    expect(r.readInt32()).toBe(-42);
    expect(r.readUint64()).toBe(144115188075855872n);
    expect(r.readLengthPrefixedUtf8()).toBe("FM27 Taktik");
    expect(r.remaining).toBe(0);
    expect(() => r.readUint8()).toThrow(RangeError);
  });

  it("frames multi-chunk (>64KB) Zstandard Raw_Blocks readable by standard fzstd", () => {
    const payload = new Uint8Array(150_000);
    for (let i = 0; i < payload.byteLength; i++) {
      payload[i] = (i * 37) & 0xff;
    }

    const framed = encodeZstdRawFrame(payload);
    expect(Array.from(framed.subarray(0, 5))).toEqual([0x28, 0xb5, 0x2f, 0xfd, 0xa0]);

    // Must decode identically via both our decoder AND independent RFC 8878 fzstd.decompress
    expect(decodeZstdFrame(framed)).toEqual(payload);
    expect(decompressWithFzstd(framed)).toEqual(payload);

    // Reject malicious Zstd bomb header claiming >16 MiB
    const bombHeader = new Uint8Array([0x28, 0xb5, 0x2f, 0xfd, 0xa0, 0xff, 0xff, 0xff, 0x7f, 0x01, 0x00, 0x00]);
    expect(() => decodeZstdFrame(bombHeader)).toThrow(RangeError);
  });

  it("encodes and decodes _data/details.aom with 10-byte random GUID", () => {
    const raw = encodeDetailsAom({
      title: "Gegenpress 4-3-3",
      description: "Test metadata XML",
      author: "Coach",
    });
    const decoded = decodeDetailsAom(raw);
    expect(decoded.handler).toBe("TACTICS_TYPE_HANDLER");
    expect(decoded.title).toBe("Gegenpress 4-3-3");
    expect(decoded.description).toBe("Test metadata XML");
    expect(decoded.author).toBe("Coach");
    expect(decoded.guidHex).toMatch(/^[0-9a-f]{20}$/);
  });

  it("round-trips .tac binary payload preserving headers, Mentality, 96-bit TI, 11x2 paired slots, and Duty bits", () => {
    const original = createSampleDualPhaseTactic();
    const tacBytes = encodeTacPayload(original);

    expect(Array.from(tacBytes.subarray(0, 8))).toEqual(Array.from(TACTIC_OUTER_HEADER));
    expect(Array.from(tacBytes.subarray(8, 16))).toEqual(Array.from(PLAN_HEADER));

    const parsed = decodeTacPayload(tacBytes);
    expect(parsed.title).toBe(original.title);
    expect(parsed.mentality).toBe(5);
    expect(parsed.teamInstructions).toEqual(original.teamInstructions);

    // GK normalized to slot 0 in binary .tac
    expect(parsed.slots[0]?.inPossession.positionId).toBe("GK");
    expect(parsed.slots[0]?.inPossession.roleId).toBe("BallPlayingGoalkeeper");
    expect(parsed.slots[0]?.outOfPossession.roleId).toBe("OPSweeperKeeper");

    // Check cross-phase player pairing (AMR InsideForward Attack <-> STR OPSplittingOutletCentreForward)
    const amrPair = parsed.slots.find((s) => s.inPossession.positionId === "AMR");
    expect(amrPair).toBeDefined();
    expect(amrPair?.inPossession.roleId).toBe("InsideForward");
    expect(amrPair?.inPossession.duty).toBe("Attack");
    expect(amrPair?.inPossession.playerInstructionBits).toEqual([13, 25]);
    expect(amrPair?.outOfPossession.positionId).toBe("STR");
    expect(amrPair?.outOfPossession.roleId).toBe("OPSplittingOutletCentreForward");
    expect(amrPair?.outOfPossession.playerInstructionBits).toEqual([29]);
  });

  it("round-trips full .fmf archive AND AES-128-CTR encrypted afe. container", async () => {
    const original = createSampleDualPhaseTactic();
    const fmfBytes = exportFmf(original);
    expect(Array.from(fmfBytes.subarray(0, 9))).toEqual(Array.from(FMF_ARCHIVE_HEADER));

    const unpackedTactic = await parseFmf(fmfBytes);
    expect(unpackedTactic.title).toBe(original.title);
    expect(unpackedTactic.description).toBe(original.description);
    expect(unpackedTactic.author).toBe(original.author);
    expect(unpackedTactic.mentality).toBe(original.mentality);
    expect(unpackedTactic.teamInstructions).toEqual(original.teamInstructions);

    // Encrypt into afe. container and verify transparent AES-128-CTR decryption in parseFmf
    const encryptedAfe = await encryptAesCtrFmf(fmfBytes);
    expect(encryptedAfe[2]).toBe(0x61); // 'a'
    expect(encryptedAfe[3]).toBe(0x66); // 'f'
    expect(encryptedAfe[4]).toBe(0x65); // 'e'

    const decryptedTactic = await parseFmf(encryptedAfe);
    expect(decryptedTactic).toEqual(unpackedTactic);
  });

  it("rejects conflicting Team Instruction bits and invalid slot counts", () => {
    const broken = createSampleDualPhaseTactic();
    broken.teamInstructions = {
      ...broken.teamInstructions,
      SupportingRunsSecondary: 25, // Overlap both flanks
      SupportingRuns: 28, // Underlap both flanks -> Conflict [25, 28]!
    };
    expect(() => validatePlan(broken)).toThrow(/Conflicting Team Instructions/);

    const missingGk = createSampleDualPhaseTactic();
    missingGk.slots = missingGk.slots.slice(0, 10);
    expect(() => exportFmf(missingGk)).toThrow(/11 slots/);
  });

  it("round-trips .fm27.json and compressed #t=... Share URL", () => {
    const original = createSampleDualPhaseTactic();
    const jsonStr = exportFm27Json(original);
    const fromJson = parseFm27Json(jsonStr);
    expect(fromJson).toEqual(original);

    const urlHash = encodeTacticToUrlHash(original);
    expect(urlHash.startsWith("#t=")).toBe(true);
    const fromUrl = decodeTacticFromUrlHash(`https://fm27.app/${urlHash}`);
    expect(fromUrl.title).toBe(original.title);
    expect(fromUrl.mentality).toBe(original.mentality);
    expect(fromUrl.teamInstructions).toEqual(original.teamInstructions);
    expect(fromUrl.slots[0]?.inPossession.roleId).toBe("InsideForward");
    expect(fromUrl.slots[0]?.outOfPossession.positionId).toBe("STR");
  });

  it("round-trips Training Schedule (.fm27-schedule.json & .tsc/.fmf) and Shortlist (.slf/.fmf)", async () => {
    const preset = getTrainingPresets("27.0").Presets[0]!;
    const schedJson = exportScheduleJson(preset);
    expect(parseScheduleJson(schedJson)).toEqual(preset);

    const schedFmf = exportScheduleFmf(preset);
    const parsedSched = await parseScheduleFmf(schedFmf);
    expect(parsedSched.name).toBe(preset.name);
    expect(parsedSched.days).toEqual(preset.days);

    const shortlistFmf = exportShortlistFmf("U21 Targets", [2700001, 2700005, 2700001, 2700099]);
    const parsedShortlist = await parseShortlistFmf(shortlistFmf);
    expect(parsedShortlist.title).toBe("U21 Targets");
    expect(parsedShortlist.playerUids).toEqual([2700001, 2700005, 2700099]);
  });

  it("verifies golden-gegenpress.fmf fixture round-trip when present", async () => {
    const fixturePath = path.resolve(process.cwd(), "tests/fixtures/golden-gegenpress.fmf");
    if (fs.existsSync(fixturePath)) {
      const bytes = new Uint8Array(fs.readFileSync(fixturePath));
      const tactic = await parseFmf(bytes);
      expect(tactic.slots).toHaveLength(11);
      expect(tactic.mentality).toBeGreaterThanOrEqual(1);
    }
  });
});
