"use client";

import React from "react";
import type { ZoneCell } from "@fm27/fm-engine";
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
    <g className="pointer-events-none" aria-label="18-Zone Spatial Heatmap">
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
            {cell.isZone14 && (
              <text
                x={x + 8}
                y={y + 15}
                fill="#F8FAFC"
                fillOpacity={0.85}
                fontSize={9}
                fontWeight={800}
                className="font-mono-metric"
              >
                ZONE 14
              </text>
            )}
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
