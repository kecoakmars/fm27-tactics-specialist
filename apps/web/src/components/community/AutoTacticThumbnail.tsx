"use client";

import { getPitchCatalog } from "@fm27/fm-data";
import type { DualPhaseTactic } from "@fm27/shared-types";

interface AutoTacticThumbnailProps {
  tactic: DualPhaseTactic;
  large?: boolean;
}

export function AutoTacticThumbnail({
  tactic,
  large = false,
}: AutoTacticThumbnailProps) {
  const catalog = getPitchCatalog(tactic.patchVersion);
  const posMap = new Map(catalog.Positions.map((p) => [p.Id, p]));

  function renderHalfPitch(phase: "ip" | "oop") {
    const strokeAccent = phase === "ip" ? "#06B6D4" : "#F59E0B";
    const fillToken = phase === "ip" ? "#0891B2" : "#D97706";

    return (
      <div className="relative flex-1 rounded-lg border border-slate-800 bg-[#081A14] p-2">
        <div className="mb-1 flex items-center justify-between font-mono text-[10px]">
          <span
            className={
              phase === "ip"
                ? "font-semibold text-cyan-300"
                : "font-semibold text-amber-300"
            }
          >
            {phase === "ip" ? "IP" : "OOP"}{" "}
            {phase === "ip" ? tactic.inFormation : tactic.outFormation}
          </span>
          <span className="text-slate-500">M{tactic.mentality}</span>
        </div>

        <svg
          viewBox="0 0 100 100"
          className={large ? "h-56 w-full" : "h-32 w-full"}
          role="img"
          aria-label={`${phase.toUpperCase()} formation preview`}
        >
          <rect
            x="3"
            y="3"
            width="94"
            height="94"
            rx="3"
            fill="#0A231B"
            stroke="#10B981"
            strokeOpacity="0.3"
            strokeWidth="0.9"
          />
          <line
            x1="3"
            y1="50"
            x2="97"
            y2="50"
            stroke="#10B981"
            strokeOpacity="0.22"
            strokeWidth="0.7"
          />
          <circle
            cx="50"
            cy="50"
            r="11"
            fill="none"
            stroke="#10B981"
            strokeOpacity="0.22"
            strokeWidth="0.7"
          />
          <rect
            x="26"
            y="3"
            width="48"
            height="15"
            fill="none"
            stroke="#10B981"
            strokeOpacity="0.22"
            strokeWidth="0.7"
          />
          <rect
            x="26"
            y="82"
            width="48"
            height="15"
            fill="none"
            stroke="#10B981"
            strokeOpacity="0.22"
            strokeWidth="0.7"
          />

          {tactic.slots.map((slot) => {
            const ipPos = posMap.get(slot.inPossession.positionId);
            const oopPos = posMap.get(slot.outOfPossession.positionId);
            const activePos = phase === "ip" ? ipPos : oopPos;
            if (!activePos) return null;

            return (
              <g key={`${phase}-${slot.slotIndex}`}>
                {phase === "ip" && ipPos && oopPos && (
                  <line
                    x1={oopPos.X}
                    y1={oopPos.Y}
                    x2={ipPos.X}
                    y2={ipPos.Y}
                    stroke="#06B6D4"
                    strokeOpacity="0.32"
                    strokeDasharray="1.8 1.5"
                    strokeWidth="0.7"
                  />
                )}
                <circle
                  cx={activePos.X}
                  cy={activePos.Y}
                  r={large ? 4.2 : 3.8}
                  fill={fillToken}
                  stroke={strokeAccent}
                  strokeWidth="1"
                />
                <text
                  x={activePos.X}
                  y={activePos.Y + 1.2}
                  textAnchor="middle"
                  fontSize={large ? "3.2" : "2.9"}
                  fill="#F8FAFC"
                  fontFamily="monospace"
                  fontWeight="700"
                >
                  {activePos.Id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {renderHalfPitch("ip")}
      {renderHalfPitch("oop")}
    </div>
  );
}
