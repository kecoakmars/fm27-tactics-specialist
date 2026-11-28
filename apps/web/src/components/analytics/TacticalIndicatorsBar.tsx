"use client";

import React, { useMemo } from "react";
import {
  computeTacticalMetrics,
  type TacticalBalanceReport,
  type TacticalFamiliarityLevel,
  type TacticalIndicatorLevel,
} from "@fm27/fm-engine";
import type { DualPhaseTactic, Player } from "@fm27/shared-types";
import { useLocale } from "@/stores/useLocaleStore";

export interface TacticalIndicatorsBarProps {
  tactic: DualPhaseTactic;
  squadPlayers?: readonly Player[];
  balanceReport?: TacticalBalanceReport;
  compact?: boolean;
}

function getIndicatorTone(level: TacticalIndicatorLevel, kind: "intensity" | "complexity") {
  if (level === "extreme") {
    return {
      bar: kind === "intensity" ? "bg-rose-500" : "bg-amber-500",
      badge:
        kind === "intensity"
          ? "bg-rose-500/18 text-rose-300 border-rose-500/40"
          : "bg-amber-500/18 text-amber-300 border-amber-500/40",
      value: kind === "intensity" ? "text-rose-300" : "text-amber-300",
    };
  }
  if (level === "high") {
    return {
      bar: kind === "intensity" ? "bg-amber-400" : "bg-cyan-400",
      badge:
        kind === "intensity"
          ? "bg-amber-500/15 text-amber-300 border-amber-500/35"
          : "bg-cyan-500/15 text-cyan-300 border-cyan-500/35",
      value: kind === "intensity" ? "text-amber-300" : "text-cyan-300",
    };
  }
  if (level === "moderate") {
    return {
      bar: "bg-emerald-400",
      badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/35",
      value: "text-emerald-300",
    };
  }
  return {
    bar: "bg-sky-400",
    badge: "bg-sky-500/15 text-sky-300 border-sky-500/35",
    value: "text-sky-300",
  };
}

function getFamiliarityTone(level: TacticalFamiliarityLevel) {
  switch (level) {
    case "fluid":
      return {
        bar: "bg-emerald-400",
        badge: "bg-emerald-500/18 text-emerald-300 border-emerald-500/40",
        value: "text-emerald-300",
      };
    case "accomplished":
      return {
        bar: "bg-cyan-400",
        badge: "bg-cyan-500/18 text-cyan-300 border-cyan-500/40",
        value: "text-cyan-300",
      };
    case "competent":
      return {
        bar: "bg-amber-400",
        badge: "bg-amber-500/18 text-amber-300 border-amber-500/40",
        value: "text-amber-300",
      };
    default:
      return {
        bar: "bg-rose-500",
        badge: "bg-rose-500/18 text-rose-300 border-rose-500/40",
        value: "text-rose-300",
      };
  }
}

