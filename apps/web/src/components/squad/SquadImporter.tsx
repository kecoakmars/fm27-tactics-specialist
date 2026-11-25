"use client";

import { useRef, useState } from "react";
import { useFolderSyncStore } from "../../stores/useFolderSyncStore";
import { useSquadStore } from "../../stores/useSquadStore";
import { useTacticStore } from "../../stores/useTacticStore";

export function SquadImporter() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const patchVersion = useTacticStore((s) => s.tactic.patchVersion);
  const sourceLabel = useSquadStore((s) => s.sourceLabel);
  const playerCount = useSquadStore((s) => s.players.length);
  const importFromText = useSquadStore((s) => s.importFromText);
  const loadDemoSquad = useSquadStore((s) => s.loadDemoSquad);
  const clearSquad = useSquadStore((s) => s.clearSquad);
  const setError = useSquadStore((s) => s.setError);

  const folderStatus = useFolderSyncStore((s) => s.status);
  const exportFiles = useFolderSyncStore((s) => s.exportFiles);
  const readExportFileText = useFolderSyncStore((s) => s.readExportFileText);

  async function handleFile(file: File) {
    try {
      const text = await file.text();
      importFromText(text, file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse squad file");
    }
  }

  async function handleFolderExportLoad(fileName: string) {
    try {
      const text = await readExportFileText(fileName);
      importFromText(text, fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read linked folder export");
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-[#111827] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            Squad Data Importer (FM27 F9 / fmsave)
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Supports <code className="text-cyan-300">FM-View-Exporter (F9)</code> CSV/HTML
            (comma &amp; German semicolon) and{" "}
            <code className="text-emerald-300">fmsave</code>{" "}
            <code className="text-slate-300">players.csv</code>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadDemoSquad(patchVersion)}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25"
          >
            Load Demo Squad (22 Players)
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/25"
          >
            Import CSV / HTML
          </button>
          {playerCount > 0 && (
            <button
              type="button"
              onClick={clearSquad}
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-300 hover:border-rose-500/50 hover:text-rose-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.html,.htm,text/csv,text/html"
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
              Active Squad:{" "}
              <strong className="font-mono text-emerald-300">{sourceLabel}</strong>
            </>
          ) : (
            "Drop squad.csv, players.csv, or FM-View-Exporter F9 .csv / .html here"
          )}
        </span>

        {folderStatus === "connected" && exportFiles.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500">Linked Folder Exports:</span>
            {exportFiles.slice(0, 3).map((f) => (
              <button
                key={f.name}
                type="button"
                onClick={() => void handleFolderExportLoad(f.name)}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-cyan-300 hover:border-cyan-500/50"
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
