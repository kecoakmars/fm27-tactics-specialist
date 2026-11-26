"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import {
  decodeTacticFromUrlHash,
  encodeTacticToUrlHash,
  exportFmf,
} from "@fm27/fm-codec";
import { getPitchCatalog, getTacticalStyles } from "@fm27/fm-data";
import { computeTacticalBalance } from "@fm27/fm-engine";
import { BalanceRadar } from "@/components/analytics/BalanceRadar";
import { CoachingFindingsList } from "@/components/analytics/CoachingFindingsList";
import {
  Heatmap18Zone,
  PitchColorLegend,
  type HeatmapOverlayMode,
} from "@/components/analytics/Heatmap18Zone";
import { UnifiedReportDashboard } from "@/components/analytics/UnifiedReportDashboard";
import { MentalityBar } from "@/components/instructions/MentalityBar";
import { PlayerInstructionModal } from "@/components/instructions/PlayerInstructionModal";
import { TeamInstructionPanel } from "@/components/instructions/TeamInstructionPanel";
import { DualPhasePitch } from "@/components/pitch/DualPhasePitch";
import { SplitViewPitch } from "@/components/pitch/SplitViewPitch";
import {
  importAnySupportedFile,
  importFmSaveArrayBuffer,
  importTacticBytes,
} from "@/lib/file-importer";
import { sanitizeFileName, triggerBrowserDownload } from "@/lib/local-folder-sync";
import { exportDualPhasePngCard } from "@/lib/svg-card-exporter";
import { useFolderSyncStore } from "@/stores/useFolderSyncStore";
import { useLocale } from "@/stores/useLocaleStore";
import { useTacticStore } from "@/stores/useTacticStore";

export default function TacticalBoardWorkspacePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useLocale();

  const {
    tactic,
    unifiedReport,
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
    clubPlayers,
    refreshUnifiedReport,
  } = useTacticStore();

  const undo = useStore(useTacticStore.temporal, (s) => s.undo);
  const redo = useStore(useTacticStore.temporal, (s) => s.redo);
  const pastCount = useStore(useTacticStore.temporal, (s) => s.pastStates.length);
  const futureCount = useStore(useTacticStore.temporal, (s) => s.futureStates.length);

  const {
    status: folderStatus,
    tacticFiles,
    saveGameFiles,
    saveTacticFmfDirect,
    readTacticFileBytes,
    readSaveGameArrayBuffer,
    refreshTacticFiles,
  } = useFolderSyncStore();

  const [heatmapMode, setHeatmapMode] = useState<HeatmapOverlayMode>("off");
  const [inspectorTab, setInspectorTab] = useState<"instructions" | "analytics">("analytics");
  const [toast, setToast] = useState<{
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

  const balanceReport = useMemo(
    () => computeTacticalBalance(tactic, clubPlayers.length >= 11 ? clubPlayers : undefined),
    [clubPlayers, tactic],
  );

  const activeShapeId = useMemo(() => {
    const isHighPress = (tactic.teamInstructions.LineOfEngagement ?? 62) === 61;
    const exactMatch = stylesCatalog.StyleShapes.find(
      (sh) =>
        sh.InPossessionName === tactic.inFormation &&
        sh.OutOfPossessionName === tactic.outFormation &&
        sh.HighPress === isHighPress,
    );
    if (exactMatch) return exactMatch.Id;
    const formationMatch = stylesCatalog.StyleShapes.find(
      (sh) =>
        sh.InPossessionName === tactic.inFormation &&
        sh.OutOfPossessionName === tactic.outFormation,
    );
    return formationMatch?.Id ?? "custom";
  }, [
    stylesCatalog.StyleShapes,
    tactic.inFormation,
    tactic.outFormation,
    tactic.teamInstructions.LineOfEngagement,
  ]);

  const notify = useCallback((tone: "ok" | "error", text: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ tone, text });
    toastTimerRef.current = setTimeout(
      () => setToast(null),
      tone === "error" ? 9000 : 5000,
    );
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const tryHydrateFromHash = () => {
      if (typeof window === "undefined") return;
      const hash = window.location.hash;
      if (!hash.includes("t=")) return;
      try {
        const decoded = decodeTacticFromUrlHash(hash);
        loadTactic(decoded, { fromUserTactic: true });
        notify(
          "ok",
          t(
            `Taktik "${decoded.title}" dimuat dari tautan`,
            `Loaded shared tactic "${decoded.title}"`,
          ),
        );
      } catch (err) {
        notify(
          "error",
          err instanceof Error
            ? err.message
            : t("Tautan taktik tidak valid", "Invalid shared tactic link"),
        );
      }
    };
    tryHydrateFromHash();
    window.addEventListener("hashchange", tryHydrateFromHash);
    return () => window.removeEventListener("hashchange", tryHydrateFromHash);
  }, [loadTactic, notify, t]);

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

  const handleImportFmSaveArrayBuffer = useCallback(
    async (fileName: string, arrayBuffer: ArrayBuffer) => {
      setBusyAction("import-fm-save");
      try {
        const outcome = await importFmSaveArrayBuffer(fileName, arrayBuffer);
        if (outcome.cancelled) {
          notify("ok", t(`Pembacaan ${fileName} dibatalkan.`, `Cancelled ${fileName}.`));
          return;
        }
        const { parsed, selectedClub, report } = outcome;
        if (selectedClub && report) {
          notify(
            "ok",
            t(
              `${selectedClub.name} dimuat · Taktik: ${report.tacticAdvice.recommendedTactic.title}`,
              `${selectedClub.name} loaded · Tactic: ${report.tacticAdvice.recommendedTactic.title}`,
            ),
          );
        } else {
          notify(
            "ok",
            t(
              `Save "${parsed.saveName}" berhasil dibuka. Silakan pilih klub Anda.`,
              `Save "${parsed.saveName}" opened. Please select your club.`,
            ),
          );
        }
      } catch (err) {
        notify(
          "error",
          err instanceof Error
            ? err.message
            : t(`Gagal membuka ${fileName}`, `Could not open ${fileName}`),
        );
      } finally {
        setBusyAction(null);
      }
    },
    [notify, t],
  );

  const handleImportBytes = useCallback(
    async (fileName: string, bytes: Uint8Array) => {
      setBusyAction("import");
      try {
        const { tactic: imported } = await importTacticBytes(fileName, bytes);
        notify(
          "ok",
          t(
            `Taktik "${imported.title}" (${imported.inFormation} → ${imported.outFormation}) dimuat`,
            `Loaded "${imported.title}" (${imported.inFormation} → ${imported.outFormation})`,
          ),
        );
      } catch (err) {
        notify(
          "error",
          err instanceof Error
            ? err.message
            : t(`Gagal membuka ${fileName}`, `Could not open ${fileName}`),
        );
      } finally {
        setBusyAction(null);
      }
    },
    [notify, t],
  );

  const handleImportPickedFile = useCallback(
    async (file: File) => {
      setBusyAction("import");
      try {
        const summary = await importAnySupportedFile(file);
        notify("ok", summary.message);
      } catch (err) {
        notify(
          "error",
          err instanceof Error
            ? err.message
            : t(`Gagal membuka ${file.name}`, `Could not open ${file.name}`),
        );
      } finally {
        setBusyAction(null);
      }
    },
    [notify, t],
  );

  const handleDownloadFmf = () => {
    setBusyAction("export-fmf");
    try {
      const bytes = exportFmf(tactic);
      const fileName = sanitizeFileName(tactic.title, ".fmf");
      triggerBrowserDownload(fileName, bytes);
      notify(
        "ok",
        t(`Taktik ${fileName} berhasil diunduh`, `Downloaded ${fileName}`),
      );
    } catch (err) {
      notify(
        "error",
        err instanceof Error
          ? err.message
          : t("Gagal mengunduh taktik .fmf", "Failed to download .fmf"),
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveDirectToFm27Folder = async () => {
    setBusyAction("save-folder");
    try {
      const bytes = exportFmf(tactic);
      const fileName = sanitizeFileName(tactic.title, ".fmf");
      if (folderStatus !== "connected") {
        triggerBrowserDownload(fileName, bytes);
        notify("ok", t(`Mengunduh ${fileName}`, `Downloading ${fileName}`));
        return;
      }
      try {
        const savedPath = await saveTacticFmfDirect(tactic.title, bytes);
        notify(
          "ok",
          t(
            `Tersimpan ke folder FM27: ${savedPath}`,
            `Saved to FM27 folder: ${savedPath}`,
          ),
        );
      } catch {
        triggerBrowserDownload(fileName, bytes);
        notify(
          "ok",
          t(`${fileName} diunduh melalui browser`, `Downloaded ${fileName}`),
        );
      }
    } catch (err) {
      notify(
        "error",
        err instanceof Error
          ? err.message
          : t("Gagal menyimpan taktik .fmf", "Failed to save .fmf"),
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleCopyShareLink = async () => {
    try {
      const hash = encodeTacticToUrlHash(tactic);
      window.history.replaceState(null, "", hash);
      const fullUrl = `${window.location.origin}${window.location.pathname}${hash}`;
      await navigator.clipboard.writeText(fullUrl);
      notify(
        "ok",
        t("Tautan taktik disalin", "Tactic link copied to clipboard"),
      );
    } catch {
      notify("error", t("Gagal menyalin tautan", "Could not copy link"));
    }
  };

  const handleExportPngCard = async () => {
    setBusyAction("png");
    try {
      await exportDualPhasePngCard(tactic);
      notify(
        "ok",
        t("Gambar taktik berhasil diunduh", "Tactical image downloaded"),
      );
    } catch {
      notify("error", t("Gagal menyimpan gambar", "Image download failed"));
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
        void handleImportPickedFile(file);
      }}
      className="flex flex-col gap-4 relative"
    >
      {/* Floating Toast Notification */}
      {toast && (
        <div
          id="fmf-toast-alert"
          role="alert"
          className={`fixed bottom-5 right-5 z-50 max-w-lg px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-start justify-between gap-3 backdrop-blur-md ${
            toast.tone === "ok"
              ? "bg-emerald-950/95 border border-emerald-400/50 text-emerald-100"
              : "bg-rose-950/95 border border-rose-400/60 text-rose-100"
          }`}
        >
          <span className="leading-relaxed break-words">{toast.text}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-300 hover:text-white font-bold cursor-pointer shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {isDraggingFile && (
        <div className="fixed inset-4 z-50 rounded-2xl bg-emerald-950/85 border-2 border-dashed border-emerald-400 flex items-center justify-center pointer-events-none">
          <p className="text-lg font-extrabold text-emerald-200">
            {t(
              "Lepaskan file Save (.fm) atau Taktik (.fmf)",
              "Drop Career Save (.fm) or Tactic (.fmf)",
            )}
          </p>
        </div>
      )}

      {/* Top Command Bar */}
      <section className="tactical-surface rounded-2xl p-4 flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-[260px] flex-1">
            <div>
              <h1 className="sr-only">FM27 Tactical Board</h1>
              <input
                id="tactic-title-input"
                type="text"
                aria-label={t("Nama Taktik", "Tactic Name")}
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
                  {t("Skor", "Score")} {balanceReport.overallScore.toFixed(0)}/100
                </span>
              </div>
            </div>
          </div>

          {/* Primary Actions */}
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
                Undo
              </button>
              <button
                id="redo-tactic-btn"
                type="button"
                disabled={futureCount === 0}
                onClick={() => redo()}
                title="Redo (Ctrl+Y)"
                className="px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-300 disabled:text-slate-600 hover:bg-slate-800/80 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
              >
                Redo
              </button>
            </div>

            <input
              ref={fileInputRef}
              id="import-tactic-file-input"
              type="file"
              accept=".fmf,.fm,.tac"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                void handleImportPickedFile(f);
              }}
            />

            <button
              id="import-fmf-btn"
              type="button"
              disabled={busyAction !== null}
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0B0F19] hover:bg-slate-800 text-slate-200 border border-white/12 cursor-pointer disabled:opacity-50"
            >
              {t("Muat .fm / .fmf", "Load .fm / .fmf")}
            </button>

            {folderStatus === "connected" && (
              <button
                id="save-direct-folder-btn"
                type="button"
                disabled={busyAction !== null}
                onClick={() => void handleSaveDirectToFm27Folder()}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition cursor-pointer"
              >
                {t("Simpan ke FM27", "Save to FM27")}
              </button>
            )}

            <button
              id="export-fmf-btn"
              type="button"
              disabled={busyAction !== null}
              onClick={handleDownloadFmf}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition cursor-pointer disabled:opacity-50"
            >
              {t("Unduh .fmf", "Download .fmf")}
            </button>

            <button
              id="export-png-card-btn"
              type="button"
              disabled={busyAction !== null}
              onClick={() => void handleExportPngCard()}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#0B0F19] hover:bg-slate-800 text-slate-300 border border-white/10 cursor-pointer"
            >
              {t("Gambar PNG", "PNG Image")}
            </button>

            <button
              id="copy-share-url-btn"
              type="button"
              onClick={() => void handleCopyShareLink()}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#0B0F19] hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 cursor-pointer"
            >
              {t("Bagikan", "Share")}
            </button>

            {!unifiedReport && (
              <button
                id="open-unified-report-btn"
                type="button"
                onClick={() => refreshUnifiedReport()}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition cursor-pointer"
              >
                {t("Ringkasan Tim", "Team Summary")}
              </button>
            )}
          </div>
        </div>

        {/* Style, Formation, Pitch Zones & View Mode */}
        <div className="pt-2.5 border-t border-white/8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <label htmlFor="preset-style-select" className="text-xs font-semibold text-slate-400">
                {t("Gaya:", "Style:")}
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
                {t("Formasi:", "Shape:")}
              </label>
              <select
                id="dual-shape-select"
                value={activeShapeId}
                onChange={(e) => applyDualShape(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-[#0B0F19] border border-white/12 text-xs font-semibold text-slate-100 cursor-pointer"
              >
                {activeShapeId === "custom" && (
                  <option value="custom">
                    IP {tactic.inFormation} → OOP {tactic.outFormation}
                  </option>
                )}
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
                {t("Area:", "Zones:")}
              </label>
              <select
                id="heatmap-mode-select"
                value={heatmapMode}
                onChange={(e) => setHeatmapMode(e.target.value as HeatmapOverlayMode)}
                className="px-2.5 py-1.5 rounded-lg bg-[#0B0F19] border border-white/12 text-xs font-semibold text-emerald-300 cursor-pointer"
              >
                <option value="off">{t("Mati", "Off")}</option>
                <option value="ip">{t("Saat Menyerang", "In Possession")}</option>
                <option value="oop">{t("Saat Bertahan", "Out of Possession")}</option>
                <option value="transition">{t("Transisi", "Transition")}</option>
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
              <span>{t("Arah Gerak", "Movement")}</span>
            </label>

            <div className="flex items-center p-1 rounded-lg bg-[#0B0F19] border border-white/10">
              {(
                [
                  ["split", t("2 Fase", "Split View")],
                  ["ip", t("Menyerang (IP)", "In Possession")],
                  ["oop", t("Bertahan (OOP)", "Out of Possession")],
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
      </section>

      {/* Team Summary Dashboard */}
      {unifiedReport && (
        <UnifiedReportDashboard
          report={unifiedReport}
          onNotify={notify}
          onRequestLoadFm={() => fileInputRef.current?.click()}
        />
      )}

      {/* Main Tactical Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 flex flex-col gap-2.5">
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
          <PitchColorLegend heatmapMode={heatmapMode} viewMode={viewMode} />
        </div>

        {/* Right Inspector */}
        <aside className="lg:col-span-4 flex flex-col gap-3.5">
          {selectedSlot && (
            <section className="tactical-surface rounded-xl p-3.5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-800 font-mono-metric text-xs font-bold text-slate-200">
                    #{selectedSlot.slotIndex + 1}
                  </span>
                  <span className="text-sm font-bold text-slate-100">
                    {selectedSlot.playerName ??
                      `${t("Pemain", "Player")} #${selectedSlot.slotIndex + 1}`}
                  </span>
                </div>
                <button
                  id="open-pi-modal-btn"
                  type="button"
                  onClick={() => setPlayerModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-500/18 text-cyan-300 border border-cyan-500/35 hover:bg-cyan-500/28 transition cursor-pointer"
                >
                  {t("Ubah Peran", "Edit Role")}
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
              {t("Keseimbangan", "Balance")} ({balanceReport.alerts.length})
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
              {t("Instruksi Tim", "Team Instructions")}
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
                  FM27 /tactics ({tacticFiles.length}) &amp; /games ({saveGameFiles.length})
                </span>
                <button
                  id="refresh-local-tactics-btn"
                  type="button"
                  onClick={() => void refreshTacticFiles()}
                  className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {t("Segarkan", "Refresh")}
                </button>
              </div>

              {saveGameFiles.length > 0 && (
                <div className="flex flex-col gap-1.5 pb-2 border-b border-white/8">
                  <span className="text-[11px] font-semibold text-cyan-300">
                    {t("Save Karier (/games):", "Career Saves (/games):")}
                  </span>
                  <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                    {saveGameFiles.map((sf) => (
                      <button
                        key={sf.name}
                        type="button"
                        disabled={busyAction !== null}
                        onClick={async () => {
                          try {
                            const ab = await readSaveGameArrayBuffer(sf.name);
                            await handleImportFmSaveArrayBuffer(sf.name, ab);
                          } catch (err) {
                            notify(
                              "error",
                              err instanceof Error
                                ? err.message
                                : t("Gagal membuka file save", "Could not open save file"),
                            );
                          }
                        }}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-cyan-950/30 hover:bg-cyan-950/50 border border-cyan-500/25 text-left transition cursor-pointer disabled:opacity-50"
                      >
                        <span className="text-xs font-semibold text-cyan-200 truncate">
                          {sf.name}
                        </span>
                        <span className="text-[11px] font-mono-metric text-cyan-400 ml-2 shrink-0">
                          {(sf.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tacticFiles.length === 0 ? (
                <p className="text-xs text-slate-400">
                  {t(
                    "Belum ada taktik .fmf di folder /tactics.",
                    "No .fmf tactics found in /tactics yet.",
                  )}
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
                            err instanceof Error
                              ? err.message
                              : t("Gagal membaca file taktik", "Failed to read tactic file"),
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
    </main>
  );
}
