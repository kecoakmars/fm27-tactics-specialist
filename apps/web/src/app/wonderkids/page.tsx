"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { getTacticalStyles } from "@fm27/fm-data";
import { rankWonderkidsForSlot } from "@fm27/fm-engine";
import { POSITION_14_KEYS, type PositionKey14 } from "@fm27/shared-types";
import { ShortlistExporter } from "../../components/wonderkids/ShortlistExporter";
import { TrendingStrip } from "../../components/wonderkids/TrendingStrip";
import { WonderkidCard } from "../../components/wonderkids/WonderkidCard";
import { importAnySupportedFile } from "../../lib/file-importer";
import { useLocale } from "../../stores/useLocaleStore";
import { useSquadStore } from "../../stores/useSquadStore";
import { useTacticStore } from "../../stores/useTacticStore";

function WonderkidsExplorerInner() {
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { t } = useLocale();

  const tactic = useTacticStore((s) => s.tactic);
  const unifiedReport = useTacticStore((s) => s.unifiedReport);
  const worldWonderkids = useTacticStore((s) => s.worldWonderkids);
  const clubPlayers = useTacticStore((s) => s.clubPlayers);
  const squadAuditWeakest = useSquadStore(
    (s) => s.auditResult?.weakestThreeSlotIndices,
  );
  const weakestIndices =
    squadAuditWeakest ??
    unifiedReport?.squadBlueprintOrAudit.audit?.weakestThreeSlotIndices;

  const defaultSlot = weakestIndices?.[0] ?? 0;
  const [activeTab, setActiveTab] = useState<"best-fit" | "trending">("best-fit");
  const [slotIndex, setSlotIndex] = useState<number>(defaultSlot);
  const [posFilter, setPosFilter] = useState<string>("");
  const [maxAge, setMaxAge] = useState<number>(21);
  const [maxBudget, setMaxBudget] = useState<number>(300);
  const [styleId, setStyleId] = useState<string>(tactic.styleId ?? "");
  const [searchText, setSearchText] = useState<string>("");
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    const slotParam = searchParams.get("slot");
    if (slotParam !== null) {
      const parsed = Number(slotParam);
      if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 10) {
        setSlotIndex(parsed);
        setActiveTab("best-fit");
        return;
      }
    }
    if (weakestIndices && weakestIndices.length > 0) {
      setSlotIndex(weakestIndices[0]!);
    }
  }, [searchParams, weakestIndices]);

  useEffect(() => {
    setStyleId(tactic.styleId ?? "");
  }, [tactic.styleId]);

  const stylesCatalog = getTacticalStyles(tactic.patchVersion);
  const targetSlot = tactic.slots[slotIndex] ?? tactic.slots[0]!;
  const hasLiveData = worldWonderkids.length > 0;

  async function handleUploadFmSave(file: File) {
    setImportError(null);
    setIsImporting(true);
    try {
      await importAnySupportedFile(file);
    } catch (err) {
      setImportError(
        err instanceof Error
          ? err.message
          : t("Gagal membuka file save .fm", "Failed to open .fm save"),
      );
    } finally {
      setIsImporting(false);
    }
  }

  const ranked = useMemo(() => {
    if (!hasLiveData) return [];
    const squadUidSet = new Set(clubPlayers.map((p) => p.uid));
    const liveExternalPool = worldWonderkids.filter((wk) => !squadUidSet.has(wk.uid));
    const list = rankWonderkidsForSlot(
      targetSlot,
      {
        position: (posFilter as PositionKey14) || undefined,
        maxAge,
        maxBudgetEurM: maxBudget >= 300 ? undefined : maxBudget,
        styleId: styleId || undefined,
        patchVersion: tactic.patchVersion,
      },
      liveExternalPool,
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
    hasLiveData,
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
      <input
        ref={fileRef}
        type="file"
        accept=".fm"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void handleUploadFmSave(f);
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-100">
          {t("Shortlist Pemain & Wonderkids", "Player Shortlist & Wonderkids")}
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          {hasLiveData && (
            <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-[#111827] p-1">
              <button
                type="button"
                onClick={() => setActiveTab("best-fit")}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-medium cursor-pointer ${
                  activeTab === "best-fit"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t("Sesuai Taktik Saya", "For My Tactic")}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("trending")}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-medium cursor-pointer ${
                  activeTab === "trending"
                    ? "bg-cyan-500/20 text-cyan-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t("Prospek Terbaik", "Top Prospects")}
              </button>
            </div>
          )}
          <button
            type="button"
            disabled={isImporting}
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 cursor-pointer disabled:opacity-50"
          >
            {isImporting
              ? t("Memuat...", "Loading...")
              : hasLiveData
                ? t("Ganti File Save .fm", "Load Another .fm Save")
                : t("Pilih File Save (.fm)", "Choose Save File (.fm)")}
          </button>
        </div>
      </div>

      {importError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
          {importError}
        </div>
      )}

      {!hasLiveData ? (
        <section
          id="wonderkids-live-empty-state"
          className="rounded-2xl border border-dashed border-slate-700 bg-[#111827]/70 p-10 text-center space-y-3"
        >
          <h2 className="text-sm font-bold text-slate-100">
            {t(
              "Muat save karier (.fm) untuk mencari wonderkid U-21 sesuai taktik Anda.",
              "Load a career save (.fm) to scout U-21 wonderkids for your tactic.",
            )}
          </h2>
          <div>
            <button
              type="button"
              disabled={isImporting}
              onClick={() => fileRef.current?.click()}
              className="rounded-lg bg-emerald-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer disabled:opacity-50"
            >
              {t("Pilih File Save (.fm)", "Choose Save File (.fm)")}
            </button>
          </div>
        </section>
      ) : (
        <>
          <ShortlistExporter />

          {activeTab === "best-fit" ? (
            <>
              <section className="rounded-xl border border-slate-800 bg-[#111827] p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <div>
                    <label className="block text-[11px] text-slate-400">
                      {t("Posisi Taktik", "Tactic Slot")}
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
                      {t("Filter Posisi", "Position")}
                    </label>
                    <select
                      value={posFilter}
                      onChange={(e) => setPosFilter(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-100"
                    >
                      <option value="">
                        {t("Otomatis", "Auto")} ({targetSlot.inPossession.positionId})
                      </option>
                      {POSITION_14_KEYS.map((pk) => (
                        <option key={pk} value={pk}>
                          {pk}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400">
                      {t("Usia Maks:", "Max Age:")}{" "}
                      <strong className="font-mono text-cyan-300">{maxAge}</strong>
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
                      {t("Batas Harga:", "Max Budget:")}{" "}
                      <strong className="font-mono text-emerald-300">
                        {maxBudget >= 300 ? t("Semua", "Any") : `€${maxBudget}M`}
                      </strong>
                    </label>
                    <input
                      type="range"
                      min={5}
                      max={300}
                      step={5}
                      value={maxBudget}
                      onChange={(e) => setMaxBudget(Number(e.target.value))}
                      className="mt-2 w-full accent-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400">
                      {t("Gaya Bermain", "Tactical Style")}
                    </label>
                    <select
                      value={styleId}
                      onChange={(e) => setStyleId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-100"
                    >
                      <option value="">{t("Semua Gaya", "Any Style")}</option>
                      {stylesCatalog.TacticalStyles.map((st) => (
                        <option key={st.Id} value={st.Id}>
                          {st.Name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400">
                      {t("Cari Pemain / Klub", "Search Player / Club")}
                    </label>
                    <input
                      type="search"
                      placeholder="Barcelona, ESP, Yamal..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-100"
                    />
                  </div>
                </div>
              </section>

              {ranked.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-[#111827] p-6 text-center text-xs text-slate-400">
                  {t(
                    "Tidak ada pemain U-21 yang cocok dengan filter saat ini.",
                    "No U-21 players match the current filters.",
                  )}
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {ranked.map((item) => (
                    <WonderkidCard
                      key={item.wonderkid.uid}
                      item={item}
                      patchVersion={tactic.patchVersion}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <TrendingStrip patchVersion={tactic.patchVersion} />
          )}
        </>
      )}
    </main>
  );
}

export default function WonderkidsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-[1600px] px-4 py-8 text-xs text-slate-400">
          Loading...
        </main>
      }
    >
      <WonderkidsExplorerInner />
    </Suspense>
  );
}
