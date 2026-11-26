"use client";

import { getPitchCatalog } from "@fm27/fm-data";
import type {
  LineupPreference,
  Player,
  SquadAuditResult,
} from "@fm27/shared-types";

interface RoleFitTableProps {
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
  audit,
  players,
  lineupPreferences,
  patchVersion,
  onInspectSlot,
  onApplyRoleAlternative,
  onToggleMustStart,
  onSetSlotLock,
}: RoleFitTableProps) {
  const catalog = getPitchCatalog(patchVersion);
  const lockByUid = new Map(lineupPreferences.map((lp) => [lp.playerUid, lp]));
  const weakSet = new Set(audit?.weakestThreeSlotIndices ?? []);

  return (
    <div className="space-y-4">
      {audit && (
        <section className="rounded-xl border border-slate-800 bg-[#111827] p-4">
          <h3 className="text-sm font-semibold text-slate-100">
            Active XI Role Fit Breakdown (11 Starters)
          </h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                  <th className="py-2 pr-3">Slot</th>
                  <th className="py-2 pr-3">Starter</th>
                  <th className="py-2 pr-3">IP Role (Qual)</th>
                  <th className="py-2 pr-3">OOP Role (Qual)</th>
                  <th className="py-2 pr-3">Role Fit</th>
                  <th className="py-2 pr-3">Better Role Option</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {audit.starterAudits.map((row) => {
                  const isWeak = weakSet.has(row.slotIndex);
                  const bestAlt = row.betterRoleAlternatives[0];
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
                        {row.playerName}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {row.inRoleId}{" "}
                        <span className="font-mono text-cyan-400">
                          ({row.inRoleQuality.toFixed(1)})
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {row.outRoleId}{" "}
                        <span className="font-mono text-amber-400">
                          ({row.outRoleQuality.toFixed(1)})
                        </span>
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
                          {row.fitScore.toFixed(1)}
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
                            className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-300 hover:bg-cyan-500/20"
                          >
                            Switch {bestAlt.phase} {"->"} {bestAlt.roleId} (
                            {bestAlt.projectedFit.toFixed(1)})
                          </button>
                        ) : (
                          <span className="text-slate-500">Optimal role</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => onInspectSlot(row.slotIndex)}
                          className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-200 hover:border-emerald-500/50 hover:text-emerald-300"
                        >
                          Replace ({row.betterInternalReplacements.length})
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
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Full Squad Pool &amp; Lineup Locks ({players.length} Players)
            </h3>
            <p className="text-xs text-slate-400">
              Locked starters receive <code className="font-mono text-emerald-300">+10000</code>{" "}
              weight in the Hungarian assignment solver.
            </p>
          </div>
          <span className="font-mono text-xs text-emerald-300">
            Locked: {lineupPreferences.filter((l) => l.mustStart).length} / 11
          </span>
        </div>

        <div className="mt-3 max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                <th className="py-1.5 pr-2">Lock</th>
                <th className="py-1.5 pr-2">Player</th>
                <th className="py-1.5 pr-2">Age</th>
                <th className="py-1.5 pr-2">Natural Positions</th>
                <th className="py-1.5 pr-2">Lock IP Slot</th>
                <th className="py-1.5">Lock OOP Slot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {players.map((p) => {
                const pref = lockByUid.get(p.uid);
                const naturalPos = Object.entries(p.positions)
                  .filter(([, v]) => v >= 15)
                  .map(([k]) => k)
                  .join(", ");

                return (
                  <tr key={p.uid} className="hover:bg-slate-800/30">
                    <td className="py-1.5 pr-2">
                      <input
                        type="checkbox"
                        checked={Boolean(pref?.mustStart)}
                        onChange={() => onToggleMustStart(p.uid)}
                        aria-label={`Lock ${p.name} as starter`}
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
                      <select
                        value={pref?.lockedInSlot ?? ""}
                        onChange={(e) => onSetSlotLock(p.uid, "ip", e.target.value)}
                        className="rounded border border-slate-700 bg-[#0B0F19] px-1.5 py-0.5 text-[11px] text-slate-200"
                      >
                        <option value="">Any IP</option>
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
                        <option value="">Any OOP</option>
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
