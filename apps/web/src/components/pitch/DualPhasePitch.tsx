"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { getPitchCatalog } from "@fm27/fm-data";
import { useLocale } from "@/stores/useLocaleStore";
import { useTacticStore } from "@/stores/useTacticStore";
import { PlayerToken } from "./PlayerToken";
import { TransitionVectors } from "./TransitionVectors";

export const PITCH_SVG_WIDTH = 600;
export const PITCH_SVG_HEIGHT = 720;
const PAD_X = 44;
const PAD_Y = 44;

export function projectPitchCoord(xPercent: number, yPercent: number): { cx: number; cy: number } {
  return {
    cx: PAD_X + (xPercent / 100) * (PITCH_SVG_WIDTH - PAD_X * 2),
    cy: PAD_Y + (yPercent / 100) * (PITCH_SVG_HEIGHT - PAD_Y * 2),
  };
}

export interface DualPhasePitchProps {
  phase: "ip" | "oop";
  compact?: boolean;
  overlayNode?: React.ReactNode;
}

export function DualPhasePitch({
  phase,
  compact = false,
  overlayNode,
}: DualPhasePitchProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { t } = useLocale();
  const {
    tactic,
    selectedSlotIndex,
    hoveredSlotIndex,
    showTransitionVectors,
    selectSlot,
    hoverSlot,
    moveSlotToPosition,
  } = useTacticStore();

  const [draggingSlotIdx, setDraggingSlotIdx] = useState<number | null>(null);
  const [dragSnapPosId, setDragSnapPosId] = useState<string | null>(null);

  const catalog = useMemo(() => getPitchCatalog(tactic.patchVersion), [tactic.patchVersion]);
  const positionsById = useMemo(
    () => new Map(catalog.Positions.map((p) => [p.Id, p])),
    [catalog.Positions],
  );
  const roleNameById = useMemo(
    () => new Map(catalog.Roles.map((r) => [r.Id, r.Name])),
    [catalog.Roles],
  );

  const occupiedPositionMap = useMemo(() => {
    const map = new Map<string, number>();
    tactic.slots.forEach((s) => {
      const posId =
        phase === "ip" ? s.inPossession.positionId : s.outOfPossession.positionId;
      map.set(posId, s.slotIndex);
    });
    return map;
  }, [phase, tactic.slots]);

  const findNearestOutfieldPosition = useCallback(
    (clientX: number, clientY: number): string | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;

      const svgX = ((clientX - rect.left) / rect.width) * PITCH_SVG_WIDTH;
      const svgY = ((clientY - rect.top) / rect.height) * PITCH_SVG_HEIGHT;

      let bestId: string | null = null;
      let bestDist = Number.POSITIVE_INFINITY;

      for (const pos of catalog.Positions) {
        if (pos.Id === "GK") continue;
        const pt = projectPitchCoord(pos.X, pos.Y);
        const d = Math.hypot(svgX - pt.cx, svgY - pt.cy);
        if (d < bestDist) {
          bestDist = d;
          bestId = pos.Id;
        }
      }
      return bestDist <= 95 ? bestId : null;
    },
    [catalog.Positions],
  );

  const handleStartDrag = useCallback(
    (slotIndex: number, event: React.PointerEvent<SVGGElement>) => {
      event.stopPropagation();
      try {
        svgRef.current?.setPointerCapture(event.pointerId);
      } catch {
        // ignore synthetic pointer capture errors
      }
      setDraggingSlotIdx(slotIndex);
      const currentPos =
        phase === "ip"
          ? tactic.slots[slotIndex]?.inPossession.positionId
          : tactic.slots[slotIndex]?.outOfPossession.positionId;
      setDragSnapPosId(currentPos ?? null);
    },
    [phase, tactic.slots],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (draggingSlotIdx === null) return;
      const nearest = findNearestOutfieldPosition(event.clientX, event.clientY);
      setDragSnapPosId(nearest);
    },
    [draggingSlotIdx, findNearestOutfieldPosition],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (draggingSlotIdx === null) return;
      try {
        svgRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      if (dragSnapPosId) {
        moveSlotToPosition(draggingSlotIdx, phase, dragSnapPosId);
      }
      setDraggingSlotIdx(null);
      setDragSnapPosId(null);
    },
    [dragSnapPosId, draggingSlotIdx, moveSlotToPosition, phase],
  );

  const selectedSlot =
    selectedSlotIndex !== null ? tactic.slots[selectedSlotIndex] ?? null : null;
  const selectedIsOutfield =
    selectedSlot !== null &&
    (phase === "ip"
      ? selectedSlot.inPossession.positionId !== "GK"
      : selectedSlot.outOfPossession.positionId !== "GK");

  const activeHighlightIdx = hoveredSlotIndex ?? selectedSlotIndex;
  const phaseAccent = phase === "ip" ? "#06B6D4" : "#F59E0B";
  const formationText = phase === "ip" ? tactic.inFormation : tactic.outFormation;

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Phase Header Strip */}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0B0F19]/80 border border-white/8">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: phaseAccent }}
          />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {phase === "ip"
              ? t("Saat Menguasai Bola (IP)", "In Possession")
              : t("Saat Bertahan (OOP)", "Out of Possession")}
          </span>
        </div>
        <span
          className="font-mono-metric text-xs font-bold px-2.5 py-0.5 rounded bg-slate-900 border border-white/10"
          style={{ color: phaseAccent }}
        >
          {formationText}
        </span>
      </div>

      {/* Responsive Tactical Pitch SVG */}
      <div className="relative w-full overflow-hidden rounded-xl border border-emerald-500/25 shadow-2xl bg-[#0B241B]">
        <svg
          ref={svgRef}
          id={`tactical-pitch-svg-${phase}`}
          viewBox={`0 0 ${PITCH_SVG_WIDTH} ${PITCH_SVG_HEIGHT}`}
          className={`w-full h-auto block touch-none ${compact ? "max-h-[560px]" : "max-h-[680px]"}`}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {Array.from({ length: 12 }).map((_, idx) => (
            <rect
              key={`stripe-${idx}`}
              x={0}
              y={idx * (PITCH_SVG_HEIGHT / 12)}
              width={PITCH_SVG_WIDTH}
              height={PITCH_SVG_HEIGHT / 12}
              fill={idx % 2 === 0 ? "#0B241B" : "#0E2B20"}
            />
          ))}

          {overlayNode}

          <g stroke="#10B981" strokeOpacity={0.09} strokeDasharray="4 6" strokeWidth={1}>
            <line x1={212} y1={28} x2={212} y2={PITCH_SVG_HEIGHT - 28} />
            <line x1={388} y1={28} x2={388} y2={PITCH_SVG_HEIGHT - 28} />
          </g>

          <g stroke="#10B981" strokeOpacity={0.38} strokeWidth={1.8} fill="none">
            <rect
              x={28}
              y={28}
              width={PITCH_SVG_WIDTH - 56}
              height={PITCH_SVG_HEIGHT - 56}
              rx={4}
            />
            <line x1={28} y1={PITCH_SVG_HEIGHT / 2} x2={PITCH_SVG_WIDTH - 28} y2={PITCH_SVG_HEIGHT / 2} />
            <circle cx={PITCH_SVG_WIDTH / 2} cy={PITCH_SVG_HEIGHT / 2} r={62} />
            <circle cx={PITCH_SVG_WIDTH / 2} cy={PITCH_SVG_HEIGHT / 2} r={2.5} fill="#10B981" />

            <rect x={165} y={28} width={270} height={106} />
            <rect x={232} y={28} width={136} height={40} />
            <path d="M 252 134 A 52 52 0 0 0 348 134" />

            <rect x={165} y={PITCH_SVG_HEIGHT - 134} width={270} height={106} />
            <rect x={232} y={PITCH_SVG_HEIGHT - 68} width={136} height={40} />
            <path d={`M 252 ${PITCH_SVG_HEIGHT - 134} A 52 52 0 0 1 348 ${PITCH_SVG_HEIGHT - 134}`} />
          </g>

          <g transform="translate(46, 52)" opacity={0.45}>
            <path d="M0 16 L6 4 L12 16" stroke="#10B981" strokeWidth={1.8} fill="none" />
            <text x={18} y={14} fill="#10B981" fontSize={9.5} fontWeight={700} letterSpacing="0.08em">
              ATT
            </text>
          </g>

          {catalog.Positions.map((pos) => {
            if (pos.Id === "GK") return null;
            const isOccupied = occupiedPositionMap.has(pos.Id);
            const isDropTarget = dragSnapPosId === pos.Id;
            if (isOccupied && !isDropTarget) return null;

            const { cx, cy } = projectPitchCoord(pos.X, pos.Y);
            const canClickMove = selectedIsOutfield && selectedSlotIndex !== null;

            return (
              <g
                key={`snap-${pos.Id}`}
                id={`pitch-snap-${phase}-${pos.Id}`}
                transform={`translate(${cx}, ${cy})`}
                className={canClickMove ? "cursor-pointer group" : "pointer-events-none"}
                onClick={() => {
                  if (canClickMove && selectedSlotIndex !== null) {
                    moveSlotToPosition(selectedSlotIndex, phase, pos.Id);
                  }
                }}
              >
                <circle
                  r={isDropTarget ? 22 : 13}
                  fill={isDropTarget ? phaseAccent : "#0B0F19"}
                  fillOpacity={isDropTarget ? 0.28 : 0.45}
                  stroke={isDropTarget ? phaseAccent : "#94A3B8"}
                  strokeOpacity={isDropTarget ? 0.95 : canClickMove ? 0.35 : 0.16}
                  strokeWidth={isDropTarget ? 2.4 : 1.2}
                  strokeDasharray={isDropTarget ? undefined : "3 3"}
                />
                <text
                  y={3}
                  textAnchor="middle"
                  fill={isDropTarget ? "#F8FAFC" : "#94A3B8"}
                  fillOpacity={isDropTarget ? 1 : canClickMove ? 0.68 : 0.32}
                  fontSize={8.5}
                  fontWeight={700}
                  className="font-mono-metric"
                >
                  {pos.Id}
                </text>
              </g>
            );
          })}

          {showTransitionVectors && (
            <TransitionVectors
              slots={tactic.slots}
              positionsById={positionsById}
              activePhase={phase}
              highlightedSlotIndex={activeHighlightIdx}
              projectPoint={projectPitchCoord}
            />
          )}

          {tactic.slots.map((slot) => {
            const cfg = phase === "ip" ? slot.inPossession : slot.outOfPossession;
            const coord = positionsById.get(cfg.positionId) ?? { X: 50, Y: 50 };
            const { cx, cy } = projectPitchCoord(coord.X, coord.Y);
            const roleName = roleNameById.get(cfg.roleId) ?? cfg.roleId;

            return (
              <PlayerToken
                key={`token-${phase}-${slot.slotIndex}`}
                slot={slot}
                phase={phase}
                cx={cx}
                cy={cy}
                roleLabel={roleName}
                isSelected={selectedSlotIndex === slot.slotIndex}
                isHovered={hoveredSlotIndex === slot.slotIndex}
                isDragSource={draggingSlotIdx === slot.slotIndex}
                onSelect={selectSlot}
                onHover={hoverSlot}
                onStartDrag={handleStartDrag}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
