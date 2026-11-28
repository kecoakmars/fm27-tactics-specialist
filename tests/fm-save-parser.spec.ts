import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { parseFmSave, scaleFmRawAttribute } from "@fm27/fm-codec";
import { analyzeUnified, computeTacticalMetrics } from "@fm27/fm-engine";
import { ALL_49_ATTRIBUTES } from "@fm27/shared-types";

const SAMPLE_SAVE_PATH = path.resolve(__dirname, "fixtures/sample-real.fm");
const STANDALONE_WORKER_PATH = path.resolve(
  __dirname,
  "../apps/web/public/workers/fm-save-worker.js",
);

describe("FM26/FM27 Client-Side .fm Save Parser & Live World Pool", () => {
  it("normalizes raw 0-125 internal FM attributes deterministically to 1-20 scale", () => {
    expect(scaleFmRawAttribute(0)).toBe(1);
    expect(scaleFmRawAttribute(1)).toBe(1);
    expect(scaleFmRawAttribute(5)).toBe(1);
    expect(scaleFmRawAttribute(8)).toBe(2);
    expect(scaleFmRawAttribute(10)).toBe(2);
    expect(scaleFmRawAttribute(50)).toBe(10);
    expect(scaleFmRawAttribute(75)).toBe(15);
    expect(scaleFmRawAttribute(98)).toBe(20);
    expect(scaleFmRawAttribute(100)).toBe(20);
    expect(scaleFmRawAttribute(125)).toBe(20);
  });

  it("throws clear Indonesian error messages on empty, non-FM, encrypted tactic, or truncated buffers", () => {
    expect(() => parseFmSave(new Uint8Array(0))).toThrow(/tidak valid atau kosong/i);

    const nonFm = new TextEncoder().encode("NOT_AN_FM_SAVE_FILE_0123456789ABCDEF");
    expect(() => parseFmSave(nonFm)).toThrow(/header biner Football Manager/i);

    const encryptedAfe = new Uint8Array(32);
    encryptedAfe.set([0x02, 0x01, 0x61, 0x66, 0x65, 0x2e], 0);
    expect(() => parseFmSave(encryptedAfe)).toThrow(/afe\./i);

    const truncatedFmf = new Uint8Array(40);
    truncatedFmf.set([0x02, 0x01, 0x66, 0x6d, 0x66, 0x2e], 0);
    new DataView(truncatedFmf.buffer).setUint32(9, 999_999, true);
    expect(() => parseFmSave(truncatedFmf)).toThrow(/rusak atau terpotong/i);
  });

  it("boots standalone /workers/fm-save-worker.js IIFE bundle, replies PONG immediately, and handles PARSE_FM_SAVE", () => {
    expect(fs.existsSync(STANDALONE_WORKER_PATH)).toBe(true);
    const workerCode = fs.readFileSync(STANDALONE_WORKER_PATH, "utf8");
    const outbox: Array<Record<string, unknown>> = [];
    const mockSelf: {
      onmessage: ((ev: { data: unknown }) => void) | null;
      postMessage: (msg: Record<string, unknown>) => void;
      TextDecoder: typeof TextDecoder;
      TextEncoder: typeof TextEncoder;
      Uint8Array: typeof Uint8Array;
      Uint32Array: typeof Uint32Array;
      Int32Array: typeof Int32Array;
      DataView: typeof DataView;
      ArrayBuffer: typeof ArrayBuffer;
      Date: typeof Date;
      Math: typeof Math;
      Number: typeof Number;
      String: typeof String;
      Map: typeof Map;
      Set: typeof Set;
      Error: typeof Error;
    } = {
      onmessage: null,
      postMessage: (msg) => outbox.push(msg),
      TextDecoder,
      TextEncoder,
      Uint8Array,
      Uint32Array,
      Int32Array,
      DataView,
      ArrayBuffer,
      Date,
      Math,
      Number,
      String,
      Map,
      Set,
      Error,
    };

    const ctx = vm.createContext(Object.assign(mockSelf, { self: mockSelf }));
    vm.runInContext(workerCode, ctx);

    // Immediate PONG emitted on script boot
    expect(outbox[0]).toEqual({ type: "PONG" });
    expect(typeof mockSelf.onmessage).toBe("function");

    // Explicit PING -> PONG handshake
    mockSelf.onmessage!({ data: { type: "PING" } });
    expect(outbox[1]).toEqual({ type: "PONG" });

    // PARSE_FM_SAVE forwards initial progress (>=5%) then structured error on invalid buffer without hanging
    const invalidBuf = new Uint8Array(16).buffer;
    mockSelf.onmessage!({
      data: { id: "req-1", type: "PARSE_FM_SAVE", buffer: invalidBuf },
    });
    expect(
      outbox.some(
        (m) =>
          m.id === "req-1" &&
          m.kind === "progress" &&
          typeof m.pct === "number" &&
          m.pct >= 5 &&
          m.pct <= 15,
      ),
    ).toBe(true);
    const doneMsg = outbox.find((m) => m.id === "req-1" && m.kind === "done");
    expect(doneMsg?.ok).toBe(false);
    expect(String(doneMsg?.error)).toMatch(/tidak valid atau kosong/i);
  });

  it.skipIf(!fs.existsSync(SAMPLE_SAVE_PATH))(
    "parses sample-real.fm, extracts clubs/players/staff/wonderkids, and runs deterministic 5-tab analyzeUnified",
    () => {
      const rawBuf = fs.readFileSync(SAMPLE_SAVE_PATH);
      const stages: string[] = [];
      const parsed = parseFmSave(
        new Uint8Array(rawBuf.buffer, rawBuf.byteOffset, rawBuf.byteLength),
        (stage) => stages.push(stage),
      );

      expect(stages.length).toBeGreaterThanOrEqual(4);
      expect(parsed.clubs.length).toBeGreaterThan(0);
      expect(parsed.humanClubUid).not.toBeNull();
      expect(parsed.worldWonderkids.length).toBeGreaterThan(0);
      expect(parsed.worldWonderkids.length).toBeLessThanOrEqual(500);
      expect(parsed.worldStaffPool.length).toBeGreaterThan(0);
      expect(parsed.worldStaffPool.length).toBeLessThanOrEqual(200);
      expect(parsed.worldStaffPool.some((s) => s.isFreeAgent)).toBe(true);

      const targetClub =
        parsed.clubs.find(
          (c) => c.uid === parsed.humanClubUid && c.playerCount >= 11,
        ) ?? parsed.clubs.find((c) => c.playerCount >= 11)!;
      expect(targetClub).toBeDefined();

      const roster = parsed.playersByClub[targetClub.uid] ?? [];
      expect(roster.length).toBeGreaterThanOrEqual(11);
      expect(roster.filter((p) => p.teamSlot === "First Team").length).toBeGreaterThanOrEqual(11);

      for (const player of roster) {
        for (const attr of ALL_49_ATTRIBUTES) {
          const val = player.attributes[attr];
          expect(val).toBeGreaterThanOrEqual(1);
          expect(val).toBeLessThanOrEqual(20);
        }
      }
      expect(roster.some((p) => Array.isArray(p.tacticalFamiliarity) && p.tacticalFamiliarity.length === 9)).toBe(true);
      expect(roster.some((p) => typeof p.condition === "number" && p.condition >= 1 && p.condition <= 100)).toBe(true);

      for (const wk of parsed.worldWonderkids.slice(0, 25)) {
        expect(wk.age).toBeLessThanOrEqual(21);
        expect(wk.attributes.passing).toBeGreaterThanOrEqual(1);
        expect(wk.attributes.passing).toBeLessThanOrEqual(20);
      }

      const clubStaff = parsed.staffByClub[targetClub.uid] ?? [];
      expect(clubStaff.length).toBeGreaterThan(0);

      const reportA = analyzeUnified({
        squad: roster,
        clubStaff,
        worldWonderkids: parsed.worldWonderkids,
        worldStaffPool: parsed.worldStaffPool,
      });
      const reportB = analyzeUnified({
        squad: roster,
        clubStaff,
        worldWonderkids: parsed.worldWonderkids,
        worldStaffPool: parsed.worldStaffPool,
      });

      expect(reportA).toEqual(reportB);
      expect(reportA.mode).toBe("squad-only");
      expect(reportA.deterministicBadge).toBe("100% Data Deterministik (Non-AI)");
      expect(reportA.tacticAdvice.recommendedTactic.slots).toHaveLength(11);

      // Verify calibrated FM27 indicators on real Nov Season-1 Man Utd save (~6/10 familiarity, non-100 complexity)
      const firstTeam = roster.filter((p) => p.teamSlot === "First Team");
      const liveMetrics = computeTacticalMetrics(
        reportA.tacticAdvice.recommendedTactic,
        firstTeam.length >= 11 ? firstTeam : roster,
      );
      expect(liveMetrics.effectiveness.hasFmFamiliarity).toBe(true);
      expect(liveMetrics.effectiveness.bars).toBeGreaterThanOrEqual(5);
      expect(liveMetrics.effectiveness.bars).toBeLessThanOrEqual(7);
      expect(liveMetrics.complexity.score).toBeLessThan(85);
      expect(liveMetrics.intensity.segments8).toBeGreaterThanOrEqual(1);
      expect(liveMetrics.intensity.segments8).toBeLessThanOrEqual(8);
      expect(reportA.squadBlueprintOrAudit.kind).toBe("audit");
      expect(reportA.squadBlueprintOrAudit.audit?.starterAudits).toHaveLength(11);
      expect(reportA.trainingPlan.schedule.days).toHaveLength(7);
      expect(reportA.staffPlan.dataSource).toBe("Live dari File Save .fm");
      expect(reportA.staffPlan.hasClubStaff).toBe(true);
      expect(reportA.wonderkidPlan.dataSource).toBe("Live dari File Save .fm");

      const rosterUids = new Set(roster.map((p) => p.uid));
      for (const slot of reportA.wonderkidPlan.slots) {
        for (const cand of slot.candidates) {
          expect(rosterUids.has(cand.uid)).toBe(false);
        }
      }
    },
    60_000,
  );
});
