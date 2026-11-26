"use client";

import { useRef, useState } from "react";
import {
  sanitizeFileName,
  triggerBrowserDownload,
} from "../../lib/local-folder-sync";
import {
  exportShortlistFmfInWorker,
  parseShortlistFmfInWorker,
} from "../../lib/worker-client";
import { useFolderSyncStore } from "../../stores/useFolderSyncStore";
import { useLocale } from "../../stores/useLocaleStore";
import { useTrainingStore } from "../../stores/useTrainingStore";

export function ShortlistExporter() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const { t } = useLocale();

  const shortlistTitle = useTrainingStore((s) => s.shortlistTitle);
  const shortlistUids = useTrainingStore((s) => s.shortlistUids);
  const setShortlistTitle = useTrainingStore((s) => s.setShortlistTitle);
  const setShortlist = useTrainingStore((s) => s.setShortlist);
  const clearShortlist = useTrainingStore((s) => s.clearShortlist);

  const folderStatus = useFolderSyncStore((s) => s.status);
  const saveShortlistFmfDirect = useFolderSyncStore(
    (s) => s.saveShortlistFmfDirect,
  );

  async function handleDownloadFmf() {
    if (shortlistUids.length === 0) return;
    const bytes = await exportShortlistFmfInWorker(shortlistTitle, shortlistUids);
    const fileName = sanitizeFileName(shortlistTitle, ".fmf");
    triggerBrowserDownload(fileName, bytes);
    setStatusMsg(t(`${fileName} diunduh`, `Downloaded ${fileName}`));
  }

  async function handleSaveToFolder() {
    if (shortlistUids.length === 0) return;
    const bytes = await exportShortlistFmfInWorker(shortlistTitle, shortlistUids);
    const saved = await saveShortlistFmfDirect(shortlistTitle, bytes);
    setStatusMsg(t(`Tersimpan ke ${saved}`, `Saved to ${saved}`));
  }

  async function handleImportShortlistFile(file: File) {
    try {
      const ab = await file.arrayBuffer();
      const parsed = await parseShortlistFmfInWorker(new Uint8Array(ab));
      setShortlist(parsed.title, parsed.playerUids);
      setStatusMsg(
        t(
          `Shortlist "${parsed.title}" (${parsed.playerUids.length} pemain) dimuat`,
          `Loaded "${parsed.title}" (${parsed.playerUids.length} players)`,
        ),
      );
    } catch (err) {
      setStatusMsg(
        err instanceof Error
          ? err.message
          : t("Gagal membaca shortlist .fmf", "Failed to read .fmf shortlist"),
      );
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-[#111827] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] text-slate-400">
              {t("Nama Shortlist", "Shortlist Name")}
            </label>
            <input
              type="text"
              value={shortlistTitle}
              onChange={(e) => setShortlistTitle(e.target.value)}
              className="mt-0.5 rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1 text-xs text-slate-100"
            />
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#0B0F19] px-3 py-1.5 font-mono text-xs text-amber-300">
            <strong>{shortlistUids.length}</strong> {t("Pemain Dipilih", "Selected")}
          </div>
          {statusMsg && (
            <span className="font-mono text-xs text-emerald-300">
              {statusMsg}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".fmf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportShortlistFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-500/40 cursor-pointer"
          >
            {t("Muat Shortlist (.fmf)", "Load Shortlist (.fmf)")}
          </button>

          {folderStatus === "connected" && (
            <button
              type="button"
              disabled={shortlistUids.length === 0}
              onClick={() => void handleSaveToFolder()}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-40 cursor-pointer"
            >
              {t("Simpan ke FM27", "Save to FM27")}
            </button>
          )}

          <button
            type="button"
            disabled={shortlistUids.length === 0}
            onClick={() => void handleDownloadFmf()}
            className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-40 cursor-pointer"
          >
            {t("Unduh Shortlist (.fmf)", "Download Shortlist (.fmf)")}
          </button>

          {shortlistUids.length > 0 && (
            <button
              type="button"
              onClick={clearShortlist}
              className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 hover:text-rose-300 cursor-pointer"
            >
              {t("Kosongkan", "Clear")}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
