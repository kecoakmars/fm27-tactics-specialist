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
import { FamiliaritySegmentsBar } from "./FamiliaritySegmentsBar";

export interface TacticalIndicatorsBarProps {
  tactic: DualPhaseTactic;
  squadPlayers?: readonly Player[];
  balanceReport?: TacticalBalanceReport;
  compact?: boolean;
}

function getStepMeterTone(level: TacticalIndicatorLevel, kind: "intensity" | "complexity") {
  if (level === "extreme") {
    return {
      segment: kind === "intensity" ? "bg-rose-500" : "bg-amber-500",
      badge:
        kind === "intensity"
          ? "bg-rose-500/18 text-rose-300 border-rose-500/40"
          : "bg-amber-500/18 text-amber-300 border-amber-500/40",
      value: kind === "intensity" ? "text-rose-300" : "text-amber-300",
    };
  }
  if (level === "high") {
    return {
      segment: kind === "intensity" ? "bg-amber-400" : "bg-cyan-400",
      badge:
        kind === "intensity"
          ? "bg-amber-500/15 text-amber-300 border-amber-500/35"
          : "bg-cyan-500/15 text-cyan-300 border-cyan-500/35",
      value: kind === "intensity" ? "text-amber-300" : "text-cyan-300",
    };
  }
  if (level === "moderate") {
    return {
      segment: "bg-emerald-400",
      badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/35",
      value: "text-emerald-300",
    };
  }
  return {
    segment: "bg-sky-400",
    badge: "bg-sky-500/15 text-sky-300 border-sky-500/35",
    value: "text-sky-300",
  };
}

function getFamiliarityTone(level: TacticalFamiliarityLevel) {
  switch (level) {
    case "fluid":
      return {
        badge: "bg-emerald-500/18 text-emerald-300 border-emerald-500/40",
        value: "text-emerald-300",
      };
    case "accomplished":
      return {
        badge: "bg-lime-500/18 text-lime-300 border-lime-500/40",
        value: "text-lime-300",
      };
    case "competent":
      return {
        badge: "bg-amber-500/18 text-amber-300 border-amber-500/40",
        value: "text-amber-300",
      };
    default:
      return {
        badge: "bg-rose-500/18 text-rose-300 border-rose-500/40",
        value: "text-rose-300",
      };
  }
}

