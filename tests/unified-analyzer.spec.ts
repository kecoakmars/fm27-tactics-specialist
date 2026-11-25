import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { exportFmf, parseFmf } from "@fm27/fm-codec";
import { getPatchData } from "@fm27/fm-data";
import { analyzeUnified, parseSquadCsv } from "@fm27/fm-engine";
import type { Player } from "@fm27/shared-types";

function buildDeterministicTestSquad(): Player[] {
  const csvPath = path.resolve(process.cwd(), "tests/fixtures/sample-squad.csv");
  if (fs.existsSync(csvPath)) {
    const parsed = parseSquadCsv(fs.readFileSync(csvPath, "utf8"));
    if (parsed.length >= 11) return parsed;
  }
  const dataset = getPatchData("27.0");
  return dataset.wonderkidsSeed.Wonderkids.slice(0, 25).map((wk) => ({
    uid: wk.uid,
    name: wk.name,
    age: wk.age,
    clubName: wk.club,
    nationality: wk.nationality,
    leftFoot: wk.leftFoot,
    rightFoot: wk.rightFoot,
    currentAbility: wk.currentAbilityEstimate,
    attributes: wk.attributes,
    positions: wk.positionFamiliarity,
  }));
}

describe("Unified 5-Tab Deterministic Pipeline — analyzeUnified (0% AI)", () => {
  const dataset = getPatchData("27.0");
  const validSessionCodes = new Set(dataset.trainingSessions.Sessions.map((s) => s.code));
  const validStaffUids = new Set(dataset.staffSeed.Staff.map((s) => s.uid));
  const validWonderkidUids = new Set(dataset.wonderkidsSeed.Wonderkids.map((w) => w.uid));
  const squad = buildDeterministicTestSquad();
  const clubStaff = dataset.staffSeed.Staff.slice(0, 6);

  function assertCatalogProvenance(report: ReturnType<typeof analyzeUnified>): void {
    expect(report.deterministicBadge).toBe("100% Data Deterministik (Non-AI)");
    expect(report.trainingPlan.loadMetrics.violations).toHaveLength(0);
    expect(report.trainingPlan.schedule.days).toHaveLength(7);

    for (const day of report.trainingPlan.schedule.days) {
      expect(validSessionCodes.has(day.s1)).toBe(true);
      expect(validSessionCodes.has(day.s2)).toBe(true);
      expect(validSessionCodes.has(day.extra)).toBe(true);
    }
    for (const sess of report.trainingPlan.selectedSessions) {
      expect(validSessionCodes.has(sess.code)).toBe(true);
    }

    expect(report.staffPlan.categories).toHaveLength(10);
    for (const cat of report.staffPlan.categories) {
      expect(cat.topStaff.length).toBeGreaterThan(0);
      expect(cat.topFreeAgents.length).toBeGreaterThan(0);
      for (const st of [...cat.topStaff, ...cat.topFreeAgents]) {
        expect(validStaffUids.has(st.uid)).toBe(true);
      }
    }

    expect(report.wonderkidPlan.slots).toHaveLength(11);
    for (const slot of report.wonderkidPlan.slots) {
      expect(slot.candidates).toHaveLength(3);
      for (const wk of slot.candidates) {
        expect(validWonderkidUids.has(wk.uid)).toBe(true);
        expect(wk.keyAttributes).toHaveLength(5);
      }
    }
  }

  it("Mode A (fmf-only): produces identical deterministic output across 2 calls with valid catalog IDs and honest squad note", async () => {
    const fmfBytes = new Uint8Array(
      fs.readFileSync(path.resolve(process.cwd(), "tests/fixtures/sample-real.fmf")),
    );
    const tactic = await parseFmf(fmfBytes);

    const run1 = analyzeUnified({ tactic, dataset });
    const run2 = analyzeUnified({ tactic, dataset });

    expect(run1).toEqual(run2);
    expect(run1.mode).toBe("fmf-only");
    expect(run1.tacticAdvice.heatmap.inPossession).toHaveLength(18);
    expect(run1.tacticAdvice.alternativeShapes).toHaveLength(3);
    expect(run1.squadBlueprintOrAudit.kind).toBe("blueprint");
    expect(run1.squadBlueprintOrAudit.hasClubSquad).toBe(false);
    expect(run1.squadBlueprintOrAudit.honestNote).toBeTruthy();
    expect(run1.squadBlueprintOrAudit.blueprint).toHaveLength(11);
    for (const bp of run1.squadBlueprintOrAudit.blueprint) {
      expect(bp.inKeyAttributes).toHaveLength(5);
      expect(bp.outKeyAttributes).toHaveLength(5);
    }

    assertCatalogProvenance(run1);
  });

  it("Mode B (squad-only): solves 13 styles x 16 StyleShapes deterministically and exports valid .fmf", async () => {
    const run1 = analyzeUnified({ squad, clubStaff, dataset });
    const run2 = analyzeUnified({ squad, clubStaff, dataset });

    expect(run1).toEqual(run2);
    expect(run1.mode).toBe("squad-only");
    expect(run1.tacticAdvice.recommendedTactic.slots).toHaveLength(11);
    expect(run1.squadBlueprintOrAudit.kind).toBe("audit");
    expect(run1.squadBlueprintOrAudit.hasClubSquad).toBe(true);
    expect(run1.squadBlueprintOrAudit.audit?.starterAudits).toHaveLength(11);
    expect(run1.squadBlueprintOrAudit.audit?.weakestThreeSlotIndices).toHaveLength(3);
    expect(run1.staffPlan.hasClubStaff).toBe(true);
    expect(run1.staffPlan.weakestClubCategories).toHaveLength(3);
    expect(run1.wonderkidPlan.slots[0]?.isPriorityWeakSlot).toBe(true);

    // Recommended #1 tactic must be valid for direct .fmf export -> import
    const exportedBytes = exportFmf(run1.tacticAdvice.recommendedTactic);
    const reParsed = await parseFmf(exportedBytes);
    expect(reParsed.slots).toHaveLength(11);

    assertCatalogProvenance(run1);
  });

  it("Mode C (combined fmf + squad + staff): audits club squad & staff against imported .fmf deterministically", async () => {
    const fmfBytes = new Uint8Array(
      fs.readFileSync(path.resolve(process.cwd(), "tests/fixtures/sample-real.fmf")),
    );
    const tactic = await parseFmf(fmfBytes);

    const run1 = analyzeUnified({ tactic, squad, clubStaff, dataset });
    const run2 = analyzeUnified({ tactic, squad, clubStaff, dataset });

    expect(run1).toEqual(run2);
    expect(run1.mode).toBe("combined");
    expect(run1.tacticAdvice.gradedPlan).not.toBeNull();
    expect(run1.squadBlueprintOrAudit.kind).toBe("audit");
    expect(run1.squadBlueprintOrAudit.audit?.starterAudits).toHaveLength(11);
    expect(run1.staffPlan.hasClubStaff).toBe(true);
    expect(run1.wonderkidPlan.prioritySlotIndices).toEqual(
      run1.squadBlueprintOrAudit.audit?.weakestThreeSlotIndices,
    );

    assertCatalogProvenance(run1);
  });
});
