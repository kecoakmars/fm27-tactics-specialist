import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  exportScheduleFmf,
  exportShortlistFmf,
  parseScheduleFmf,
  parseShortlistFmf,
} from "@fm27/fm-codec";
import {
  auditSquadAgainstTactic,
  calculateAllStaffStars,
  optimizeStaffAssignments,
  parseSquadCsv,
  parseStaffCsv,
  parseStaffHtml,
} from "@fm27/fm-engine";
import { useSquadStore } from "../apps/web/src/stores/useSquadStore.js";
import { useTacticStore } from "../apps/web/src/stores/useTacticStore.js";
import { useTrainingStore } from "../apps/web/src/stores/useTrainingStore.js";

describe("Phase 4 — F9 Parsers, Squad Store, Staff Optimizer & Training Store", () => {
  it("parses FM-View-Exporter (F9) German semicolon CSV with multi-word headers, decimal commas, and scouted ranges", () => {
    const f9Csv = [
      "Unique ID;Player;Position;Age;Nation;Nation;Preferred Foot;First Touch;Off The Ball;Rushing Out (Tendency);Passing;Ability;Potential",
      '8718372;"Manuel Neuer";GK;39;GER;Germany;Right;15;8;18;16;4,5;4,5',
      '9100221;"Jamal Musiala";"M/AM (RLC)";22;GER;Germany;Right;18-20;17;3;16;4,5;5,0',
    ].join("\n");

    const players = parseSquadCsv(f9Csv);
    expect(players).toHaveLength(2);
    expect(players[0]!.uid).toBe(8718372);
    expect(players[0]!.nationality).toBe("GER");
    expect(players[0]!.attributes.rushing_out).toBe(18);
    expect(players[0]!.currentAbility).toBe(162);

    expect(players[1]!.name).toBe("Jamal Musiala");
    expect(players[1]!.attributes.first_touch).toBe(19);
    expect(players[1]!.attributes.off_the_ball).toBe(17);
    expect(players[1]!.positions.AMC).toBeGreaterThanOrEqual(17);
  });

  it("parses FM_Staff_Scores and F9 staff CSV/HTML with TCo, Youth, Mgm, Judge A/P, and formatted wages", () => {
    const staffCsv = [
      "Unique ID,Name,Age,Nation,Club,Job,Wage,Att,Def,Fit,Men,TCo,Tec,Youth,Det,Mgm,Mot,Judge A,Judge P,Tac Knw,GkS,GkH,GkD",
      "901101,Xabi Alonso,44,ESP,Free Agent,Manager,€0 p/w,17,15,12,18,19,18,15,18,17,18,17,17,19,2,2,2",
      "901102,Inaki Cana,50,ESP,Arsenal,Goalkeeping Coach,€14.5K p/w,6,7,10,13,12,10,12,17,16,17,14,14,13,19,18,18",
    ].join("\n");

    const parsed = parseStaffCsv(staffCsv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]!.isFreeAgent).toBe(true);
    expect(parsed[0]!.attributes.tactical).toBe(19);
    expect(parsed[0]!.attributes.working_with_youngsters).toBe(15);
    expect(parsed[0]!.attributes.level_of_discipline).toBe(17);
    expect(parsed[1]!.wageEstimateEurWeekly).toBe(14500);

    const starsGk = calculateAllStaffStars(parsed[1]!.attributes);
    const shotStop = starsGk.find((s) => s.categoryId === "gk_shot_stopping")!;
    expect(shotStop.stars).toBeGreaterThanOrEqual(4.5);

    const plan = optimizeStaffAssignments(parsed);
    expect(plan.assignments).toHaveLength(10);

    const htmlStaff = parseStaffHtml(
      "<table><tr><th>Name</th><th>Club</th><th>Role</th><th>Att</th><th>TCo</th><th>Det</th><th>Mgm</th><th>Mot</th></tr><tr><td>Pep Lijnders</td><td>Free Agent</td><td>Assistant Manager</td><td>18</td><td>18</td><td>17</td><td>16</td><td>18</td></tr></table>",
    );
    expect(htmlStaff[0]!.preferredRole).toBe("Assistant Manager");
    expect(htmlStaff[0]!.attributes.tactical).toBe(18);
  });

  it("wires useSquadStore CSV import -> Squad Audit -> useTrainingStore schedule & shortlist .fmf round-trip", async () => {
    const csvPath = path.resolve(process.cwd(), "tests/fixtures/sample-squad.csv");
    const count = useSquadStore
      .getState()
      .importFromText(fs.readFileSync(csvPath, "utf8"), "sample-squad.csv");
    expect(count).toBe(18);
    const squadPlayers = useSquadStore.getState().players;
    expect(squadPlayers).toHaveLength(18);

    // Enforce <= 11 starter locks
    for (let i = 0; i < 12; i++) {
      useSquadStore.getState().toggleMustStart(squadPlayers[i]!.uid);
    }
    expect(
      useSquadStore.getState().lineupPreferences.filter((l) => l.mustStart),
    ).toHaveLength(11);
    expect(useSquadStore.getState().errorMessage).toMatch(/Maksimal 11|Maximum 11/i);

    const activeTactic = useTacticStore.getState().tactic;
    const audit = auditSquadAgainstTactic(activeTactic, squadPlayers);
    expect(audit.starterAudits).toHaveLength(11);
    expect(audit.weakestThreeSlotIndices).toHaveLength(3);

    // Swap slots and verify max_sessions_per_week violation detection in useTrainingStore
    useTrainingStore.getState().applyPreset("normal-1-match-week", "27.0");
    useTrainingStore.getState().swapSlots(0, "s1", 1, "s1");
    expect(useTrainingStore.getState().schedule.days[0]!.s1).toBe("ATT_MOVEMENT");

    for (let d = 0; d < 5; d++) {
      useTrainingStore.getState().setSlotSession(d, "s1", "ENDURANCE");
    }
    expect(
      useTrainingStore
        .getState()
        .loadMetrics.violations.some((v) => v.code === "ENDURANCE"),
    ).toBe(true);

    // Reset valid preset & verify binary .tsc / .slf round-trip
    useTrainingStore.getState().applyPreset("wonderkid-accelerated-growth", "27.0");
    const schedBytes = exportScheduleFmf(useTrainingStore.getState().schedule);
    const decodedSched = await parseScheduleFmf(schedBytes);
    expect(decodedSched.days[0]!.s1).toBe("QUICKNESS");

    useTrainingStore.getState().setShortlist("Phase4 Targets", [squadPlayers[0]!.uid, squadPlayers[2]!.uid]);
    const slfBytes = exportShortlistFmf(
      useTrainingStore.getState().shortlistTitle,
      useTrainingStore.getState().shortlistUids,
    );
    const decodedSlf = await parseShortlistFmf(slfBytes);
    expect(decodedSlf.title).toBe("Phase4 Targets");
    expect(decodedSlf.playerUids).toEqual([squadPlayers[0]!.uid, squadPlayers[2]!.uid]);
  });
});
