"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { listPatchVersions } from "@fm27/fm-data";
import { ClubPickerModal } from "@/components/ClubPickerModal";
import { importAnySupportedFile } from "@/lib/file-importer";
import { useFolderSyncStore } from "@/stores/useFolderSyncStore";
import { useTacticStore } from "@/stores/useTacticStore";

const NAV_ITEMS = [
  { href: "/", label: "Pitch Board" },
  { href: "/squad", label: "Squad Audit" },
  { href: "/wonderkids", label: "Wonderkids" },
  { href: "/staff", label: "Staff Stars" },
  { href: "/training", label: "Training" },
  { href: "/community", label: "Community" },
] as const;

export function TopNavShell() {
  const pathname = usePathname();
  const patchVersions = listPatchVersions();
  const globalFileRef = useRef<HTMLInputElement | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [importingGlobal, setImportingGlobal] = useState(false);

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
    void hydrateFromIndexedDb();
  }, [hydrateFromIndexedDb]);

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
        err instanceof Error ? err.message : `Gagal memproses ${file.name}`,
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
                  DUAL-PHASE STUDIO
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
                    id={`nav-link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                      active
                        ? "bg-slate-800/90 text-slate-50 border border-white/12"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Controls: Global File Import + Live .fm Club Switcher + Patch Selector + Local FM27 Folder Sync */}
          <div className="flex items-center gap-2.5 shrink-0">
            <input
              ref={globalFileRef}
              id="global-any-file-input"
              type="file"
              accept=".fm,.fmf,.tac,.json,.fm27.json,.csv,.html,.htm"
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
              title="Unggah Save Karier (.fm), Taktik/Jadwal (.fmf), atau Ekspor CSV/HTML dari halaman mana saja"
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition cursor-pointer disabled:opacity-50"
            >
              {importingGlobal ? "Memproses..." : "Impor .fm / .fmf"}
            </button>

            {liveFmSave && (
              <button
                id="header-switch-club-btn"
                type="button"
                onClick={() => setClubPickerOpen(true)}
                title="Ganti klub dari sesi file save .fm tanpa membaca ulang file"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25 transition cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="max-w-[140px] truncate">
                  {activeClub ? activeClub.shortName || activeClub.name : "Pilih Klub"}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-cyan-300 underline">
                  Ganti Klub
                </span>
              </button>
            )}

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#111827] border border-white/10">
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
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/12 border border-emerald-500/35">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-semibold text-emerald-200 max-w-[160px] truncate">
                  {folderName} ({tacticFiles.length} .fmf · {saveGameFiles.length} .fm)
                </span>
                <button
                  id="disconnect-folder-btn"
                  type="button"
                  onClick={() => void disconnectFolder()}
                  title="Disconnect local FM27 folder"
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
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/35 hover:bg-amber-500/25 transition cursor-pointer"
              >
                Reconnect {folderName ?? "FM27 Folder"}
              </button>
            )}

            {status === "disconnected" && (
              <button
                id="connect-folder-btn"
                type="button"
                onClick={() => void connectNewFolder()}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/25 transition cursor-pointer"
              >
                Connect FM27 Folder
              </button>
            )}

            {status === "unsupported" && (
              <span
                id="folder-fallback-badge"
                title="Browser uses standard file download & drag-and-drop mode"
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-slate-900 text-slate-400 border border-white/8"
              >
                Download / Drop Mode
              </span>
            )}
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
