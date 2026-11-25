import { getPitchCatalog } from "@fm27/fm-data";
import type { DualPhaseTactic, Duty, PitchCatalog } from "@fm27/shared-types";

export interface ZoneCell {
  zoneIndex: number; // 0..17 (row * 3 + col)
  row: number; // 0 (attacking box) .. 5 (own box)
  col: number; // 0 = Left, 1 = Central, 2 = Right
  label: string;
  isZone14: boolean;
  intensity: number; // 0..100
}

export interface Heatmap18ZoneResult {
  inPossession: ZoneCell[];
  outOfPossession: ZoneCell[];
  transition: ZoneCell[];
  zone14IntensityIp: number;
  leftHalfSpaceIntensityIp: number;
  rightHalfSpaceIntensityIp: number;
  averageTransitionDistance: number;
}

const ROW_NAMES = [
  "Final Third Box",
  "Zone 14 / Edge",
  "Advanced Midfield",
  "Deep Midfield",
  "Defensive Third",
  "Penalty Area",
] as const;

const COL_NAMES = ["Left Channel", "Central Lane", "Right Channel"] as const;

function dutyForwardShift(duty: Duty): number {
  if (duty === "Attack") return -9; // moves toward Y=0 (opponent goal)
  if (duty === "Defend") return 6; // drops toward Y=100 (own goal)
  return -2;
}

function roleLateralAndVerticalShift(
  roleId: string,
  baseX: number,
): { dx: number; dy: number } {
  const sideSign = baseX < 50 ? 1 : baseX > 50 ? -1 : 0; // +1 toward center from left, -1 toward center from right
  if (
    roleId === "InsideForward" ||
    roleId === "InsideWinger" ||
    roleId === "InsideWingBack" ||
    roleId === "InsideFullBack" ||
    roleId === "PlaymakingWinger"
  ) {
    return { dx: sideSign * 14, dy: roleId.includes("WingBack") ? -8 : -5 };
  }
  if (
    roleId === "Winger" ||
    roleId === "AdvancedWingBack" ||
    roleId === "WingBack" ||
    roleId === "WideCentreBack" ||
    roleId === "OverlappingCentreBack"
  ) {
    return { dx: -sideSign * 7, dy: -8 };
  }
  if (roleId === "HalfBack" || roleId === "OPDroppingDefensiveMidfielder") {
    return { dx: 0, dy: 9 };
  }
  if (roleId === "FalseNine" || roleId === "DeepLyingForward") {
    return { dx: 0, dy: 8 };
  }
  if (
    roleId === "SecondStriker" ||
    roleId === "ChannelMidfielder" ||
    roleId === "BoxToBoxMidfielder"
  ) {
    return { dx: 0, dy: -8 };
  }
  return { dx: 0, dy: 0 };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function splatPointsTo18Zones(points: ReadonlyArray<{ x: number; y: number; weight: number }>): ZoneCell[] {
  const rawScores = new Float64Array(18);

  for (let r = 0; r < 6; r++) {
    const centerY = (r + 0.5) * (100 / 6);
    for (let c = 0; c < 3; c++) {
      const centerX = (c + 0.5) * (100 / 3);
      const zIdx = r * 3 + c;
      let accum = 0;
      for (const pt of points) {
        const distSq = (pt.x - centerX) ** 2 + (pt.y - centerY) ** 2;
        // Gaussian spatial kernel (sigma ~= 18 pitch units)
        accum += pt.weight * Math.exp(-distSq / (2 * 18 * 18));
      }
      rawScores[zIdx] = accum;
    }
  }

  const cells: ZoneCell[] = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 3; c++) {
      const zIdx = r * 3 + c;
      // Scale comfortably to 0..100 where ~2.3 overlapping players saturates 100
      const intensity = Math.round(clamp((rawScores[zIdx]! / 2.3) * 100, 0, 100) * 10) / 10;
      cells.push({
        zoneIndex: zIdx,
        row: r,
        col: c,
        label: `${ROW_NAMES[r]} — ${COL_NAMES[c]}`,
        isZone14: r === 1 && c === 1,
        intensity,
      });
    }
  }
  return cells;
}

/**
 * Computes 18-zone spatial presence density across In-Possession, Out-of-Possession,
 * and Transition phases, including explicit Zone 14 and Half-Space intensities.
 */
