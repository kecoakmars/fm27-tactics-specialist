"use client";

import { useState } from "react";
import { getStaffSeed } from "@fm27/fm-data";
import type { StaffAttributes, StaffMember } from "@fm27/shared-types";
import { StaffOptimizerTable } from "../../components/staff/StaffOptimizerTable";
import { StaffStarCalculator } from "../../components/staff/StaffStarCalculator";
import { useTacticStore } from "../../stores/useTacticStore";

export default function StaffPage() {
  const patchVersion = useTacticStore((s) => s.tactic.patchVersion);
  const defaultCoach = getStaffSeed(patchVersion).Staff[0]!;

  const [coachLabel, setCoachLabel] = useState<string>(defaultCoach.name);
  const [attributes, setAttributes] = useState<StaffAttributes>({
    ...defaultCoach.attributes,
  });

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
