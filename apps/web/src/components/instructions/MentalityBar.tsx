"use client";

import React, { useMemo } from "react";
import { getTacticalStyles } from "@fm27/fm-data";
import { useTacticStore } from "@/stores/useTacticStore";

export function MentalityBar() {
  const { tactic, setMentality } = useTacticStore();
  const mentalities = useMemo(
    () => getTacticalStyles(tactic.patchVersion).Mentalities,
    [tactic.patchVersion],
  );

  const activeItem =
    mentalities.find((m) => m.Value === tactic.mentality) ?? mentalities[3]!;

  return (
    <section
      aria-label="Team Mentality"
      className="tactical-surface rounded-xl p-3.5 flex flex-col gap-2.5"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Mentality
        </span>
        <span className="text-xs font-bold text-cyan-400 font-mono-metric">
          {tactic.mentality}/7 · {activeItem.Label}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1" role="radiogroup" aria-label="Mentality Level">
        {mentalities.map((m) => {
          const isSelected = m.Value === tactic.mentality;
          const isReached = m.Value <= tactic.mentality;
          return (
            <button
              key={m.Value}
              id={`mentality-btn-${m.Value}`}
              type="button"
              role="radio"
              aria-checked={isSelected}
              title={m.Label}
              onClick={() => setMentality(m.Value)}
              className={`h-8 rounded-md text-[11px] font-bold transition-all cursor-pointer border ${
                isSelected
                  ? "bg-cyan-500/20 border-cyan-400 text-slate-50"
                  : isReached
                    ? "bg-cyan-950/55 border-white/10 text-cyan-200 hover:border-white/25"
                    : "bg-[#0B0F19] border-white/6 text-slate-500 hover:text-slate-300 hover:border-white/15"
              }`}
            >
              {m.Value}
            </button>
          );
        })}
      </div>
    </section>
  );
}
