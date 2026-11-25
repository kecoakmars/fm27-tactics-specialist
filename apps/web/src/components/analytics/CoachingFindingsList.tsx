"use client";

import React, { useMemo } from "react";
import { getCoachingKnowledge } from "@fm27/fm-data";
import type { StructuralGapAlert } from "@fm27/fm-engine";
import { useTacticStore } from "@/stores/useTacticStore";

export interface CoachingFindingsListProps {
  alerts: readonly StructuralGapAlert[];
}

export function CoachingFindingsList({ alerts }: CoachingFindingsListProps) {
  const { tactic, setTeamInstruction } = useTacticStore();
  const ck = useMemo(
    () => getCoachingKnowledge(tactic.patchVersion),
    [tactic.patchVersion],
  );
  const sourceById = useMemo(
    () => new Map(ck.Sources.map((s) => [s.Id, s])),
    [ck.Sources],
  );

  return (
    <section
      aria-label="Structural Gap Analysis"
      className="tactical-surface rounded-xl p-3.5 flex flex-col gap-2.5"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Structural Alerts ({alerts.length})
        </span>
        <span className="text-[10px] font-mono-metric text-slate-400">UEFA / FIFA / SI</span>
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-lg p-3 bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-200">
          No critical spatial or rest-defense gaps detected across all 18 zones.
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-0.5">
          {alerts.map((alert) => {
            const isCritical = alert.severity === "critical";
            return (
              <div
                key={alert.id}
                className={`rounded-lg p-3 border flex flex-col gap-1.5 ${
                  isCritical
                    ? "bg-rose-950/25 border-rose-500/45"
                    : "bg-amber-950/20 border-amber-500/35"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`text-xs font-bold ${
                      isCritical ? "text-rose-300" : "text-amber-300"
                    }`}
                  >
                    {alert.title}
                  </span>
                  <span
                    className={`text-[10px] font-mono-metric uppercase px-1.5 py-0.5 rounded shrink-0 ${
                      isCritical
                        ? "bg-rose-500/20 text-rose-200"
                        : "bg-amber-500/20 text-amber-200"
                    }`}
                  >
                    {alert.severity}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{alert.detail}</p>

                {alert.citations.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {alert.citations.map((cid) => {
                      const src = sourceById.get(cid);
                      return (
                        <span
                          key={cid}
                          title={src ? `${src.Publisher} — ${src.Title}` : cid}
                          className="text-[10px] font-mono-metric px-1.5 py-0.5 rounded bg-[#0B0F19] text-slate-400 border border-white/8"
                        >
                          {src ? `${src.Publisher}: ${src.Coach ?? src.Date}` : cid}
                        </span>
                      );
                    })}
                  </div>
                )}

                {alert.autoFix && (
                  <div className="pt-1 flex items-center justify-between gap-2 border-t border-white/8 mt-1">
                    <span className="text-[11px] text-emerald-300 truncate">
                      Fix: {alert.autoFix.text}
                    </span>
                    <button
                      id={`apply-autofix-${alert.id}`}
                      type="button"
                      onClick={() =>
                        setTeamInstruction(
                          alert.autoFix!.group,
                          alert.autoFix!.toBit,
                          true,
                        )
                      }
                      className="px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 shrink-0 cursor-pointer"
                    >
                      Apply Auto-Fix
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
