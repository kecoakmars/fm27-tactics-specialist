"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { exportFmf } from "@fm27/fm-codec";
import { computeTacticalBalance } from "@fm27/fm-engine";
import { TacticalIndicatorsBar } from "@/components/analytics/TacticalIndicatorsBar";
import { UnifiedReportDashboard } from "@/components/analytics/UnifiedReportDashboard";
import { TacticRecommendationPanel } from "@/components/tactics/TacticRecommendationPanel";
import { sanitizeFileName, triggerBrowserDownload } from "@/lib/local-folder-sync";
import { useLocale } from "@/stores/useLocaleStore";
import { useTacticStore } from "@/stores/useTacticStore";

export default function TacticalSummaryPage() {
  const { t } = useLocale();
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const tactic = useTacticStore((s) => s.tactic);
  const clubPlayers = useTacticStore((s) => s.clubPlayers);
  const unifiedReport = useTacticStore((s) => s.unifiedReport);
  const unifiedReportMinimized = useTacticStore((s) => s.unifiedReportMinimized);
  const refreshUnifiedReport = useTacticStore((s) => s.refreshUnifiedReport);
  const setUnifiedReportMinimized = useTacticStore((s) => s.setUnifiedReportMinimized);

  useEffect(() => {
    if (!unifiedReport) {
      refreshUnifiedReport();
    }
  }, [refreshUnifiedReport, unifiedReport]);

  useEffect(() => {
    if (unifiedReportMinimized) {
      setUnifiedReportMinimized(false);
    }
  }, [setUnifiedReportMinimized, unifiedReportMinimized]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const notify = (tone: "ok" | "error", text: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ tone, text });
    toastTimerRef.current = setTimeout(
      () => setToast(null),
      tone === "error" ? 9000 : 5000,
    );
  };

  const balanceReport = useMemo(
    () => computeTacticalBalance(tactic, clubPlayers.length >= 11 ? clubPlayers : undefined),
    [clubPlayers, tactic],
  );

  const handleDownloadFmf = () => {
    try {
      const bytes = exportFmf(tactic);
      const fileName = sanitizeFileName(tactic.title, ".fmf");
      triggerBrowserDownload(fileName, bytes);
      notify("ok", t(`Taktik ${fileName} berhasil diunduh`, `Downloaded ${fileName}`));
    } catch (err) {
      notify(
        "error",
        err instanceof Error
          ? err.message
          : t("Gagal mengunduh taktik .fmf", "Failed to download .fmf"),
      );
    }
  };

  return (
    <main className="flex flex-col gap-4 relative">
      {toast && (
        <div
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

      {/* Header */}
      <section className="tactical-surface rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-50">
            {t("Ringkasan Taktik & Rekomendasi", "Tactical Summary & Recommendations")}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs font-mono-metric">
            <span className="text-slate-200 font-semibold">{tactic.title}</span>
            <span className="text-slate-600">·</span>
            <span className="text-cyan-400 font-bold">IP {tactic.inFormation}</span>
            <span className="text-slate-500">→</span>
            <span className="text-amber-400 font-bold">OOP {tactic.outFormation}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadFmf}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition cursor-pointer"
          >
            {t("Unduh Taktik (.fmf)", "Download Tactic (.fmf)")}
          </button>
          <Link
            href="/"
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500/18 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/28 transition"
          >
            {t("Buka Papan Taktik →", "Open Tactics Board →")}
          </Link>
        </div>
      </section>

      {/* 3 Live Indicators: Intensity, Complexity, Effectiveness (Familiarity) */}
      <TacticalIndicatorsBar
        tactic={tactic}
        squadPlayers={clubPlayers}
        balanceReport={balanceReport}
      />

      {/* Tactic Recommendation & Finder */}
      <TacticRecommendationPanel
        collapsible={false}
        defaultOpen={true}
        navigateToBoardOnApply={true}
        onNotify={notify}
      />

      {/* Full Unified Report Summary */}
      {unifiedReport && (
        <UnifiedReportDashboard report={unifiedReport} onNotify={notify} />
      )}
    </main>
  );
}
