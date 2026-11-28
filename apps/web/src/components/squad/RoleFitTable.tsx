"use client";

import { useMemo } from "react";
import { getPitchCatalog } from "@fm27/fm-data";
import {
  computePlayerBestTacticEffectiveness,
  computePlayerSlotEffectiveness,
} from "@fm27/fm-engine";
import type {
  DualPhaseTactic,
  LineupPreference,
  Player,
  SquadAuditResult,
} from "@fm27/shared-types";
import { FamiliaritySegmentsBar } from "../analytics/FamiliaritySegmentsBar";
import { useLocale } from "../../stores/useLocaleStore";

interface RoleFitTableProps {
  tactic: DualPhaseTactic;
  audit: SquadAuditResult | null;
  players: readonly Player[];
  lineupPreferences: readonly LineupPreference[];
  patchVersion: string;
  onInspectSlot: (slotIndex: number) => void;
  onApplyRoleAlternative: (
    slotIndex: number,
    phase: "ip" | "oop",
    roleId: string,
  ) => void;
  onToggleMustStart: (playerUid: number) => void;
  onSetSlotLock: (playerUid: number, phase: "ip" | "oop", slotId: string) => void;
}

export function RoleFitTable({
  tactic,
  audit,
  players,
  lineupPreferences,
  patchVersion,
  onInspectSlot,
  onApplyRoleAlternative,
  onToggleMustStart,
  onSetSlotLock,
}: RoleFitTableProps) {
  const { t } = useLocale();
  const catalog = getPitchCatalog(patchVersion);
  const roleNameById = new Map(catalog.Roles.map((r) => [r.Id, r.Name]));
  const lockByUid = new Map(lineupPreferences.map((lp) => [lp.playerUid, lp]));
  const playerByUid = useMemo(() => new Map(players.map((p) => [p.uid, p])), [players]);
  const weakSet = new Set(audit?.weakestThreeSlotIndices ?? []);

  const squadBestEffByUid = useMemo(() => {
    const map = new Map<number, ReturnType<typeof computePlayerBestTacticEffectiveness>>();
    for (const p of players) {
      map.set(p.uid, computePlayerBestTacticEffectiveness(p, tactic));
    }
    return map;
  }, [players, tactic]);

  return (
    <div className="space-y-4">
      {audit && (
        <section className="rounded-xl border border-slate-800 bg-[#111827] p-4">
          <h3 className="text-sm font-semibold text-slate-100">
            {t("Starting XI Aktif", "Active Starting XI")}
          </h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                  <th className="py-2 pr-3">{t("Posisi", "Position")}</th>
                  <th className="py-2 pr-3">{t("Pemain", "Player")}</th>
                  <th className="py-2 pr-3">{t("Peran IP", "IP Role")}</th>
                  <th className="py-2 pr-3">{t("Peran OOP", "OOP Role")}</th>
                  <th className="py-2 pr-3">{t("Efektivitas", "Effectiveness")}</th>
                  <th className="py-2 pr-3">{t("Kecocokan", "Fit")}</th>
                  <th className="py-2 pr-3">{t("Saran Peran", "Role Suggestion")}</th>
                  <th className="py-2 text-right">{t("Opsi", "Options")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {audit.starterAudits.map((row) => {
                  const isWeak = weakSet.has(row.slotIndex);
                  const bestAlt = row.betterRoleAlternatives[0];
                  const playerObj = playerByUid.get(row.playerUid);
                  const slotObj = tactic.slots[row.slotIndex];
                  const eff =
                    playerObj && slotObj
                      ? computePlayerSlotEffectiveness(playerObj, slotObj, tactic)
                      : null;

                  return (
                    <tr
                      key={row.slotIndex}
                      className={isWeak ? "bg-rose-500/5" : "hover:bg-slate-800/40"}
                    >
                      <td className="py-2 pr-3 font-mono text-slate-300">
                        <span className="text-cyan-300">{row.inSlot}</span> /{" "}
                        <span className="text-amber-300">{row.outSlot}</span>
                      </td>
                      <td className="py-2 pr-3 font-medium text-slate-100">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{row.playerName}</span>
                          {playerObj?.condition !== undefined && (
                            <span
                              title={t("Kondisi Fisik / Ketajaman", "Condition / Sharpness")}
                              className="rounded bg-slate-800/90 px-1.5 py-0.5 font-mono text-[10px] text-slate-300"
                            >
                              {playerObj.condition}%
                              {playerObj.matchSharpness !== undefined
                                ? ` · ${playerObj.matchSharpness}%`
                                : ""}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {roleNameById.get(row.inRoleId) ?? row.inRoleId}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {roleNameById.get(row.outRoleId) ?? row.outRoleId}
                      </td>
                      <td className="py-2 pr-3">
                        {eff ? (
                          <FamiliaritySegmentsBar
                            score={eff.score}
                            size="sm"
                            showNumeric
                            title={
                              eff.fmFamiliarityScore !== null
                                ? `${eff.bars}/10 · FM Fam ${eff.fmFamiliarityScore.toFixed(0)} · Fit ${eff.roleSlotFitScore.toFixed(0)}`
                                : `${eff.bars}/10 (${eff.score.toFixed(0)})`
                            }
                          />
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-mono font-semibold">
                        <span
                          className={
                            row.fitScore >= 78
                              ? "text-emerald-300"
                              : row.fitScore >= 66
                                ? "text-amber-300"
                                : "text-rose-300"
                          }
                        >
                          {row.fitScore.toFixed(0)}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        {bestAlt ? (
                          <button
                            type="button"
                            onClick={() =>
                              onApplyRoleAlternative(
                                row.slotIndex,
                                bestAlt.phase === "IP" ? "ip" : "oop",
                                bestAlt.roleId,
                              )
                            }
                            className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-300 hover:bg-cyan-500/20 cursor-pointer"
                          >
                            {bestAlt.phase} →{" "}
                            {roleNameById.get(bestAlt.roleId) ?? bestAlt.roleId} (
                            {bestAlt.projectedFit.toFixed(0)})
                          </button>
                        ) : (
                          <span className="text-slate-500">
                            {t("Sudah pas", "Optimal")}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => onInspectSlot(row.slotIndex)}
                          className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-200 hover:border-emerald-500/50 hover:text-emerald-300 cursor-pointer"
                        >
                          {t("Ganti", "Replace")} ({row.betterInternalReplacements.length})
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-800 bg-[#111827] p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">
            {t("Daftar Pemain", "Squad List")} ({players.length})
          </h3>
          <span className="font-mono text-xs text-emerald-300">
            {t("Wajib Starter:", "Locked Starters:")}{" "}
            {lineupPreferences.filter((l) => l.mustStart).length} / 11
          </span>
        </div>

        <div className="mt-3 max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                <th className="py-1.5 pr-2">{t("Kunci XI", "Lock XI")}</th>
                <th className="py-1.5 pr-2">{t("Pemain", "Player")}</th>
                <th className="py-1.5 pr-2">{t("Usia", "Age")}</th>
                <th className="py-1.5 pr-2">{t("Posisi Alami", "Positions")}</th>
                <th className="py-1.5 pr-2">{t("Efektivitas Taktik", "Effectiveness")}</th>
                <th className="py-1.5 pr-2">{t("Posisi IP", "IP Position")}</th>
                <th className="py-1.5">{t("Posisi OOP", "OOP Position")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {players.map((p) => {
                const pref = lockByUid.get(p.uid);
                const naturalPos = Object.entries(p.positions)
                  .filter(([, v]) => v >= 15)
                  .map(([k]) => k)
                  .join(", ");
                const bestEff = squadBestEffByUid.get(p.uid);

                return (
                  <tr key={p.uid} className="hover:bg-slate-800/30">
                    <td className="py-1.5 pr-2">
                      <input
                        type="checkbox"
                        checked={Boolean(pref?.mustStart)}
                        onChange={() => onToggleMustStart(p.uid)}
                        aria-label={`Lock ${p.name}`}
                        className="h-3.5 w-3.5 accent-emerald-500"
                      />
                    </td>
                    <td className="py-1.5 pr-2 font-medium text-slate-100">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{p.name}</span>
                        {p.teamSlot && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              p.teamSlot === "First Team"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : p.teamSlot === "U21 / Reserve"
                                  ? "bg-cyan-500/15 text-cyan-300"
                                  : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {p.teamSlot}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 pr-2 font-mono text-slate-400">
                      {p.age ?? "-"}
                    </td>
                    <td className="py-1.5 pr-2 font-mono text-cyan-300">
                      {naturalPos || "-"}
                    </td>
                    <td className="py-1.5 pr-2">
                      {bestEff ? (
                        <div className="flex items-center gap-2">
                          <FamiliaritySegmentsBar
                            score={bestEff.score}
                            size="xs"
                            showNumeric
                            title={`${bestEff.inSlot}/${bestEff.outSlot}: ${bestEff.bars}/10 (${bestEff.score.toFixed(0)})`}
                          />
                          <span className="font-mono text-[10px] text-slate-400">
                            {bestEff.inSlot}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2">
                      <select
                        value={pref?.lockedInSlot ?? ""}
                        onChange={(e) => onSetSlotLock(p.uid, "ip", e.target.value)}
                        className="rounded border border-slate-700 bg-[#0B0F19] px-1.5 py-0.5 text-[11px] text-slate-200"
                      >
                        <option value="">{t("Bebas", "Any")}</option>
                        {catalog.Positions.map((pos) => (
                          <option key={pos.Id} value={pos.Id}>
                            {pos.Id}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5">
                      <select
                        value={pref?.lockedOutSlot ?? ""}
                        onChange={(e) => onSetSlotLock(p.uid, "oop", e.target.value)}
                        className="rounded border border-slate-700 bg-[#0B0F19] px-1.5 py-0.5 text-[11px] text-slate-200"
                      >
                        <option value="">{t("Bebas", "Any")}</option>
                        {catalog.Positions.map((pos) => (
                          <option key={pos.Id} value={pos.Id}>
                            {pos.Id}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
