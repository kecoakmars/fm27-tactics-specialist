"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getStaffFormulas } from "@fm27/fm-data";
import {
  calculateAllStaffStars,
  optimizeStaffAssignments,
} from "@fm27/fm-engine";
import type { StaffCategoryId, StaffMember } from "@fm27/shared-types";
import { importAnySupportedFile } from "../../lib/file-importer";
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

  const {
    clubStaff,
    worldStaffPool,
    liveFmSave,
    selectedClubUid,
    setClubPickerOpen,
  } = useTacticStore();

  const [customStaff, setCustomStaff] = useState<StaffMember[] | null>(null);
  const [freeAgentsOnly, setFreeAgentsOnly] = useState(false);
  const [clubStaffOnly, setClubStaffOnly] = useState(false);
  const [focusCategory, setFocusCategory] =
    useState<StaffCategoryId>("attacking_tactical");
  const [selectedPoolUids, setSelectedPoolUids] = useState<number[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  // Sync Club Coaching Pool strictly from real uploaded club staff (.fm or CSV/HTML), NEVER from static seed
  useEffect(() => {
    if (customStaff && customStaff.length > 0) {
      setSelectedPoolUids(customStaff.slice(0, 12).map((s) => s.uid));
    } else if (clubStaff.length > 0) {
      setSelectedPoolUids(clubStaff.slice(0, 12).map((s) => s.uid));
    } else {
      setSelectedPoolUids([]);
    }
  }, [clubStaff, customStaff]);

  const hasLiveDirectory =
    Boolean(customStaff && customStaff.length > 0) ||
    clubStaff.length > 0 ||
    worldStaffPool.length > 0;

  const dataSourceLabel = customStaff
    ? "Impor CSV / HTML Kustom"
    : hasLiveDirectory
      ? `Live .fm: ${liveFmSave?.saveName ?? "Save Aktif"} (${liveFmSave?.gameDate ?? ""})`
      : "Menunggu Impor File Save .fm / CSV (0% Data Sample)";

  const clubStaffUidSet = useMemo(
    () => new Set(clubStaff.map((s) => s.uid)),
    [clubStaff],
  );

  const activeDirectory = useMemo(() => {
    if (customStaff) return customStaff;
    if (worldStaffPool.length > 0 || clubStaff.length > 0) {
      const merged = new Map<number, StaffMember>();
      for (const s of clubStaff) merged.set(s.uid, s);
      for (const s of worldStaffPool) {
        if (!merged.has(s.uid)) merged.set(s.uid, s);
      }
      return Array.from(merged.values());
    }
    return [];
  }, [clubStaff, customStaff, worldStaffPool]);

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

  async function handleImportStaffFile(file: File) {
    setImportError(null);
    try {
      const res = await importAnySupportedFile(file);
      if (res.kind === "fm-save" || res.kind === "staff") {
        setCustomStaff(null);
      }
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Gagal memproses file ekspor staf",
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
      {assignmentPlan ? (
        <section className="rounded-xl border border-emerald-500/30 bg-[#111827] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-emerald-300">
                Auto-Assign Coaching Workload Optimizer ({poolMembers.length} Pelatih di Pool Klub)
              </h3>
              <p className="text-xs text-slate-400">
                Memaksimalkan bintang tiap kategori latihan sekaligus menjaga beban kerja Light / Average.
              </p>
            </div>
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 font-mono text-xs font-bold text-emerald-300">
              Avg Rating: {assignmentPlan.averageStars.toFixed(2)} *
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
                      {item.effectiveStars.toFixed(1)} *
                    </span>
                  </div>
                  <div className="mt-1.5 text-xs font-medium text-cyan-300">
                    Lead: {lead?.name ?? `#${item.leadStaffUid}`}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">
                      {supports.length > 0
                        ? `+${supports.length} support`
                        : "Solo lead"}
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
      ) : (
        <section
          id="staff-club-empty-state"
          className="rounded-xl border border-dashed border-slate-700 bg-[#111827]/70 p-6 text-center"
        >
          <h3 className="text-sm font-bold text-slate-200">
            Belum Ada Staf Klub yang Dimuat ke Workload Optimizer
          </h3>
          <p className="mx-auto mt-1 max-w-xl text-xs text-slate-400 leading-relaxed">
            Unggah file save karier <code className="text-emerald-300">.fm</code> (diproses 100%
            lokal di browser) atau ekspor <code className="text-cyan-300">Staff CSV / HTML</code>{" "}
            untuk memuat jajaran pelatih asli klub Anda tanpa data sampel buatan, atau centang
            pelatih dari direktori di bawah untuk simulasi manual.
          </p>
        </section>
      )}

      <section className="rounded-xl border border-slate-800 bg-[#111827] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100">
                Direktori Pelatih, Free Agents &amp; Importer ({filteredDirectory.length})
              </h3>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                  hasLiveDirectory
                    ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                    : "border border-amber-500/40 bg-amber-500/15 text-amber-300"
                }`}
              >
                {dataSourceLabel}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Centang pelatih untuk dimasukkan ke Pool Optimizer klub, atau klik Load Sliders untuk kalkulasi detail.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {clubStaff.length > 0 && !customStaff && (
              <label className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clubStaffOnly}
                  onChange={(e) => setClubStaffOnly(e.target.checked)}
                  className="accent-cyan-400"
                />
                Staf Klub Saja ({clubStaff.length})
              </label>
            )}

            <select
              value={focusCategory}
              onChange={(e) => setFocusCategory(e.target.value as StaffCategoryId)}
              className="rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-100"
            >
              {formulas.categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  Sort by: {cat.label}
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
              Free Agents Only
            </label>

            <input
              ref={fileRef}
              type="file"
              accept=".fm,.csv,.html,.htm"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportStaffFile(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
            >
              Unggah Save .fm / Staff CSV
            </button>
            {liveFmSave && (
              <button
                type="button"
                onClick={() => setClubPickerOpen(true)}
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/25 cursor-pointer"
              >
                Ganti Klub (
                {liveFmSave.clubs.find((c) => c.uid === selectedClubUid)?.shortName ?? "Pilih"})
              </button>
            )}
            {customStaff && (
              <button
                type="button"
                onClick={() => {
                  setCustomStaff(null);
                  setSelectedPoolUids(clubStaff.slice(0, 12).map((s) => s.uid));
                }}
                className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 cursor-pointer"
              >
                Reset Kustom
              </button>
            )}
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
              Belum Ada Data Staf Pelatih yang Dimuat (0% Data Sample)
            </p>
            <p className="mx-auto max-w-xl text-xs text-slate-400 leading-relaxed">
              Unggah file save karier <code className="text-emerald-300">.fm</code> untuk memuat
              jajaran pelatih klub Anda dan 200 pelatih/free agent terbaik langsung dari dunia
              karier Anda, atau unggah ekspor <code className="text-cyan-300">Staff CSV / HTML</code>.
            </p>
            <div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                Unggah File Save .fm / Staff CSV
              </button>
            </div>
          </div>
        ) : (
        <div className="mt-3 max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                <th className="py-2 pr-2">Pool</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Preferred Role</th>
                <th className="py-2 pr-3">Club</th>
                <th className="py-2 pr-3">Est. Wage</th>
                <th className="py-2 pr-3">DDM</th>
                <th className="py-2 pr-3">Target Cat *</th>
                <th className="py-2 text-right">Sliders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredDirectory.map(({ member, targetStars }) => {
                const inPool = selectedPoolUids.includes(member.uid);
                const ddm =
                  member.attributes.determination +
                  member.attributes.level_of_discipline +
                  member.attributes.motivating;

                return (
                  <tr key={member.uid} className="hover:bg-slate-800/40">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={inPool}
                        onChange={() => toggleCoachInPool(member.uid)}
                        aria-label={`Include ${member.name} in coaching pool`}
                        className="accent-emerald-400"
                      />
                    </td>
                    <td className="py-2 pr-3 font-medium text-slate-100">
                      {member.name}{" "}
                      <span className="font-mono text-[11px] text-slate-500">
                        ({member.age}yo · {member.nationality})
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
                      EUR {(member.wageEstimateEurWeekly / 1000).toFixed(1)}K/w
                    </td>
                    <td className="py-2 pr-3 font-mono text-cyan-300">{ddm}</td>
                    <td className="py-2 pr-3 font-mono font-bold text-emerald-300">
                      {targetStars.toFixed(1)} *
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onInspectCoach(member)}
                        className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-200 hover:border-cyan-500/40 hover:text-cyan-300 cursor-pointer"
                      >
                        Load Sliders
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
