"use client";

import React from "react";
import type { ZoneCell } from "@fm27/fm-engine";
import { useLocale } from "@/stores/useLocaleStore";
import type { PitchViewMode } from "@/stores/useTacticStore";
import { PITCH_SVG_HEIGHT, PITCH_SVG_WIDTH } from "../pitch/DualPhasePitch";

export type HeatmapOverlayMode = "off" | "ip" | "oop" | "transition";

export interface Heatmap18ZoneProps {
  cells: readonly ZoneCell[];
  mode: Exclude<HeatmapOverlayMode, "off">;
}

function heatFillColor(intensity: number, mode: Exclude<HeatmapOverlayMode, "off">): string {
  if (mode === "ip") {
    return intensity >= 70 ? "#06B6D4" : intensity >= 40 ? "#10B981" : "#0E7490";
  }
  if (mode === "oop") {
    return intensity >= 70 ? "#F59E0B" : intensity >= 40 ? "#D97706" : "#92400E";
  }
  return intensity >= 70 ? "#F43F5E" : intensity >= 40 ? "#F59E0B" : "#10B981";
}

export function Heatmap18Zone({ cells, mode }: Heatmap18ZoneProps) {
  const innerX = 28;
  const innerY = 28;
  const innerW = PITCH_SVG_WIDTH - 56;
  const innerH = PITCH_SVG_HEIGHT - 56;
  const cellW = innerW / 3;
  const cellH = innerH / 6;

  return (
    <g className="pointer-events-none" aria-label="Pitch Zone Heatmap">
      {cells.map((cell) => {
        const x = innerX + cell.col * cellW;
        const y = innerY + cell.row * cellH;
        const fill = heatFillColor(cell.intensity, mode);
        const alpha = Math.min(0.54, Math.max(0.06, (cell.intensity / 100) * 0.52));

        return (
          <g key={`hz-${mode}-${cell.zoneIndex}`}>
            <rect
              x={x + 1.5}
              y={y + 1.5}
              width={cellW - 3}
              height={cellH - 3}
              rx={5}
              fill={fill}
              fillOpacity={alpha}
              stroke={cell.isZone14 ? "#F8FAFC" : fill}
              strokeOpacity={cell.isZone14 ? 0.65 : 0.25}
              strokeWidth={cell.isZone14 ? 1.8 : 1}
              strokeDasharray={cell.isZone14 ? "4 3" : undefined}
            />
            <text
              x={x + cellW - 8}
              y={y + cellH - 8}
              textAnchor="end"
              fill="#F8FAFC"
              fillOpacity={0.78}
              fontSize={10}
              fontWeight={700}
              className="font-mono-metric"
            >
              {Math.round(cell.intensity)}%
            </text>
          </g>
        );
      })}
    </g>
  );
}

export interface PitchColorLegendProps {
  heatmapMode: HeatmapOverlayMode;
  viewMode: PitchViewMode;
}

export function PitchColorLegend({ heatmapMode, viewMode }: PitchColorLegendProps) {
  const { t } = useLocale();

  const zoneSwatches =
    heatmapMode === "off"
      ? null
      : heatmapMode === "transition"
        ? [
            {
              color: "#F43F5E",
              label: t("Merah (≥70%): Transisi padat", "Red (≥70%): Heavy transition"),
            },
            {
              color: "#F59E0B",
              label: t("Kuning (40–69%): Sedang", "Yellow (40–69%): Moderate"),
            },
            {
              color: "#10B981",
              label: t("Hijau (<40%): Ruang terbuka", "Green (<40%): Open space"),
            },
          ]
        : heatmapMode === "oop" && viewMode !== "split"
          ? [
              {
                color: "#F59E0B",
                label: t("Terang (≥70%): Dijaga rapat", "Bright (≥70%): Tight cover"),
              },
              {
                color: "#D97706",
                label: t("Sedang (40–69%): Cukup", "Mid (40–69%): Balanced"),
              },
              {
                color: "#92400E",
                label: t("Gelap (<40%): Rawan kosong", "Dark (<40%): Exposed"),
              },
            ]
          : viewMode === "split"
            ? [
                {
                  color: "#06B6D4",
                  secondaryColor: "#F59E0B",
                  label: t("Terang (≥70%): Terisi kuat", "Bright (≥70%): Strong cover"),
                },
                {
                  color: "#10B981",
                  secondaryColor: "#D97706",
                  label: t("Sedang (40–69%): Cukup", "Mid (40–69%): Balanced"),
                },
                {
                  color: "#0E7490",
                  secondaryColor: "#92400E",
                  label: t("Gelap (<40%): Ruang kosong", "Dark (<40%): Empty space"),
                },
              ]
            : [
                {
                  color: "#06B6D4",
                  label: t("Biru (≥70%): Terisi kuat", "Cyan (≥70%): Strong presence"),
                },
                {
                  color: "#10B981",
                  label: t("Hijau (40–69%): Cukup", "Green (40–69%): Balanced"),
                },
                {
                  color: "#0E7490",
                  label: t("Gelap (<40%): Ruang kosong", "Dark (<40%): Empty space"),
                },
              ];

  return (
    <div
      id="pitch-color-legend"
      aria-label={t("Keterangan Warna Lapangan", "Pitch Color Legend")}
      className="px-3 py-2 rounded-lg bg-[#0B0F19]/80 border border-white/8 text-[11px] text-slate-300 flex flex-wrap items-center gap-x-3.5 gap-y-1.5"
    >
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-[#06B6D4] shrink-0" />
        <span>{t("Biru: Menyerang (IP)", "Blue: In Possession")}</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shrink-0" />
        <span>{t("Oranye: Bertahan (OOP)", "Orange: Out of Possession")}</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] shrink-0" />
        <span>{t("Hijau: Kiper", "Green: GK")}</span>
      </span>

      {zoneSwatches && (
        <>
          <span className="text-slate-600 hidden sm:inline">|</span>
          {zoneSwatches.map((sw) => (
            <span key={sw.label} className="inline-flex items-center gap-1.5">
              {"secondaryColor" in sw && sw.secondaryColor ? (
                <span className="inline-flex items-center gap-0.5 shrink-0">
                  <span
                    className="w-2 h-2.5 rounded-xs"
                    style={{ backgroundColor: sw.color }}
                  />
                  <span
                    className="w-2 h-2.5 rounded-xs"
                    style={{ backgroundColor: sw.secondaryColor }}
                  />
                </span>
              ) : (
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: sw.color }}
                />
              )}
              <span>{sw.label}</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-2.5 rounded-xs border border-dashed border-slate-200/80 shrink-0" />
            <span>{t("Putus-putus: Depan penalti", "Dashed: Edge of box")}</span>
          </span>
        </>
      )}
    </div>
  );
}
