"use client";

import { useMemo } from "react";
import { useTacticStore } from "../../stores/useTacticStore";
import { useTrainingStore } from "../../stores/useTrainingStore";

export function TrendingStrip({ patchVersion }: { patchVersion: string }) {
  void patchVersion;
  const worldWonderkids = useTacticStore((s) => s.worldWonderkids);
  const clubPlayers = useTacticStore((s) => s.clubPlayers);
  const shortlistUids = useTrainingStore((s) => s.shortlistUids);
  const toggleShortlistUid = useTrainingStore((s) => s.toggleShortlistUid);

  const items = useMemo(() => {
    if (worldWonderkids.length === 0) return [];
    const squadUidSet = new Set(clubPlayers.map((p) => p.uid));
    return worldWonderkids
      .filter((wk) => !squadUidSet.has(wk.uid))
      .map((wk) => {
        const paWeight =
          wk.paRange === "170-200"
            ? 30
            : wk.paRange === "160-190"
              ? 22
              : wk.paRange === "150-180"
                ? 15
                : 10;
        const ageBonus = Math.max(0, (21 - wk.age) * 3.5);
        const valueScore =
          Math.round((wk.currentAbilityEstimate * 0.65 + paWeight + ageBonus) * 10) / 10;
        return { wonderkid: wk, valueScore };
      })
      .sort((a, b) => b.valueScore - a.valueScore || a.wonderkid.uid - b.wonderkid.uid)
      .slice(0, 30)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  }, [clubPlayers, worldWonderkids]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 bg-[#111827]/70 p-6 text-center text-xs text-slate-400">
        Unggah file save karier <code className="text-emerald-300">.fm</code> untuk melihat daftar
        Top Prospek U-21 asli dari dunia karier Anda.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((entry) => {
        const inShortlist = shortlistUids.includes(entry.wonderkid.uid);
        return (
          <div
            key={entry.wonderkid.uid}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#111827] p-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 font-mono text-xs font-bold text-cyan-300">
                  #{entry.rank}
                </span>
                <span className="truncate text-sm font-semibold text-slate-100">
                  {entry.wonderkid.name}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {entry.wonderkid.age}yo · {entry.wonderkid.club} ({entry.wonderkid.nationality}) ·{" "}
                <span className="font-mono text-cyan-300">
                  {entry.wonderkid.positions.join("/")}
                </span>
              </div>
              <div className="mt-1 font-mono text-[11px] text-slate-500">
                CA <strong className="text-emerald-300">{entry.wonderkid.currentAbilityEstimate}</strong> · PA{" "}
                <strong className="text-cyan-300">{entry.wonderkid.paRange}</strong> · Est. EUR{" "}
                {entry.wonderkid.estimatedPriceEurM.toFixed(1)}M
              </div>
            </div>

            <button
              type="button"
              onClick={() => toggleShortlistUid(entry.wonderkid.uid)}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                inShortlist
                  ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                  : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
              }`}
            >
              {inShortlist ? "Saved" : "+ Shortlist"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
