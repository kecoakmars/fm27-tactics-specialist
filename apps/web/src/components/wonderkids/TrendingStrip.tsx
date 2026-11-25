"use client";

import { useEffect, useState } from "react";
import { getWonderkidsSeed } from "@fm27/fm-data";
import type { TrendingWonderkidItem } from "@fm27/shared-types";
import { useTrainingStore } from "../../stores/useTrainingStore";

function buildOfflineTrendingFallback(patchVersion: string): TrendingWonderkidItem[] {
  const seed = getWonderkidsSeed(patchVersion).Wonderkids;
  const scored = seed.map((wk, idx) => {
    const paBoost = wk.paRange === "170-200" ? 28 : wk.paRange === "160-190" ? 19 : 12;
    const bargainBoost = Math.max(0, 26 - wk.estimatedPriceEurM * 0.45);
    const shortlists7d = Math.round(14 + paBoost * 1.4 + bargainBoost * 0.8);
    const views7d = shortlists7d * 4 + ((idx * 7) % 19);
    const trendScore =
      Math.round((shortlists7d * 6 * 0.62 + views7d * 1 * 0.58) * 10) / 10;
    const rankDelta = ((wk.uid % 5) - 2);
    return {
      wonderkid: wk,
      trendScore,
      rank: 1,
      rankDelta,
      views7d,
      shortlists7d,
    };
  });

  scored.sort((a, b) => b.trendScore - a.trendScore);
  return scored.slice(0, 24).map((item, i) => ({ ...item, rank: i + 1 }));
}

export function TrendingStrip({ patchVersion }: { patchVersion: string }) {
  const [items, setItems] = useState<TrendingWonderkidItem[]>(() =>
    buildOfflineTrendingFallback(patchVersion),
  );
  const shortlistUids = useTrainingStore((s) => s.shortlistUids);
  const toggleShortlistUid = useTrainingStore((s) => s.toggleShortlistUid);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/community/trending?patch=${encodeURIComponent(patchVersion)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { wonderkids?: TrendingWonderkidItem[] };
        if (!cancelled && Array.isArray(data.wonderkids) && data.wonderkids.length > 0) {
          setItems(data.wonderkids);
        }
      } catch {
        // Offline / pre-Phase-5 fallback stays active
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patchVersion]);

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((entry) => {
        const inShortlist = shortlistUids.includes(entry.wonderkid.uid);
        return (
          <div
            key={entry.wonderkid.uid}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#111827] p-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 font-mono text-xs font-bold text-cyan-300">
                  #{entry.rank}
                </span>
                <span
                  className={`font-mono text-[11px] font-semibold ${
                    entry.rankDelta > 0
                      ? "text-emerald-400"
                      : entry.rankDelta < 0
                        ? "text-rose-400"
                        : "text-slate-500"
                  }`}
                >
                  {entry.rankDelta > 0
                    ? `+${entry.rankDelta}`
                    : entry.rankDelta < 0
                      ? `${entry.rankDelta}`
                      : "="}
                </span>
                <span className="text-sm font-semibold text-slate-100">
                  {entry.wonderkid.name}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {entry.wonderkid.age}yo · {entry.wonderkid.club} ·{" "}
                <span className="font-mono text-cyan-300">
                  {entry.wonderkid.positions.join("/")}
                </span>{" "}
                · PA {entry.wonderkid.paRange}
              </div>
              <div className="mt-1 font-mono text-[11px] text-slate-500">
                7d Trend{" "}
                <strong className="text-emerald-300">
                  {entry.trendScore.toFixed(1)}
                </strong>{" "}
                · {entry.shortlists7d} shortlists · {entry.views7d} views
              </div>
            </div>

            <button
              type="button"
              onClick={() => toggleShortlistUid(entry.wonderkid.uid)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
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
