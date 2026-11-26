"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getTacticalStyles } from "@fm27/fm-data";
import type { TacticPlanResult } from "@fm27/shared-types";
import { ReplacementModal } from "../../components/squad/ReplacementModal";
import { RoleFitTable } from "../../components/squad/RoleFitTable";
import { SquadImporter } from "../../components/squad/SquadImporter";
import { WeakestPositionsCard } from "../../components/squad/WeakestPositionsCard";
import {
  analyzeSquadInWorker,
  auditSquadInWorker,
  gradeImportedTacticInWorker,
} from "../../lib/worker-client";
import { useLocale } from "../../stores/useLocaleStore";
import { useSquadStore } from "../../stores/useSquadStore";
import { useTacticStore } from "../../stores/useTacticStore";

export default function SquadAuditPage() {
  const router = useRouter();
  const { t } = useLocale();
  const tactic = useTacticStore((s) => s.tactic);
  const loadTactic = useTacticStore((s) => s.loadTactic);
  const setSlotRole = useTacticStore((s) => s.setSlotRole);
  const assignPlayerToSlot = useTacticStore((s) => s.assignPlayerToSlot);

  const players = useSquadStore((s) => s.players);
  const lineupPreferences = useSquadStore((s) => s.lineupPreferences);
  const priorities = useSquadStore((s) => s.priorities);
  const styleFilter = useSquadStore((s) => s.styleFilter);
  const generatedPlans = useSquadStore((s) => s.generatedPlans);
  const auditResult = useSquadStore((s) => s.auditResult);
  const isBusy = useSquadStore((s) => s.isBusy);
  const errorMessage = useSquadStore((s) => s.errorMessage);

  const toggleMustStart = useSquadStore((s) => s.toggleMustStart);
  const setPlayerSlotLock = useSquadStore((s) => s.setPlayerSlotLock);
  const setObjective = useSquadStore((s) => s.setObjective);
  const setRiskOffset = useSquadStore((s) => s.setRiskOffset);
  const setStyleFilter = useSquadStore((s) => s.setStyleFilter);
  const setGeneratedPlans = useSquadStore((s) => s.setGeneratedPlans);
  const setAuditResult = useSquadStore((s) => s.setAuditResult);
  const setBusy = useSquadStore((s) => s.setBusy);
  const setError = useSquadStore((s) => s.setError);

  const [inspectSlotIdx, setInspectSlotIdx] = useState<number | null>(null);
  const [gradedCurrent, setGradedCurrent] = useState<TacticPlanResult | null>(null);
  const [squadTierFilter, setSquadTierFilter] = useState<"first-team" | "first-and-u21" | "all">("first-team");

  const stylesCatalog = getTacticalStyles(tactic.patchVersion);

  const hasTeamSlots = useMemo(
    () => players.some((p) => p.teamSlot === "First Team"),
    [players],
  );
  const firstTeamCount = useMemo(
    () => players.filter((p) => p.teamSlot === "First Team").length,
    [players],
  );
  const firstAndU21Count = useMemo(
    () =>
      players.filter(
        (p) => p.teamSlot === "First Team" || p.teamSlot === "U21 / Reserve",
      ).length,
    [players],
  );

  const activePlayers = useMemo(() => {
    if (!hasTeamSlots || squadTierFilter === "all") return players;
    if (squadTierFilter === "first-team") {
      const ft = players.filter((p) => p.teamSlot === "First Team");
      return ft.length >= 11 ? ft : players;
    }
    const ftU21 = players.filter(
      (p) => p.teamSlot === "First Team" || p.teamSlot === "U21 / Reserve",
    );
    return ftU21.length >= 11 ? ftU21 : players;
  }, [hasTeamSlots, players, squadTierFilter]);

  useEffect(() => {
    if (activePlayers.length < 11) {
      setAuditResult(null);
      setGradedCurrent(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [audit, graded] = await Promise.all([
          auditSquadInWorker(tactic, activePlayers),
          gradeImportedTacticInWorker(tactic, activePlayers, true),
        ]);
        if (!cancelled) {
          setAuditResult(audit);
          setGradedCurrent(graded);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : t("Gagal menganalisis skuad", "Squad check failed"),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activePlayers, tactic, setAuditResult, setError, t]);

  useEffect(() => {
    if (activePlayers.length < 11 || generatedPlans.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const plans = await analyzeSquadInWorker(activePlayers, {
          styleId: styleFilter || undefined,
          priorities,
          lineupPreferences,
          patchVersion: tactic.patchVersion,
        });
        if (!cancelled) {
          setGeneratedPlans(plans);
        }
      } catch {
        // Ignore if squad lacks GK
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    activePlayers,
    generatedPlans.length,
    lineupPreferences,
    priorities,
    setGeneratedPlans,
    styleFilter,
    tactic.patchVersion,
  ]);

  async function handleAutoGenerateBestTactics() {
    if (activePlayers.length < 11) return;
    setBusy(true);
    setError(null);
    try {
      const plans = await analyzeSquadInWorker(activePlayers, {
        styleId: styleFilter || undefined,
        priorities,
        lineupPreferences,
        patchVersion: tactic.patchVersion,
      });
      setGeneratedPlans(plans);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("Gagal menyusun rekomendasi formasi", "Could not generate tactics"),
      );
    } finally {
      setBusy(false);
    }
  }

  function handleLoadPlanToBoard(plan: TacticPlanResult) {
    loadTactic(plan.tactic);
    router.push("/");
  }

  const inspectedAuditItem =
    inspectSlotIdx !== null && auditResult
      ? auditResult.starterAudits[inspectSlotIdx] ?? null
      : null;
  const inspectedSlot =
    inspectSlotIdx !== null ? tactic.slots[inspectSlotIdx] ?? null : null;

  return (
    <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-slate-100">
            {t("Skuad & Rekomendasi Taktik", "Squad & Tactic Finder")}
          </h1>
          <span className="rounded-lg border border-white/10 bg-[#111827] px-2.5 py-1 text-xs text-slate-300">
            <strong className="text-cyan-300">{tactic.title}</strong> (IP{" "}
            {tactic.inFormation} / OOP {tactic.outFormation})
          </span>
        </div>

        {gradedCurrent && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-[#111827] px-3.5 py-2">
            <span className="text-xs text-slate-300">
              {t("Kecocokan Taktik:", "Tactic Fit:")}{" "}
              <strong className="font-mono text-emerald-300">
                {gradedCurrent.rankingFit.toFixed(0)}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => loadTactic(gradedCurrent.tactic)}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
            >
              {t("Optimalkan Peran", "Optimize Roles")}
            </button>
          </div>
        )}
      </div>

      <SquadImporter />

      {hasTeamSlots && (
        <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-[#111827] px-4 py-2.5">
          <span className="text-xs font-semibold text-slate-200">
            {t("Kelompok Skuad", "Squad Group")}
          </span>
          <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0B0F19] p-1 text-xs">
            {(
              [
                ["first-team", `${t("Tim Utama", "First Team")} (${firstTeamCount})`],
                ["first-and-u21", `${t("Tim Utama + U21", "First Team + U21")} (${firstAndU21Count})`],
                ["all", `${t("Semua Pemain", "All Players")} (${players.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSquadTierFilter(key)}
                className={`rounded-md px-2.5 py-1 font-semibold transition cursor-pointer ${
                  squadTierFilter === key
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
          {errorMessage}
        </div>
      )}

      {players.length === 0 && (
        <section
          id="squad-empty-state"
          className="rounded-xl border border-dashed border-slate-700 bg-[#111827]/70 p-8 text-center"
        >
          <h2 className="text-sm font-bold text-slate-200">
            {t(
              "Muat save karier (.fm) untuk melihat starting XI terbaik & rekomendasi formasi.",
              "Load a career save (.fm) to see your best XI & recommended formations.",
            )}
          </h2>
        </section>
      )}

      {players.length >= 11 && (
        <section className="rounded-xl border border-slate-800 bg-[#111827] p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] text-slate-400">
                  {t("Gaya Bermain", "Tactical Style")}
                </label>
                <select
                  value={styleFilter}
                  onChange={(e) => setStyleFilter(e.target.value)}
                  className="mt-1 rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-100"
                >
                  <option value="">{t("Semua Gaya Bermain", "All Tactical Styles")}</option>
                  <option value="__auto__">{t("Otomatis", "Automatic")}</option>
                  {stylesCatalog.TacticalStyles.map((st) => (
                    <option key={st.Id} value={st.Id}>
                      {st.Name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400">
                  {t("Pendekatan Laga", "Match Approach")}
                </label>
                <select
                  value={priorities.objective}
                  onChange={(e) =>
                    setObjective(
                      e.target.value as
                        | "WinNow"
                        | "Balanced"
                        | "ProtectLead"
                        | "Underdog",
                    )
                  }
                  className="mt-1 rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-100"
                >
                  <option value="Balanced">{t("Seimbang", "Balanced")}</option>
                  <option value="WinNow">{t("Menyerang Penuh", "Attacking")}</option>
                  <option value="ProtectLead">{t("Amankan Keunggulan", "Protect Lead")}</option>
                  <option value="Underdog">{t("Tim Underdog", "Underdog")}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400">
                  {t("Keberanian Risiko", "Risk Level")} ({priorities.riskOffset >= 0 ? "+" : ""}
                  {priorities.riskOffset})
                </label>
                <input
                  type="range"
                  min={-2}
                  max={2}
                  step={1}
                  value={priorities.riskOffset}
                  onChange={(e) => setRiskOffset(Number(e.target.value))}
                  className="mt-2 w-28 accent-cyan-400"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleAutoGenerateBestTactics()}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
            >
              {isBusy
                ? t("Menyusun Formasi...", "Finding Best Tactics...")
                : t("Cari Formasi Terbaik", "Find Best Tactics")}
            </button>
          </div>

          {generatedPlans.length > 0 && (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {generatedPlans.slice(0, 6).map((plan, idx) => (
                <div
                  key={`${plan.tactic.title}-${idx}`}
                  className="flex flex-col justify-between rounded-lg border border-slate-800 bg-[#0B0F19] p-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
                        #{idx + 1} · {t("Skor", "Fit")} {plan.rankingFit.toFixed(0)}
                      </span>
                    </div>
                    <div className="mt-1.5 text-sm font-semibold text-slate-100">
                      {plan.tactic.title}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                      IP {plan.tactic.inFormation} → OOP {plan.tactic.outFormation}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLoadPlanToBoard(plan)}
                    className="mt-3 w-full rounded-md border border-cyan-500/40 bg-cyan-500/15 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/25 cursor-pointer"
                  >
                    {t("Buka di Papan Taktik →", "Open on Tactics Board →")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {auditResult && (
        <WeakestPositionsCard
          audit={auditResult}
          onInspectSlot={(idx) => setInspectSlotIdx(idx)}
        />
      )}

      {activePlayers.length > 0 && (
        <RoleFitTable
          audit={auditResult}
          players={activePlayers}
          lineupPreferences={lineupPreferences}
          patchVersion={tactic.patchVersion}
          onInspectSlot={(idx) => setInspectSlotIdx(idx)}
          onApplyRoleAlternative={(slotIdx, phase, roleId) =>
            setSlotRole(slotIdx, phase, roleId)
          }
          onToggleMustStart={toggleMustStart}
          onSetSlotLock={setPlayerSlotLock}
        />
      )}

      {inspectedAuditItem && inspectedSlot && (
        <ReplacementModal
          auditItem={inspectedAuditItem}
          slotAssignment={inspectedSlot}
          styleId={tactic.styleId}
          patchVersion={tactic.patchVersion}
          onClose={() => setInspectSlotIdx(null)}
          onSwapInternalStarter={(slotIdx, uid, name) =>
            assignPlayerToSlot(slotIdx, uid, name)
          }
        />
      )}
    </main>
  );
}
