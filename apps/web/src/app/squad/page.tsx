"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { useSquadStore } from "../../stores/useSquadStore";
import { useTacticStore } from "../../stores/useTacticStore";

export default function SquadAuditPage() {
  const router = useRouter();
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

  const stylesCatalog = getTacticalStyles(tactic.patchVersion);

  // Auto-run Audit Active Tactic whenever squad or active tactic updates
  useEffect(() => {
    if (players.length < 11) {
      setAuditResult(null);
      setGradedCurrent(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [audit, graded] = await Promise.all([
          auditSquadInWorker(tactic, players),
          gradeImportedTacticInWorker(tactic, players, true),
        ]);
        if (!cancelled) {
          setAuditResult(audit);
          setGradedCurrent(graded);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Squad audit failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [players, tactic, setAuditResult, setError]);

  async function handleAutoGenerateBestTactics() {
    if (players.length < 11) return;
    setBusy(true);
    setError(null);
    try {
      const plans = await analyzeSquadInWorker(players, {
        styleId: styleFilter || undefined,
        priorities,
        lineupPreferences,
        patchVersion: tactic.patchVersion,
      });
      setGeneratedPlans(plans);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hungarian solver failed");
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
        <div>
          <h1 className="text-xl font-bold text-slate-100">
            Squad Audit &amp; Hungarian Tactic Generator
          </h1>
          <p className="text-xs text-slate-400">
            Active Board Tactic:{" "}
            <span className="font-semibold text-cyan-300">{tactic.title}</span> (IP{" "}
            {tactic.inFormation} / OOP {tactic.outFormation})
          </p>
        </div>

        {gradedCurrent && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-[#111827] px-3.5 py-2">
            <div className="text-xs">
              <span className="text-slate-400">Active RankingFit: </span>
              <span className="font-mono font-bold text-emerald-300">
                {gradedCurrent.rankingFit.toFixed(2)}
              </span>
              <span className="ml-2 text-slate-500">
                (Cover {gradedCurrent.coverFit.toFixed(1)} · CoachAdj{" "}
                {gradedCurrent.coachingAdjustment >= 0 ? "+" : ""}
                {gradedCurrent.coachingAdjustment.toFixed(2)})
              </span>
            </div>
            <button
              type="button"
              onClick={() => loadTactic(gradedCurrent.tactic)}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25"
            >
              Apply Auto-Improved Roles/TI
            </button>
          </div>
        )}
      </div>

      <SquadImporter />

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
            Belum Ada Data Skuad Klub yang Dimuat
          </h2>
          <p className="mx-auto mt-1.5 max-w-xl text-xs text-slate-400 leading-relaxed">
            Unggah file save karier <code className="text-emerald-300">.fm</code> (diproses 100%
            lokal di Web Worker browser tanpa unggah server) atau file ekspor{" "}
            <code className="text-cyan-300">CSV / HTML</code> di atas untuk membuka Audit Starter
            XI, 3 Posisi Terlemah, dan Hungarian 13×16 Tactic Generator tanpa data sampel buatan.
          </p>
        </section>
      )}

      {players.length >= 11 && (
        <section className="rounded-xl border border-slate-800 bg-[#111827] p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] text-slate-400">
                  Target Style (13 Presets or All)
                </label>
                <select
                  value={styleFilter}
                  onChange={(e) => setStyleFilter(e.target.value)}
                  className="mt-1 rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-100"
                >
                  <option value="">All 13 Styles x 16 Dual-Shapes</option>
                  {stylesCatalog.TacticalStyles.map((st) => (
                    <option key={st.Id} value={st.Id}>
                      {st.Name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400">
                  Tactical Objective
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
                  <option value="Balanced">Balanced</option>
                  <option value="WinNow">Win Now (Aggressive)</option>
                  <option value="ProtectLead">Protect Lead (Compact)</option>
                  <option value="Underdog">Underdog (Counter Resilience)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400">
                  Risk Offset ({priorities.riskOffset >= 0 ? "+" : ""}
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
              className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {isBusy
                ? "Solving Hungarian Matrix..."
                : "Auto-Generate Best Tactic (Hungarian Solver)"}
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
                        Rank #{idx + 1} · {plan.rankingFit.toFixed(2)}
                      </span>
                      {plan.nearTieWithNext && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                          Near-Tie (&lt;0.1)
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 text-sm font-semibold text-slate-100">
                      {plan.tactic.title}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                      IP {plan.tactic.inFormation} {"->"} OOP {plan.tactic.outFormation}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-slate-500">
                      StartFit {plan.startingFit.toFixed(1)} · Cover{" "}
                      {plan.coverFit.toFixed(1)} · Pen -{plan.instructionPenalty.toFixed(2)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLoadPlanToBoard(plan)}
                    className="mt-3 w-full rounded-md border border-cyan-500/40 bg-cyan-500/15 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/25"
                  >
                    Load to Pitch Board {"->"}
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

      {players.length > 0 && (
        <RoleFitTable
          audit={auditResult}
          players={players}
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
