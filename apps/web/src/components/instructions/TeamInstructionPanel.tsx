"use client";

import React, { useMemo, useState } from "react";
import { getPitchCatalog } from "@fm27/fm-data";
import { useTacticStore } from "@/stores/useTacticStore";

export function TeamInstructionPanel() {
  const { tactic, setTeamInstruction, resolveAllConflicts } = useTacticStore();
  const [phaseTab, setPhaseTab] = useState<"ip" | "oop">("ip");

  const catalog = useMemo(() => getPitchCatalog(tactic.patchVersion), [tactic.patchVersion]);

  const groupsForTab = useMemo(
    () =>
      catalog.Instructions.filter((g) => (phaseTab === "oop" ? g.Out : !g.Out)),
    [catalog.Instructions, phaseTab],
  );

  const activeBitsSet = useMemo(
    () => new Set(Object.values(tactic.teamInstructions).filter((b) => b > 0)),
    [tactic.teamInstructions],
  );

  // Detect any active conflicts or candidate bit conflicts from PitchCatalog.Conflicts
  const conflictingActiveBits = useMemo(() => {
    const bad = new Set<number>();
    for (const [a, b] of catalog.Conflicts) {
      if (activeBitsSet.has(a) && activeBitsSet.has(b)) {
        bad.add(a);
        bad.add(b);
      }
    }
    return bad;
  }, [activeBitsSet, catalog.Conflicts]);

  const wouldConflictWithActive = (candidateBit: number, currentGroupBit: number): boolean => {
    if (candidateBit <= 0) return false;
    for (const [a, b] of catalog.Conflicts) {
      if (a === candidateBit && b !== currentGroupBit && activeBitsSet.has(b)) return true;
      if (b === candidateBit && a !== currentGroupBit && activeBitsSet.has(a)) return true;
    }
    return false;
  };

  const activeCountIp = catalog.Instructions.filter(
    (g) => !g.Out && (tactic.teamInstructions[g.Group] ?? g.Current) > 0,
  ).length;
  const activeCountOop = catalog.Instructions.filter(
    (g) => g.Out && (tactic.teamInstructions[g.Group] ?? g.Current) > 0,
  ).length;

  return (
    <section
      aria-label="Team Instructions"
      className="tactical-surface rounded-xl p-3.5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Team Instructions (29)
        </span>

        {conflictingActiveBits.size > 0 && (
          <button
            id="resolve-ti-conflicts-btn"
            type="button"
            onClick={resolveAllConflicts}
            className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition cursor-pointer"
          >
            Resolve Conflict
          </button>
        )}
      </div>

      {/* Phase Tabs */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[#0B0F19] border border-white/6">
        <button
          id="ti-tab-ip"
          type="button"
          onClick={() => setPhaseTab("ip")}
          className={`py-1.5 px-2.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center justify-between ${
            phaseTab === "ip"
              ? "bg-cyan-500/18 text-cyan-300 border border-cyan-500/35"
              : "text-slate-400 hover:text-slate-200 border border-transparent"
          }`}
        >
          <span>In Possession</span>
          <span className="font-mono-metric text-[11px] opacity-80">{activeCountIp}</span>
        </button>
        <button
          id="ti-tab-oop"
          type="button"
          onClick={() => setPhaseTab("oop")}
          className={`py-1.5 px-2.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center justify-between ${
            phaseTab === "oop"
              ? "bg-amber-500/18 text-amber-300 border border-amber-500/35"
              : "text-slate-400 hover:text-slate-200 border border-transparent"
          }`}
        >
          <span>Out of Possession</span>
          <span className="font-mono-metric text-[11px] opacity-80">{activeCountOop}</span>
        </button>
      </div>

      {/* Scrollable 29 Instruction Groups */}
      <div className="flex flex-col gap-2.5 max-h-[430px] overflow-y-auto pr-1">
        {groupsForTab.map((group) => {
          const currentBit = tactic.teamInstructions[group.Group] ?? group.Current;
          const hasGroupConflict = currentBit > 0 && conflictingActiveBits.has(currentBit);

          return (
            <div
              key={group.Group}
              className={`rounded-lg p-2.5 border transition ${
                hasGroupConflict
                  ? "bg-rose-950/25 border-rose-500/50"
                  : "bg-[#0B0F19]/65 border-white/6"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-200">{group.Label}</span>
                {hasGroupConflict && (
                  <span className="text-[10px] font-bold uppercase text-rose-400">
                    Overlap/Underlap Conflict
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1">
                {group.Options.map((opt) => {
                  const isSelected = currentBit === opt.Bit;
                  const causesConflict =
                    !isSelected && wouldConflictWithActive(opt.Bit, currentBit);
                  const activeStyle =
                    phaseTab === "ip"
                      ? "bg-cyan-500/20 border-cyan-400/60 text-cyan-100"
                      : "bg-amber-500/20 border-amber-400/60 text-amber-100";

                  return (
                    <button
                      key={`${group.Group}-${opt.Bit}`}
                      id={`ti-opt-${group.Group}-${opt.Bit}`}
                      type="button"
                      onClick={() => setTeamInstruction(group.Group, opt.Bit, false)}
                      title={
                        causesConflict
                          ? "Conflicts with an active Overlap/Underlap instruction"
                          : opt.Label
                      }
                      className={`px-2 py-1 rounded text-[11px] font-medium border transition cursor-pointer ${
                        isSelected
                          ? hasGroupConflict
                            ? "bg-rose-500/25 border-rose-400 text-rose-100"
                            : activeStyle
                          : causesConflict
                            ? "bg-rose-950/20 border-rose-500/30 text-rose-300/80 hover:border-rose-400"
                            : "bg-slate-900/70 border-white/8 text-slate-400 hover:text-slate-200 hover:border-white/20"
                      }`}
                    >
                      {opt.Label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
