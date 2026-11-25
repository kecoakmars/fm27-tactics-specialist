"use client";

import React from "react";
import { DualPhasePitch } from "./DualPhasePitch";

export interface SplitViewPitchProps {
  ipOverlayNode?: React.ReactNode;
  oopOverlayNode?: React.ReactNode;
}

export function SplitViewPitch({
  ipOverlayNode,
  oopOverlayNode,
}: SplitViewPitchProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 w-full items-start">
      <DualPhasePitch phase="ip" compact overlayNode={ipOverlayNode} />
      <DualPhasePitch phase="oop" compact overlayNode={oopOverlayNode} />
    </div>
  );
}
