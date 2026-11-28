"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPitchCatalog } from "@fm27/fm-data";
import type { TacticPlanResult } from "@fm27/shared-types";
import { ActiveTeamInstructionsSummary } from "../../components/instructions/ActiveTeamInstructionsSummary";
import { ReplacementModal } from "../../components/squad/ReplacementModal";
import { RoleFitTable } from "../../components/squad/RoleFitTable";
import { SquadImporter } from "../../components/squad/SquadImporter";
import { WeakestPositionsCard } from "../../components/squad/WeakestPositionsCard";
import {
  auditSquadInWorker,
  gradeImportedTacticInWorker,
} from "../../lib/worker-client";
import { useLocale } from "../../stores/useLocaleStore";
import { useSquadStore } from "../../stores/useSquadStore";
import { useTacticStore } from "../../stores/useTacticStore";

export default function SquadAuditPage() {
  const { t } = useLocale();
  const tactic = useTacticStore((s) => s.tactic);
  const loadTactic = useTacticStore((s) => s.loadTactic);
  const setSlotRole = useTacticStore((s) => s.setSlotRole);
  const assignPlayerToSlot = useTacticStore((s) => s.assignPlayerToSlot);
  const setGlobalNotice = useTacticStore((s) => s.setGlobalNotice);

  const players = useSquadStore((s) => s.players);
  const lineupPreferences = useSquadStore((s) => s.lineupPreferences);
  const auditResult = useSquadStore((s) => s.auditResult);
  const errorMessage = useSquadStore((s) => s.errorMessage);

  const toggleMustStart = useSquadStore((s) => s.toggleMustStart);
  const setPlayerSlotLock = useSquadStore((s) => s.setPlayerSlotLock);
  const setAuditResult = useSquadStore((s) => s.setAuditResult);
  const setError = useSquadStore((s) => s.setError);

  const [inspectSlotIdx, setInspectSlotIdx] = useState<number | null>(null);
  const [baselineCurrent, setBaselineCurrent] = useState<TacticPlanResult | null>(null);
  const [gradedCurrent, setGradedCurrent] = useState<TacticPlanResult | null>(null);
  const [squadTierFilter, setSquadTierFilter] = useState<"first-team" | "first-and-u21" | "all">("first-team");
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pitchCatalog = getPitchCatalog(tactic.patchVersion);
  const roleNameById = useMemo(
    () => new Map(pitchCatalog.Roles.map((r) => [r.Id, r.Name])),
    [pitchCatalog],
  );

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

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
      setBaselineCurrent(null);
      setGradedCurrent(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [audit, baseline, graded] = await Promise.all([
          auditSquadInWorker(tactic, activePlayers),
          gradeImportedTacticInWorker(
            tactic,
            activePlayers,
            false,
            lineupPreferences,
          ),
          gradeImportedTacticInWorker(
            tactic,
            activePlayers,
            true,
            lineupPreferences,
          ),
        ]);
        if (!cancelled) {
          setAuditResult(audit);
          setBaselineCurrent(baseline);
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
  }, [activePlayers, lineupPreferences, tactic, setAuditResult, setError, t]);

  const optimizationDiff = useMemo(() => {
    if (!baselineCurrent || !gradedCurrent) {
      return { changedSlotCount: 0, examples: [] as string[] };
    }
    let changedSlotCount = 0;
    const examples: string[] = [];

    for (let i = 0; i < tactic.slots.length; i++) {
      const curSlot = tactic.slots[i]!;
      const nextSlot = gradedCurrent.tactic.slots[i];
      if (!nextSlot) continue;

      const starterChanged = curSlot.playerUid !== nextSlot.playerUid;
      const ipChanged =
        curSlot.inPossession.roleId !== nextSlot.inPossession.roleId;
      const oopChanged =
        curSlot.outOfPossession.roleId !== nextSlot.outOfPossession.roleId;

      if (starterChanged || ipChanged || oopChanged) {
        changedSlotCount++;
        if (examples.length < 3) {
          const shortName =
            nextSlot.playerName?.split(" ").slice(-1)[0] ||
            nextSlot.inPossession.positionId;
          if (ipChanged) {
            examples.push(
              `${shortName} → ${roleNameById.get(nextSlot.inPossession.roleId) ?? nextSlot.inPossession.roleId}`,
            );
          } else if (oopChanged) {
            examples.push(
              `${shortName} → ${roleNameById.get(nextSlot.outOfPossession.roleId) ?? nextSlot.outOfPossession.roleId} (OOP)`,
            );
          } else {
            examples.push(
              `${nextSlot.inPossession.positionId}: ${nextSlot.playerName ?? shortName}`,
            );
          }
        }
      }
    }

    return { changedSlotCount, examples };
  }, [baselineCurrent, gradedCurrent, roleNameById, tactic.slots]);

  function handleOptimizeRoles() {
    if (!baselineCurrent || !gradedCurrent || optimizationDiff.changedSlotCount === 0) {
      return;
    }
    const prevScore = baselineCurrent.rankingFit.toFixed(1);
    const nextScore = gradedCurrent.rankingFit.toFixed(1);
    const count = optimizationDiff.changedSlotCount;
    const detailText =
      optimizationDiff.examples.length > 0
        ? ` (${optimizationDiff.examples.join(", ")}${count > optimizationDiff.examples.length ? ", ..." : ""})`
        : "";

    loadTactic(gradedCurrent.tactic);

    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setGlobalNotice({
      tone: "ok",
      text: t(
        `Peran ${count} posisi disesuaikan dengan skuad${detailText} · Kecocokan ${prevScore} → ${nextScore}`,
        `Optimized ${count} slot roles for your squad${detailText} · Fit ${prevScore} → ${nextScore}`,
      ),
    });
    noticeTimerRef.current = setTimeout(() => setGlobalNotice(null), 6500);
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
            {t("Skuad & Audit Posisi", "Squad & Role Audit")}
          </h1>
          <span className="rounded-lg border border-white/10 bg-[#111827] px-2.5 py-1 text-xs text-slate-300">
            <strong className="text-cyan-300">{tactic.title}</strong> (IP{" "}
            {tactic.inFormation} / OOP {tactic.outFormation})
          </span>
          <Link
            href="/"
            className="rounded-lg border border-emerald-500/35 bg-emerald-500/12 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
          >
            {t("Cari Taktik Terbaik di Papan Taktik →", "Find Best Tactics on Board →")}
          </Link>
        </div>

        {baselineCurrent && gradedCurrent && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-[#111827] px-3.5 py-2">
            <span className="text-xs text-slate-300">
              {t("Kecocokan Taktik:", "Tactic Fit:")}{" "}
              <strong className="font-mono text-emerald-300">
                {baselineCurrent.rankingFit.toFixed(0)}
              </strong>
              {optimizationDiff.changedSlotCount > 0 &&
                gradedCurrent.rankingFit > baselineCurrent.rankingFit + 0.05 && (
                  <span className="font-mono text-cyan-300">
                    {" → "}
                    {gradedCurrent.rankingFit.toFixed(0)}
                  </span>
                )}
            </span>
            {optimizationDiff.changedSlotCount > 0 ? (
              <button
                id="optimize-roles-btn"
                type="button"
                onClick={handleOptimizeRoles}
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 cursor-pointer transition"
              >
                {t(
                  `Optimalkan Peran (${optimizationDiff.changedSlotCount})`,
                  `Optimize Roles (${optimizationDiff.changedSlotCount})`,
                )}
              </button>
            ) : (
              <span
                id="optimize-roles-optimal-badge"
                className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300/80 select-none"
              >
                {t("Peran Sudah Optimal ✓", "Roles Optimal ✓")}
              </span>
            )}
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

      {auditResult && (
        <WeakestPositionsCard
          audit={auditResult}
          onInspectSlot={(idx) => setInspectSlotIdx(idx)}
        />
      )}

      {activePlayers.length > 0 && (
        <>
          <ActiveTeamInstructionsSummary tactic={tactic} />
          <RoleFitTable
            tactic={tactic}
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
        </>
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
