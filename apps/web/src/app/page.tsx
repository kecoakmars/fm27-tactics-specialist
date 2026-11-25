"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import {
  decodeTacticFromUrlHash,
  encodeTacticToUrlHash,
  exportFm27Json,
  parseFm27Json,
} from "@fm27/fm-codec";
import { getPitchCatalog, getTacticalStyles } from "@fm27/fm-data";
import { computeTacticalBalance } from "@fm27/fm-engine";
import { AiAdvisorDrawer } from "@/components/analytics/AiAdvisorDrawer";
import { BalanceRadar } from "@/components/analytics/BalanceRadar";
import { CoachingFindingsList } from "@/components/analytics/CoachingFindingsList";
import {
  Heatmap18Zone,
  type HeatmapOverlayMode,
} from "@/components/analytics/Heatmap18Zone";
import { MentalityBar } from "@/components/instructions/MentalityBar";
import { PlayerInstructionModal } from "@/components/instructions/PlayerInstructionModal";
import { TeamInstructionPanel } from "@/components/instructions/TeamInstructionPanel";
import { DualPhasePitch } from "@/components/pitch/DualPhasePitch";
import { SplitViewPitch } from "@/components/pitch/SplitViewPitch";
import { sanitizeFileName, triggerBrowserDownload } from "@/lib/local-folder-sync";
import { exportDualPhasePngCard } from "@/lib/svg-card-exporter";
import { exportFmfInWorker, parseFmfInWorker } from "@/lib/worker-client";
import { useFolderSyncStore } from "@/stores/useFolderSyncStore";
import { useTacticStore } from "@/stores/useTacticStore";

export default function TacticalBoardWorkspacePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    tactic,
    viewMode,
    showTransitionVectors,
    selectedSlotIndex,
    setViewMode,
    setShowTransitionVectors,
    setTitle,
    setPlayerModalOpen,
    applyPresetStyle,
    applyDualShape,
    loadTactic,
  } = useTacticStore();

  const undo = useStore(useTacticStore.temporal, (s) => s.undo);
  const redo = useStore(useTacticStore.temporal, (s) => s.redo);
  const pastCount = useStore(useTacticStore.temporal, (s) => s.pastStates.length);
  const futureCount = useStore(useTacticStore.temporal, (s) => s.futureStates.length);

  const {
    status: folderStatus,
    tacticFiles,
    saveTacticFmfDirect,
    readTacticFileBytes,
    refreshTacticFiles,
  } = useFolderSyncStore();

  const [heatmapMode, setHeatmapMode] = useState<HeatmapOverlayMode>("off");
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"instructions" | "analytics">("analytics");
  const [statusBanner, setStatusBanner] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const stylesCatalog = useMemo(
    () => getTacticalStyles(tactic.patchVersion),
    [tactic.patchVersion],
  );
  const pitchCatalog = useMemo(
    () => getPitchCatalog(tactic.patchVersion),
    [tactic.patchVersion],
  );
  const roleNameMap = useMemo(
    () => new Map(pitchCatalog.Roles.map((r) => [r.Id, r.Name])),
    [pitchCatalog.Roles],
  );

  // Real-time 18-zone Heatmap & 6-pillar Tactical Balance evaluation
  const balanceReport = useMemo(() => computeTacticalBalance(tactic), [tactic]);

  const notify = useCallback((tone: "ok" | "error", text: string) => {
    setStatusBanner({ tone, text });
  }, []);

  useEffect(() => {
    const tryHydrateFromHash = () => {
      if (typeof window === "undefined") return;
      const hash = window.location.hash;
      if (!hash.includes("t=")) return;
      try {
        const decoded = decodeTacticFromUrlHash(hash);
        loadTactic(decoded);
        notify("ok", `Loaded shared tactic "${decoded.title}" from URL`);
      } catch (err) {
        notify(
          "error",
          err instanceof Error ? err.message : "Failed to decode shared tactic link",
        );
      }
    };
    tryHydrateFromHash();
    window.addEventListener("hashchange", tryHydrateFromHash);
    return () => window.removeEventListener("hashchange", tryHydrateFromHash);
  }, [loadTactic, notify]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        e.key.toLowerCase() === "y" ||
        (e.key.toLowerCase() === "z" && e.shiftKey)
      ) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, undo]);

  const handleImportBytes = useCallback(
    async (fileName: string, bytes: Uint8Array) => {
      setBusyAction("import");
      try {
        if (fileName.toLowerCase().endsWith(".json")) {
          const text = new TextDecoder().decode(bytes);
          const imported = parseFm27Json(text);
          loadTactic(imported);
          notify("ok", `Imported "${imported.title}" from ${fileName}`);
        } else {
          const imported = await parseFmfInWorker(bytes, tactic.patchVersion);
          loadTactic(imported);
          notify("ok", `Imported binary tactic "${imported.title}" (${bytes.byteLength} B)`);
        }
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Failed to import tactic file");
      } finally {
        setBusyAction(null);
      }
    },
    [loadTactic, notify, tactic.patchVersion],
  );

  const handleDownloadFmf = async () => {
    setBusyAction("export-fmf");
    try {
      const bytes = await exportFmfInWorker(tactic);
      triggerBrowserDownload(sanitizeFileName(tactic.title, ".fmf"), bytes);
      notify("ok", `Exported ${sanitizeFileName(tactic.title, ".fmf")} (${bytes.byteLength} B)`);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Failed to export .fmf");
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveDirectToFm27Folder = async () => {
    setBusyAction("save-folder");
    try {
      const bytes = await exportFmfInWorker(tactic);
      const savedPath = await saveTacticFmfDirect(tactic.title, bytes);
      notify("ok", `Saved directly to FM27 folder: ${savedPath}`);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Direct folder save failed");
    } finally {
      setBusyAction(null);
    }
  };

  const handleExportJson = () => {
    try {
      const jsonText = exportFm27Json(tactic);
      triggerBrowserDownload(
        sanitizeFileName(tactic.title, ".fm27.json"),
        jsonText,
        "application/json",
      );
      notify("ok", `Exported ${sanitizeFileName(tactic.title, ".fm27.json")}`);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "JSON export failed");
    }
  };

  const handleCopyShareLink = async () => {
    try {
      const hash = encodeTacticToUrlHash(tactic);
      window.history.replaceState(null, "", hash);
      const fullUrl = `${window.location.origin}${window.location.pathname}${hash}`;
      await navigator.clipboard.writeText(fullUrl);
      notify("ok", "Compressed #t=... Share URL copied to clipboard");
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Could not copy Share URL");
    }
  };

  const handleExportPngCard = async () => {
    setBusyAction("png");
    try {
      await exportDualPhasePngCard(tactic);
      notify("ok", "Downloaded 1600×900 Dual-Phase PNG tactical card");
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "PNG export failed");
    } finally {
      setBusyAction(null);
    }
  };

  const selectedSlot =
    selectedSlotIndex !== null ? tactic.slots[selectedSlotIndex] ?? null : null;

  const buildOverlayForBoard = (boardPhase: "ip" | "oop") => {
    if (heatmapMode === "off") return undefined;
    if (heatmapMode === "transition") {
      return <Heatmap18Zone cells={balanceReport.heatmap.transition} mode="transition" />;
    }
    if (viewMode === "split") {
      const cells =
        boardPhase === "ip"
          ? balanceReport.heatmap.inPossession
          : balanceReport.heatmap.outOfPossession;
      return <Heatmap18Zone cells={cells} mode={boardPhase} />;
    }
    const cells =
      heatmapMode === "ip"
        ? balanceReport.heatmap.inPossession
        : balanceReport.heatmap.outOfPossession;
    return <Heatmap18Zone cells={cells} mode={heatmapMode} />;
  };

  return (
    <main
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingFile(false);
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        void file.arrayBuffer().then((ab) => handleImportBytes(file.name, new Uint8Array(ab)));
      }}
      className="flex flex-col gap-4 relative"
    >
      {isDraggingFile && (
        <div className="fixed inset-4 z-50 rounded-2xl bg-emerald-950/80 border-2 border-dashed border-emerald-400 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-lg font-extrabold text-emerald-200">
              Drop .fmf or .fm27.json to Load onto Tactical Board
            </p>
            <p className="text-xs text-emerald-300/80 mt-1">
              Supports plain fmf., encrypted afe. (AES-128-CTR), raw .tac, and .fm27.json
            </p>
          </div>
        </div>
      )}

      {/* Top Command Bar */}
      <section className="tactical-surface rounded-2xl p-4 flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-[260px] flex-1">
            <div>
              <h1 className="sr-only">FM27 Dual-Phase Tactical Board</h1>
              <input
                id="tactic-title-input"
                type="text"
                aria-label="Tactic Title"
                value={tactic.title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-lg sm:text-xl font-extrabold bg-transparent border-b border-transparent hover:border-white/15 focus:border-cyan-400 focus:outline-none text-slate-50 w-full max-w-md"
              />
              <div className="flex items-center gap-2 mt-1 text-xs font-mono-metric">
                <span className="text-cyan-400 font-bold">IP {tactic.inFormation}</span>
                <span className="text-slate-500">→</span>
                <span className="text-amber-400 font-bold">OOP {tactic.outFormation}</span>
                <span className="text-slate-600">|</span>
                <span className="text-emerald-400 font-bold">
                  Balance {balanceReport.overallScore.toFixed(0)}/100
                </span>
              </div>
            </div>
          </div>

          {/* Undo/Redo + Import/Export + AI Advisor */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg bg-[#0B0F19] border border-white/10 p-0.5">
              <button
                id="undo-tactic-btn"
                type="button"
                disabled={pastCount === 0}
                onClick={() => undo()}
                title="Undo (Ctrl+Z)"
                className="px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-300 disabled:text-slate-600 hover:bg-slate-800/80 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
              >
                Undo ({pastCount})
              </button>
              <button
                id="redo-tactic-btn"
                type="button"
                disabled={futureCount === 0}
                onClick={() => redo()}
                title="Redo (Ctrl+Y)"
                className="px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-300 disabled:text-slate-600 hover:bg-slate-800/80 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
              >
                Redo ({futureCount})
              </button>
            </div>

            <input
              ref={fileInputRef}
              id="import-tactic-file-input"
              type="file"
              accept=".fmf,.tac,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void f.arrayBuffer().then((ab) => handleImportBytes(f.name, new Uint8Array(ab)));
                e.currentTarget.value = "";
              }}
            />

            <button
              id="import-fmf-btn"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0B0F19] hover:bg-slate-800 text-slate-200 border border-white/12 cursor-pointer"
            >
              Import .fmf
            </button>

            {folderStatus === "connected" && (
              <button
                id="save-direct-folder-btn"
                type="button"
                disabled={busyAction !== null}
                onClick={() => void handleSaveDirectToFm27Folder()}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition cursor-pointer"
              >
                Save to FM27 /tactics
              </button>
            )}

            <button
              id="export-fmf-btn"
              type="button"
              disabled={busyAction !== null}
              onClick={() => void handleDownloadFmf()}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/18 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/28 transition cursor-pointer"
            >
              Export .fmf
            </button>

            <button
              id="export-json-btn"
              type="button"
              onClick={handleExportJson}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#0B0F19] hover:bg-slate-800 text-slate-300 border border-white/10 cursor-pointer"
            >
              .fm27.json
            </button>

            <button
              id="export-png-card-btn"
              type="button"
              disabled={busyAction !== null}
              onClick={() => void handleExportPngCard()}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#0B0F19] hover:bg-slate-800 text-slate-300 border border-white/10 cursor-pointer"
            >
              PNG Card
            </button>

            <button
              id="copy-share-url-btn"
              type="button"
              onClick={() => void handleCopyShareLink()}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#0B0F19] hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 cursor-pointer"
            >
              Share URL
            </button>

            <button
              id="open-ai-advisor-btn"
              type="button"
              onClick={() => setAiDrawerOpen(true)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition cursor-pointer"
            >
              AI Tactical Advisor
            </button>
          </div>
        </div>

        {/* Presets + 18-Zone Heatmap Toggle + View Mode Switcher */}
        <div className="pt-2.5 border-t border-white/8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <label htmlFor="preset-style-select" className="text-xs font-semibold text-slate-400">
                Style:
              </label>
              <select
                id="preset-style-select"
                value={tactic.styleId ?? "Balanced"}
                onChange={(e) => applyPresetStyle(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-[#0B0F19] border border-white/12 text-xs font-semibold text-slate-100 cursor-pointer"
              >
                {stylesCatalog.TacticalStyles.map((st) => (
                  <option key={st.Id} value={st.Id}>
                    {st.Name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label htmlFor="dual-shape-select" className="text-xs font-semibold text-slate-400">
                Shape:
              </label>
              <select
                id="dual-shape-select"
                defaultValue="shape-03-433-4141"
                onChange={(e) => applyDualShape(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-[#0B0F19] border border-white/12 text-xs font-semibold text-slate-100 cursor-pointer"
              >
                {stylesCatalog.StyleShapes.map((sh) => (
                  <option key={sh.Id} value={sh.Id}>
                    IP {sh.InPossessionName} → OOP {sh.OutOfPossessionName}
                    {sh.HighPress ? " (Press)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label htmlFor="heatmap-mode-select" className="text-xs font-semibold text-slate-400">
                18-Zone Heatmap:
              </label>
              <select
                id="heatmap-mode-select"
                value={heatmapMode}
                onChange={(e) => setHeatmapMode(e.target.value as HeatmapOverlayMode)}
                className="px-2.5 py-1.5 rounded-lg bg-[#0B0F19] border border-white/12 text-xs font-semibold text-emerald-300 cursor-pointer"
              >
                <option value="off">Off</option>
                <option value="ip">Phase Density (IP / OOP)</option>
                <option value="oop">Out-of-Possession Block</option>
                <option value="transition">Transition Exposure</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none mr-1">
              <input
                id="toggle-transition-vectors"
                type="checkbox"
                checked={showTransitionVectors}
                onChange={(e) => setShowTransitionVectors(e.target.checked)}
                className="accent-emerald-400 rounded cursor-pointer"
              />
              <span>Vectors</span>
            </label>

            <div className="flex items-center p-1 rounded-lg bg-[#0B0F19] border border-white/10">
              {(
                [
                  ["split", "Split View"],
                  ["ip", "In-Possession"],
                  ["oop", "Out-of-Possession"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  id={`view-mode-${mode}`}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                    viewMode === mode
                      ? mode === "ip"
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        : mode === "oop"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {statusBanner && (
          <div
            role="status"
            className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center justify-between ${
              statusBanner.tone === "ok"
                ? "bg-emerald-500/12 border border-emerald-500/30 text-emerald-200"
                : "bg-rose-500/15 border border-rose-500/35 text-rose-200"
            }`}
          >
            <span>{statusBanner.text}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-slate-400 hover:text-slate-100 ml-3 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}
      </section>

      {/* Main Tactical Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 flex flex-col gap-3">
          {viewMode === "split" ? (
            <SplitViewPitch
              ipOverlayNode={buildOverlayForBoard("ip")}
              oopOverlayNode={buildOverlayForBoard("oop")}
            />
          ) : (
            <div className="max-w-[640px] w-full mx-auto">
              <DualPhasePitch
                phase={viewMode}
                overlayNode={buildOverlayForBoard(viewMode)}
              />
            </div>
          )}

          <p className="text-xs text-slate-400 px-1">
            Drag tokens across the 24 official snap points (or click a dashed marker while a player
            is selected). Double-click any player token to edit Role, Duty, and 43-bit Player
            Instructions.
          </p>
        </div>

        {/* Right Inspector: Selected Slot + Analytics / Instructions Tabs */}
        <aside className="lg:col-span-4 flex flex-col gap-3.5">
          {selectedSlot && (
            <section className="tactical-surface rounded-xl p-3.5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-800 font-mono-metric text-xs font-bold text-slate-200">
                    #{selectedSlot.slotIndex + 1}
                  </span>
                  <span className="text-sm font-bold text-slate-100">
                    {selectedSlot.playerName ?? `Player #${selectedSlot.slotIndex + 1}`}
                  </span>
                </div>
                <button
                  id="open-pi-modal-btn"
                  type="button"
                  onClick={() => setPlayerModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-500/18 text-cyan-300 border border-cyan-500/35 hover:bg-cyan-500/28 transition cursor-pointer"
                >
                  Edit Role &amp; PI
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg p-2.5 bg-[#0B0F19] border border-cyan-500/20">
                  <div className="text-[10px] font-bold uppercase text-cyan-400">
                    IP · {selectedSlot.inPossession.positionId} ({selectedSlot.inPossession.duty})
                  </div>
                  <div className="font-semibold text-slate-200 mt-0.5 truncate">
                    {roleNameMap.get(selectedSlot.inPossession.roleId) ??
                      selectedSlot.inPossession.roleId}
                  </div>
                </div>
                <div className="rounded-lg p-2.5 bg-[#0B0F19] border border-amber-500/20">
                  <div className="text-[10px] font-bold uppercase text-amber-400">
                    OOP · {selectedSlot.outOfPossession.positionId}
                  </div>
                  <div className="font-semibold text-slate-200 mt-0.5 truncate">
                    {roleNameMap.get(selectedSlot.outOfPossession.roleId) ??
                      selectedSlot.outOfPossession.roleId}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Inspector Switcher */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#111827] border border-white/10">
            <button
              id="inspector-tab-analytics"
              type="button"
              onClick={() => setInspectorTab("analytics")}
              className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                inspectorTab === "analytics"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/35"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Balance &amp; Gaps ({balanceReport.alerts.length})
            </button>
            <button
              id="inspector-tab-instructions"
              type="button"
              onClick={() => setInspectorTab("instructions")}
              className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                inspectorTab === "instructions"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/35"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Mentality &amp; 29 TI
            </button>
          </div>

          {inspectorTab === "analytics" ? (
            <>
              <BalanceRadar report={balanceReport} />
              <CoachingFindingsList alerts={balanceReport.alerts} />
            </>
          ) : (
            <>
              <MentalityBar />
              <TeamInstructionPanel />
            </>
          )}

          {folderStatus === "connected" && (
            <section className="tactical-surface rounded-xl p-3.5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Local /tactics Folder ({tacticFiles.length})
                </span>
                <button
                  id="refresh-local-tactics-btn"
                  type="button"
                  onClick={() => void refreshTacticFiles()}
                  className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Refresh
                </button>
              </div>

              {tacticFiles.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No .fmf files in /tactics yet. Click &ldquo;Save to FM27 /tactics&rdquo; above.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                  {tacticFiles.map((f) => (
                    <button
                      key={f.name}
                      type="button"
                      onClick={async () => {
                        try {
                          const bytes = await readTacticFileBytes(f.name);
                          await handleImportBytes(f.name, bytes);
                        } catch (err) {
                          notify(
                            "error",
                            err instanceof Error ? err.message : "Failed to read local file",
                          );
                        }
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#0B0F19] hover:bg-slate-900 border border-white/8 text-left transition cursor-pointer"
                    >
                      <span className="text-xs font-medium text-slate-200 truncate">
                        {f.name}
                      </span>
                      <span className="text-[11px] font-mono-metric text-slate-500 ml-2 shrink-0">
                        {(f.size / 1024).toFixed(1)} KB
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </aside>
      </div>

      <PlayerInstructionModal />
      <AiAdvisorDrawer open={aiDrawerOpen} onClose={() => setAiDrawerOpen(false)} />
    </main>
  );
}