function EightSegmentBar({
  filledCount,
  activeClass,
}: {
  filledCount: number;
  activeClass: string;
}) {
  return (
    <div className="flex items-center gap-1 w-full" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, idx) => (
        <span
          key={idx}
          className={`h-2.5 flex-1 rounded-[2.5px] transition-colors ${
            idx < filledCount ? activeClass : "bg-slate-800/90 border border-white/6"
          }`}
        />
      ))}
    </div>
  );
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

  const intensityLabel = (lvl: TacticalIndicatorLevel) => {
    switch (lvl) {
      case "extreme":
        return t("Sangat Menguras", "Very Demanding");
      case "high":
        return t("Tinggi", "High");
      case "moderate":
        return t("Seimbang", "Balanced");
      default:
        return t("Hemat Stamina", "Low Load");
    }
  };

  const intensityBeginnerHint = (lvl: TacticalIndicatorLevel) => {
    switch (lvl) {
      case "extreme":
        return t(
          "Stamina cepat habis — wajib rotasi pemain di babak ke-2 & jadwal padat.",
          "Drains stamina fast — rotate subs early in the 2nd half & busy weeks.",
        );
      case "high":
        return t(
          "Temponya agresif — siapkan pemain cadangan bugar mulai menit 65.",
          "Energetic pressing — keep fresh bench legs ready around minute 65.",
        );
      case "moderate":
        return t(
          "Beban fisik ideal — aman dipakai rutin sepanjang musim.",
          "Balanced physical workload — safe for regular weekly matches.",
        );
      default:
        return t(
          "Sangat hemat tenaga — cocok untuk mengamankan keunggulan atau jadwal padat.",
          "Conserves energy — great for seeing out leads or congested fixtures.",
        );
    }
  };

  const complexityLabel = (lvl: TacticalIndicatorLevel) => {
    switch (lvl) {
      case "extreme":
        return t("Sangat Rumit", "Very Complex");
      case "high":
        return t("Cukup Rumit", "Complex");
      case "moderate":
        return t("Terstruktur", "Structured");
      default:
        return t("Mudah Dipahami", "Simple");
    }
  };

  const complexityBeginnerHint = (lvl: TacticalIndicatorLevel) => {
    switch (lvl) {
      case "extreme":
        return t(
          "Banyak aturan khusus — butuh waktu latihan lebih lama agar tim tidak bingung.",
          "Heavy tactical rules — takes extra training weeks for players to master.",
        );
      case "high":
        return t(
          "Cukup menuntut kecerdasan posisi (Decisions & Teamwork) skuad.",
          "Demands solid Decisions & Teamwork across your starting XI.",
        );
      case "moderate":
        return t(
          "Instruksi jelas & rapi — mudah dipelajari mayoritas pemain.",
          "Clear tactical structure — easy for most squads to pick up.",
        );
      default:
        return t(
          "Sangat simpel — pemain langsung paham meski baru berganti taktik.",
          "Plug-and-play simplicity — players adapt quickly with minimal friction.",
        );
    }
  };

  const familiarityLabel = (lvl: TacticalFamiliarityLevel) => {
    switch (lvl) {
      case "fluid":
        return t("Sangat Padu", "Fluid");
      case "accomplished":
        return t("Matang", "Accomplished");
      case "competent":
        return t("Mulai Paham", "Competent");
      default:
        return t("Butuh Adaptasi", "Awkward");
    }
  };

  const intTone = getStepMeterTone(metrics.intensity.level, "intensity");
  const compTone = getStepMeterTone(metrics.complexity.level, "complexity");
  const effTone = getFamiliarityTone(metrics.effectiveness.level);

  const intWarning =
    locale === "id" ? metrics.intensity.squadWarningId : metrics.intensity.squadWarningEn;
  const compWarning =
    locale === "id" ? metrics.complexity.squadWarningId : metrics.complexity.squadWarningEn;
  const effNote =
    locale === "id" ? metrics.effectiveness.summaryNoteId : metrics.effectiveness.summaryNoteEn;
  const activeDrivers =
    locale === "id" ? metrics.intensity.driversId : metrics.intensity.drivers;

  return (
    <section
      id="tactical-indicators-bar"
      aria-label={t(
        "Indikator Beban Fisik, Kerumitan & Kesiapan Taktik",
        "Physical Load, Complexity & Tactical Readiness Indicators",
      )}
      className={`grid grid-cols-1 md:grid-cols-3 gap-3 ${compact ? "" : ""}`}
    >
      {/* 1. BEBAN FISIK (INTENSITAS) */}
      <div className="tactical-surface rounded-xl p-3.5 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              {t("Intensitas Fisik", "Intensity")}
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border truncate ${intTone.badge}`}
            >
              {intensityLabel(metrics.intensity.level)}
            </span>
          </div>
          <span className={`font-mono-metric text-xs font-extrabold shrink-0 ${intTone.value}`}>
            {metrics.intensity.segments8}
            <span className="text-[10px] text-slate-500 font-normal">/8</span>
          </span>
        </div>

        <EightSegmentBar
          filledCount={metrics.intensity.segments8}
          activeClass={intTone.segment}
        />

        <div className="text-[11px] text-slate-400 leading-snug">
          {intWarning ? (
            <span className="text-amber-300 font-medium">⚠ {intWarning}</span>
          ) : (
            <span>{intensityBeginnerHint(metrics.intensity.level)}</span>
          )}
        </div>

        {activeDrivers.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {activeDrivers.map((drv) => (
              <span
                key={drv}
                className="px-1.5 py-0.5 rounded bg-[#0B0F19] border border-white/8 text-[10px] text-slate-300"
              >
                {drv}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 2. KERUMITAN TAKTIK (KOMPLEKSITAS) */}
      <div className="tactical-surface rounded-xl p-3.5 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              {t("Kompleksitas", "Complexity")}
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border truncate ${compTone.badge}`}
            >
              {complexityLabel(metrics.complexity.level)}
            </span>
          </div>
          <span className={`font-mono-metric text-xs font-extrabold shrink-0 ${compTone.value}`}>
            {metrics.complexity.segments8}
            <span className="text-[10px] text-slate-500 font-normal">/8</span>
          </span>
        </div>

        <EightSegmentBar
          filledCount={metrics.complexity.segments8}
          activeClass={compTone.segment}
        />

        <div className="text-[11px] text-slate-400 leading-snug">
          {compWarning ? (
            <span className="text-amber-300 font-medium">⚠ {compWarning}</span>
          ) : (
            <span>{complexityBeginnerHint(metrics.complexity.level)}</span>
          )}
        </div>

        <div className="flex flex-wrap gap-1 pt-0.5">
          <span className="px-1.5 py-0.5 rounded bg-[#0B0F19] border border-white/8 text-[10px] text-slate-300">
            {metrics.complexity.activeTeamInstructions}{" "}
            {t("instruksi tim", "team rules")}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[#0B0F19] border border-white/8 text-[10px] text-slate-300">
            {metrics.complexity.customPlayerInstructions}{" "}
            {t("instruksi individu", "player tasks")}
          </span>
          {metrics.complexity.phaseShiftSlots > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-[#0B0F19] border border-white/8 text-[10px] text-cyan-300">
              {metrics.complexity.phaseShiftSlots}{" "}
              {t("geser posisi IP→OOP", "phase shifts")}
            </span>
          )}
        </div>
      </div>

      {/* 3. KESIAPAN TAKTIK (EFEKTIVITAS / FAMILIARITY) */}
      <div className="tactical-surface rounded-xl p-3.5 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              {t("Efektivitas Tim", "Effectiveness")}
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border truncate ${effTone.badge}`}
            >
              {familiarityLabel(metrics.effectiveness.level)}
            </span>
          </div>
          <span className={`font-mono-metric text-xs font-extrabold shrink-0 ${effTone.value}`}>
            {metrics.effectiveness.bars}
            <span className="text-[10px] text-slate-500 font-normal">/10</span>
          </span>
        </div>

        <FamiliaritySegmentsBar score={metrics.effectiveness.score} size="md" />

        <div className="text-[11px] text-slate-400 leading-snug">{effNote}</div>
      </div>
    </section>
  );
}
