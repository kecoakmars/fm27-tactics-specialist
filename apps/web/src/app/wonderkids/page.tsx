"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { getTacticalStyles } from "@fm27/fm-data";
import { rankWonderkidsForSlot } from "@fm27/fm-engine";
import { POSITION_14_KEYS, type PositionKey14 } from "@fm27/shared-types";
import { ShortlistExporter } from "../../components/wonderkids/ShortlistExporter";
import { TrendingStrip } from "../../components/wonderkids/TrendingStrip";
import { WonderkidCard } from "../../components/wonderkids/WonderkidCard";
import { useSquadStore } from "../../stores/useSquadStore";
import { useTacticStore } from "../../stores/useTacticStore";

function WonderkidsExplorerInner() {
  const searchParams = useSearchParams();
  const tactic = useTacticStore((s) => s.tactic);
  const worldWonderkids = useTacticStore((s) => s.worldWonderkids);
  const clubPlayers = useTacticStore((s) => s.clubPlayers);
  const weakestIndices = useSquadStore(
    (s) => s.auditResult?.weakestThreeSlotIndices,
  );

  const defaultSlot = weakestIndices?.[0] ?? 10;
  const [activeTab, setActiveTab] = useState<"best-fit" | "trending">("best-fit");
  const [slotIndex, setSlotIndex] = useState<number>(defaultSlot);
  const [posFilter, setPosFilter] = useState<string>("");
  const [maxAge, setMaxAge] = useState<number>(21);
  const [maxBudget, setMaxBudget] = useState<number>(120);
  const [styleId, setStyleId] = useState<string>(tactic.styleId ?? "");
  const [searchText, setSearchText] = useState<string>("");

  useEffect(() => {
    const slotParam = searchParams.get("slot");
    if (slotParam !== null) {
      const parsed = Number(slotParam);
      if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 10) {
        setSlotIndex(parsed);
        setActiveTab("best-fit");
      }
    }
  }, [searchParams]);

  const stylesCatalog = getTacticalStyles(tactic.patchVersion);
  const targetSlot = tactic.slots[slotIndex] ?? tactic.slots[0]!;

  const ranked = useMemo(() => {
    const squadUidSet = new Set(clubPlayers.map((p) => p.uid));
    const customPool =
      worldWonderkids.length > 0
        ? worldWonderkids.filter((wk) => !squadUidSet.has(wk.uid))
        : undefined;
    const list = rankWonderkidsForSlot(
      targetSlot,
      {
        position: (posFilter as PositionKey14) || undefined,
        maxAge,
        maxBudgetEurM: maxBudget,
        styleId: styleId || undefined,
        patchVersion: tactic.patchVersion,
      },
      customPool,
    );
    if (!searchText.trim()) return list.slice(0, 36);
    const q = searchText.trim().toLowerCase();
    return list
      .filter(
        (r) =>
          r.wonderkid.name.toLowerCase().includes(q) ||
          r.wonderkid.club.toLowerCase().includes(q) ||
          r.wonderkid.nationality.toLowerCase().includes(q),
      )
      .slice(0, 36);
  }, [
    clubPlayers,
    worldWonderkids,
    targetSlot,
    posFilter,
    maxAge,
    maxBudget,
    styleId,
    tactic.patchVersion,
    searchText,
  ]);

  return (
    <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-100">
              U-21 Wonderkids Scout &amp; Tactical Fit Ranker
            </h1>
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                worldWonderkids.length > 0
                  ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                  : "border border-cyan-500/30 bg-slate-800 text-cyan-300"
              }`}
            >
              Sumber:{" "}
              {worldWonderkids.length > 0
                ? `Live dari File Save .fm (${worldWonderkids.length} U-21)`
                : "Dataset Seed Statis FM27"}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Formula:{" "}
            <code className="font-mono text-emerald-300">
              ValueRatio = 0.55*RoleFit + 0.30*Potential + 0.15*PriceEfficiency
            </code>
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#111827] p-1">
          <button
            type="button"
            onClick={() => setActiveTab("best-fit")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium ${
              activeTab === "best-fit"
                ? "bg-emerald-500/20 text-emerald-300"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Best For My Tactic
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("trending")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium ${
              activeTab === "trending"
                ? "bg-cyan-500/20 text-cyan-300"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Trending Mingguan (7d)
          </button>
        </div>
      </div>

      <ShortlistExporter />

      {activeTab === "best-fit" ? (
        <>
          <section className="rounded-xl border border-slate-800 bg-[#111827] p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div>
                <label className="block text-[11px] text-slate-400">
                  Target Active Tactic Slot
                </label>
                <select
                  value={slotIndex}
                  onChange={(e) => setSlotIndex(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-100"
                >
                  {tactic.slots.map((s) => (
                    <option key={s.slotIndex} value={s.slotIndex}>
                      #{s.slotIndex + 1} {s.inPossession.positionId} (
                      {s.inPossession.roleId}) / {s.outOfPossession.positionId}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400">
                  Position Filter
                </label>
                <select
                  value={posFilter}
                  onChange={(e) => setPosFilter(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-100"
                >
                  <option value="">Auto ({targetSlot.inPossession.positionId})</option>
                  {POSITION_14_KEYS.map((pk) => (
                    <option key={pk} value={pk}>
                      {pk}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400">
                  Max Age: <strong className="font-mono text-cyan-300">{maxAge}</strong>
                </label>
                <input
                  type="range"
                  min={15}
                  max={21}
                  value={maxAge}
                  onChange={(e) => setMaxAge(Number(e.target.value))}
                  className="mt-2 w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400">
                  Max Budget:{" "}
                  <strong className="font-mono text-emerald-300">
                    EUR {maxBudget}M
                  </strong>
                </label>
                <input
                  type="range"
                  min={5}
                  max={150}
                  step={5}
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(Number(e.target.value))}
                  className="mt-2 w-full accent-emerald-400"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400">
                  Tactical Style Synergy
                </label>
                <select
                  value={styleId}
                  onChange={(e) => setStyleId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-100"
                >
                  <option value="">Neutral Style</option>
                  {stylesCatalog.TacticalStyles.map((st) => (
                    <option key={st.Id} value={st.Id}>
                      {st.Name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400">
                  Search Name / Club / Nation
                </label>
                <input
                  type="search"
                  placeholder="e.g. Palmeiras, ESP..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-100"
                />
              </div>
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {ranked.map((item) => (
              <WonderkidCard
                key={item.wonderkid.uid}
                item={item}
                patchVersion={tactic.patchVersion}
              />
            ))}
          </div>
        </>
      ) : (
        <TrendingStrip patchVersion={tactic.patchVersion} />
      )}
    </main>
  );
}

export default function WonderkidsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-[1600px] px-4 py-8 text-xs text-slate-400">
          Loading U-21 Wonderkids Scout...
        </main>
      }
    >
      <WonderkidsExplorerInner />
    </Suspense>
  );
}
