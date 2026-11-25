"use client";

import { useMemo } from "react";
import { getWonderkidsSeed } from "@fm27/fm-data";
import { recommendTrainingSessions } from "@fm27/fm-engine";
import { ALL_49_ATTRIBUTES, type AttributeName } from "@fm27/shared-types";
import { useSquadStore } from "../../stores/useSquadStore";
import {
  useTrainingStore,
  type TrainingUnitScope,
} from "../../stores/useTrainingStore";

interface SessionPaletteProps {
  patchVersion: string;
  activeBrushCode: string | null;
  onSelectBrush: (code: string | null) => void;
}

export function SessionPalette({
  patchVersion,
  activeBrushCode,
  onSelectBrush,
}: SessionPaletteProps) {
  const targetAttributes = useTrainingStore((s) => s.targetAttributes);
  const unitScope = useTrainingStore((s) => s.unitScope);
  const shortlistUids = useTrainingStore((s) => s.shortlistUids);
  const setTargetAttributes = useTrainingStore((s) => s.setTargetAttributes);
  const toggleTargetAttribute = useTrainingStore((s) => s.toggleTargetAttribute);
  const setUnitScope = useTrainingStore((s) => s.setUnitScope);

  const squadWeakAttrs = useSquadStore(
    (s) => s.auditResult?.weakestTeamAttributes,
  );

  const recommendations = useMemo(
    () =>
      recommendTrainingSessions(targetAttributes, {
        unit: unitScope,
        patchVersion,
      }),
    [targetAttributes, unitScope, patchVersion],
  );

  function syncFromShortlistWonderkids() {
    if (shortlistUids.length === 0) return;
    const seed = getWonderkidsSeed(patchVersion).Wonderkids;
    const picked = seed.filter((w) => shortlistUids.includes(w.uid));
    if (picked.length === 0) return;

    const avgByAttr = ALL_49_ATTRIBUTES.slice(0, 36).map((attr) => {
      const avg =
        picked.reduce((acc, w) => acc + (w.attributes[attr] ?? 10), 0) /
        picked.length;
      return { attr, avg };
    });
    avgByAttr.sort((a, b) => a.avg - b.avg);
    setTargetAttributes(avgByAttr.slice(0, 6).map((x) => x.attr));
  }

  return (
    <aside className="rounded-xl border border-slate-800 bg-[#111827] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Smart Session Recommendations
          </h3>
          <p className="text-xs text-slate-400">
            Drag a session card onto the 7x3 grid, or click to activate paint brush.
          </p>
        </div>

        <select
          value={unitScope}
          onChange={(e) => setUnitScope(e.target.value as TrainingUnitScope)}
          className="rounded-lg border border-slate-700 bg-[#0B0F19] px-2 py-1 text-xs text-slate-200"
        >
          <option value="all">All Units</option>
          <option value="attacking">Attacking Unit</option>
          <option value="midfield">Midfield Unit</option>
          <option value="defending">Defending Unit</option>
          <option value="goalkeeping">Goalkeeping Unit</option>
        </select>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {squadWeakAttrs && squadWeakAttrs.length > 0 && (
          <button
            type="button"
            onClick={() => setTargetAttributes(squadWeakAttrs)}
            className="rounded border border-rose-500/40 bg-rose-500/15 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/25"
          >
            Sync Squad Weaknesses ({squadWeakAttrs.length})
          </button>
        )}
        {shortlistUids.length > 0 && (
          <button
            type="button"
            onClick={syncFromShortlistWonderkids}
            className="rounded border border-cyan-500/40 bg-cyan-500/15 px-2 py-1 text-[11px] text-cyan-300 hover:bg-cyan-500/25"
          >
            Sync Shortlist ({shortlistUids.length})
          </button>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1">
        {(
          [
            "passing",
            "decisions",
            "anticipation",
            "off_the_ball",
            "finishing",
            "tackling",
            "positioning",
            "acceleration",
            "pace",
            "stamina",
            "composure",
            "first_touch",
          ] as AttributeName[]
        ).map((attr) => {
          const active = targetAttributes.includes(attr);
          return (
            <button
              key={attr}
              type="button"
              onClick={() => toggleTargetAttribute(attr)}
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition ${
                active
                  ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40"
                  : "bg-[#0B0F19] text-slate-400 border border-slate-800 hover:text-slate-200"
              }`}
            >
              {attr.replace(/_/g, " ")}
            </button>
          );
        })}
      </div>

      <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {recommendations.map((rec) => {
          const isBrush = activeBrushCode === rec.session.code;
          return (
            <div
              key={rec.session.code}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/x-fm27-session",
                  rec.session.code,
                );
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() =>
                onSelectBrush(isBrush ? null : rec.session.code)
              }
              className={`cursor-grab rounded-lg border p-2.5 text-xs transition ${
                isBrush
                  ? "border-emerald-400 bg-emerald-500/15"
                  : "border-slate-800 bg-[#0B0F19] hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-100">
                  {rec.session.name}
                </span>
                <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                  Score {rec.relevanceScore.toFixed(1)}
                </span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-slate-400">
                Max {rec.session.max_sessions_per_week}/wk · Fat{" "}
                {rec.session.impact.fatigue >= 0 ? "+" : ""}
                {rec.session.impact.fatigue} · Inj{" "}
                {rec.session.impact.injuries >= 0 ? "+" : ""}
                {rec.session.impact.injuries}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {rec.matchedAttributes.map((attr) => (
                  <span
                    key={attr}
                    className="rounded bg-emerald-500/10 px-1 py-0.5 font-mono text-[10px] text-emerald-300"
                  >
                    {attr.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
