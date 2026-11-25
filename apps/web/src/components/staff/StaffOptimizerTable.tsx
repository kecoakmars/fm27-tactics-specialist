"use client";

import { useMemo, useRef, useState } from "react";
import { getStaffFormulas, getStaffSeed } from "@fm27/fm-data";
import {
  calculateAllStaffStars,
  optimizeStaffAssignments,
  parseStaffCsv,
  parseStaffHtml,
} from "@fm27/fm-engine";
import type { StaffCategoryId, StaffMember } from "@fm27/shared-types";

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
  const seedStaff = getStaffSeed(patchVersion).Staff;

  const [customStaff, setCustomStaff] = useState<StaffMember[] | null>(null);
  const [freeAgentsOnly, setFreeAgentsOnly] = useState(false);
  const [focusCategory, setFocusCategory] =
    useState<StaffCategoryId>("attacking_tactical");
  const [selectedPoolUids, setSelectedPoolUids] = useState<number[]>(() =>
    seedStaff.slice(0, 10).map((s) => s.uid),
  );
  const [importError, setImportError] = useState<string | null>(null);

  const activeDirectory = customStaff ?? seedStaff;
  const staffByUid = useMemo(
    () => new Map(activeDirectory.map((s) => [s.uid, s])),
    [activeDirectory],
  );

  const filteredDirectory = useMemo(() => {
    const rows = activeDirectory
      .filter((s) => (!freeAgentsOnly ? true : s.isFreeAgent))
      .map((member) => {
        const stars = calculateAllStaffStars(member.attributes, patchVersion);
        const targetStars =
          stars.find((r) => r.categoryId === focusCategory)?.stars ?? 0.5;
        const bestStars = Math.max(...stars.map((r) => r.stars));
        return { member, targetStars, bestStars };
      });
    rows.sort((a, b) => b.targetStars - a.targetStars || b.bestStars - a.bestStars);
    return rows;
  }, [activeDirectory, freeAgentsOnly, focusCategory, patchVersion]);

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
    try {
      const text = await file.text();
      const isHtml =
        file.name.toLowerCase().endsWith(".html") ||
        file.name.toLowerCase().endsWith(".htm") ||
        /<table\b/i.test(text);
      const parsed = isHtml ? parseStaffHtml(text) : parseStaffCsv(text);
      setCustomStaff(parsed);
      setSelectedPoolUids(parsed.slice(0, 10).map((s) => s.uid));
      setImportError(null);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Failed to parse staff export",
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
      {assignmentPlan && (
        <section className="rounded-xl border border-emerald-500/30 bg-[#111827] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-emerald-300">
                Auto-Assign Coaching Workload Optimizer ({poolMembers.length} Coaches in Pool)
              </h3>
              <p className="text-xs text-slate-400">
                Maximizes category stars while keeping coaching workload Light / Average.
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
      )}

      <section className="rounded-xl border border-slate-800 bg-[#111827] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Curated Best Staff, Free Agents &amp; F9 Importer ({filteredDirectory.length})
            </h3>
            <p className="text-xs text-slate-400">
              Check coaches to include them in the Auto-Assign Optimizer pool, or click a row to load into sliders.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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

            <label className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-200">
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
              accept=".csv,.html,.htm"
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
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/25"
            >
              Import Staff CSV/HTML
            </button>
            {customStaff && (
              <button
                type="button"
                onClick={() => {
                  setCustomStaff(null);
                  setSelectedPoolUids(seedStaff.slice(0, 10).map((s) => s.uid));
                }}
                className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300"
              >
                Reset to Seed
              </button>
            )}
          </div>
        </div>

        {importError && (
          <p className="mt-2 text-xs text-rose-300">{importError}</p>
        )}

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
                        className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-200 hover:border-cyan-500/40 hover:text-cyan-300"
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
      </section>
    </div>
  );
}
