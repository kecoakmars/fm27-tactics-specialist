"use client";

import { useEffect, useState } from "react";
import type { StaffAttributes, StaffMember } from "@fm27/shared-types";
import { StaffOptimizerTable } from "../../components/staff/StaffOptimizerTable";
import { StaffStarCalculator } from "../../components/staff/StaffStarCalculator";
import { useTacticStore } from "../../stores/useTacticStore";

const NEUTRAL_CALCULATOR_ATTRIBUTES: StaffAttributes = {
  attacking: 10,
  defending: 10,
  fitness: 10,
  mental: 10,
  tactical: 10,
  technical: 10,
  working_with_youngsters: 10,
  gk_distribution: 10,
  gk_handling: 10,
  gk_shot_stopping: 10,
  determination: 10,
  level_of_discipline: 10,
  motivating: 10,
  tactical_knowledge: 10,
  judging_player_ability: 10,
  judging_player_potential: 10,
};

export default function StaffPage() {
  const patchVersion = useTacticStore((s) => s.tactic.patchVersion);
  const clubStaff = useTacticStore((s) => s.clubStaff);

  const [coachLabel, setCoachLabel] = useState<string>(
    "Kalkulator Manual (Belum Ada Pelatih Dipilih)",
  );
  const [attributes, setAttributes] = useState<StaffAttributes>({
    ...NEUTRAL_CALCULATOR_ATTRIBUTES,
  });

  useEffect(() => {
    const firstClubCoach = clubStaff[0];
    if (firstClubCoach) {
      setCoachLabel(`${firstClubCoach.name} (${firstClubCoach.club})`);
      setAttributes({ ...firstClubCoach.attributes });
    }
  }, [clubStaff]);

  function handleInspectCoach(coach: StaffMember) {
    setCoachLabel(`${coach.name} (${coach.club})`);
    setAttributes({ ...coach.attributes });
  }

  return (
    <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5">
      <div>
        <h1 className="text-xl font-bold text-slate-100">
          Coaching Staff Star Calculator &amp; Workload Optimizer
        </h1>
        <p className="text-xs text-slate-400">
          10-category training star engine (0.5-5.0 step 0.5) calibrated to{" "}
          <code className="text-cyan-300">FM_Staff_Scores</code> DDM + coaching weights.
        </p>
      </div>

      <StaffStarCalculator
        attributes={attributes}
        coachLabel={coachLabel}
        patchVersion={patchVersion}
        onChangeAttribute={(key, val) => {
          setCoachLabel("Custom Edited Profile");
          setAttributes((prev) => ({ ...prev, [key]: val }));
        }}
      />

      <StaffOptimizerTable
        patchVersion={patchVersion}
        onInspectCoach={handleInspectCoach}
      />
    </main>
  );
}
