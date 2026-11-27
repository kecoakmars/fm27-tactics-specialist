"use client";

import React, { useMemo } from "react";
import { getPitchCatalog, getTacticalStyles } from "@fm27/fm-data";
import type { DualPhaseTactic } from "@fm27/shared-types";
import { useLocale } from "@/stores/useLocaleStore";

export interface ActiveTeamInstructionsSummaryProps {
  tactic: DualPhaseTactic;
  onEditClick?: () => void;
  compact?: boolean;
}

interface InstructionTextRow {
  key: string;
  groupLabel: string;
  valueLabel: string;
}

export function ActiveTeamInstructionsSummary({
  tactic,
  onEditClick,
  compact = false,
}: ActiveTeamInstructionsSummaryProps) {
  const { t } = useLocale();

  const catalog = useMemo(
    () => getPitchCatalog(tactic.patchVersion),
    [tactic.patchVersion],
  );
  const stylesCatalog = useMemo(
    () => getTacticalStyles(tactic.patchVersion),
    [tactic.patchVersion],
  );

  const mentalityLabel = useMemo(() => {
    const found = stylesCatalog.Mentalities.find((m) => m.Value === tactic.mentality);
    return found?.Label ?? "Balanced";
  }, [stylesCatalog.Mentalities, tactic.mentality]);

  const { ipRows, oopRows } = useMemo(() => {
    const ip: InstructionTextRow[] = [];
    const oop: InstructionTextRow[] = [];

    for (const group of catalog.Instructions) {
      const activeBit = tactic.teamInstructions[group.Group] ?? group.Current;
      if (activeBit <= 0) continue;

      const selectedOpt = group.Options.find((o) => o.Bit === activeBit);
      if (!selectedOpt) continue;

      const optLower = selectedOpt.Label.toLowerCase();
      if (
        group.Group !== "LineOfEngagement" &&
        (optLower === "standard" || optLower === "balanced")
      ) {
        continue;
      }

      const valueLabel =
        optLower === "yes" ||
        optLower === "participate" ||
        optLower === group.Label.toLowerCase()
          ? t("Aktif", "Active")
          : selectedOpt.Label;

      const row: InstructionTextRow = {
        key: group.Group,
        groupLabel: group.Label,
        valueLabel,
      };

      if (group.Out) {
        oop.push(row);
      } else {
        ip.push(row);
      }
    }

    return { ipRows: ip, oopRows: oop };
  }, [catalog.Instructions, t, tactic.teamInstructions]);

  return (
    <section
      id="active-team-instructions-summary"
      aria-label={t("Instruksi Tim", "Team Instructions")}
      className={
        compact
          ? "rounded-xl p-3 bg-[#0B0F19] border border-white/8 flex flex-col gap-2.5 text-xs"
          : "tactical-surface rounded-xl p-3.5 flex flex-col gap-2.5 text-xs"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-100">
            {t("Instruksi Tim", "Team Instructions")}
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-[11px] text-slate-300">
            {t("Mentalitas:", "Mentality:")}{" "}
            <strong className="text-cyan-300">{mentalityLabel}</strong>
          </span>
        </div>

        {onEditClick && (
          <button
            type="button"
            onClick={onEditClick}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-cyan-500/18 text-cyan-300 border border-cyan-500/35 hover:bg-cyan-500/28 transition cursor-pointer"
          >
            {t("Ubah Instruksi", "Edit Instructions")}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <div className="rounded-lg p-2.5 bg-[#0B0F19] border border-white/8 flex flex-col gap-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
            {t("Saat Menguasai Bola (IP)", "In Possession")} ({ipRows.length})
          </div>
          {ipRows.length === 0 ? (
            <p className="text-[11px] text-slate-500">
              {t("Standar (tanpa instruksi khusus)", "Standard (no extra instructions)")}
            </p>
          ) : (
            <div className="divide-y divide-white/5 text-[11px]">
              {ipRows.map((row) => (
                <div
                  key={row.key}
                  className="py-1 flex items-baseline justify-between gap-2"
                >
                  <span className="text-slate-400">{row.groupLabel}</span>
                  <span className="font-semibold text-slate-100 text-right">
                    {row.valueLabel}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg p-2.5 bg-[#0B0F19] border border-white/8 flex flex-col gap-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
            {t("Saat Bertahan (OOP)", "Out of Possession")} ({oopRows.length})
          </div>
          {oopRows.length === 0 ? (
            <p className="text-[11px] text-slate-500">
              {t("Standar (tanpa instruksi khusus)", "Standard (no extra instructions)")}
            </p>
          ) : (
            <div className="divide-y divide-white/5 text-[11px]">
              {oopRows.map((row) => (
                <div
                  key={row.key}
                  className="py-1 flex items-baseline justify-between gap-2"
                >
                  <span className="text-slate-400">{row.groupLabel}</span>
                  <span className="font-semibold text-slate-100 text-right">
                    {row.valueLabel}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
