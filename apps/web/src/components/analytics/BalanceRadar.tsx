"use client";

import React from "react";
import type { TacticalBalanceReport } from "@fm27/fm-engine";

export interface BalanceRadarProps {
  report: TacticalBalanceReport;
}

const AXES: ReadonlyArray<{
  key: keyof TacticalBalanceReport["pillars"];
  shortLabel: string;
}> = [
  { key: "attackingThreat", shortLabel: "Attack" },
  { key: "buildUpProgression", shortLabel: "Build-Up" },
  { key: "widthAndHalfSpaceCoverage", shortLabel: "Width/HS" },
  { key: "restDefenseStability", shortLabel: "Rest-Def" },
  { key: "transitionResilience", shortLabel: "Transition" },
  { key: "pressingCohesion", shortLabel: "Pressing" },
];

function polarPoint(cx: number, cy: number, radius: number, index: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 6;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

export function BalanceRadar({ report }: BalanceRadarProps) {
  const size = 230;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 76;

  const polygonPoints = AXES.map((axis, idx) => {
    const val = report.pillars[axis.key];
    const r = (Math.max(8, val) / 100) * maxR;
    const pt = polarPoint(cx, cy, r, idx);
    return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
  }).join(" ");

  const scoreColor =
    report.overallScore >= 72
      ? "#10B981"
      : report.overallScore >= 52
        ? "#06B6D4"
        : "#F59E0B";

  return (
    <section
      aria-label="Tactical Balance Score"
      className="tactical-surface rounded-xl p-3.5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Tactical Balance Score
          </span>
          <p className="text-[11px] text-slate-400">6-Pillar Spatial &amp; Phase Evaluation</p>
        </div>
        <div
          className="px-3 py-1 rounded-lg bg-[#0B0F19] border border-white/10 font-mono-metric text-lg font-extrabold"
          style={{ color: scoreColor }}
        >
          {report.overallScore.toFixed(0)}
          <span className="text-xs text-slate-500">/100</span>
        </div>
      </div>

      {/* Pure SVG Hexagonal Radar */}
      <div className="flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {[0.33, 0.66, 1].map((ring) => {
            const pts = AXES.map((_, idx) => {
              const p = polarPoint(cx, cy, maxR * ring, idx);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            }).join(" ");
            return (
              <polygon
                key={`ring-${ring}`}
                points={pts}
                fill="none"
                stroke="rgba(148,163,184,0.18)"
                strokeWidth={1}
              />
            );
          })}

          {AXES.map((axis, idx) => {
            const edge = polarPoint(cx, cy, maxR, idx);
            const labelPt = polarPoint(cx, cy, maxR + 22, idx);
            const val = Math.round(report.pillars[axis.key]);
            return (
              <g key={axis.key}>
                <line
                  x1={cx}
                  y1={cy}
                  x2={edge.x}
                  y2={edge.y}
                  stroke="rgba(148,163,184,0.16)"
                  strokeWidth={1}
                />
                <text
                  x={labelPt.x}
                  y={labelPt.y - 3}
                  textAnchor="middle"
                  fill="#CBD5E1"
                  fontSize={9.5}
                  fontWeight={600}
                >
                  {axis.shortLabel}
                </text>
                <text
                  x={labelPt.x}
                  y={labelPt.y + 8}
                  textAnchor="middle"
                  fill="#06B6D4"
                  fontSize={9}
                  fontWeight={700}
                  className="font-mono-metric"
                >
                  {val}
                </text>
              </g>
            );
          })}

          <polygon
            points={polygonPoints}
            fill="#10B981"
            fillOpacity={0.22}
            stroke="#10B981"
            strokeWidth={2}
          />
        </svg>
      </div>

      {/* Zone 14 & Half-Space Quick Readout */}
      <div className="grid grid-cols-3 gap-1.5 text-center pt-1 border-t border-white/8">
        <div className="rounded-lg py-1.5 bg-[#0B0F19]">
          <div className="text-[10px] text-slate-400">Zone 14 IP</div>
          <div className="text-xs font-bold font-mono-metric text-cyan-300">
            {report.heatmap.zone14IntensityIp.toFixed(0)}%
          </div>
        </div>
        <div className="rounded-lg py-1.5 bg-[#0B0F19]">
          <div className="text-[10px] text-slate-400">Half-Spaces</div>
          <div className="text-xs font-bold font-mono-metric text-emerald-300">
            {Math.round(
              (report.heatmap.leftHalfSpaceIntensityIp +
                report.heatmap.rightHalfSpaceIntensityIp) /
                2,
            )}
            %
          </div>
        </div>
        <div className="rounded-lg py-1.5 bg-[#0B0F19]">
          <div className="text-[10px] text-slate-400">Avg Shift</div>
          <div className="text-xs font-bold font-mono-metric text-amber-300">
            Δ{report.heatmap.averageTransitionDistance}m
          </div>
        </div>
      </div>
    </section>
  );
}
