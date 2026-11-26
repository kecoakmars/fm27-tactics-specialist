import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getRoleProfiles, getStaffSeed, getTrainingPresets } from "@fm27/fm-data";
import {
  analyzeSquadAndGenerateTactics,
  assertSaveSnapshotUnchanged,
  attributeRatingFromRawMap,
  auditSquadAgainstTactic,
  calculateAllStaffStars,
  computeHeatmap18Zones,
  computeSlotFit,
  computeTacticalBalance,
  evaluateWeeklyScheduleLoad,
  gradeImportedTactic,
  normalizeAndValidateSquad,
  normalizePlayer,
  optimizeStaffAssignments,
  parseSquadCsv,
  parseSquadHtml,
  parseStaffHtml,
  rankWonderkidsForSlot,
  recommendTrainingSessions,
  reviewCoachingKnowledge,
  selectBestRole,
  solveHungarianMax,
  weakLink,
} from "@fm27/fm-engine";

const SAMPLE_SQUAD_CSV_PATH = path.resolve(process.cwd(), "tests/fixtures/sample-squad.csv");

describe("Phase 1 — @fm27/fm-engine Deterministic Math & Analytics Suite", () => {
  it("normalizes raw 0-125 attributes to 1-20 and enforces >=1 GK (GK>=15) + >=10 outfielders", () => {
    expect(attributeRatingFromRawMap({ raw_passing: 85 }, "passing")).toBeCloseTo(17.0, 5);
    expect(attributeRatingFromRawMap({ raw_passing: 120 }, "passing")).toBeCloseTo(20.0, 5);

    const csvText = fs.readFileSync(SAMPLE_SQUAD_CSV_PATH, "utf8");
    const players = parseSquadCsv(csvText);
    expect(players.length).toBe(18);

    const normalized = normalizeAndValidateSquad(players);
    expect(normalized.filter((p) => p.isGoalkeeper).length).toBe(2);
    expect(normalized.filter((p) => p.isUsableOutfielder).length).toBe(16);

    // Rejects squad with no eligible GK
    const outfieldOnly = players.filter((p) => (p.positions.GK ?? 0) < 15);
    expect(() => normalizeAndValidateSquad(outfieldOnly)).toThrow(/Goalkeeper/);
  });

  it("applies InsideForward inverted-foot bonus, -0.45 specialist gate, and excludes +0.20 synergy from roleQuality", () => {
    const rp = getRoleProfiles("27.0");
    const insideForward = rp.Roles.find((r) => r.Id === "InsideForward")!;
    const winger = rp.Roles.find((r) => r.Id === "Winger")!;
    const dlp = rp.Roles.find((r) => r.Id === "DeepLyingPlaymaker")!;

    const leftFootedRightWinger = normalizePlayer({
      uid: 1,
      name: "Left-Footed AMR",
      rawNumbers: {
        pos_AMR: 20,
        pos_AML: 20,
        preferred_foot_left: 20,
        preferred_foot_right: 8,
        dribbling: 16,
        off_the_ball: 16,
        acceleration: 16,
        finishing: 16,
        composure: 16,
        crossing: 16,
        pace: 16,
        agility: 16,
      },
    });

    const amrSel = selectBestRole(leftFootedRightWinger, "AMR", [insideForward, winger]);
    const amlSel = selectBestRole(leftFootedRightWinger, "AML", [insideForward, winger]);

    // At AMR: +0.12 * (20 - 8) = +1.44 -> 16 + 1.44 = 17.44 > Winger (16)
    expect(amrSel.role.Id).toBe("InsideForward");
    expect(amrSel.roleQuality).toBeCloseTo(17.44, 5);

    // At AML: -0.12 * (20 - 8) = -1.44 -> IF drops to 14.56, so Winger (16.0) wins!
    expect(amlSel.role.Id).toBe("Winger");
    expect(amlSel.roleQuality).toBeCloseTo(16.0, 5);

    // Specialist -0.45 gate + style synergy (+0.20 * overlap) excluded from pure roleQuality
    const midPlayer = normalizePlayer({
      uid: 2,
      name: "Playmaker",
      rawNumbers: {
        pos_DM: 20,
        passing: 15,
        vision: 15,
        decisions: 15,
        first_touch: 15,
        composure: 15,
      },
    });
    const styleAttrs = new Set(["passing", "vision", "decisions"]);
    const dlpSel = selectBestRole(midPlayer, "DMC", [dlp], styleAttrs);
    expect(dlpSel.roleQuality).toBeCloseTo(14.55, 5); // 15.0 - 0.45
    expect(dlpSel.selectionScore).toBeCloseTo(15.15, 5); // 14.55 + 3 * 0.20
  });

  it("computes exact dual-phase Slot Fit including OOP familiarity penalty and -1000 GK mismatch", () => {
    const player = normalizePlayer({
      uid: 3,
      name: "Winger Weak At ML",
      rawNumbers: {
        pos_AMR: 20,
        pos_MR: 10, // < 14 triggers out-of-position penalty
        ability_current: 150, // -> 15.0
        dribbling: 16,
        acceleration: 16,
      },
    });

    // posScore = 0.65 * ((20 + 10)/2) + 0.35 * 10 = 9.75 + 3.5 = 13.25
    // roleMean = (16 + 14)/2 = 15.0
    // standard raw (fullProfile=false) = 0.55*13.25 + 0.35*15.0 + 0.10*15.0 = 7.2875 + 5.25 + 1.5 = 14.0375
    // Fit = 5 * 14.0375 - 1.5 * (14 - 10) = 70.1875 - 6.0 = 64.1875
    const fit = computeSlotFit(player, "AMR", "MR", 16, 14);
    expect(fit).toBeCloseTo(64.1875, 4);

    const gkMismatchFit = computeSlotFit(player, "GK", "GK", 10, 10);
    expect(gkMismatchFit).toBeLessThan(-900);
  });

  it("proves Kuhn-Munkres Hungarian Solver beats greedy assignment on contested star player", () => {
    // Player 0 is star at both Slot 0 (95) and Slot 1 (94).
    // Player 1 is great at Slot 0 (92) but awful at Slot 1 (40).
    // Greedy on Slot 0 picks Player 0 -> total 95 + 40 = 135.
    // Hungarian picks Player 1 for Slot 0 and Player 0 for Slot 1 -> total 92 + 94 = 186!
    const scores = [
      [95, 92, 50],
      [94, 40, 50],
    ];
    const assignment = solveHungarianMax(scores);
    expect(assignment).toEqual([1, 0]);
    const total = scores[0]![assignment[0]!]! + scores[1]![assignment[1]!]!;
    expect(total).toBe(186);
  });

  it("evaluates CoachingKnowledge tanh curve and applies Gegenpress auto-adjustment (65 -> 66) when press < 12.5", () => {
    expect(weakLink([10, 20])).toBeCloseTo(0.65 * 15 + 0.35 * 10, 5); // 13.25

    const csvPlayers = parseSquadCsv(fs.readFileSync(SAMPLE_SQUAD_CSV_PATH, "utf8"));
    // Artificially lower stamina & work_rate to trigger press < 12.5
    const lowPressSquad = csvPlayers.map((p) => ({
      ...p,
      attributes: {
        ...p.attributes,
        work_rate: 9,
        stamina: 9,
        aggression: 9,
        anticipation: 10,
        acceleration: 10,
      },
    }));
    const norm = normalizeAndValidateSquad(lowPressSquad);
    const starters = norm.slice(0, 11).map((player, idx) => ({
      player,
      inSlot: idx === 0 ? "GK" : idx <= 4 ? "DC" : "MC",
      outSlot: idx === 0 ? "GK" : idx <= 4 ? "DC" : "MC",
      inRoleId: idx === 0 ? "Goalkeeper" : "CentralMidfielder",
      outRoleId: idx === 0 ? "OPGoalkeeper" : "OPCentralMidfielder",
    }));

    const review = reviewCoachingKnowledge({
      starters,
      inSlots: starters.map((s) => s.inSlot),
      outSlots: starters.map((s) => s.outSlot),
      teamInstructions: { LineOfEngagement: 61, TriggerPress: 65 },
      styleName: "Gegenpress",
      highPress: true,
      finalize: true,
    });

    expect(review.adjustedTeamInstructions.TriggerPress).toBe(66);
    expect(review.coachingAdjustment).toBeLessThan(0);
    expect(review.coachingAdjustment).toBeGreaterThan(-6);
  });

  it("runs full SquadAnalyzer (Auto + Gegenpress + Lineup Locks) and GradeImported hill-climbing", () => {
    const players = parseSquadCsv(fs.readFileSync(SAMPLE_SQUAD_CSV_PATH, "utf8"));

    const autoPlans = analyzeSquadAndGenerateTactics(players);
    expect(autoPlans).toHaveLength(8);
    expect(autoPlans[0]!.rankingFit).toBeGreaterThanOrEqual(autoPlans[1]!.rankingFit);

    // Lock backup player Ethan Nwaneri (uid 1015) into Starting XI
    const lockedPlans = analyzeSquadAndGenerateTactics(players, {
      styleId: "ControlPossession",
      lineupPreferences: [{ playerUid: 1015, mustStart: true }],
    });
    expect(lockedPlans.length).toBeGreaterThan(0);
    const topPlanUids = lockedPlans[0]!.tactic.slots.map((s) => s.playerUid);
    expect(topPlanUids).toContain(1015);

    // GradeImported + hill climbing
    const baselineGrade = gradeImportedTactic(lockedPlans[0]!.tactic, players, { improve: false });
    const improvedGrade = gradeImportedTactic(lockedPlans[0]!.tactic, players, { improve: true });
    expect(improvedGrade.rankingFit).toBeGreaterThanOrEqual(baselineGrade.rankingFit);

    // Suboptimal roles on an assigned board: Optimize Roles upgrades IP/OOP roles, preserves 11 starters & team instructions, and is idempotent
    const degradedTactic = {
      ...lockedPlans[0]!.tactic,
      slots: lockedPlans[0]!.tactic.slots.map((slot) =>
        slot.inPossession.positionId === "GK"
          ? {
              ...slot,
              inPossession: { ...slot.inPossession, roleId: "BallPlayingGoalkeeper" },
            }
          : slot.inPossession.positionId === "AMR" || slot.inPossession.positionId === "AML"
            ? {
                ...slot,
                inPossession: { ...slot.inPossession, roleId: "WideMidfielder" },
                outOfPossession: { ...slot.outOfPossession, roleId: "OPTrackingWinger" },
              }
            : slot,
      ),
    };
    const subBase = gradeImportedTactic(degradedTactic, players, {
      improve: false,
      lineupPreferences: [{ playerUid: 1015, mustStart: true }],
    });
    const subOpt = gradeImportedTactic(degradedTactic, players, {
      improve: true,
      lineupPreferences: [{ playerUid: 1015, mustStart: true }],
    });
    expect(subOpt.rankingFit).toBeGreaterThan(subBase.rankingFit);
    expect(subOpt.tactic.slots.map((s) => s.playerUid)).toEqual(
      degradedTactic.slots.map((s) => s.playerUid),
    );
    expect(subOpt.tactic.teamInstructions).toEqual(degradedTactic.teamInstructions);
    const subOptSecondPass = gradeImportedTactic(subOpt.tactic, players, {
      improve: true,
      lineupPreferences: [{ playerUid: 1015, mustStart: true }],
    });
    expect(
      subOptSecondPass.tactic.slots.map(
        (s) => `${s.playerUid}:${s.inPossession.roleId}:${s.outOfPossession.roleId}`,
      ),
    ).toEqual(
      subOpt.tactic.slots.map(
        (s) => `${s.playerUid}:${s.inPossession.roleId}:${s.outOfPossession.roleId}`,
      ),
    );
  });

  it("computes 18-Zone Heatmap, 6-Pillar Balance Score, Squad Audit, Wonderkid Ranking, Staff Optimizer, and Training Load", () => {
    const players = parseSquadCsv(fs.readFileSync(SAMPLE_SQUAD_CSV_PATH, "utf8"));
    const topTactic = analyzeSquadAndGenerateTactics(players, { styleId: "Gegenpress" })[0]!.tactic;

    const heatmap = computeHeatmap18Zones(topTactic);
    expect(heatmap.inPossession).toHaveLength(18);
    expect(heatmap.outOfPossession).toHaveLength(18);
    expect(heatmap.transition).toHaveLength(18);
    expect(heatmap.inPossession.filter((z) => z.isZone14)).toHaveLength(1);

    const balance = computeTacticalBalance(topTactic, players);
    expect(balance.overallScore).toBeGreaterThan(0);
    expect(balance.overallScore).toBeLessThanOrEqual(100);

    const audit = auditSquadAgainstTactic(topTactic, players);
    expect(audit.starterAudits).toHaveLength(11);
    expect(audit.weakestThreeSlotIndices).toHaveLength(3);

    const weakestSlotIdx = audit.weakestThreeSlotIndices[0]!;
    const wkRankings = rankWonderkidsForSlot(topTactic.slots[weakestSlotIdx]!, {
      maxAge: 20,
      maxBudgetEurM: 50,
      limit: 5,
    });
    expect(wkRankings.length).toBeGreaterThan(0);
    expect(wkRankings[0]!.valueRatio).toBeGreaterThanOrEqual(wkRankings[wkRankings.length - 1]!.valueRatio);

    // Staff Star Calculator & Optimizer (real FM27 v27.0 seed data)
    const staffList = getStaffSeed("27.0").Staff;
    const fitnessCoach = staffList.find((s) => s.name === "Mário Monteiro")!;
    const fitnessCoachStars = calculateAllStaffStars(fitnessCoach.attributes);
    expect(fitnessCoachStars).toHaveLength(10);
    const fitnessRating = fitnessCoachStars.find((r) => r.categoryId === "fitness_strength")!;
    expect(fitnessRating.stars).toBeGreaterThanOrEqual(4.5);

    const plan = optimizeStaffAssignments(staffList.slice(0, 30));
    expect(plan.assignments).toHaveLength(10);
    expect(plan.averageStars).toBeGreaterThanOrEqual(4.0);
    expect(plan.assignments.every((a) => a.workload === "Light" || a.workload === "Average")).toBe(true);

    // Training Recommender & Weekly Load
    const recs = recommendTrainingSessions(["passing", "vision", "first_touch"]);
    expect(recs.length).toBeGreaterThan(0);

    const preset = getTrainingPresets("27.0").Presets[1]!;
    const load = evaluateWeeklyScheduleLoad(preset);
    expect(load.violations).toHaveLength(0);
  });

  it("parses FM-View-Exporter (F9) HTML squad & staff tables and guards save snapshots", () => {
    const f9SquadHtml = `
      <table>
        <tr><th>Name</th><th>Position</th><th>Age</th><th>Acc</th><th>Pac</th><th>Pas</th><th>Vis</th><th>Dec</th><th>Fir</th><th>Cmp</th><th>Ref</th><th>Han</th></tr>
        <tr><td>Jan Oblak</td><td>GK</td><td>31</td><td>12</td><td>12</td><td>13</td><td>13</td><td>16</td><td>13</td><td>17</td><td>19</td><td>19</td></tr>
        <tr><td>Pedri</td><td>M/AM (C), AM (L)</td><td>22</td><td>15</td><td>14</td><td>18</td><td>19</td><td>17</td><td>19</td><td>18</td><td>2</td><td>2</td></tr>
      </table>
    `;
    const parsedSquad = parseSquadHtml(f9SquadHtml);
    expect(parsedSquad).toHaveLength(2);
    expect(parsedSquad[0]?.positions.GK).toBe(20);
    expect(parsedSquad[1]?.positions.MC).toBe(20);
    expect(parsedSquad[1]?.positions.AML).toBe(17);
    expect(parsedSquad[1]?.attributes.vision).toBe(19);

    const f9StaffHtml = `
      <table>
        <tr><th>Name</th><th>Club</th><th>Role</th><th>Age</th><th>Nat</th><th>Att</th><th>Def</th><th>Tac</th><th>Tec</th><th>Men</th><th>Fit</th><th>Det</th><th>LoD</th><th>Mot</th></tr>
        <tr><td>Xabi Mentor</td><td>Free Agent</td><td>Coach</td><td>44</td><td>Spain</td><td>17</td><td>16</td><td>19</td><td>19</td><td>18</td><td>12</td><td>18</td><td>17</td><td>18</td></tr>
      </table>
    `;
    const parsedStaff = parseStaffHtml(f9StaffHtml);
    expect(parsedStaff).toHaveLength(1);
    expect(parsedStaff[0]?.isFreeAgent).toBe(true);
    expect(parsedStaff[0]?.attributes.tactical).toBe(19);

    expect(() =>
      assertSaveSnapshotUnchanged(
        { name: "career.fm", byteLength: 1000, lastModifiedMs: 100 },
        { name: "career.fm", byteLength: 1004, lastModifiedMs: 100 },
      ),
    ).toThrow(/modified/);
  });
});
