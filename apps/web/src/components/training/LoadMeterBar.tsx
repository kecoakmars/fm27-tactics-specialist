"use client";

import type { LoadMetrics } from "@fm27/shared-types";

export function LoadMeterBar({ metrics }: { metrics: LoadMetrics }) {
  const meters = [
    {
      label: "Condition Delta",
      val: `${metrics.conditionDelta >= 0 ? "+" : ""}${metrics.conditionDelta}`,
      pct: Math.min(100, Math.max(8, 55 + metrics.conditionDelta * 1.4)),
      tone:
        metrics.conditionDelta >= -12
          ? "bg-emerald-500 text-emerald-300"
          : "bg-amber-500 text-amber-300",
    },
    {
      label: "Weekly Fatigue",
      val: `${metrics.fatigueDelta >= 0 ? "+" : ""}${metrics.fatigueDelta}`,
      pct: Math.min(100, Math.max(5, 25 + metrics.fatigueDelta * 1.6)),
      tone:
        metrics.fatigueDelta <= 28
          ? "bg-cyan-500 text-cyan-300"
          : "bg-rose-500 text-rose-300",
    },
    {
      label: "Injury Risk",
      val: `${metrics.injuryRiskScore.toFixed(1)}`,
      pct: Math.min(100, Math.max(5, metrics.injuryRiskScore * 2.2)),
      tone:
        metrics.injuryRiskScore <= 26
          ? "bg-emerald-500 text-emerald-300"
          : metrics.injuryRiskScore <= 38
            ? "bg-amber-500 text-amber-300"
            : "bg-rose-500 text-rose-300",
    },
    {
      label: "Match Sharpness",
      val: `${metrics.sharpnessDelta >= 0 ? "+" : ""}${metrics.sharpnessDelta}`,
      pct: Math.min(100, Math.max(8, 35 + metrics.sharpnessDelta * 1.8)),
      tone: "bg-cyan-500 text-cyan-300",
    },
    {
      label: "Squad Happiness",
      val: `${metrics.happinessDelta >= 0 ? "+" : ""}${metrics.happinessDelta}`,
      pct: Math.min(100, Math.max(8, 50 + metrics.happinessDelta * 2.5)),
      tone:
        metrics.happinessDelta >= 0
          ? "bg-emerald-500 text-emerald-300"
          : "bg-rose-500 text-rose-300",
    },
  ];

  return (
    <section className="rounded-xl border border-slate-800 bg-[#111827] p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {meters.map((m) => {
          const [barColor, textColor] = m.tone.split(" ");
          return (
            <div
              key={m.label}
              className="rounded-lg border border-slate-800 bg-[#0B0F19] p-3"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{m.label}</span>
                <span className={`font-mono font-bold ${textColor}`}>
                  {m.val}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${m.pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {metrics.violations.length > 0 && (
        <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-200">
          <strong>Session Limit Exceeded: </strong>
          {metrics.violations.map((v, i) => (
            <span key={v.code} className="font-mono">
              {i > 0 ? " · " : ""}
              {v.code} ({v.count}x / max {v.maxAllowed}x per week)
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
