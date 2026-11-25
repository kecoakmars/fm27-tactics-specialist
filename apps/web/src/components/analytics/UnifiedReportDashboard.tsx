"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { UnifiedReport } from "@fm27/fm-engine";
import { useSquadStore } from "@/stores/useSquadStore";
import { useTacticStore } from "@/stores/useTacticStore";
import { useTrainingStore } from "@/stores/useTrainingStore";

type UnifiedTabKey = "formation" | "squad" | "training" | "staff" | "wonderkids";

const TABS: ReadonlyArray<{ id: UnifiedTabKey; label: string }> = [
  { id: "formation", label: "Formasi" },
  { id: "squad", label: "Squad Audit/Blueprint" },
  { id: "training", label: "Training" },
  { id: "staff", label: "Staff Star" },
  { id: "wonderkids", label: "Wonderkids" },
];

export interface UnifiedReportDashboardProps {
  report: UnifiedReport;
  onNotify?: (tone: "ok" | "error", text: string) => void;
}

export function UnifiedReportDashboard({
  report,
  onNotify,
}: UnifiedReportDashboardProps) {
  const [activeTab, setActiveTab] = useState<UnifiedTabKey>("formation");
  const {
    loadTactic,
    applyDualShape,
    setTeamInstruction,
    assignPlayerToSlot,
    pushTrainingPlanToStore,
    dismissUnifiedReport,
  } = useTacticStore();
  const loadDemoSquad = useSquadStore((s) => s.loadDemoSquad);
  const shortlistUids = useTrainingStore((s) => s.shortlistUids);
  const toggleShortlistUid = useTrainingStore((s) => s.toggleShortlistUid);

  const modeLabel =
    report.mode === "fmf-only"
      ? "Mode A · .fmf Blueprint"
      : report.mode === "squad-only"
        ? "Mode B · Squad Solver (13×16)"
        : "Mode C · .fmf + Klub Nyata";

  const { tacticAdvice, squadBlueprintOrAudit, trainingPlan, staffPlan, wonderkidPlan } =
    report;

  return (
    <section
      id="unified-report-dashboard"
      aria-label="Unified 5-Tab Deterministic Tactical Report"
      className="tactical-surface rounded-2xl p-4 border border-emerald-500/30 flex flex-col gap-3.5"
    >
      {/* Header + Non-AI Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            id="non-ai-deterministic-badge"
            className="px-2.5 py-1 rounded-md text-[11px] font-extrabold tracking-wide bg-emerald-500/20 text-emerald-300 border border-emerald-500/45"
          >
            {report.deterministicBadge}
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono-metric bg-[#0B0F19] text-cyan-300 border border-cyan-500/30">
            {modeLabel}
          </span>
          <span className="text-xs font-semibold text-slate-200">
            {tacticAdvice.activeTactic.title} (IP {tacticAdvice.activeTactic.inFormation} → OOP{" "}
            {tacticAdvice.activeTactic.outFormation})
          </span>
        </div>

        <div className="flex items-center gap-2">
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
                  `Dimuat ke Papan Taktik: "${tacticAdvice.recommendedTactic.title}"`,
                );
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer"
            >
              Terapkan Taktik Rekomendasi #1
            </button>
          )}
          <button
            type="button"
            onClick={dismissUnifiedReport}
            title="Sembunyikan panel ringkasan"
            className="px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-slate-100 bg-[#0B0F19] border border-white/10 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* 5-Tab Bar */}
      <div
        role="tablist"
        className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-[#0B0F19] border border-white/10"
      >
        {TABS.map((tab) => {
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

      {/* TAB 1: FORMASI */}
      {activeTab === "formation" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl p-3 bg-[#0B0F19] border border-white/8 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">6 Pilar &amp; 18-Zone Spatial</span>
              <span className="font-mono-metric font-bold text-emerald-400">
                {tacticAdvice.balance.overallScore.toFixed(1)} / 100
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="px-2 py-1 rounded bg-slate-900/80 flex justify-between">
                <span className="text-slate-400">Attack</span>
                <span className="font-mono-metric text-slate-100">
                  {tacticAdvice.balance.pillars.attackingThreat.toFixed(0)}
                </span>
              </div>
              <div className="px-2 py-1 rounded bg-slate-900/80 flex justify-between">
                <span className="text-slate-400">Build-Up</span>
                <span className="font-mono-metric text-slate-100">
                  {tacticAdvice.balance.pillars.buildUpProgression.toFixed(0)}
                </span>
              </div>
              <div className="px-2 py-1 rounded bg-slate-900/80 flex justify-between">
                <span className="text-slate-400">Rest-Def</span>
                <span className="font-mono-metric text-slate-100">
                  {tacticAdvice.balance.pillars.restDefenseStability.toFixed(0)}
                </span>
              </div>
              <div className="px-2 py-1 rounded bg-slate-900/80 flex justify-between">
                <span className="text-slate-400">Half-Space</span>
                <span className="font-mono-metric text-slate-100">
                  {tacticAdvice.balance.pillars.widthAndHalfSpaceCoverage.toFixed(0)}
                </span>
              </div>
              <div className="px-2 py-1 rounded bg-slate-900/80 flex justify-between">
                <span className="text-slate-400">Pressing</span>
                <span className="font-mono-metric text-slate-100">
                  {tacticAdvice.balance.pillars.pressingCohesion.toFixed(0)}
                </span>
              </div>
              <div className="px-2 py-1 rounded bg-slate-900/80 flex justify-between">
                <span className="text-slate-400">Transisi</span>
                <span className="font-mono-metric text-slate-100">
                  {tacticAdvice.balance.pillars.transitionResilience.toFixed(0)}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 font-mono-metric pt-1 border-t border-white/6">
              Zone 14 IP: {tacticAdvice.heatmap.zone14IntensityIp.toFixed(1)}% · LHS{" "}
              {tacticAdvice.heatmap.leftHalfSpaceIntensityIp.toFixed(0)}% · RHS{" "}
              {tacticAdvice.heatmap.rightHalfSpaceIntensityIp.toFixed(0)}% · Dist{" "}
              {tacticAdvice.heatmap.averageTransitionDistance.toFixed(1)}
            </div>
          </div>

          <div className="rounded-xl p-3 bg-[#0B0F19] border border-white/8 flex flex-col gap-2">
            <span className="font-bold text-slate-200">
              Celah Struktural &amp; Coaching Auto-Adjustment (
              {tacticAdvice.structuralAdjustments.length})
            </span>
            {tacticAdvice.structuralAdjustments.length === 0 ? (
              <p className="text-emerald-300 text-[11px]">
                Struktur 18-zona seimbang tanpa celah rest-defense kritis.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                {tacticAdvice.structuralAdjustments.map((al) => (
                  <div
                    key={al.id}
                    className="p-2 rounded-lg bg-slate-900/80 border border-white/8 flex flex-col gap-1"
                  >
                    <div className="font-semibold text-amber-300 text-[11px]">{al.title}</div>
                    <p className="text-[11px] text-slate-400 leading-snug">{al.detail}</p>
                    {al.autoFix && (
                      <button
                        type="button"
                        onClick={() => {
                          setTeamInstruction(al.autoFix!.group, al.autoFix!.toBit, true);
                          onNotify?.("ok", `Auto-adjustment diterapkan: ${al.autoFix!.text}`);
                        }}
                        className="self-start mt-0.5 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 text-[10px] font-bold hover:bg-emerald-500/30 cursor-pointer"
                      >
                        Auto-Fix: {al.autoFix.text}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl p-3 bg-[#0B0F19] border border-white/8 flex flex-col gap-2">
            <span className="font-bold text-slate-200">
              Top 3 Pasangan Formasi IP/OOP Alternatif
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
                    <div className="text-[10px] text-slate-400 truncate">{alt.rationale}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono-metric text-[11px] font-bold text-emerald-300">
                      {alt.compatibilityScore.toFixed(1)}
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
                          `Formasi diubah ke IP ${alt.inPossessionName} → OOP ${alt.outOfPossessionName}`,
                        );
                      }}
                      className="px-2 py-1 rounded bg-cyan-500/18 text-cyan-300 border border-cyan-500/35 text-[10px] font-bold hover:bg-cyan-500/28 cursor-pointer"
                    >
                      Pakai
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SQUAD AUDIT / BLUEPRINT */}
      {activeTab === "squad" && (
        <div className="flex flex-col gap-3 text-xs">
          {!squadBlueprintOrAudit.hasClubSquad && squadBlueprintOrAudit.honestNote && (
            <div
              id="squad-honest-note"
              className="rounded-xl p-3 bg-amber-500/12 border border-amber-500/35 text-amber-200 flex flex-wrap items-center justify-between gap-2"
            >
              <span>{squadBlueprintOrAudit.honestNote}</span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    loadDemoSquad(report.patchVersion);
                    onNotify?.("ok", "Demo Squad (22 pemain) dimuat untuk simulasi Mode C");
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-bold text-[11px] hover:bg-amber-300 cursor-pointer"
                >
                  Coba Demo Squad
                </button>
                <Link
                  href="/squad"
                  className="px-2.5 py-1 rounded-lg bg-[#0B0F19] text-amber-200 border border-amber-400/40 font-bold text-[11px]"
                >
                  Unggah CSV / HTML →
                </Link>
              </div>
            </div>
          )}

          {squadBlueprintOrAudit.audit ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-200">
                  Audit Skuad Nyata · Overall Fit{" "}
                  <span className="font-mono-metric text-emerald-400">
                    {squadBlueprintOrAudit.audit.overallSquadFit.toFixed(1)}
                  </span>
                </span>
                <span className="text-[11px] text-rose-300">
                  3 Titik Terlemah:{" "}
                  {squadBlueprintOrAudit.audit.weakestThreeSlotIndices
                    .map((idx) => {
                      const st = squadBlueprintOrAudit.audit!.starterAudits[idx];
                      return st ? `${st.inSlot} (${st.playerName}, ${st.fitScore.toFixed(1)})` : `#${idx + 1}`;
                    })
                    .join(" · ")}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-1.5 pr-2">Slot IP→OOP</th>
                      <th className="py-1.5 pr-2">Starter</th>
                      <th className="py-1.5 pr-2">Role IP / OOP</th>
                      <th className="py-1.5 pr-2">Role Fit</th>
                      <th className="py-1.5 pr-2">Atribut Kurang (&lt;14)</th>
                      <th className="py-1.5">Pengganti Internal</th>
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
                            {item.inRoleId} / {item.outRoleId}
                          </td>
                          <td className="py-1.5 pr-2 font-mono-metric font-bold text-emerald-300">
                            {item.fitScore.toFixed(1)}
                          </td>
                          <td className="py-1.5 pr-2 text-amber-300">
                            {item.keyAttributeGaps.length === 0
                              ? "Optimal"
                              : item.keyAttributeGaps
                                  .map((g) => `${g.attribute} (${g.value})`)
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
                                    `${bestSub.playerName} dipasang di ${item.inSlot} (+${bestSub.fitGain.toFixed(1)} Fit)`,
                                  );
                                }}
                                className="px-2 py-0.5 rounded bg-emerald-500/18 text-emerald-300 border border-emerald-500/35 font-semibold cursor-pointer"
                              >
                                {bestSub.playerName} (+{bestSub.fitGain.toFixed(1)})
                              </button>
                            ) : (
                              <span className="text-slate-500">Starter terbaik</span>
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
                    <th className="py-1.5 pr-2">Role IP (Duty)</th>
                    <th className="py-1.5 pr-2">Role OOP</th>
                    <th className="py-1.5 pr-2">5 Atribut Kunci (role-profiles.json)</th>
                    <th className="py-1.5">Target Min</th>
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
                        {bp.inKeyAttributes.join(", ")}
                      </td>
                      <td className="py-1.5 font-mono-metric font-bold text-emerald-300">
                        ≥ {bp.minTargetAttribute} (Ideal {bp.idealTargetAttribute})
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
                Cond {trainingPlan.loadMetrics.conditionDelta >= 0 ? "+" : ""}
                {trainingPlan.loadMetrics.conditionDelta}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300">
                Fatigue {trainingPlan.loadMetrics.fatigueDelta >= 0 ? "+" : ""}
                {trainingPlan.loadMetrics.fatigueDelta}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 text-cyan-300">
                Sharpness +{trainingPlan.loadMetrics.sharpnessDelta}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300">
                Violations: {trainingPlan.loadMetrics.violations.length}
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
                      `Jadwal "${trainingPlan.schedule.name}" didorong ke Training Planner`,
                    );
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                Dorong ke Training Store (1-Klik)
              </button>
              <Link
                href="/training"
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#0B0F19] text-cyan-300 border border-cyan-500/35"
              >
                Buka Kalender →
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {trainingPlan.selectedSessions.slice(0, 6).map((s) => (
              <div
                key={s.code}
                className="p-2 rounded-lg bg-[#0B0F19] border border-white/8 flex items-start justify-between gap-2 text-[11px]"
              >
                <div>
                  <span className="font-bold text-slate-100">{s.name}</span>{" "}
                  <span className="font-mono-metric text-emerald-400">
                    ({s.countUsed}/{s.maxSessionsPerWeek}x)
                  </span>
                  <p className="text-slate-400 mt-0.5">{s.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: STAFF STAR */}
      {activeTab === "staff" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
          {staffPlan.categories.slice(0, 6).map((cat) => (
            <div
              key={cat.categoryId}
              className="rounded-xl p-3 bg-[#0B0F19] border border-white/8 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-100">{cat.label}</span>
                <div className="flex items-center gap-1.5 font-mono-metric text-[11px]">
                  {cat.clubCurrentStars !== null && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      Klub {cat.clubCurrentStars.toFixed(1)}★
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                    Prio {cat.priorityWeight}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">{cat.rationale}</p>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div>
                  <div className="text-[10px] uppercase font-bold text-cyan-400">Top Staff</div>
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
                    Free Agents
                  </div>
                  {cat.topFreeAgents.slice(0, 2).map((fa) => (
                    <div key={fa.uid} className="truncate text-slate-200">
                      {fa.name} ·{" "}
                      <span className="font-mono-metric text-emerald-300">
                        {fa.stars.toFixed(1)}★
                      </span>{" "}
                      (€{(fa.wageEstimateEurWeekly / 1000).toFixed(0)}k/w)
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 5: WONDERKIDS */}
      {activeTab === "wonderkids" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs max-h-[420px] overflow-y-auto pr-1">
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
                    Prioritas Lemah
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
                          {inShortlist ? "Shortlisted" : "+ Shortlist"}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 font-mono-metric text-[10px] text-slate-300">
                        <span className="text-emerald-300">Fit {wk.roleFitScore.toFixed(1)}</span>
                        <span className="text-cyan-300">Val {wk.valueRatio.toFixed(1)}</span>
                        <span className="text-amber-300">€{wk.estimatedPriceEurM.toFixed(1)}M</span>
                        <span>PA {wk.paRange}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono-metric truncate">
                        {wk.keyAttributes.map((ka) => `${ka.attribute}:${ka.value}`).join(" · ")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
