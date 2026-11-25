import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PATCH_VERSION,
  getCoachingKnowledge,
  getManifest,
  getPatchData,
  getPitchCatalog,
  getRoleProfiles,
  getStaffFormulas,
  getStaffSeed,
  getTacticalStyles,
  getTrainingPresets,
  getTrainingSessions,
  getWonderkidsSeed,
  listPatchVersions,
  migrateTacticToPatch,
} from "@fm27/fm-data";
import type { DualPhaseTactic } from "@fm27/shared-types";
import { validateVersionFolder } from "../scripts/validate-data.mjs";

describe("Phase 0 — @fm27/fm-data & v27.0 Registry Integrity", () => {
  it("loads and validates the default v27.0 patch bundle", () => {
    expect(DEFAULT_PATCH_VERSION).toBe("27.0");
    expect(listPatchVersions()).toContain("27.0");

    const manifest = getManifest();
    expect(manifest.patchVersion).toBe("27.0");
    expect(manifest.game).toBe("FM27");
    expect(manifest.sourceMode).toBe("gdrive-rea");
  });

  it("preserves exact FM27 binary pitch catalog invariants (24 positions, 79 roles, 29 TI, 17 PI)", () => {
    const catalog = getPitchCatalog("27.0");
    expect(catalog.Positions).toHaveLength(24);
    expect(catalog.Roles).toHaveLength(79);
    expect(catalog.Instructions).toHaveLength(29);
    expect(catalog.PlayerInstructions).toHaveLength(17);
    expect(catalog.Conflicts).toEqual([
      [25, 28],
      [25, 29],
      [25, 30],
      [26, 28],
      [26, 29],
      [27, 28],
      [27, 30],
    ]);

    const dcr = catalog.Positions.find((p) => p.Id === "DCR");
    expect(dcr).toEqual({ Id: "DCR", Mask: 2097168, X: 67, Y: 78 });

    const bpcb = catalog.Roles.find((r) => r.Id === "BallPlayingCentreBack");
    expect(bpcb?.Flags).toBe("16777216");
    expect(BigInt(bpcb!.Flags)).toBe(16777216n);

    const midPlaymaker = catalog.Roles.find((r) => r.Id === "MidfieldPlaymaker");
    expect(BigInt(midPlaymaker!.Flags)).toBe(144115188075855872n);
  });

  it("preserves coaching knowledge (23 sources, 10 rules, 3 auto-adjustments)", () => {
    const ck = getCoachingKnowledge("27.0");
    expect(ck.Sources).toHaveLength(23);
    expect(ck.Rules).toHaveLength(10);
    expect(ck.Adjustments).toHaveLength(3);
    expect(ck.Adjustments[0]).toMatchObject({
      Metric: "press",
      Style: "Gegenpress",
      Group: "TriggerPress",
      From: 65,
      To: 66,
      Below: 12.5,
    });
  });

  it("maps all 79 roles to 5-attribute profiles over 49 attributes", () => {
    const rp = getRoleProfiles("27.0");
    expect(rp.AllAttributes).toHaveLength(49);
    expect(rp.Goalkeeping).toHaveLength(11);
    expect(rp.LowerIsBetter).toEqual([
      "dirtiness",
      "injury_proneness",
      "eccentricity",
      "controversy",
    ]);
    expect(rp.Roles).toHaveLength(79);

    const insideForward = rp.Roles.find((r) => r.Id === "InsideForward");
    expect(insideForward?.Keys).toEqual([
      "dribbling",
      "off_the_ball",
      "acceleration",
      "finishing",
      "composure",
    ]);
  });

  it("validates 13 tactical styles, 8 default Shapes, and 16 StyleShapes", () => {
    const styles = getTacticalStyles("27.0");
    expect(styles.Mentalities).toHaveLength(7);
    expect(styles.TacticalStyles).toHaveLength(13);
    expect(styles.Shapes).toHaveLength(8);
    expect(styles.StyleShapes).toHaveLength(16);
  });

  it("validates training sessions, presets, staff formulas, and >=150 curated wonderkids", () => {
    expect(getTrainingSessions("27.0").Sessions.length).toBeGreaterThanOrEqual(24);
    expect(getTrainingPresets("27.0").Presets).toHaveLength(4);
    expect(getStaffFormulas("27.0").categories).toHaveLength(10);
    expect(getStaffSeed("27.0").Staff.length).toBeGreaterThanOrEqual(30);
    expect(getWonderkidsSeed("27.0").Wonderkids.length).toBeGreaterThanOrEqual(150);
  });

  it("passes full cross-file validator on v27.0 and safely migrates unknown roles across patches", () => {
    const v270Dir = path.resolve(process.cwd(), "packages/fm-data/versions/v27.0");
    expect(() => validateVersionFolder(v270Dir)).not.toThrow();

    const bundle = getPatchData("27.0");
    const baseShape = bundle.tacticalStyles.Shapes[0]!;
    const sampleTactic: DualPhaseTactic = {
      title: "Test Tactic",
      description: "",
      author: "Tester",
      patchVersion: "26.9",
      mentality: 4,
      inFormation: baseShape.InPossessionName,
      outFormation: baseShape.OutOfPossessionName,
      teamInstructions: { LineOfEngagement: 62 },
      slots: baseShape.InSlots.map((inPos, idx) => ({
        slotIndex: idx,
        inPossession: {
          positionId: inPos,
          roleId: idx === 10 ? "Goalkeeper" : "RemovedLegacyRole",
          duty: "Support",
          playerInstructionBits: [],
          markingPositionMask: 0,
        },
        outOfPossession: {
          positionId: baseShape.OutSlots[idx]!,
          roleId: idx === 10 ? "OPGoalkeeper" : "OPRemovedLegacyRole",
          duty: "Defend",
          playerInstructionBits: [],
          markingPositionMask: 0,
        },
      })),
    };

    const migrated = migrateTacticToPatch(sampleTactic, "27.0");
    expect(migrated.patchVersion).toBe("27.0");
    expect(migrated.slots[0]?.inPossession.roleId).toBe("CentralMidfielder");
    expect(migrated.slots[0]?.outOfPossession.roleId).toBe("OPCentralMidfielder");
    expect(migrated.slots[10]?.inPossession.roleId).toBe("Goalkeeper");
  });
});