export function computeHeatmap18Zones(
  tactic: DualPhaseTactic,
  options?: { catalog?: PitchCatalog },
): Heatmap18ZoneResult {
  const catalog = options?.catalog ?? getPitchCatalog(tactic.patchVersion);
  const posById = new Map(catalog.Positions.map((p) => [p.Id, p]));

  const widthBit = tactic.teamInstructions.AttackingWidth ?? 0;
  const widthScale =
    widthBit === 50
      ? 1.22
      : widthBit === 51
        ? 1.12
        : widthBit === 52
          ? 0.88
          : widthBit === 53
            ? 0.78
            : 1.0;

  const defLineBit = tactic.teamInstructions.DefensiveLine ?? 0;
  const defLineShiftY =
    defLineBit === 56
      ? -10
      : defLineBit === 57
        ? -5
        : defLineBit === 58
          ? 5
          : defLineBit === 59
            ? 10
            : 0;

  const loeBit = tactic.teamInstructions.LineOfEngagement ?? 62;
  const loeShiftY = loeBit === 61 ? -6 : loeBit === 63 ? 8 : 0;

  const ipPoints: Array<{ x: number; y: number; weight: number }> = [];
  const oopPoints: Array<{ x: number; y: number; weight: number }> = [];
  const transitionPoints: Array<{ x: number; y: number; weight: number }> = [];

  let leftHsAccum = 0;
  let rightHsAccum = 0;
  let totalTransitionDist = 0;

  for (const slot of tactic.slots) {
    const inPos = posById.get(slot.inPossession.positionId) ?? { X: 50, Y: 50 };
    const outPos = posById.get(slot.outOfPossession.positionId) ?? { X: 50, Y: 50 };

    const isGk = slot.inPossession.positionId === "GK";
    const ipDelta = roleLateralAndVerticalShift(slot.inPossession.roleId, inPos.X);
    const dutyDy = isGk ? 0 : dutyForwardShift(slot.inPossession.duty);

    const rawIpX = 50 + (inPos.X + ipDelta.dx - 50) * (isGk ? 1 : widthScale);
    const ipX = clamp(rawIpX, 4, 96);
    const ipY = clamp(inPos.Y + ipDelta.dy + dutyDy + (isGk ? 0 : defLineShiftY * 0.4), 5, 95);

    const oopDelta = roleLateralAndVerticalShift(slot.outOfPossession.roleId, outPos.X);
    const oopX = clamp(outPos.X + oopDelta.dx * 0.5, 6, 94);
    const oopY = clamp(
      outPos.Y + oopDelta.dy * 0.5 + (isGk ? 0 : (defLineShiftY + loeShiftY) * 0.5),
      8,
      95,
    );

    ipPoints.push({ x: ipX, y: ipY, weight: isGk ? 0.65 : 1.0 });
    oopPoints.push({ x: oopX, y: oopY, weight: isGk ? 0.65 : 1.0 });

    const dist = Math.hypot(ipX - oopX, ipY - oopY);
    totalTransitionDist += dist;
    // Midpoint weighted by transition workload highlights transition corridors & exposed recovery lanes
    transitionPoints.push({
      x: (ipX + oopX) * 0.5,
      y: (ipY + oopY) * 0.5,
      weight: clamp(0.6 + dist / 35, 0.6, 1.8),
    });

    if (!isGk) {
      // Left Half-Space center ~ (30, 28), Right Half-Space center ~ (70, 28)
      leftHsAccum += Math.exp(-((ipX - 30) ** 2 + (ipY - 28) ** 2) / (2 * 16 * 16));
      rightHsAccum += Math.exp(-((ipX - 70) ** 2 + (ipY - 28) ** 2) / (2 * 16 * 16));
    }
  }

  const inPossession = splatPointsTo18Zones(ipPoints);
  const outOfPossession = splatPointsTo18Zones(oopPoints);
  const transition = splatPointsTo18Zones(transitionPoints);

  const zone14Cell = inPossession.find((c) => c.isZone14);

  return {
    inPossession,
    outOfPossession,
    transition,
    zone14IntensityIp: zone14Cell?.intensity ?? 0,
    leftHalfSpaceIntensityIp: Math.round(clamp((leftHsAccum / 2.0) * 100, 0, 100) * 10) / 10,
    rightHalfSpaceIntensityIp: Math.round(clamp((rightHsAccum / 2.0) * 100, 0, 100) * 10) / 10,
    averageTransitionDistance: Math.round((totalTransitionDist / 11) * 10) / 10,
  };
}
