"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getStaffFormulas } from "@fm27/fm-data";
import {
  calculateAllStaffStars,
  optimizeStaffAssignments,
} from "@fm27/fm-engine";
import type { StaffCategoryId, StaffMember } from "@fm27/shared-types";
import { importAnySupportedFile } from "../../lib/file-importer";
import { useLocale } from "../../stores/useLocaleStore";
import { useTacticStore } from "../../stores/useTacticStore";

interface StaffOptimizerTableProps {
  patchVersion: string;
  onInspectCoach: (coach: StaffMember) => void;
}

export function StaffOptimizerTable({
  patchVersion,
  onInspectCoach,
}: StaffOptimizerTableProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const formulas = getStaffFormulas(patchVersion);
  const { t } = useLocale();

  const { clubStaff, worldStaffPool } = useTacticStore();

  const [freeAgentsOnly, setFreeAgentsOnly] = useState(false);
  const [clubStaffOnly, setClubStaffOnly] = useState(false);
  const [focusCategory, setFocusCategory] =
    useState<StaffCategoryId>("attacking_tactical");
  const [selectedPoolUids, setSelectedPoolUids] = useState<number[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (clubStaff.length > 0) {
      setSelectedPoolUids(clubStaff.slice(0, 12).map((s) => s.uid));
    } else {
      setSelectedPoolUids([]);
    }
  }, [clubStaff]);

  const hasLiveDirectory = clubStaff.length > 0 || worldStaffPool.length > 0;

  const clubStaffUidSet = useMemo(
    () => new Set(clubStaff.map((s) => s.uid)),
    [clubStaff],
  );

  const activeDirectory = useMemo(() => {
    if (worldStaffPool.length > 0 || clubStaff.length > 0) {
      const merged = new Map<number, StaffMember>();
      for (const s of clubStaff) merged.set(s.uid, s);
      for (const s of worldStaffPool) {
        if (!merged.has(s.uid)) merged.set(s.uid, s);
      }
      return Array.from(merged.values());
    }
    return [];
  }, [clubStaff, worldStaffPool]);

  const staffByUid = useMemo(
    () => new Map(activeDirectory.map((s) => [s.uid, s])),
    [activeDirectory],
  );

  const filteredDirectory = useMemo(() => {
    const rows = activeDirectory
      .filter((s) => {
        if (clubStaffOnly && !clubStaffUidSet.has(s.uid)) return false;
        if (freeAgentsOnly && !s.isFreeAgent) return false;
        return true;
      })
      .map((member) => {
        const stars = calculateAllStaffStars(member.attributes, patchVersion);
        const targetStars =
          stars.find((r) => r.categoryId === focusCategory)?.stars ?? 0.5;
        const bestStars = Math.max(...stars.map((r) => r.stars));
        return { member, targetStars, bestStars };
      });
    rows.sort((a, b) => b.targetStars - a.targetStars || b.bestStars - a.bestStars);
    return rows;
  }, [
    activeDirectory,
    clubStaffOnly,
    clubStaffUidSet,
    freeAgentsOnly,
    focusCategory,
    patchVersion,
  ]);

  const poolMembers = useMemo(
    () =>
      selectedPoolUids
        .map((uid) => staffByUid.get(uid))
        .filter((s): s is StaffMember => Boolean(s)),
    [selectedPoolUids, staffByUid],
  );

  const assignmentPlan = useMemo(
    () =>
      poolMembers.length > 0
        ? optimizeStaffAssignments(poolMembers, patchVersion)
        : null,
    [poolMembers, patchVersion],
  );

  async function handleImportSaveFile(file: File) {
    setImportError(null);
    try {
      await importAnySupportedFile(file);
    } catch (err) {
      setImportError(
        err instanceof Error
          ? err.message
          : t("Gagal membuka file save .fm", "Failed to open .fm save"),
      );
    }
  }

  function toggleCoachInPool(uid: number) {
    setSelectedPoolUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    );
  }

  const labelByCat = new Map(formulas.categories.map((c) => [c.id, c.label]));

  return (
    <div className="space-y-5">
      <input
        ref={fileRef}
        type="file"
        accept=".fm"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportSaveFile(file);
          e.target.value = "";
        }}
      />

      {assignmentPlan && (
        <section className="rounded-xl border border-emerald-500/30 bg-[#111827] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-emerald-300">
              {t("Pembagian Tugas Pelatih Klub", "Club Coaching Assignments")} (
              {poolMembers.length})
            </h3>
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 font-mono text-xs font-bold text-emerald-300">
              {t("Rata-rata:", "Avg:")} {assignmentPlan.averageStars.toFixed(1)}★
            </div>
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            {assignmentPlan.assignments.map((item) => {
              const lead = staffByUid.get(item.leadStaffUid);
              const supports = item.supportStaffUids
                .map((id) => staffByUid.get(id)?.name)
                .filter(Boolean);

              return (
                <div
                  key={item.categoryId}
                  className="rounded-lg border border-slate-800 bg-[#0B0F19] p-3"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-200">
                      {labelByCat.get(item.categoryId)}
                    </span>
                    <span className="font-mono font-bold text-emerald-300">
                      {item.effectiveStars.toFixed(1)}★
                    </span>
                  </div>
                  <div className="mt-1.5 text-xs font-medium text-cyan-300 truncate">
                    {lead?.name ?? `#${item.leadStaffUid}`}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">
                      {supports.length > 0
                        ? `+${supports.length} ${t("asisten", "support")}`
                        : t("Utama", "Lead")}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                        item.workload === "Light"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : item.workload === "Average"
                            ? "bg-cyan-500/20 text-cyan-300"
                            : "bg-rose-500/20 text-rose-300"
                      }`}
                    >
                      {item.workload}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-800 bg-[#111827] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-100">
            {t("Daftar Pelatih & Free Agent", "Coaches & Free Agents")} (
            {filteredDirectory.length})
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            {clubStaff.length > 0 && (
              <label className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clubStaffOnly}
                  onChange={(e) => setClubStaffOnly(e.target.checked)}
                  className="accent-cyan-400"
                />
                {t("Staf Klub", "Club Staff")} ({clubStaff.length})
              </label>
            )}

            <select
              value={focusCategory}
              onChange={(e) => setFocusCategory(e.target.value as StaffCategoryId)}
              className="rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-100"
            >
              {formulas.categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={freeAgentsOnly}
                onChange={(e) => setFreeAgentsOnly(e.target.checked)}
                className="accent-emerald-400"
              />
              Free Agent
            </label>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
            >
              {t("Pilih Save (.fm)", "Choose Save (.fm)")}
            </button>
          </div>
        </div>

        {importError && (
          <p className="mt-2 text-xs text-rose-300">{importError}</p>
        )}

        {!hasLiveDirectory ? (
          <div
            id="staff-directory-empty-state"
            className="mt-4 rounded-xl border border-dashed border-slate-700 bg-[#0B0F19]/80 p-8 text-center space-y-3"
          >
            <p className="text-sm font-bold text-slate-100">
              {t(
                "Muat save karier (.fm) untuk melihat staf pelatih klub Anda & kandidat pelatih terbaik.",
                "Load a career save (.fm) to inspect your club staff & top available coaches.",
              )}
            </p>
            <div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                {t("Pilih File Save (.fm)", "Choose Save File (.fm)")}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                  <th className="py-2 pr-2">{t("Tim", "Pool")}</th>
                  <th className="py-2 pr-3">{t("Nama", "Name")}</th>
                  <th className="py-2 pr-3">{t("Jabatan", "Role")}</th>
                  <th className="py-2 pr-3">{t("Klub", "Club")}</th>
                  <th className="py-2 pr-3">{t("Gaji", "Est. Wage")}</th>
                  <th className="py-2 pr-3">{t("Bintang", "Stars")}</th>
                  <th className="py-2 text-right">{t("Cek", "Inspect")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredDirectory.map(({ member, targetStars }) => {
                  const inPool = selectedPoolUids.includes(member.uid);

                  return (
                    <tr key={member.uid} className="hover:bg-slate-800/40">
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={inPool}
                          onChange={() => toggleCoachInPool(member.uid)}
                          aria-label={member.name}
                          className="accent-emerald-400"
                        />
                      </td>
                      <td className="py-2 pr-3 font-medium text-slate-100">
                        {member.name}{" "}
                        <span className="font-mono text-[11px] text-slate-500">
                          ({member.age} · {member.nationality})
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {member.preferredRole}
                      </td>
                      <td className="py-2 pr-3">
                        {member.isFreeAgent ? (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[11px] font-medium text-emerald-300">
                            Free Agent
                          </span>
                        ) : (
                          <span className="text-slate-300">{member.club}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-mono text-slate-400">
                        €{(member.wageEstimateEurWeekly / 1000).toFixed(1)}K/{t("mgg", "w")}
                      </td>
                      <td className="py-2 pr-3 font-mono font-bold text-emerald-300">
                        {targetStars.toFixed(1)}★
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => onInspectCoach(member)}
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-200 hover:border-cyan-500/40 hover:text-cyan-300 cursor-pointer"
                        >
                          {t("Lihat", "View")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
