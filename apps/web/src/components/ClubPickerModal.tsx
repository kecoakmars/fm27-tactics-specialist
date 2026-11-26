"use client";

import React, { useMemo, useState } from "react";
import { cancelActiveFmSaveImport } from "@/lib/worker-client";
import { formatFmSaveStage, useLocale } from "@/stores/useLocaleStore";
import { useTacticStore } from "@/stores/useTacticStore";

export function ClubPickerModal() {
  const { locale, t } = useLocale();
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
      {/* Career Save Loading Banner */}
      {fmImportProgress && (
        <div
          id="fm-save-progress-banner"
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 top-16 z-50 mx-auto max-w-xl px-4"
        >
          <div className="rounded-2xl border border-emerald-400/50 bg-[#0B0F19]/95 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-xs font-bold text-slate-100">
                  {formatFmSaveStage(fmImportProgress.pct, locale)}
                </span>
              </div>
              <span className="text-xs font-mono-metric font-bold text-emerald-300">
                {fmImportProgress.pct}%
              </span>
            </div>

            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-200"
                style={{ width: `${Math.max(4, Math.min(100, fmImportProgress.pct))}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-400">
              <span className="truncate font-mono-metric">{fmImportProgress.fileName}</span>
              <button
                type="button"
                onClick={() => {
                  cancelActiveFmSaveImport();
                  setFmImportProgress(null);
                }}
                className="rounded border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300 hover:bg-rose-500/25 cursor-pointer shrink-0"
              >
                {t("Batalkan", "Cancel")}
              </button>
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
          aria-label={t("Pilih Klub", "Select Club")}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-3 rounded-2xl border border-white/15 bg-[#111827] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-100">
                  {t("Pilih Klub", "Select Club")}
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  <strong className="text-cyan-300">{liveFmSave.saveName}</strong> ·{" "}
                  {liveFmSave.gameDate} · {liveFmSave.stats.totalClubs.toLocaleString()}{" "}
                  {t("klub", "clubs")}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setClubPickerOpen(false)}
                className="rounded-lg border border-white/10 bg-[#0B0F19] px-2.5 py-1 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                {t("Tutup", "Close")}
              </button>
            </div>

            <input
              id="club-picker-search-input"
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(
                "Cari nama klub atau negara (contoh: Man Utd, Barcelona, Persib)...",
                "Search club or nation (e.g. Man Utd, Barcelona, Arsenal)...",
              )}
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
                          err instanceof Error
                            ? err.message
                            : t("Gagal memuat klub", "Failed to load club"),
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
                            {t("Klub Anda", "Your Club")}
                          </span>
                        )}
                        {isSelected && (
                          <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
                            {t("Aktif", "Active")}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">{club.nation}</div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 font-mono-metric text-[11px]">
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-emerald-300">
                        {club.playerCount} {t("Pemain", "Players")}
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-cyan-300">
                        {club.staffCount} {t("Pelatih", "Staff")}
                      </span>
                      <span className="font-sans text-xs font-bold text-emerald-400">
                        {isBusyThis
                          ? t("Memuat...", "Loading...")
                          : t("Pilih →", "Select →")}
                      </span>
                    </div>
                  </button>
                );
              })}

              {filteredClubs.length === 0 && (
                <p className="py-6 text-center text-xs text-slate-400">
                  {t(
                    `Tidak ada klub yang cocok dengan "${query}".`,
                    `No clubs match "${query}".`,
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
