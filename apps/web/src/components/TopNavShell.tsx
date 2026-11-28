"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { listPatchVersions } from "@fm27/fm-data";
import { ClubPickerModal } from "@/components/ClubPickerModal";
import { importAnySupportedFile } from "@/lib/file-importer";
import { useFolderSyncStore } from "@/stores/useFolderSyncStore";
import { useLocale } from "@/stores/useLocaleStore";
import { useTacticStore } from "@/stores/useTacticStore";

const NAV_ITEMS = [
  { href: "/summary", idSlug: "summary", labelId: "Ringkasan", labelEn: "Summary" },
  { href: "/", idSlug: "pitch-board", labelId: "Papan Taktik", labelEn: "Tactics" },
  { href: "/squad", idSlug: "squad-audit", labelId: "Skuad", labelEn: "Squad" },
  { href: "/wonderkids", idSlug: "wonderkids", labelId: "Shortlist", labelEn: "Shortlist" },
  { href: "/staff", idSlug: "staff-stars", labelId: "Staf Pelatih", labelEn: "Staff" },
  { href: "/training", idSlug: "training", labelId: "Latihan", labelEn: "Training" },
  { href: "/community", idSlug: "community", labelId: "Komunitas", labelEn: "Community" },
] as const;

export function TopNavShell() {
  const pathname = usePathname();
  const patchVersions = listPatchVersions();
  const globalFileRef = useRef<HTMLInputElement | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [importingGlobal, setImportingGlobal] = useState(false);

  const { locale, setLocale, hydrateLocale, t } = useLocale();

  const {
    tactic,
    liveFmSave,
    selectedClubUid,
    globalNotice,
    setPatchVersion,
    setClubPickerOpen,
    setGlobalNotice,
  } = useTacticStore();
  const {
    status,
    folderName,
    tacticFiles,
    saveGameFiles,
    hydrateFromIndexedDb,
    connectNewFolder,
    reconnectSavedFolder,
    disconnectFolder,
  } = useFolderSyncStore();

  useEffect(() => {
    hydrateLocale();
    void hydrateFromIndexedDb();
  }, [hydrateFromIndexedDb, hydrateLocale]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const showGlobalToast = (tone: "ok" | "error", text: string) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setGlobalNotice({ tone, text });
    noticeTimerRef.current = setTimeout(
      () => setGlobalNotice(null),
      tone === "error" ? 9000 : 5500,
    );
  };

  async function handleGlobalImport(file: File) {
    setImportingGlobal(true);
    try {
      const res = await importAnySupportedFile(file);
      showGlobalToast("ok", res.message);
    } catch (err) {
      showGlobalToast(
        "error",
        err instanceof Error
          ? err.message
          : t(`Gagal membuka ${file.name}`, `Could not open ${file.name}`),
      );
    } finally {
      setImportingGlobal(false);
    }
  }

  const activeClub =
    liveFmSave && selectedClubUid !== null
      ? liveFmSave.clubs.find((c) => c.uid === selectedClubUid) ?? null
      : null;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0B0F19]/92 backdrop-blur-md">
        <div className="max-w-[1640px] mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-4">
          {/* Brand + Navigation */}
          <div className="flex items-center gap-6 overflow-x-auto">
            <Link
              href="/"
              id="brand-home-link"
              className="flex items-center gap-2.5 shrink-0"
            >
              <span className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-extrabold tracking-tight text-slate-100 leading-none">
                  FM27 TACTICS
                </span>
                <span className="text-[10px] font-mono-metric text-emerald-400 mt-0.5">
                  TACTICAL STUDIO
                </span>
              </div>
            </Link>

            <nav aria-label="Primary" className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    id={`nav-link-${item.idSlug}`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                      active
                        ? "bg-slate-800/90 text-slate-50 border border-white/12"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                    }`}
                  >
                    {locale === "id" ? item.labelId : item.labelEn}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={globalFileRef}
              id="global-any-file-input"
              type="file"
              accept=".fm,.fmf,.tac"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void handleGlobalImport(f);
              }}
            />

            <button
              id="header-global-import-btn"
              type="button"
              disabled={importingGlobal}
              onClick={() => globalFileRef.current?.click()}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition cursor-pointer disabled:opacity-50"
            >
              {importingGlobal
                ? t("Memuat...", "Loading...")
                : t("Muat .fm / .fmf", "Load .fm / .fmf")}
            </button>

            {liveFmSave && (
              <button
                id="header-switch-club-btn"
                type="button"
                onClick={() => setClubPickerOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25 transition cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="max-w-[140px] truncate">
                  {activeClub
                    ? activeClub.shortName || activeClub.name
                    : t("Pilih Klub", "Select Club")}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-cyan-300 underline">
                  {t("Ganti", "Switch")}
                </span>
              </button>
            )}

            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#111827] border border-white/10">
              <span className="text-[11px] text-slate-400">Patch</span>
              <select
                id="global-patch-selector"
                aria-label="FM27 Patch Version"
                value={tactic.patchVersion}
                onChange={(e) => setPatchVersion(e.target.value)}
                className="bg-transparent text-xs font-bold font-mono-metric text-emerald-400 cursor-pointer focus:outline-none"
              >
                {patchVersions.map((ver) => (
                  <option key={ver} value={ver} className="bg-[#111827] text-slate-100">
                    v{ver}
                  </option>
                ))}
              </select>
            </div>

            {status === "connected" && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/12 border border-emerald-500/35">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-semibold text-emerald-200 max-w-[150px] truncate">
                  {folderName} ({tacticFiles.length + saveGameFiles.length})
                </span>
                <button
                  id="disconnect-folder-btn"
                  type="button"
                  onClick={() => void disconnectFolder()}
                  title={t("Putuskan folder FM27", "Disconnect FM27 folder")}
                  className="ml-1 text-[11px] text-slate-400 hover:text-rose-300 cursor-pointer"
                >
                  ×
                </button>
              </div>
            )}

            {status === "needs-permission" && (
              <button
                id="reconnect-folder-btn"
                type="button"
                onClick={() => void reconnectSavedFolder()}
                className="hidden sm:inline-flex px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/35 hover:bg-amber-500/25 transition cursor-pointer"
              >
                {t("Sambung Ulang Folder", "Reconnect Folder")}
              </button>
            )}

            {status === "disconnected" && (
              <button
                id="connect-folder-btn"
                type="button"
                onClick={() => void connectNewFolder()}
                className="hidden sm:inline-flex px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/25 transition cursor-pointer"
              >
                {t("Folder FM27", "FM27 Folder")}
              </button>
            )}

            {/* ID | EN Language Switcher */}
            <div
              id="language-switcher"
              role="group"
              aria-label="Language"
              className="flex items-center rounded-lg bg-[#111827] border border-white/10 p-0.5 text-[11px] font-bold"
            >
              <button
                type="button"
                onClick={() => setLocale("id")}
                className={`px-2 py-1 rounded-md transition cursor-pointer ${
                  locale === "id"
                    ? "bg-emerald-500 text-slate-950"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                ID
              </button>
              <button
                type="button"
                onClick={() => setLocale("en")}
                className={`px-2 py-1 rounded-md transition cursor-pointer ${
                  locale === "en"
                    ? "bg-emerald-500 text-slate-950"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </header>

      {globalNotice && (
        <div className="max-w-[1640px] mx-auto px-4 sm:px-6 pt-3">
          <div
            role="status"
            className={`rounded-xl px-3.5 py-2 text-xs font-medium flex items-center justify-between ${
              globalNotice.tone === "ok"
                ? "bg-emerald-500/12 border border-emerald-500/35 text-emerald-200"
                : "bg-rose-500/15 border border-rose-500/40 text-rose-200"
            }`}
          >
            <span>{globalNotice.text}</span>
            <button
              type="button"
              onClick={() => setGlobalNotice(null)}
              className="ml-3 text-slate-400 hover:text-slate-100 cursor-pointer"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <ClubPickerModal />
    </>
  );
}
