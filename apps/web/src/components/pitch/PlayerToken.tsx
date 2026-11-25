"use client";

import React from "react";
import type { SlotAssignment } from "@fm27/shared-types";

export interface PlayerTokenProps {
  slot: SlotAssignment;
  phase: "ip" | "oop";
  cx: number;
  cy: number;
  roleLabel: string;
  isSelected: boolean;
  isHovered: boolean;
  isDragSource: boolean;
  onSelect: (slotIndex: number, openModal?: boolean) => void;
  onHover: (slotIndex: number | null) => void;
  onStartDrag: (slotIndex: number, event: React.PointerEvent<SVGGElement>) => void;
}

function shortRoleCode(roleId: string): string {
  const base = roleId.replace(/^OP/, "");
  const caps = base.match(/[A-Z]/g);
  if (caps && caps.length >= 2) return caps.slice(0, 4).join("");
  return base.slice(0, 3).toUpperCase();
}

export function PlayerToken({
  slot,
  phase,
  cx,
  cy,
  roleLabel,
  isSelected,
  isHovered,
  isDragSource,
  onSelect,
  onHover,
  onStartDrag,
}: PlayerTokenProps) {
  const cfg = phase === "ip" ? slot.inPossession : slot.outOfPossession;
  const isGk = cfg.positionId === "GK";
  const accent = isGk ? "#10B981" : phase === "ip" ? "#06B6D4" : "#F59E0B";
  const roleShort = shortRoleCode(cfg.roleId);
  const dutyLetter = phase === "ip" ? cfg.duty[0] : "D";
  const piCount = cfg.playerInstructionBits.length;
  const displayName = slot.playerName
    ? slot.playerName.split(" ").slice(-1)[0] ?? cfg.positionId
    : `#${slot.slotIndex + 1} ${cfg.positionId}`;

  return (
    <g
      id={`pitch-token-${phase}-${slot.slotIndex}`}
      transform={`translate(${cx}, ${cy})`}
      className="cursor-grab active:cursor-grabbing select-none"
      style={{ opacity: isDragSource ? 0.45 : 1, transition: "opacity 120ms ease" }}
      onPointerDown={(e) => {
        if (!isGk) {
          onStartDrag(slot.slotIndex, e);
        }
        onSelect(slot.slotIndex, false);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onSelect(slot.slotIndex, true);
      }}
      onPointerEnter={() => onHover(slot.slotIndex)}
      onPointerLeave={() => onHover(null)}
    >
      {/* Active selection or cross-board hover halo */}
      {(isSelected || isHovered) && (
        <circle
          r={isSelected ? 30 : 27}
          fill={accent}
          fillOpacity={isSelected ? 0.22 : 0.14}
          stroke={accent}
          strokeWidth={isSelected ? 2 : 1.5}
          strokeDasharray={isSelected ? undefined : "4 3"}
        />
      )}

      {/* Main tactical disc */}
      <circle
        r={21}
        fill="#0B0F19"
        stroke={accent}
        strokeWidth={isSelected ? 3.2 : 2.4}
      />

      {/* Shirt index pill top-left */}
      <circle cx={-16} cy={-15} r={8.5} fill="#111827" stroke={accent} strokeWidth={1.2} />
      <text
        x={-16}
        y={-11.5}
        textAnchor="middle"
        fill="#F8FAFC"
        fontSize={9}
        fontWeight={700}
        className="font-mono-metric"
      >
        {slot.slotIndex + 1}
      </text>

      {/* Active PI indicator top-right */}
      {piCount > 0 && (
        <g transform="translate(16, -15)">
          <circle r={7.5} fill={accent} />
          <text
            y={3}
            textAnchor="middle"
            fill="#0B0F19"
            fontSize={8.5}
            fontWeight={800}
            className="font-mono-metric"
          >
            {piCount}
          </text>
        </g>
      )}

      {/* Role code & Duty */}
      <text
        y={-1}
        textAnchor="middle"
        fill="#F8FAFC"
        fontSize={10.5}
        fontWeight={800}
        letterSpacing="0.02em"
      >
        {roleShort}
      </text>
      <text
        y={11}
        textAnchor="middle"
        fill={accent}
        fontSize={9}
        fontWeight={700}
        className="font-mono-metric"
      >
        {cfg.positionId}·{dutyLetter}
      </text>

      {/* Nameplate & full role subtitle */}
      <g transform="translate(0, 30)">
        <rect
          x={-48}
          y={-9}
          width={96}
          height={20}
          rx={5}
          fill="#0B0F19"
          fillOpacity={0.9}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1}
        />
        <text
          y={4}
          textAnchor="middle"
          fill="#F8FAFC"
          fontSize={10}
          fontWeight={600}
        >
          {displayName.slice(0, 14)}
        </text>
      </g>

      {(isSelected || isHovered) && (
        <g transform="translate(0, 49)">
          <rect
            x={-60}
            y={-8}
            width={120}
            height={16}
            rx={4}
            fill="#111827"
            fillOpacity={0.95}
          />
          <text
            y={3}
            textAnchor="middle"
            fill="#94A3B8"
            fontSize={8.5}
            fontWeight={500}
          >
            {roleLabel.slice(0, 22)}
          </text>
        </g>
      )}
    </g>
  );
}
