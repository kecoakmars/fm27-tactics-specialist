"use client";

import React from "react";
import type { Position, SlotAssignment } from "@fm27/shared-types";

export interface TransitionVectorsProps {
  slots: readonly SlotAssignment[];
  positionsById: ReadonlyMap<string, Position>;
  activePhase: "ip" | "oop";
  highlightedSlotIndex: number | null;
  projectPoint: (xPercent: number, yPercent: number) => { cx: number; cy: number };
}

export function TransitionVectors({
  slots,
  positionsById,
  activePhase,
  highlightedSlotIndex,
  projectPoint,
}: TransitionVectorsProps) {
  const markerId = `transition-arrow-${activePhase}`;

  return (
    <g className="pointer-events-none">
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="7"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path
            d="M 0 1 L 9 5 L 0 9 z"
            fill={activePhase === "ip" ? "#F59E0B" : "#06B6D4"}
          />
        </marker>
      </defs>

      {slots.map((slot) => {
        const ipPos = positionsById.get(slot.inPossession.positionId);
        const oopPos = positionsById.get(slot.outOfPossession.positionId);
        if (!ipPos || !oopPos) return null;

        const dist = Math.hypot(ipPos.X - oopPos.X, ipPos.Y - oopPos.Y);
        if (dist < 2) return null;

        const isFocused =
          highlightedSlotIndex === null || highlightedSlotIndex === slot.slotIndex;
        if (!isFocused && highlightedSlotIndex !== null) {
          return null;
        }

        const fromPt =
          activePhase === "ip"
            ? projectPoint(ipPos.X, ipPos.Y)
            : projectPoint(oopPos.X, oopPos.Y);
        const toPt =
          activePhase === "ip"
            ? projectPoint(oopPos.X, oopPos.Y)
            : projectPoint(ipPos.X, ipPos.Y);

        const midX = (fromPt.cx + toPt.cx) / 2;
        const midY = (fromPt.cy + toPt.cy) / 2;
        const strokeColor = activePhase === "ip" ? "#F59E0B" : "#06B6D4";

        return (
          <g key={`vec-${slot.slotIndex}`} opacity={highlightedSlotIndex === slot.slotIndex ? 0.95 : 0.45}>
            <line
              x1={fromPt.cx}
              y1={fromPt.cy}
              x2={toPt.cx}
              y2={toPt.cy}
              stroke={strokeColor}
              strokeWidth={highlightedSlotIndex === slot.slotIndex ? 2.4 : 1.5}
              strokeDasharray="5 4"
              markerEnd={`url(#${markerId})`}
            />
            {highlightedSlotIndex === slot.slotIndex && (
              <g transform={`translate(${midX}, ${midY})`}>
                <rect
                  x={-22}
                  y={-9}
                  width={44}
                  height={17}
                  rx={4}
                  fill="#0B0F19"
                  stroke={strokeColor}
                  strokeWidth={1}
                />
                <text
                  y={3}
                  textAnchor="middle"
                  fill={strokeColor}
                  fontSize={9}
                  fontWeight={700}
                  className="font-mono-metric"
                >
                  Δ{Math.round(dist)}m
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}
