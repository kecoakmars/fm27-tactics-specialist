"use client";

import { getPitchCatalog, getTacticalStyles } from "@fm27/fm-data";
import type { DualPhaseTactic } from "@fm27/shared-types";
import { sanitizeFileName, triggerBrowserDownload } from "./local-folder-sync";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function abbreviateRole(roleId: string): string {
  const clean = roleId.replace(/^OP/, "");
  const capitals = clean.match(/[A-Z]/g);
  if (capitals && capitals.length >= 2) {
    return capitals.slice(0, 4).join("");
  }
  return clean.slice(0, 3).toUpperCase();
}

/**
 * Generates a standalone 1600x900 Dual-Phase SVG markup string for sharing / PNG rasterization.
 */
export function buildDualPhaseTacticCardSvg(tactic: DualPhaseTactic): string {
  const catalog = getPitchCatalog(tactic.patchVersion);
  const styles = getTacticalStyles(tactic.patchVersion);
  const posMap = new Map(catalog.Positions.map((p) => [p.Id, p]));
  const mentalityLabel =
    styles.Mentalities.find((m) => m.Value === tactic.mentality)?.Label ?? "Balanced";

  const activeTiLabels: string[] = [];
  for (const [grp, bit] of Object.entries(tactic.teamInstructions)) {
    if (bit <= 0) continue;
    const g = catalog.Instructions.find((i) => i.Group === grp);
    const opt = g?.Options.find((o) => o.Bit === bit);
    if (g && opt) {
      activeTiLabels.push(`${g.Label}: ${opt.Label}`);
    }
  }

  const renderPitchTokens = (phase: "ip" | "oop", offsetX: number, offsetY: number) => {
    const pitchW = 680;
    const pitchH = 660;
    const accent = phase === "ip" ? "#06B6D4" : "#F59E0B";

    const lines = [
      `<g transform="translate(${offsetX}, ${offsetY})">`,
      `  <rect width="${pitchW}" height="${pitchH}" rx="18" fill="#0B241B" stroke="#10B981" stroke-opacity="0.45" stroke-width="2"/>`,
      `  <line x1="24" y1="${pitchH / 2}" x2="${pitchW - 24}" y2="${pitchH / 2}" stroke="#10B981" stroke-opacity="0.28" stroke-width="1.5"/>`,
      `  <circle cx="${pitchW / 2}" cy="${pitchH / 2}" r="68" fill="none" stroke="#10B981" stroke-opacity="0.28" stroke-width="1.5"/>`,
      `  <rect x="${pitchW / 2 - 145}" y="18" width="290" height="105" fill="none" stroke="#10B981" stroke-opacity="0.28" stroke-width="1.5"/>`,
      `  <rect x="${pitchW / 2 - 145}" y="${pitchH - 123}" width="290" height="105" fill="none" stroke="#10B981" stroke-opacity="0.28" stroke-width="1.5"/>`,
    ];

    for (const slot of tactic.slots) {
      const cfg = phase === "ip" ? slot.inPossession : slot.outOfPossession;
      const coord = posMap.get(cfg.positionId) ?? { X: 50, Y: 50 };
      const cx = Math.round(36 + (coord.X / 100) * (pitchW - 72));
      const cy = Math.round(36 + (coord.Y / 100) * (pitchH - 72));
      const isGk = cfg.positionId === "GK";
      const tokenFill = isGk ? "#10B981" : accent;
      const roleShort = abbreviateRole(cfg.roleId);
      const dutyChar = phase === "ip" ? cfg.duty[0] : "D";
      const label = slot.playerName
        ? slot.playerName.split(" ").pop() ?? cfg.positionId
        : cfg.positionId;

      lines.push(
        `  <g transform="translate(${cx}, ${cy})">`,
        `    <circle r="23" fill="#0B0F19" stroke="${tokenFill}" stroke-width="3"/>`,
        `    <text y="-2" text-anchor="middle" fill="#F8FAFC" font-family="system-ui, sans-serif" font-size="11" font-weight="700">${escapeXml(roleShort)}</text>`,
        `    <text y="12" text-anchor="middle" fill="${tokenFill}" font-family="monospace" font-size="10" font-weight="700">${escapeXml(cfg.positionId)}·${dutyChar}</text>`,
        `    <rect x="-46" y="27" width="92" height="18" rx="5" fill="#111827" fill-opacity="0.92"/>`,
        `    <text y="40" text-anchor="middle" fill="#E2E8F0" font-family="system-ui, sans-serif" font-size="11" font-weight="600">${escapeXml(label.slice(0, 14))}</text>`,
        `  </g>`,
      );
    }

    lines.push(`</g>`);
    return lines.join("\n");
  };

  const tiSummary = activeTiLabels.slice(0, 6).join("  •  ") || "Standard Instructions";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">`,
    `  <rect width="1600" height="900" fill="#0B0F19"/>`,
    `  <rect x="36" y="28" width="1528" height="96" rx="16" fill="#111827" stroke="#1E293B"/>`,
    `  <text x="68" y="68" fill="#F8FAFC" font-family="system-ui, sans-serif" font-size="28" font-weight="800">${escapeXml(tactic.title)}</text>`,
    `  <text x="68" y="102" fill="#94A3B8" font-family="monospace" font-size="15">FM27 v${escapeXml(tactic.patchVersion)}  |  Mentality: ${escapeXml(mentalityLabel)}  |  IP ${escapeXml(tactic.inFormation)} -> OOP ${escapeXml(tactic.outFormation)}</text>`,
    `  <text x="68" y="164" fill="#06B6D4" font-family="system-ui, sans-serif" font-size="18" font-weight="700">IN POSSESSION (${escapeXml(tactic.inFormation)})</text>`,
    `  <text x="852" y="164" fill="#F59E0B" font-family="system-ui, sans-serif" font-size="18" font-weight="700">OUT OF POSSESSION (${escapeXml(tactic.outFormation)})</text>`,
    renderPitchTokens("ip", 68, 180),
    renderPitchTokens("oop", 852, 180),
    `  <text x="800" y="874" text-anchor="middle" fill="#94A3B8" font-family="system-ui, sans-serif" font-size="14">${escapeXml(tiSummary)}</text>`,
    `</svg>`,
  ].join("\n");
}

/**
 * Renders the Dual-Phase Tactical SVG onto a high-resolution Canvas and downloads a PNG card.
 */
export async function exportDualPhasePngCard(tactic: DualPhaseTactic): Promise<void> {
  const svgMarkup = buildDualPhaseTacticCardSvg(tactic);
  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to rasterize SVG tactical card"));
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, 0, 0, 1600, 900);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))), "image/png");
    });
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
    triggerBrowserDownload(sanitizeFileName(tactic.title, ".png"), pngBytes, "image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
