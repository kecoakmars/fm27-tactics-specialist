"use client";

import React, { useMemo, useState } from "react";
import { getPitchCatalog, getRoleProfiles } from "@fm27/fm-data";
import {
  getCandidateRolesForSlot,
  getPlayerInstructionPolicy,
} from "@fm27/fm-engine";
import type { Duty } from "@fm27/shared-types";
import { useLocale } from "@/stores/useLocaleStore";
import { useTacticStore } from "@/stores/useTacticStore";

const DUTIES: readonly Duty[] = ["Defend", "Support", "Attack"];

export function PlayerInstructionModal() {
  const { t } = useLocale();
  const {
    tactic,
    selectedSlotIndex,
    playerModalOpen,
    setPlayerModalOpen,
    setSlotRole,
    setSlotDuty,
    setSlotPlayerInstructionGroupBit,
    loadTactic,
  } = useTacticStore();

  const [phaseTab, setPhaseTab] = useState<"ip" | "oop">("ip");

  const catalog = useMemo(() => getPitchCatalog(tactic.patchVersion), [tactic.patchVersion]);
  const roleProfiles = useMemo(
    () => getRoleProfiles(tactic.patchVersion),
    [tactic.patchVersion],
  );

  if (!playerModalOpen || selectedSlotIndex === null) return null;
  const slot = tactic.slots[selectedSlotIndex];
  if (!slot) return null;

  const phaseNum = phaseTab === "ip" ? 0 : 1;
  const cfg = phaseTab === "ip" ? slot.inPossession : slot.outOfPossession;
  const shapeSlots = tactic.slots.map((s) =>
    phaseTab === "ip" ? s.inPossession.positionId : s.outOfPossession.positionId,
  );

  const candidateRoles = getCandidateRolesForSlot(
    cfg.positionId,
    phaseNum,
    shapeSlots,
    tactic.patchVersion,
  );
  const activeRoleProfile = roleProfiles.Roles.find((r) => r.Id === cfg.roleId);
  const piGroups = catalog.PlayerInstructions.filter((g) => g.Phase === phaseNum);

  const updatePlayerLabel = (nextName: string) => {
    loadTactic({
      ...tactic,
      slots: tactic.slots.map((s, idx) =>
        idx === selectedSlotIndex
          ? { ...s, playerName: nextName || undefined }
          : s,
      ),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
      onClick={() => setPlayerModalOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("Peran & Instruksi Pemain", "Player Role & Instructions")}
        className="tactical-surface-elevated w-full max-w-2xl max-h-[88vh] rounded-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0B0F19]">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-slate-800 border border-white/15 flex items-center justify-center font-mono-metric text-sm font-bold text-slate-100">
              #{slot.slotIndex + 1}
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {slot.playerName ?? `${t("Pemain", "Player")} #${slot.slotIndex + 1}`}
              </h2>
              <p className="text-xs text-slate-400 font-mono-metric">
                IP {slot.inPossession.positionId} → OOP {slot.outOfPossession.positionId}
              </p>
            </div>
          </div>

          <button
            id="close-pi-modal-btn"
            type="button"
            onClick={() => setPlayerModalOpen(false)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 cursor-pointer"
          >
            {t("Selesai", "Done")}
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="slot-player-name-input"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1"
              >
                {t("Nama Pemain", "Player Name")}
              </label>
              <input
                id="slot-player-name-input"
                type="text"
                value={slot.playerName ?? ""}
                onChange={(e) => updatePlayerLabel(e.target.value)}
                placeholder={`${t("Pemain", "Player")} #${slot.slotIndex + 1}`}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0F19] border border-white/12 text-sm text-slate-100 placeholder:text-slate-600"
              />
            </div>

            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                {t("Fase Permainan", "Phase")}
              </span>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[#0B0F19] border border-white/10">
                <button
                  id="pi-modal-tab-ip"
                  type="button"
                  onClick={() => setPhaseTab("ip")}
                  className={`py-1.5 rounded-md text-xs font-bold cursor-pointer transition ${
                    phaseTab === "ip"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {t("Menyerang", "In Possession")} ({slot.inPossession.positionId})
                </button>
                <button
                  id="pi-modal-tab-oop"
                  type="button"
                  onClick={() => setPhaseTab("oop")}
                  className={`py-1.5 rounded-md text-xs font-bold cursor-pointer transition ${
                    phaseTab === "oop"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {t("Bertahan", "Out of Possession")} ({slot.outOfPossession.positionId})
                </button>
              </div>
            </div>
          </div>

          {/* Role & Duty Selector */}
          <div className="rounded-xl p-4 bg-[#0B0F19]/80 border border-white/8 flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="sm:col-span-2">
                <label
                  htmlFor="slot-role-select"
                  className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1"
                >
                  {t("Peran Pemain", "Player Role")}
                </label>
                <select
                  id="slot-role-select"
                  value={cfg.roleId}
                  onChange={(e) => setSlotRole(slot.slotIndex, phaseTab, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-white/15 text-sm font-semibold text-slate-100 cursor-pointer"
                >
                  {candidateRoles.map((r) => (
                    <option key={r.Id} value={r.Id}>
                      {r.Name}
                    </option>
                  ))}
                </select>
              </div>

              {phaseTab === "ip" && (
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Duty
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    {DUTIES.map((duty) => (
                      <button
                        key={duty}
                        id={`slot-duty-${duty}`}
                        type="button"
                        onClick={() => setSlotDuty(slot.slotIndex, duty)}
                        className={`py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                          slot.inPossession.duty === duty
                            ? "bg-cyan-500/20 border-cyan-400 text-cyan-200"
                            : "bg-[#111827] border-white/10 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {duty.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {activeRoleProfile && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400 mr-1">
                  {t("Atribut Utama:", "Key Attributes:")}
                </span>
                {activeRoleProfile.Keys.map((attr) => (
                  <span
                    key={attr}
                    className="px-2 py-0.5 rounded bg-emerald-500/12 border border-emerald-500/25 text-emerald-300 text-[11px] font-mono-metric"
                  >
                    {attr.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Player Instructions */}
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {t("Instruksi Individu", "Player Instructions")}
            </span>

            {piGroups.map((group) => {
              const nonZeroBits = group.Options.map((o) => o.Bit).filter((b) => b > 0);
              const visibleOptions = group.Options.filter((opt) => {
                if (opt.Bit === 0) return true;
                return (
                  getPlayerInstructionPolicy(
                    catalog.PlayerInstructionPolicies,
                    phaseNum,
                    cfg.positionId,
                    cfg.roleId,
                    opt.Bit,
                  ) !== "1"
                );
              });

              if (visibleOptions.length <= 1) return null;

              const activeNonZero = nonZeroBits.find((b) =>
                cfg.playerInstructionBits.includes(b),
              );
              const selectedBit = activeNonZero ?? 0;

              return (
                <div
                  key={group.Id}
                  className="rounded-lg p-3 bg-[#0B0F19]/65 border border-white/8 flex flex-col gap-2"
                >
                  <span className="text-xs font-semibold text-slate-200">{group.Label}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {visibleOptions.map((opt) => {
                      const policy =
                        opt.Bit === 0
                          ? "0"
                          : getPlayerInstructionPolicy(
                              catalog.PlayerInstructionPolicies,
                              phaseNum,
                              cfg.positionId,
                              cfg.roleId,
                              opt.Bit,
                            );
                      const isPreset = policy === "3";
                      const isLockedOff = policy === "2";
                      const isSelected = isPreset || selectedBit === opt.Bit;

                      return (
                        <button
                          key={`${group.Id}-${opt.Bit}`}
                          id={`pi-opt-${group.Id}-${opt.Bit}`}
                          type="button"
                          disabled={isPreset || isLockedOff}
                          onClick={() =>
                            setSlotPlayerInstructionGroupBit(
                              slot.slotIndex,
                              phaseTab,
                              nonZeroBits,
                              opt.Bit,
                            )
                          }
                          className={`px-2.5 py-1 rounded text-xs font-medium border transition ${
                            isPreset
                              ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-200 cursor-not-allowed"
                              : isLockedOff
                                ? "bg-slate-900/40 border-white/5 text-slate-600 line-through cursor-not-allowed"
                                : isSelected
                                  ? phaseTab === "ip"
                                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-100 cursor-pointer"
                                    : "bg-amber-500/20 border-amber-400 text-amber-100 cursor-pointer"
                                  : "bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200 cursor-pointer"
                          }`}
                        >
                          {opt.Label}
                          {isPreset ? ` (${t("Bawaan Peran", "Role Default")})` : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
