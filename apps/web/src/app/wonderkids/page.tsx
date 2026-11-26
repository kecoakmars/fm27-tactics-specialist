"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { getTacticalStyles } from "@fm27/fm-data";
import { rankWonderkidsForSlot } from "@fm27/fm-engine";
import { POSITION_14_KEYS, type PositionKey14 } from "@fm27/shared-types";
import { ShortlistExporter } from "../../components/wonderkids/ShortlistExporter";
import { TrendingStrip } from "../../components/wonderkids/TrendingStrip";
import { WonderkidCard } from "../../components/wonderkids/WonderkidCard";
import { importFmSaveFile, isFmSaveFileName } from "../../lib/file-importer";
import { useSquadStore } from "../../stores/useSquadStore";
import { useTacticStore } from "../../stores/useTacticStore";

function WonderkidsExplorerInner() {
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const tactic = useTacticStore((s) => s.tactic);
  const liveFmSave = useTacticStore((s) => s.liveFmSave);
  const worldWonderkids = useTacticStore((s) => s.worldWonderkids);
  const clubPlayers = useTacticStore((s) => s.clubPlayers);
  const setClubPickerOpen = useTacticStore((s) => s.setClubPickerOpen);
  const weakestIndices = useSquadStore(
    (s) => s.auditResult?.weakestThreeSlotIndices,
  );

  const defaultSlot = weakestIndices?.[0] ?? 10;
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
      }
    }
  }, [searchParams]);

  const stylesCatalog = getTacticalStyles(tactic.patchVersion);
  const targetSlot = tactic.slots[slotIndex] ?? tactic.slots[0]!;
  const hasLiveData = worldWonderkids.length > 0;

  async function handleUploadFmSave(file: File) {
    if (!isFmSaveFileName(file.name)) {
      setImportError(
        "Halaman Wonderkids membutuhkan file save karier .fm (bukan .fmf) untuk mengekstrak daftar U-21 asli.",
      );
      return;
    }
    setImportError(null);
    setIsImporting(true);
    try {
      await importFmSaveFile(file);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Gagal memproses file save .fm",
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
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-100">
              U-21 Wonderkids Scout &amp; Tactical Fit Ranker
            </h1>
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                hasLiveData
                  ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                  : "border border-amber-500/40 bg-amber-500/15 text-amber-300"
              }`}
            >
              {hasLiveData
                ? `Live .fm: ${liveFmSave?.saveName ?? "Save Aktif"} (${liveFmSave?.gameDate ?? ""}) · ${worldWonderkids.length} U-21`
                : "Menunggu Impor File Save .fm (0% Data Sample)"}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Formula:{" "}
            <code className="font-mono text-emerald-300">
              ValueRatio = 0.55*RoleFit + 0.30*Potential + 0.15*PriceEfficiency
            </code>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isImporting}
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 cursor-pointer disabled:opacity-50"
          >
            {isImporting
              ? "Memproses .fm..."
              : hasLiveData
                ? "Muat Save .fm Lain"
                : "Unggah Save Karier .fm"}
          </button>
          {liveFmSave && (
            <button
              type="button"
              onClick={() => setClubPickerOpen(true)}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/25 cursor-pointer"
            >
              Ganti Klub
            </button>
          )}
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
              Best For My Tactic
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
              Top Prospek Save (.fm)
            </button>
          </div>
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
          <h2 className="text-base font-bold text-slate-100">
            Belum Ada File Save Karier (.fm) yang Dimuat
          </h2>
          <p className="mx-auto max-w-xl text-xs text-slate-400 leading-relaxed">
            Data sample/seed statis dinonaktifkan agar seluruh daftar Wonderkids U-21 yang tampil{" "}
            <strong className="text-emerald-300">100% asli dari dunia karier Football Manager Anda</strong>{" "}
            (lengkap dengan klub terkini, umur, atribut, dan potensi di save Anda). Diproses 100%
            lokal di browser tanpa unggah ke server.
          </p>
          <div className="pt-1">
            <button
              type="button"
              disabled={isImporting}
              onClick={() => fileRef.current?.click()}
              className="rounded-lg bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer disabled:opacity-50"
            >
              Unggah File Save .fm Sekarang
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
                        {maxBudget >= 300 ? "Tanpa Batas" : `EUR ${maxBudget}M`}
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
                      placeholder="e.g. Barcelona, ESP, Yamal..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-100"
                    />
                  </div>
                </div>
              </section>

              {ranked.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-[#111827] p-6 text-center text-xs text-slate-400">
                  Tidak ada wonderkid U-21 dari save .fm yang cocok dengan filter saat ini. Coba
                  longgarkan filter posisi, budget, atau pencarian.
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
          Loading U-21 Wonderkids Scout...
        </main>
      }
    >
      <WonderkidsExplorerInner />
    </Suspense>
  );
}
