"use client";

import { useRef, useState } from "react";
import {
  importFmSaveArrayBuffer,
  importFmSaveFile,
  isFmSaveFileName,
} from "../../lib/file-importer";
import { useFolderSyncStore } from "../../stores/useFolderSyncStore";
import { useSquadStore } from "../../stores/useSquadStore";
import { useTacticStore } from "../../stores/useTacticStore";

export function SquadImporter() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const sourceLabel = useSquadStore((s) => s.sourceLabel);
  const playerCount = useSquadStore((s) => s.players.length);
  const importFromText = useSquadStore((s) => s.importFromText);
  const clearSquad = useSquadStore((s) => s.clearSquad);
  const setError = useSquadStore((s) => s.setError);
  const setBusy = useSquadStore((s) => s.setBusy);
  const isBusy = useSquadStore((s) => s.isBusy);

  const {
    liveFmSave,
    selectedClubUid,
    setClubPickerOpen,
  } = useTacticStore();

  const folderStatus = useFolderSyncStore((s) => s.status);
  const saveGameFiles = useFolderSyncStore((s) => s.saveGameFiles);
  const exportFiles = useFolderSyncStore((s) => s.exportFiles);
  const readSaveGameArrayBuffer = useFolderSyncStore((s) => s.readSaveGameArrayBuffer);
  const readExportFileText = useFolderSyncStore((s) => s.readExportFileText);

  async function handleFmSaveArrayBuffer(fileName: string, ab: ArrayBuffer) {
    setBusy(true);
    setError(null);
    try {
      await importFmSaveArrayBuffer(fileName, ab);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses file save .fm");
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File) {
    if (isFmSaveFileName(file.name)) {
      setBusy(true);
      setError(null);
      try {
        await importFmSaveFile(file);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal membaca file save .fm");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (file.name.toLowerCase().endsWith(".fmf") || file.name.toLowerCase().endsWith(".tac")) {
      setError(
        "File .fmf / .tac adalah file taktik, bukan daftar skuad. Impor taktik di halaman Pitch Board, atau unggah file save karier .fm / CSV / HTML di sini.",
      );
      return;
    }
    try {
      const text = await file.text();
      importFromText(text, file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses file CSV/HTML skuad");
    }
  }

  async function handleFolderExportLoad(fileName: string) {
    try {
      const text = await readExportFileText(fileName);
      importFromText(text, fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membaca file ekspor dari folder lokal");
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-[#111827] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-100">
              Impor Skuad Nyata (.fm Career Save / CSV / HTML)
            </h2>
            <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
              Diproses 100% lokal di browser (tidak diunggah ke server)
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Mendukung file save karier <code className="text-emerald-300">.fm</code> (FM26/FM27
            Zstandard), <code className="text-cyan-300">FM-View-Exporter (F9)</code> CSV/HTML, dan{" "}
            <code className="text-slate-300">players.csv</code>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 cursor-pointer disabled:opacity-50"
          >
            Unggah Save .fm / CSV / HTML
          </button>
          {liveFmSave && (
            <button
              type="button"
              onClick={() => setClubPickerOpen(true)}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/25 cursor-pointer"
            >
              Ganti Klub (
              {liveFmSave.clubs.find((c) => c.uid === selectedClubUid)?.shortName ?? "Pilih"})
            </button>
          )}
          {playerCount > 0 && (
            <button
              type="button"
              onClick={clearSquad}
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-300 hover:border-rose-500/50 hover:text-rose-300 cursor-pointer"
            >
              Bersihkan
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".fm,.csv,.html,.htm,text/csv,text/html"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

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
          {sourceLabel ? (
            <>
              Skuad Aktif:{" "}
              <strong className="font-mono text-emerald-300">{sourceLabel}</strong>
            </>
          ) : (
            "Tarik & lepas file karier .fm (50–400 MB) atau ekspor .csv / .html ke sini"
          )}
        </span>

        {folderStatus === "connected" && (saveGameFiles.length > 0 || exportFiles.length > 0) && (
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
                      err instanceof Error ? err.message : "Gagal membaca file save /games",
                    );
                  }
                }}
                className="rounded border border-emerald-500/40 bg-emerald-950/50 px-2 py-0.5 font-mono text-[11px] text-emerald-300 hover:border-emerald-400 cursor-pointer disabled:opacity-50"
              >
                /games/{sf.name}
              </button>
            ))}
            {exportFiles.slice(0, 2).map((f) => (
              <button
                key={f.name}
                type="button"
                onClick={() => void handleFolderExportLoad(f.name)}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-cyan-300 hover:border-cyan-500/50 cursor-pointer"
              >
                {f.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
