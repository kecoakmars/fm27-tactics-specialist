"use client";

import { useRef, useState } from "react";
import {
  importAnySupportedFile,
  importFmSaveArrayBuffer,
} from "../../lib/file-importer";
import { useFolderSyncStore } from "../../stores/useFolderSyncStore";
import { useLocale } from "../../stores/useLocaleStore";
import { useSquadStore } from "../../stores/useSquadStore";

export function SquadImporter() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const { t } = useLocale();

  const sourceLabel = useSquadStore((s) => s.sourceLabel);
  const playerCount = useSquadStore((s) => s.players.length);
  const clearSquad = useSquadStore((s) => s.clearSquad);
  const setError = useSquadStore((s) => s.setError);
  const setBusy = useSquadStore((s) => s.setBusy);
  const isBusy = useSquadStore((s) => s.isBusy);

  const folderStatus = useFolderSyncStore((s) => s.status);
  const saveGameFiles = useFolderSyncStore((s) => s.saveGameFiles);
  const readSaveGameArrayBuffer = useFolderSyncStore((s) => s.readSaveGameArrayBuffer);

  async function handleFmSaveArrayBuffer(fileName: string, ab: ArrayBuffer) {
    setBusy(true);
    setError(null);
    try {
      await importFmSaveArrayBuffer(fileName, ab);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("Gagal membuka file save .fm", "Failed to open .fm save"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      await importAnySupportedFile(file);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("Gagal membuka file", "Failed to open file"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-[#111827] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-sm font-semibold text-slate-100">
            {t("Save Karier (.fm)", "Career Save (.fm)")}
          </h2>
          {sourceLabel && (
            <span className="rounded bg-emerald-500/15 border border-emerald-500/35 px-2 py-0.5 font-mono text-xs text-emerald-300">
              {sourceLabel}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer disabled:opacity-50"
          >
            {t("Pilih File Save (.fm)", "Choose Save File (.fm)")}
          </button>
          {playerCount > 0 && (
            <button
              type="button"
              onClick={clearSquad}
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-300 hover:border-rose-500/50 hover:text-rose-300 cursor-pointer"
            >
              {t("Reset", "Reset")}
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".fm"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      {!sourceLabel && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-3.5 py-2.5 text-xs transition ${
            dragActive
              ? "border-emerald-400 bg-emerald-500/10 text-emerald-200"
              : "border-slate-700/80 bg-[#0B0F19]/70 text-slate-400"
          }`}
        >
          <span>
            {t(
              "Atau tarik file save karier (.fm) ke kotak ini",
              "Or drag and drop your career save (.fm) here",
            )}
          </span>

          {folderStatus === "connected" && saveGameFiles.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {saveGameFiles.slice(0, 2).map((sf) => (
                <button
                  key={sf.name}
                  type="button"
                  disabled={isBusy}
                  onClick={async () => {
                    try {
                      const ab = await readSaveGameArrayBuffer(sf.name);
                      await handleFmSaveArrayBuffer(sf.name, ab);
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : t("Gagal membaca save /games", "Could not read /games save"),
                      );
                    }
                  }}
                  className="rounded border border-emerald-500/40 bg-emerald-950/50 px-2 py-0.5 font-mono text-[11px] text-emerald-300 hover:border-emerald-400 cursor-pointer disabled:opacity-50"
                >
                  {sf.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
