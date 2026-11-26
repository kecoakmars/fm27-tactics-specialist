"use client";

import React, { useMemo, useState } from "react";
import { cancelActiveFmSaveImport } from "@/lib/worker-client";
import { useTacticStore } from "@/stores/useTacticStore";

export function ClubPickerModal() {
  const {
    liveFmSave,
    selectedClubUid,
    clubPickerOpen,
    fmImportProgress,
    setClubPickerOpen,
    setFmImportProgress,
    selectClubFromFmSave,
  } = useTacticStore();

  const [query, setQuery] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [selectingUid, setSelectingUid] = useState<number | null>(null);

  const filteredClubs = useMemo(() => {
    if (!liveFmSave) return [];
    const q = query.trim().toLowerCase();
    const list = !q
      ? liveFmSave.clubs
      : liveFmSave.clubs.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.shortName.toLowerCase().includes(q) ||
            c.nation.toLowerCase().includes(q),
        );
    return list.slice(0, 120);
  }, [liveFmSave, query]);

  return (
    <>
      {/* Global Client-Side .fm Progress Banner */}
      {fmImportProgress && (
        <div
          id="fm-save-progress-banner"
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 top-16 z-50 mx-auto max-w-2xl px-4"
        >
          <div className="rounded-2xl border border-emerald-400/50 bg-[#0B0F19]/95 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-xs font-bold text-slate-100">
                  {fmImportProgress.stage}
                </span>
              </div>
              <span className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                Diproses 100% lokal di browser (tidak diunggah ke server)
              </span>
            </div>

            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-200"
                style={{ width: `${Math.max(4, Math.min(100, fmImportProgress.pct))}%` }}
              />
            </div>

            <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] font-mono-metric text-slate-400">
              <span className="truncate">{fmImportProgress.fileName}</span>
              <div className="flex items-center gap-2.5 shrink-0">
                <span>{fmImportProgress.pct}%</span>
                <button
                  type="button"
                  onClick={() => {
                    cancelActiveFmSaveImport();
                    setFmImportProgress(null);
                  }}
                  className="rounded border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 font-sans text-[10px] font-bold text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                >
                  Batalkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Searchable Club Switcher Modal */}
      {clubPickerOpen && liveFmSave && (
        <div
          id="club-picker-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Pilih Klub dari File Save .fm"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-3 rounded-2xl border border-white/15 bg-[#111827] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-extrabold text-slate-100">
                    Pilih Klub Karier (.fm)
                  </h2>
                  <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    Diproses 100% lokal di browser (tidak diunggah ke server)
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Save: <strong className="text-cyan-300">{liveFmSave.saveName}</strong> ·{" "}
                  {liveFmSave.gameDate} · {liveFmSave.stats.totalClubs.toLocaleString()} klub ·{" "}
                  {liveFmSave.stats.totalPlayers.toLocaleString()} pemain ·{" "}
                  {liveFmSave.worldWonderkids.length} U-21 live wonderkids
                </p>
              </div>

              <button
                type="button"
                onClick={() => setClubPickerOpen(false)}
                className="rounded-lg border border-white/10 bg-[#0B0F19] px-2.5 py-1 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                Tutup
              </button>
            </div>

            <input
              id="club-picker-search-input"
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama klub atau negara (mis. Man Utd, Barcelona, Persib, England)..."
              className="w-full rounded-xl border border-slate-700 bg-[#0B0F19] px-3.5 py-2 text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
            />

            {modalError && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
                {modalError}
              </div>
            )}

            <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
              {filteredClubs.map((club) => {
                const isSelected = club.uid === selectedClubUid;
                const isBusyThis = selectingUid === club.uid;
                return (
                  <button
                    key={club.uid}
                    type="button"
                    disabled={selectingUid !== null}
                    onClick={async () => {
                      setModalError(null);
                      setSelectingUid(club.uid);
                      try {
                        await selectClubFromFmSave(club.uid);
                      } catch (err) {
                        setModalError(
                          err instanceof Error ? err.message : "Gagal memuat data klub",
                        );
                      } finally {
                        setSelectingUid(null);
                      }
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition cursor-pointer ${
                      isSelected
                        ? "border-emerald-400/60 bg-emerald-500/15"
                        : "border-white/8 bg-[#0B0F19] hover:border-cyan-500/40 hover:bg-slate-900"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-xs font-bold text-slate-100">
                          {club.name}
                        </span>
                        {club.isHumanControlled && (
                          <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-950">
                            Klub Manajer Anda
                          </span>
                        )}
                        {isSelected && (
                          <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
                            Aktif
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {club.nation} · UID #{club.uid}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 font-mono-metric text-[11px]">
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-emerald-300">
                        {club.playerCount} Pemain
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-cyan-300">
                        {club.staffCount} Pelatih
                      </span>
                      <span className="font-sans text-xs font-bold text-emerald-400">
                        {isBusyThis ? "Memuat..." : "Pilih →"}
                      </span>
                    </div>
                  </button>
                );
              })}

              {filteredClubs.length === 0 && (
                <p className="py-6 text-center text-xs text-slate-400">
                  Tidak ada klub yang cocok dengan pencarian &ldquo;{query}&rdquo;.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
