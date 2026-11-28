"use client";

import React from "react";
import { scoreToFamiliarityBars } from "@fm27/fm-engine";

export interface FamiliaritySegmentsBarProps {
  score: number;
  size?: "xs" | "sm" | "md";
  showNumeric?: boolean;
  className?: string;
  title?: string;
}

export function getFamiliarityBarColors(score: number): {
  filled: string;
  text: string;
  hex: string;
} {
  if (score >= 78) {
    return { filled: "bg-emerald-400", text: "text-emerald-300", hex: "#34D399" };
  }
  if (score >= 62) {
    return { filled: "bg-lime-400", text: "text-lime-300", hex: "#A3E635" };
  }
  if (score >= 42) {
    return { filled: "bg-amber-400", text: "text-amber-300", hex: "#FBBF24" };
  }
  return { filled: "bg-rose-500", text: "text-rose-300", hex: "#F43F5E" };
}

export function FamiliaritySegmentsBar({
  score,
  size = "sm",
  showNumeric = false,
  className = "",
  title,
}: FamiliaritySegmentsBarProps) {
  const bars = scoreToFamiliarityBars(score);
  const tone = getFamiliarityBarColors(score);

  const dimClass =
    size === "xs"
      ? "h-2 w-1.5 rounded-[1.5px]"
      : size === "sm"
        ? "h-2.5 w-2 rounded-[2px]"
        : "h-2.5 flex-1 rounded-[2px]";

  return (
    <div
      title={title ?? `${bars}/10 (${score.toFixed(0)}%)`}
      className={`inline-flex items-center gap-1.5 ${size === "md" ? "w-full" : ""} ${className}`}
    >
      <div
        className={`flex items-center ${size === "md" ? "gap-1 w-full" : "gap-0.5"}`}
        aria-hidden="true"
      >
        {Array.from({ length: 10 }).map((_, idx) => {
          const active = idx < bars;
          return (
            <span
              key={idx}
              className={`${dimClass} transition-colors ${
                active ? tone.filled : "bg-slate-800/90 border border-white/6"
              }`}
            />
          );
        })}
      </div>
      {showNumeric && (
        <span className={`font-mono-metric text-[11px] font-bold shrink-0 ${tone.text}`}>
          {bars}/10
        </span>
      )}
    </div>
  );
}
