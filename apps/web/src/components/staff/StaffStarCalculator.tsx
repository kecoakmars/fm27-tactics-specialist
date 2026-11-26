"use client";

import { useMemo } from "react";
import { getStaffFormulas } from "@fm27/fm-data";
import { calculateAllStaffStars } from "@fm27/fm-engine";
import type { StaffAttributes } from "@fm27/shared-types";
import { useLocale } from "../../stores/useLocaleStore";

interface StaffStarCalculatorProps {
  attributes: StaffAttributes;
  coachLabel: string;
  patchVersion: string;
  onChangeAttribute: (key: keyof StaffAttributes, val: number) => void;
}

const SLIDER_FIELDS: Array<{ key: keyof StaffAttributes; label: string }> = [
  { key: "determination", label: "Determination" },
  { key: "level_of_discipline", label: "Level of Discipline" },
  { key: "motivating", label: "Motivating" },
  { key: "attacking", label: "Attacking Coaching" },
  { key: "defending", label: "Defending Coaching" },
  { key: "mental", label: "Mental Coaching" },
  { key: "tactical", label: "Tactical Coaching" },
  { key: "technical", label: "Technical Coaching" },
  { key: "fitness", label: "Fitness Coaching" },
  { key: "gk_shot_stopping", label: "GK Shot Stopping" },
  { key: "gk_handling", label: "GK Handling" },
  { key: "gk_distribution", label: "GK Distribution" },
];

function formatStars(stars: number): string {
  const full = Math.floor(stars);
  const half = stars % 1 >= 0.5;
  return `${"★".repeat(full)}${half ? "½" : ""} (${stars.toFixed(1)})`;
}

export function StaffStarCalculator({
  attributes,
  coachLabel,
  patchVersion,
  onChangeAttribute,
}: StaffStarCalculatorProps) {
  const { t } = useLocale();
  const formulas = getStaffFormulas(patchVersion);
  const breakdown = useMemo(
    () => calculateAllStaffStars(attributes, patchVersion),
    [attributes, patchVersion],
  );

  const labelById = new Map(formulas.categories.map((c) => [c.id, c.label]));

  return (
    <section className="grid gap-4 lg:grid-cols-12">
      <div className="rounded-xl border border-slate-800 bg-[#111827] p-4 lg:col-span-7">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">
            {t("Simulasi Atribut Pelatih", "Coach Attribute Simulator")}
          </h2>
          <span className="text-xs font-semibold text-cyan-300">{coachLabel}</span>
        </div>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {SLIDER_FIELDS.map((field) => {
            const value = attributes[field.key];
            return (
              <label
                key={field.key}
                className="rounded-lg border border-slate-800/80 bg-[#0B0F19] px-3 py-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{field.label}</span>
                  <span className="font-mono font-bold text-emerald-300">
                    {value}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={value}
                  onChange={(e) =>
                    onChangeAttribute(field.key, Number(e.target.value))
                  }
                  className="mt-1 w-full accent-emerald-400"
                />
              </label>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#111827] p-4 lg:col-span-5">
        <h2 className="text-sm font-semibold text-slate-100">
          {t("Bintang Latihan", "Training Stars")}
        </h2>

        <div className="mt-3 space-y-2">
          {breakdown.map((row) => (
            <div
              key={row.categoryId}
              className="rounded-lg border border-slate-800 bg-[#0B0F19] px-3 py-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-200">
                  {labelById.get(row.categoryId) ?? row.categoryId}
                </span>
                <span
                  className={`font-mono font-bold ${
                    row.stars >= 4.5
                      ? "text-emerald-300"
                      : row.stars >= 3.5
                        ? "text-cyan-300"
                        : "text-amber-300"
                  }`}
                >
                  {formatStars(row.stars)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${row.normalizedPercent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
