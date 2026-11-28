"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { getPitchCatalog } from "@fm27/fm-data";
import type { UnifiedReport } from "@fm27/fm-engine";
import { ActiveTeamInstructionsSummary } from "@/components/instructions/ActiveTeamInstructionsSummary";
import { localizeTacticalAlert, useLocale } from "@/stores/useLocaleStore";
import { useTacticStore } from "@/stores/useTacticStore";
import { useTrainingStore } from "@/stores/useTrainingStore";

type UnifiedTabKey = "formation" | "squad" | "training" | "staff" | "wonderkids";

export interface UnifiedReportDashboardProps {
  report: UnifiedReport;
  onNotify?: (tone: "ok" | "error", text: string) => void;
  onRequestLoadFm?: () => void;
}

export function UnifiedReportDashboard({
  report,
  onNotify,
  onRequestLoadFm,
}: UnifiedReportDashboardProps) {
  const [activeTab, setActiveTab] = useState<UnifiedTabKey>("formation");
  const { locale, t } = useLocale();
  const {
    loadTactic,
    applyDualShape,
    setTeamInstruction,
    assignPlayerToSlot,
    pushTrainingPlanToStore,
    solveBestTacticForCurrentClub,
    unifiedReportMinimized,
    toggleUnifiedReportMinimized,
  } = useTacticStore();
  const shortlistUids = useTrainingStore((s) => s.shortlistUids);
  const toggleShortlistUid = useTrainingStore((s) => s.toggleShortlistUid);

  const tabs: ReadonlyArray<{ id: UnifiedTabKey; label: string }> = [
    { id: "formation", label: t("Formasi", "Formation") },
    { id: "squad", label: t("Skuad", "Squad") },
    { id: "training", label: t("Latihan", "Training") },
    { id: "staff", label: t("Staf Pelatih", "Staff") },
    { id: "wonderkids", label: "Shortlist" },
  ];

  const { tacticAdvice, squadBlueprintOrAudit, trainingPlan, staffPlan, wonderkidPlan } =
    report;

  const roleNameMap = useMemo(() => {
    const cat = getPitchCatalog(report.patchVersion);
    return new Map(cat.Roles.map((r) => [r.Id, r.Name]));
  }, [report.patchVersion]);

  return (
    <section
      id="unified-report-dashboard"
      aria-label={t("Ringkasan Tim", "Team Summary")}
      className={`tactical-surface rounded-2xl border border-emerald-500/30 flex flex-col gap-3.5 ${
        unifiedReportMinimized ? "px-4 py-2.5" : "p-4"
      }`}
    >
      {/* Clean Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-extrabold text-slate-100">
            {tacticAdvice.activeTactic.title}
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono-metric bg-[#0B0F19] text-cyan-300 border border-cyan-500/30">
            IP {tacticAdvice.activeTactic.inFormation} → OOP{" "}
            {tacticAdvice.activeTactic.outFormation}
          </span>
          {unifiedReportMinimized && (
            <span className="px-2 py-0.5 rounded text-[11px] font-mono-metric bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {t("Skor", "Score")} {tacticAdvice.balance.overallScore.toFixed(0)}/100
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {report.mode === "combined" && (
            <button
              type="button"
              onClick={async () => {
                const best = await solveBestTacticForCurrentClub();
                if (best) {
                  onNotify?.(
                    "ok",
                    t(
                      `Rekomendasi terbaik: "${best.tacticAdvice.recommendedTactic.title}"`,
                      `Best tactic found: "${best.tacticAdvice.recommendedTactic.title}"`,
                    ),
                  );
                }
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/18 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/28 cursor-pointer"
            >
              {t("Cari Taktik Terbaik", "Find Best Tactic")}
            </button>
          )}
          {(report.mode === "squad-only" ||
            (tacticAdvice.gradedPlan &&
              tacticAdvice.baselineRankingFit !== null &&
              tacticAdvice.gradedPlan.rankingFit > tacticAdvice.baselineRankingFit)) && (
            <button
              type="button"
              onClick={() => {
                loadTactic(tacticAdvice.recommendedTactic);
                onNotify?.(
                  "ok",
                  t(
                    `Diterapkan: "${tacticAdvice.recommendedTactic.title}"`,
                    `Applied: "${tacticAdvice.recommendedTactic.title}"`,
                  ),
                );
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer"
            >
              {t("Pakai Rekomendasi", "Apply Recommended")}
            </button>
          )}
          <button
            id="toggle-minimize-unified-report-btn"
            type="button"
            aria-expanded={!unifiedReportMinimized}
            onClick={toggleUnifiedReportMinimized}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              unifiedReportMinimized
                ? "bg-cyan-500/18 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/28"
                : "text-slate-300 hover:text-slate-100 bg-[#0B0F19] border-white/10"
            }`}
          >
            {unifiedReportMinimized
              ? t("Buka Ringkasan ▾", "Expand ▾")
              : t("Minimize ▴", "Minimize ▴")}
          </button>
        </div>
      </div>

      {!unifiedReportMinimized && (
        <>
          {/* 5-Tab Bar */}
      <div
        role="tablist"
        className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-[#0B0F19] border border-white/10"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`unified-tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                isActive
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: FORMATION */}
      {activeTab === "formation" && (
        <div className="flex flex-col gap-3 text-xs">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="rounded-xl p-3 bg-[#0B0F19] border border-white/8 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">
                {t("Keseimbangan Taktik", "Tactical Balance")}
              </span>
              <span className="font-mono-metric font-bold text-emerald-400">
                {tacticAdvice.balance.overallScore.toFixed(0)} / 100
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="px-2 py-1.5 rounded bg-slate-900/80 flex justify-between">
                <span className="text-slate-400">{t("Serangan", "Attack")}</span>
                <span className="font-mono-metric text-slate-100">
                  {tacticAdvice.balance.pillars.attackingThreat.toFixed(0)}
                </span>
              </div>
              <div className="px-2 py-1.5 rounded bg-slate-900/80 flex justify-between">
                <span className="text-slate-400">Build-Up</span>
                <span className="font-mono-metric text-slate-100">
                  {tacticAdvice.balance.pillars.buildUpProgression.toFixed(0)}
                </span>
              </div>
              <div className="px-2 py-1.5 rounded bg-slate-900/80 flex justify-between">
                <span className="text-slate-400">{t("Pertahanan", "Defense")}</span>
                <span className="font-mono-metric text-slate-100">
                  {tacticAdvice.balance.pillars.restDefenseStability.toFixed(0)}
                </span>
              </div>
              <div className="px-2 py-1.5 rounded bg-slate-900/80 flex justify-between">
                <span className="text-slate-400">{t("Lebar Sayap", "Width")}</span>
                <span className="font-mono-metric text-slate-100">
                  {tacticAdvice.balance.pillars.widthAndHalfSpaceCoverage.toFixed(0)}
                </span>
              </div>
              <div className="px-2 py-1.5 rounded bg-slate-900/80 flex justify-between">
                <span className="text-slate-400">Pressing</span>
                <span className="font-mono-metric text-slate-100">
                  {tacticAdvice.balance.pillars.pressingCohesion.toFixed(0)}
                </span>
              </div>
              <div className="px-2 py-1.5 rounded bg-slate-900/80 flex justify-between">
                <span className="text-slate-400">{t("Transisi", "Transition")}</span>
                <span className="font-mono-metric text-slate-100">
                  {tacticAdvice.balance.pillars.transitionResilience.toFixed(0)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-3 bg-[#0B0F19] border border-white/8 flex flex-col gap-2">
            <span className="font-bold text-slate-200">
              {t("Catatan Taktis", "Tactical Notes")} (
              {tacticAdvice.structuralAdjustments.length})
            </span>
            {tacticAdvice.structuralAdjustments.length === 0 ? (
              <p className="text-emerald-300 text-[11px]">
                {t(
                  "Struktur formasi sudah seimbang saat menyerang maupun bertahan.",
                  "Formation is balanced across both attacking and defensive phases.",
                )}
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                {tacticAdvice.structuralAdjustments.map((al) => {
                  const localized = localizeTacticalAlert(al, locale);
                  return (
                    <div
                      key={al.id}
                      className="p-2 rounded-lg bg-slate-900/80 border border-white/8 flex flex-col gap-1"
                    >
                      <div className="font-semibold text-amber-300 text-[11px]">
                        {localized.title}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {localized.detail}
                      </p>
                      {al.autoFix && (
                        <button
                          type="button"
                          onClick={() => {
                            const fixLabel = localized.autoFixText ?? al.autoFix!.text;
                            setTeamInstruction(al.autoFix!.group, al.autoFix!.toBit, true);
                            onNotify?.(
                              "ok",
                              t(
                                `Instruksi diterapkan: ${fixLabel}`,
                                `Applied instruction: ${fixLabel}`,
                              ),
                            );
                          }}
                          className="self-start mt-0.5 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 text-[10px] font-bold hover:bg-emerald-500/30 cursor-pointer"
                        >
                          {t("Terapkan", "Apply")}: {localized.autoFixText ?? al.autoFix.text}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl p-3 bg-[#0B0F19] border border-white/8 flex flex-col gap-2">
            <span className="font-bold text-slate-200">
              {t("Formasi Alternatif", "Alternative Formations")}
            </span>
            <div className="flex flex-col gap-1.5">
              {tacticAdvice.alternativeShapes.map((alt) => (
                <div
                  key={alt.shapeId}
                  className="p-2 rounded-lg bg-slate-900/80 border border-white/8 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-cyan-300 text-[11px]">
                      IP {alt.inPossessionName} → OOP {alt.outOfPossessionName}
                    </div>
                    {alt.styleName && (
                      <div className="text-[10px] text-slate-400 truncate">
                        {alt.styleName}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono-metric text-[11px] font-bold text-emerald-300">
                      {alt.compatibilityScore.toFixed(0)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (alt.tactic) {
                          loadTactic(alt.tactic);
                        } else {
                          applyDualShape(alt.shapeId);
                        }
                        onNotify?.(
                          "ok",
                          t(
                            `Formasi diubah ke IP ${alt.inPossessionName} → OOP ${alt.outOfPossessionName}`,
                            `Switched to IP ${alt.inPossessionName} → OOP ${alt.outOfPossessionName}`,
                          ),
                        );
                      }}
                      className="px-2 py-1 rounded bg-cyan-500/18 text-cyan-300 border border-cyan-500/35 text-[10px] font-bold hover:bg-cyan-500/28 cursor-pointer"
                    >
                      {t("Pakai", "Use")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>

          <ActiveTeamInstructionsSummary tactic={tacticAdvice.activeTactic} compact />
        </div>
      )}

      {/* TAB 2: SQUAD */}
      {activeTab === "squad" && (
        <div className="flex flex-col gap-3 text-xs">
          {!squadBlueprintOrAudit.hasClubSquad && (
            <div
              id="squad-honest-note"
              className="rounded-xl p-3 bg-amber-500/12 border border-amber-500/35 text-amber-200 flex flex-wrap items-center justify-between gap-2"
            >
              <span>
                {t(
                  "Muat file save karier (.fm) untuk melihat kecocokan pemain klub Anda.",
                  "Load a career save (.fm) to see how your squad fits this tactic.",
                )}
              </span>
              {onRequestLoadFm ? (
                <button
                  type="button"
                  onClick={onRequestLoadFm}
                  className="px-2.5 py-1 rounded-lg bg-[#0B0F19] text-amber-200 border border-amber-400/40 font-bold text-[11px] cursor-pointer"
                >
                  {t("Muat Save .fm", "Load .fm Save")}
                </button>
              ) : (
                <Link
                  href="/squad"
                  className="px-2.5 py-1 rounded-lg bg-[#0B0F19] text-amber-200 border border-amber-400/40 font-bold text-[11px]"
                >
                  {t("Buka Skuad →", "Open Squad →")}
                </Link>
              )}
            </div>
          )}

          {squadBlueprintOrAudit.audit ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-200">
                  {t("Kecocokan Skuad", "Squad Fit")}{" "}
                  <span className="font-mono-metric text-emerald-400">
                    {squadBlueprintOrAudit.audit.overallSquadFit.toFixed(0)}/100
                  </span>
                </span>
                <span className="text-[11px] text-rose-300">
                  {t("Perlu Dibenahi:", "Weakest Spots:")}{" "}
                  {squadBlueprintOrAudit.audit.weakestThreeSlotIndices
                    .map((idx) => {
                      const st = squadBlueprintOrAudit.audit!.starterAudits[idx];
                      return st
                        ? `${st.inSlot} (${st.playerName})`
                        : `#${idx + 1}`;
                    })
                    .join(" · ")}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-1.5 pr-2">{t("Posisi", "Position")}</th>
                      <th className="py-1.5 pr-2">{t("Pemain", "Starter")}</th>
                      <th className="py-1.5 pr-2">{t("Peran (IP / OOP)", "Role (IP / OOP)")}</th>
                      <th className="py-1.5 pr-2">{t("Skor", "Fit")}</th>
                      <th className="py-1.5 pr-2">{t("Atribut Kurang", "Low Attributes")}</th>
                      <th className="py-1.5">{t("Cadangan Lebih Cocok", "Better Option")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {squadBlueprintOrAudit.audit.starterAudits.map((item) => {
                      const isWeak =
                        squadBlueprintOrAudit.audit!.weakestThreeSlotIndices.includes(
                          item.slotIndex,
                        );
                      const bestSub = item.betterInternalReplacements[0];
                      return (
                        <tr
                          key={item.slotIndex}
                          className={`border-b border-white/5 ${isWeak ? "bg-rose-950/20" : ""}`}
                        >
                          <td className="py-1.5 pr-2 font-mono-metric font-bold text-cyan-300">
                            {item.inSlot}→{item.outSlot}
                          </td>
                          <td className="py-1.5 pr-2 font-semibold text-slate-100">
                            {item.playerName}
                          </td>
                          <td className="py-1.5 pr-2 text-slate-300">
                            {roleNameMap.get(item.inRoleId) ?? item.inRoleId} /{" "}
                            {roleNameMap.get(item.outRoleId) ?? item.outRoleId}
                          </td>
                          <td className="py-1.5 pr-2 font-mono-metric font-bold text-emerald-300">
                            {item.fitScore.toFixed(0)}
                          </td>
                          <td className="py-1.5 pr-2 text-amber-300">
                            {item.keyAttributeGaps.length === 0
                              ? t("Aman", "Solid")
                              : item.keyAttributeGaps
                                  .map((g) => `${g.attribute.replace(/_/g, " ")} (${g.value})`)
                                  .join(", ")}
                          </td>
                          <td className="py-1.5">
                            {bestSub ? (
                              <button
                                type="button"
                                onClick={() => {
                                  assignPlayerToSlot(
                                    item.slotIndex,
                                    bestSub.playerUid,
                                    bestSub.playerName,
                                  );
                                  onNotify?.(
                                    "ok",
                                    t(
                                      `${bestSub.playerName} dipasang di ${item.inSlot}`,
                                      `Assigned ${bestSub.playerName} to ${item.inSlot}`,
                                    ),
                                  );
                                }}
                                className="px-2 py-0.5 rounded bg-emerald-500/18 text-emerald-300 border border-emerald-500/35 font-semibold cursor-pointer"
                              >
                                {bestSub.playerName} (+{bestSub.fitGain.toFixed(0)})
                              </button>
                            ) : (
                              <span className="text-slate-500">
                                {t("Pilihan utama", "Best starter")}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-1.5 pr-2">#</th>
                    <th className="py-1.5 pr-2">IP → OOP</th>
                    <th className="py-1.5 pr-2">{t("Peran Menyerang", "In Possession Role")}</th>
                    <th className="py-1.5 pr-2">{t("Peran Bertahan", "Out of Possession Role")}</th>
                    <th className="py-1.5 pr-2">{t("Atribut Utama", "Key Attributes")}</th>
                    <th className="py-1.5">{t("Target", "Target")}</th>
                  </tr>
                </thead>
                <tbody>
                  {squadBlueprintOrAudit.blueprint.map((bp) => (
                    <tr key={bp.slotIndex} className="border-b border-white/5">
                      <td className="py-1.5 pr-2 font-mono-metric text-slate-400">
                        {bp.slotIndex + 1}
                      </td>
                      <td className="py-1.5 pr-2 font-mono-metric font-bold text-cyan-300">
                        {bp.inPositionId} → {bp.outPositionId}
                      </td>
                      <td className="py-1.5 pr-2 font-semibold text-slate-100">
                        {bp.inRoleName}{" "}
                        <span className="text-[10px] text-emerald-400">({bp.inDuty})</span>
                      </td>
                      <td className="py-1.5 pr-2 text-amber-300">{bp.outRoleName}</td>
                      <td className="py-1.5 pr-2 text-slate-300 font-mono-metric">
                        {bp.inKeyAttributes.map((a) => a.replace(/_/g, " ")).join(", ")}
                      </td>
                      <td className="py-1.5 font-mono-metric font-bold text-emerald-300">
                        {bp.minTargetAttribute}+
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TRAINING */}
      {activeTab === "training" && (
        <div className="flex flex-col gap-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 font-mono-metric text-[11px]">
              <span className="px-2 py-0.5 rounded bg-slate-900 text-emerald-300">
                {t("Kondisi", "Condition")} {trainingPlan.loadMetrics.conditionDelta >= 0 ? "+" : ""}
                {trainingPlan.loadMetrics.conditionDelta}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300">
                {t("Kelelahan", "Fatigue")} {trainingPlan.loadMetrics.fatigueDelta >= 0 ? "+" : ""}
                {trainingPlan.loadMetrics.fatigueDelta}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 text-cyan-300">
                {t("Ketajaman", "Sharpness")} +{trainingPlan.loadMetrics.sharpnessDelta}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="push-training-plan-btn"
                type="button"
                onClick={() => {
                  const ok = pushTrainingPlanToStore();
                  if (ok) {
                    onNotify?.(
                      "ok",
                      t(
                        `Jadwal "${trainingPlan.schedule.name}" diterapkan`,
                        `Applied schedule "${trainingPlan.schedule.name}"`,
                      ),
                    );
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                {t("Terapkan Jadwal", "Apply Schedule")}
              </button>
              <Link
                href="/training"
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#0B0F19] text-cyan-300 border border-cyan-500/35"
              >
                {t("Buka Latihan →", "Open Training →")}
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
            {trainingPlan.schedule.days.map((d) => (
              <div
                key={d.day}
                className="rounded-lg p-2 bg-[#0B0F19] border border-white/8 flex flex-col gap-1 text-[11px]"
              >
                <div className="font-bold text-emerald-300">{d.day}</div>
                <div className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-200 truncate">
                  {d.s1}
                </div>
                <div className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 truncate">
                  {d.s2}
                </div>
                <div className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 truncate">
                  {d.extra}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {trainingPlan.selectedSessions.slice(0, 6).map((s) => (
              <div
                key={s.code}
                className="p-2.5 rounded-lg bg-[#0B0F19] border border-white/8 flex flex-col gap-1 text-[11px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-100">{s.name}</span>
                  <span className="font-mono-metric text-emerald-400">
                    {s.countUsed}x/{t("mgg", "wk")}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono-metric truncate">
                  {s.trainedAttributes
                    .slice(0, 4)
                    .map((a) => a.replace(/_/g, " "))
                    .join(" · ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: STAFF */}
      {activeTab === "staff" && (
        <div className="flex flex-col gap-2.5 text-xs">
          {staffPlan.dataSource !== "Live dari File Save .fm" && !staffPlan.hasClubStaff ? (
            <div className="rounded-xl border border-dashed border-slate-700 bg-[#0B0F19] p-6 text-center space-y-2.5">
              <p className="text-xs text-slate-300">
                {t(
                  "Muat save karier (.fm) untuk melihat rating staf pelatih klub Anda & rekomendasi pelatih baru.",
                  "Load a career save (.fm) to view your club coaching ratings & recommended staff.",
                )}
              </p>
              {onRequestLoadFm && (
                <button
                  type="button"
                  onClick={onRequestLoadFm}
                  className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                >
                  {t("Muat Save .fm", "Load .fm Save")}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {staffPlan.categories.slice(0, 6).map((cat) => (
                <div
                  key={cat.categoryId}
                  className="rounded-xl p-3 bg-[#0B0F19] border border-white/8 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-100">{cat.label}</span>
                    {cat.clubCurrentStars !== null && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono-metric text-[11px]">
                        {t("Klub", "Club")} {cat.clubCurrentStars.toFixed(1)}★
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-cyan-400">
                        {t("Pelatih Terbaik", "Top Coaches")}
                      </div>
                      {cat.topStaff.slice(0, 2).map((st) => (
                        <div key={st.uid} className="truncate text-slate-200">
                          {st.name} ({st.club}) ·{" "}
                          <span className="font-mono-metric text-amber-300">
                            {st.stars.toFixed(1)}★
                          </span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-emerald-400">
                        Free Agent
                      </div>
                      {cat.topFreeAgents.slice(0, 2).map((fa) => (
                        <div key={fa.uid} className="truncate text-slate-200">
                          {fa.name} ·{" "}
                          <span className="font-mono-metric text-emerald-300">
                            {fa.stars.toFixed(1)}★
                          </span>{" "}
                          (€{(fa.wageEstimateEurWeekly / 1000).toFixed(0)}k)
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: WONDERKIDS */}
      {activeTab === "wonderkids" && (
        <div className="flex flex-col gap-2.5 text-xs">
          {wonderkidPlan.dataSource !== "Live dari File Save .fm" ? (
            <div className="rounded-xl border border-dashed border-slate-700 bg-[#0B0F19] p-6 text-center space-y-2.5">
              <p className="text-xs text-slate-300">
                {t(
                  "Muat save karier (.fm) untuk melihat target wonderkid U-21 dari dunia karier Anda.",
                  "Load a career save (.fm) to discover U-21 wonderkid targets from your save.",
                )}
              </p>
              {onRequestLoadFm && (
                <button
                  type="button"
                  onClick={onRequestLoadFm}
                  className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                >
                  {t("Muat Save .fm", "Load .fm Save")}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
              {wonderkidPlan.slots.map((slotPlan) => (
                <div
                  key={slotPlan.slotIndex}
                  className={`rounded-xl p-3 bg-[#0B0F19] border flex flex-col gap-2 ${
                    slotPlan.isPriorityWeakSlot ? "border-rose-500/45" : "border-white/8"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-metric font-bold text-cyan-300">
                      #{slotPlan.slotIndex + 1} {slotPlan.inPositionId}→{slotPlan.outPositionId} ·{" "}
                      {slotPlan.inRoleName}
                    </span>
                    {slotPlan.isPriorityWeakSlot && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-200 text-[10px] font-bold">
                        {t("Prioritas", "Priority")}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {slotPlan.candidates.map((wk) => {
                      const inShortlist = shortlistUids.includes(wk.uid);
                      return (
                        <div
                          key={wk.uid}
                          className="p-2 rounded-lg bg-slate-900/80 border border-white/6 flex flex-col gap-1 text-[11px]"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-slate-100 truncate">
                              {wk.name} ({wk.age}, {wk.club})
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleShortlistUid(wk.uid)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                inShortlist
                                  ? "bg-emerald-500 text-slate-950"
                                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                              }`}
                            >
                              {inShortlist ? "✓" : "+ Shortlist"}
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2 font-mono-metric text-[10px] text-slate-300">
                            <span className="text-emerald-300">
                              {t("Kecocokan", "Fit")} {wk.roleFitScore.toFixed(0)}
                            </span>
                            <span className="text-amber-300">
                              €{wk.estimatedPriceEurM.toFixed(1)}M
                            </span>
                            <span>PA {wk.paRange}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono-metric truncate">
                            {wk.keyAttributes
                              .map((ka) => `${ka.attribute.replace(/_/g, " ")}:${ka.value}`)
                              .join(" · ")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
        </>
      )}
    </section>
  );
}