export function TacticalIndicatorsBar({
  tactic,
  squadPlayers,
  balanceReport,
  compact = false,
}: TacticalIndicatorsBarProps) {
  const { locale, t } = useLocale();

  const metrics = useMemo(
    () =>
      computeTacticalMetrics(
        tactic,
        squadPlayers && squadPlayers.length >= 11 ? squadPlayers : undefined,
        balanceReport,
      ),
    [balanceReport, squadPlayers, tactic],
  );

  const levelLabel = (lvl: TacticalIndicatorLevel, kind: "intensity" | "complexity") => {
    if (kind === "intensity") {
      switch (lvl) {
        case "extreme":
          return t("Ekstrem", "Extreme");
        case "high":
          return t("Tinggi", "High");
        case "moderate":
          return t("Sedang", "Moderate");
        default:
          return t("Rendah", "Low");
      }
    }
    switch (lvl) {
      case "extreme":
        return t("Sangat Kompleks", "Very Complex");
      case "high":
        return t("Kompleks", "Complex");
      case "moderate":
        return t("Terstruktur", "Structured");
      default:
        return t("Sederhana", "Simple");
    }
  };

  const familiarityLabel = (lvl: TacticalFamiliarityLevel) => {
    switch (lvl) {
      case "fluid":
        return t("Sangat Padu (Fluid)", "Fluid");
      case "accomplished":
        return t("Matang (Accomplished)", "Accomplished");
      case "competent":
        return t("Cukup (Competent)", "Competent");
      default:
        return t("Kurang Cocok (Awkward)", "Awkward");
    }
  };

  const intTone = getIndicatorTone(metrics.intensity.level, "intensity");
  const compTone = getIndicatorTone(metrics.complexity.level, "complexity");
  const effTone = getFamiliarityTone(metrics.effectiveness.level);

  const intWarning =
    locale === "id" ? metrics.intensity.squadWarningId : metrics.intensity.squadWarningEn;
  const compWarning =
    locale === "id" ? metrics.complexity.squadWarningId : metrics.complexity.squadWarningEn;
  const effNote =
    locale === "id" ? metrics.effectiveness.summaryNoteId : metrics.effectiveness.summaryNoteEn;

  return (
    <section
      id="tactical-indicators-bar"
      aria-label={t(
        "Indikator Intensitas, Kompleksitas & Efektivitas",
        "Intensity, Complexity & Effectiveness Indicators",
      )}
      className={`grid grid-cols-1 md:grid-cols-3 gap-3 ${compact ? "" : ""}`}
    >
      {/* 1. INTENSITAS */}
      <div className="tactical-surface rounded-xl p-3.5 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {t("Intensitas", "Intensity")}
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${intTone.badge}`}
            >
              {levelLabel(metrics.intensity.level, "intensity")}
            </span>
          </div>
          <span className={`font-mono-metric text-sm font-extrabold ${intTone.value}`}>
            {metrics.intensity.score.toFixed(0)}
            <span className="text-[10px] text-slate-500 font-normal">/100</span>
          </span>
        </div>

        <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden border border-white/5">
          <div
            className={`h-full rounded-full transition-all duration-300 ${intTone.bar}`}
            style={{ width: `${Math.max(4, Math.min(100, metrics.intensity.score))}%` }}
          />
        </div>

        <div className="text-[11px] text-slate-400 leading-snug">
          {intWarning ? (
            <span className="text-amber-300 font-medium">⚠ {intWarning}</span>
          ) : metrics.intensity.drivers.length > 0 ? (
            <span>
              {t("Pemicu utama:", "Key drivers:")}{" "}
              <strong className="text-slate-200 font-medium">
                {metrics.intensity.drivers.slice(0, 3).join(" · ")}
              </strong>
            </span>
          ) : (
            <span>
              {t(
                "Beban fisik dan intensitas pressing seimbang sepanjang laga.",
                "Balanced physical load and pressing workload across 90 minutes.",
              )}
            </span>
          )}
        </div>
      </div>

      {/* 2. KOMPLEKSITAS */}
      <div className="tactical-surface rounded-xl p-3.5 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {t("Kompleksitas", "Complexity")}
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${compTone.badge}`}
            >
              {levelLabel(metrics.complexity.level, "complexity")}
            </span>
          </div>
          <span className={`font-mono-metric text-sm font-extrabold ${compTone.value}`}>
            {metrics.complexity.score.toFixed(0)}
            <span className="text-[10px] text-slate-500 font-normal">/100</span>
          </span>
        </div>

        <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden border border-white/5">
          <div
            className={`h-full rounded-full transition-all duration-300 ${compTone.bar}`}
            style={{ width: `${Math.max(4, Math.min(100, metrics.complexity.score))}%` }}
          />
        </div>

        <div className="text-[11px] text-slate-400 leading-snug">
          {compWarning ? (
            <span className="text-amber-300 font-medium">⚠ {compWarning}</span>
          ) : (
            <span className="font-mono-metric text-[10px] text-slate-300">
              {metrics.complexity.activeTeamInstructions} TI ·{" "}
              {metrics.complexity.customPlayerInstructions} PI ·{" "}
              {metrics.complexity.phaseShiftSlots} {t("geser fase", "phase shifts")} ·{" "}
              {metrics.complexity.specialistRoleCount} {t("peran spesialis", "specialist roles")}
            </span>
          )}
        </div>
      </div>

      {/* 3. EFEKTIVITAS (FAMILIARITY) */}
      <div className="tactical-surface rounded-xl p-3.5 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {t("Efektivitas (Familiarity)", "Effectiveness (Familiarity)")}
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${effTone.badge}`}
            >
              {familiarityLabel(metrics.effectiveness.level)}
            </span>
          </div>
          <span className={`font-mono-metric text-sm font-extrabold ${effTone.value}`}>
            {metrics.effectiveness.score.toFixed(0)}
            <span className="text-[10px] text-slate-500 font-normal">/100</span>
          </span>
        </div>

        <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden border border-white/5">
          <div
            className={`h-full rounded-full transition-all duration-300 ${effTone.bar}`}
            style={{ width: `${Math.max(4, Math.min(100, metrics.effectiveness.score))}%` }}
          />
        </div>

        <div className="text-[11px] text-slate-400 leading-snug">{effNote}</div>
      </div>
    </section>
  );
}
