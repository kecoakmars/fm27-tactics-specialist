"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getTacticalStyles } from "@fm27/fm-data";
import type { TacticPlanResult } from "@fm27/shared-types";
import { analyzeSquadInWorker } from "@/lib/worker-client";
import { useLocale } from "@/stores/useLocaleStore";
import { useSquadStore } from "@/stores/useSquadStore";
import { useTacticStore } from "@/stores/useTacticStore";

export interface TacticRecommendationPanelProps {
  /** Whether the panel can collapse (useful on Tactics Board to preserve vertical space). */
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Navigate to "/" after applying a recommended tactic (useful when placed on /summary). */
  navigateToBoardOnApply?: boolean;
  onNotify?: (tone: "ok" | "error", text: string) => void;
}

export function TacticRecommendationPanel({
  collapsible = false,
  defaultOpen = true,
  navigateToBoardOnApply = false,
  onNotify,
}: TacticRecommendationPanelProps) {
  const router = useRouter();
  const { t } = useLocale();

  const tactic = useTacticStore((s) => s.tactic);
  const clubPlayers = useTacticStore((s) => s.clubPlayers);
  const loadTactic = useTacticStore((s) => s.loadTactic);

  const squadPlayers = useSquadStore((s) => s.players);
  const lineupPreferences = useSquadStore((s) => s.lineupPreferences);
  const priorities = useSquadStore((s) => s.priorities);
  const styleFilter = useSquadStore((s) => s.styleFilter);
  const generatedPlans = useSquadStore((s) => s.generatedPlans);
  const isBusy = useSquadStore((s) => s.isBusy);
  const errorMessage = useSquadStore((s) => s.errorMessage);

  const setObjective = useSquadStore((s) => s.setObjective);
  const setRiskOffset = useSquadStore((s) => s.setRiskOffset);
  const setStyleFilter = useSquadStore((s) => s.setStyleFilter);
  const setGeneratedPlans = useSquadStore((s) => s.setGeneratedPlans);
  const setBusy = useSquadStore((s) => s.setBusy);
  const setError = useSquadStore((s) => s.setError);

  const [isOpen, setIsOpen] = useState(defaultOpen);

  const stylesCatalog = useMemo(
    () => getTacticalStyles(tactic.patchVersion),
    [tactic.patchVersion],
  );

  // Use First Team players if available (>= 11), otherwise fall back to full club squad
  const activePlayers = useMemo(() => {
    const source = squadPlayers.length >= 11 ? squadPlayers : clubPlayers;
    const firstTeam = source.filter((p) => p.teamSlot === "First Team");
    return firstTeam.length >= 11 ? firstTeam : source;
  }, [clubPlayers, squadPlayers]);

  const hasSquad = activePlayers.length >= 11;

  async function handleFindBestTactics() {
    if (!hasSquad) return;
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
      if (plans.length > 0) {
        setIsOpen(true);
        onNotify?.(
          "ok",
          t(
            `Ditemukan ${plans.length} rekomendasi taktik terbaik · #1 ${plans[0]!.tactic.title}`,
            `Found ${plans.length} recommended tactics · #1 ${plans[0]!.tactic.title}`,
          ),
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : t("Gagal menyusun rekomendasi taktik", "Could not generate tactics");
      setError(msg);
      onNotify?.("error", msg);
    } finally {
      setBusy(false);
    }
  }

  function handleApplyPlan(plan: TacticPlanResult) {
    loadTactic(plan.tactic);
    onNotify?.(
      "ok",
      t(
        `Taktik diterapkan: "${plan.tactic.title}" (IP ${plan.tactic.inFormation} → OOP ${plan.tactic.outFormation})`,
        `Applied tactic: "${plan.tactic.title}" (IP ${plan.tactic.inFormation} → OOP ${plan.tactic.outFormation})`,
      ),
    );
    if (navigateToBoardOnApply) {
      router.push("/");
    }
  }

  return (
    <section
      id="tactic-recommendation-panel"
      aria-label={t("Rekomendasi & Cari Taktik Terbaik", "Tactic Recommendations & Finder")}
      className="tactical-surface rounded-2xl border border-emerald-500/25 p-4 flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-extrabold text-slate-100">
            {t("Rekomendasi & Cari Taktik Terbaik", "Tactic Finder & Recommendations")}
          </h2>
          {hasSquad ? (
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-[11px] font-mono-metric text-emerald-300">
              {activePlayers.length} {t("pemain siap dianalisis", "players ready")}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-amber-500/12 border border-amber-500/35 text-[11px] text-amber-300">
              {t("Muat save .fm di header atas untuk aktifkan", "Load .fm save in top bar to enable")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasSquad && (
            <button
              id="find-best-tactics-btn"
              type="button"
              disabled={isBusy}
              onClick={() => void handleFindBestTactics()}
              className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition cursor-pointer"
            >
              {isBusy
                ? t("Menyusun Taktik...", "Finding Best Tactics...")
                : t("Cari Taktik Terbaik", "Find Best Tactics")}
            </button>
          )}
          {collapsible && (
            <button
              id="toggle-recommendation-panel-btn"
              type="button"
              aria-expanded={isOpen}
              onClick={() => setIsOpen((v) => !v)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-[#0B0F19] border border-white/10 text-slate-300 hover:text-slate-100 cursor-pointer"
            >
              {isOpen ? t("Sembunyikan ▴", "Hide ▴") : t("Buka Filter & Hasil ▾", "Show Finder ▾")}
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {errorMessage}
        </div>
      )}

      {isOpen && (
        <>
          {!hasSquad ? (
            <p className="text-xs text-slate-400">
              {t(
                "Unggah file save karier (.fm) lewat tombol 'Muat .fm / .fmf' di pojok kanan atas untuk otomatis menghitung formasi, peran IP/OOP, dan instruksi terbaik sesuai skuad klub Anda.",
                "Upload your career save (.fm) via 'Load .fm / .fmf' in the top bar to automatically compute the optimal formations, IP/OOP roles, and instructions for your squad.",
              )}
            </p>
          ) : (
            <>
              {/* Filter Controls */}
              <div className="flex flex-wrap items-end gap-3 pt-1 border-t border-white/8">
                <div>
                  <label className="block text-[11px] text-slate-400">
                    {t("Gaya Bermain", "Tactical Style")}
                  </label>
                  <select
                    value={styleFilter}
                    onChange={(e) => setStyleFilter(e.target.value)}
                    className="mt-1 rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-100 cursor-pointer"
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
                    className="mt-1 rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-100 cursor-pointer"
                  >
                    <option value="Balanced">{t("Seimbang", "Balanced")}</option>
                    <option value="WinNow">{t("Menyerang Penuh", "Attacking")}</option>
                    <option value="ProtectLead">
                      {t("Amankan Keunggulan", "Protect Lead")}
                    </option>
                    <option value="Underdog">{t("Tim Underdog", "Underdog")}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400">
                    {t("Keberanian Risiko", "Risk Level")} (
                    {priorities.riskOffset >= 0 ? "+" : ""}
                    {priorities.riskOffset})
                  </label>
                  <input
                    type="range"
                    min={-2}
                    max={2}
                    step={1}
                    value={priorities.riskOffset}
                    onChange={(e) => setRiskOffset(Number(e.target.value))}
                    className="mt-2 w-28 accent-cyan-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* Generated Top 6 Tactic Recommendations */}
              {generatedPlans.length > 0 ? (
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {generatedPlans.slice(0, 6).map((plan, idx) => (
                    <div
                      key={`${plan.tactic.title}-${idx}`}
                      className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#0B0F19] p-3 hover:border-cyan-500/35 transition"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono-metric text-[11px] font-bold text-emerald-300">
                            #{idx + 1} · {t("Kecocokan", "Fit")} {plan.rankingFit.toFixed(0)}
                          </span>
                          <span className="font-mono-metric text-[10px] text-slate-400">
                            XI {plan.startingFit.toFixed(0)} · {t("Cad", "Cov")}{" "}
                            {plan.coverFit.toFixed(0)}
                          </span>
                        </div>
                        <div className="mt-1.5 text-sm font-semibold text-slate-100 truncate">
                          {plan.tactic.title}
                        </div>
                        <div className="mt-0.5 font-mono-metric text-[11px] text-cyan-300/90">
                          IP {plan.tactic.inFormation} → OOP {plan.tactic.outFormation}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApplyPlan(plan)}
                        className="mt-3 w-full rounded-lg border border-cyan-500/40 bg-cyan-500/15 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 cursor-pointer transition"
                      >
                        {navigateToBoardOnApply
                          ? t("Terapkan & Buka Papan Taktik →", "Apply & Open Tactics Board →")
                          : t("Terapkan ke Papan Taktik", "Apply to Tactics Board")}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  {t(
                    "Klik 'Cari Taktik Terbaik' untuk membandingkan seluruh kombinasi formasi IP/OOP yang paling cocok bagi skuad Anda.",
                    "Click 'Find Best Tactics' to rank all IP/OOP formation combinations tailored to your squad.",
                  )}
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
