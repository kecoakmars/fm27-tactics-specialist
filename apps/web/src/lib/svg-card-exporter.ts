"use client";

import { getPitchCatalog, getTacticalStyles } from "@fm27/fm-data";
import { computeTacticalBalance, computeTacticalMetrics } from "@fm27/fm-engine";
import type { DualPhaseTactic, Player } from "@fm27/shared-types";
import { sanitizeFileName, triggerBrowserDownload } from "./local-folder-sync";

export interface TacticCardRenderOptions {
  squadPlayers?: readonly Player[];
  locale?: "id" | "en";
  showPlayerNames?: boolean;
}

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

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

function wrapSvgLines(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    }
  }

  if (lines.length < maxLines && current) {
    const usedWords = lines.join(" ").split(/\s+/).filter(Boolean).length;
    const remainingText = words.slice(usedWords).join(" ");
    lines.push(truncateText(remainingText, maxCharsPerLine));
  }

  return lines.slice(0, maxLines);
}

function barColorHex(score: number): string {
  if (score >= 78) return "#34D399";
  if (score >= 62) return "#A3E635";
  if (score >= 42) return "#FBBF24";
  return "#F43F5E";
}

const IP_GROUPS = new Set([
  "PassingDirectness",
  "Tempo",
  "Width",
  "ApproachPlay",
  "FinalThird",
  "CrossingStyle",
  "CreativeFreedom",
  "Dribbling",
  "PlayOutOfDefence",
]);

const TRANSITION_GROUPS = new Set([
  "DefensiveTransition",
  "AttackingTransition",
  "GoalkeeperDistributionSpeed",
  "GoalkeeperDistributionType",
  "GoalkeeperDistributionTarget",
]);

function buildDeterministicTacticExplanation(
  tactic: DualPhaseTactic,
  styleName: string,
  mentalityLabel: string,
  locale: "id" | "en",
): { line1: string; line2: string } {
  const ti = tactic.teamInstructions;
  const loe = ti.LineOfEngagement ?? 62;
  const blockId =
    loe === 61
      ? locale === "id"
        ? "High Press agresif"
        : "aggressive High Press"
      : loe === 63
        ? locale === "id"
          ? "Low Block rapat"
          : "compact Low Block"
        : locale === "id"
          ? "Mid Block terorganisir"
          : "structured Mid Block";

  const transitionDesc =
    ti.DefensiveTransition === 70
      ? locale === "id"
        ? "Counter-Press instan saat kehilangan bola"
        : "instant Counter-Press upon losing possession"
      : ti.DefensiveTransition === 71
        ? locale === "id"
          ? "kembali rapat (Regroup) menjaga kedalaman"
          : "disciplined Regroup to protect central space"
        : locale === "id"
          ? "transisi bertahan seimbang"
          : "balanced defensive transition";

  const tempoDesc =
    ti.Tempo === 46 || ti.Tempo === 47
      ? locale === "id"
        ? "tempo cepat"
        : "high-tempo progression"
      : ti.Tempo === 48 || ti.Tempo === 49
        ? locale === "id"
          ? "tempo sabar"
          : "patient build-up tempo"
        : locale === "id"
          ? "tempo terukur"
          : "measured tempo";

  const attackDuties = tactic.slots.filter((s) => s.inPossession.duty === "Attack").length;
  const shapeChanged = tactic.inFormation !== tactic.outFormation;

  if (locale === "id") {
    return {
      line1: `Sistem ${styleName} (${mentalityLabel}) menyerang dalam struktur ${tactic.inFormation} dengan ${tempoDesc} serta ${attackDuties} peran penetrasi aktif.`,
      line2: shapeChanged
        ? `Saat kehilangan bola, formasi bergeser ke ${tactic.outFormation} melalui ${transitionDesc} dan bertahan dalam ${blockId}.`
        : `Saat bertahan, tim menjaga bentuk ${tactic.outFormation} dengan ${transitionDesc} serta ${blockId}.`,
    };
  }

  return {
    line1: `${styleName} (${mentalityLabel}) attacks in a ${tactic.inFormation} structure using ${tempoDesc} and ${attackDuties} active penetration runners.`,
    line2: shapeChanged
      ? `Out of possession, the team morphs into a ${tactic.outFormation} shape with ${transitionDesc} and ${blockId}.`
      : `Out of possession, the unit holds a ${tactic.outFormation} block backed by ${transitionDesc} and ${blockId}.`,
  };
}

/**
 * Generates a rich, standalone 1600x900 Dual-Phase Tactical Poster SVG for preview & HD PNG export.
 */
export function buildDualPhaseTacticCardSvg(
  tactic: DualPhaseTactic,
  options?: TacticCardRenderOptions,
): string {
  const locale = options?.locale ?? "id";
  const showPlayerNames = options?.showPlayerNames ?? true;
  const squadPlayers =
    options?.squadPlayers && options.squadPlayers.length >= 11
      ? options.squadPlayers
      : undefined;

  const catalog = getPitchCatalog(tactic.patchVersion);
  const styles = getTacticalStyles(tactic.patchVersion);
  const posMap = new Map(catalog.Positions.map((p) => [p.Id, p]));
  const roleMap = new Map(catalog.Roles.map((r) => [r.Id, r.Name]));

  const styleObj = styles.TacticalStyles.find(
    (s) => s.Id.toLowerCase() === (tactic.styleId ?? "").toLowerCase(),
  );
  const styleName = styleObj?.Name ?? tactic.styleId ?? "Custom";
  const mentalityLabel =
    styles.Mentalities.find((m) => m.Value === tactic.mentality)?.Label ?? "Balanced";

  const balance = computeTacticalBalance(tactic, squadPlayers);
  const metrics = computeTacticalMetrics(tactic, squadPlayers, balance);
  const effBySlot = new Map(
    metrics.effectiveness.playerEffectiveness.map((pe) => [pe.slotIndex, pe]),
  );

  // Group active team instructions into IP, Transition, OOP
  const ipPills: string[] = [];
  const trPills: string[] = [];
  const oopPills: string[] = [];

  for (const group of catalog.Instructions) {
    const bit = tactic.teamInstructions[group.Group] ?? group.Current;
    if (bit <= 0) continue;
    if (group.Group === "LineOfEngagement" && bit === 62) {
      oopPills.push("Mid Block");
      continue;
    }
    const opt = group.Options.find((o) => o.Bit === bit);
    if (!opt) continue;
    const low = opt.Label.toLowerCase();
    if (low === "standard" || low === "balanced" || low === "mixed" || low === "mixed crosses") {
      continue;
    }
    if (IP_GROUPS.has(group.Group)) {
      ipPills.push(opt.Label);
    } else if (TRANSITION_GROUPS.has(group.Group)) {
      trPills.push(opt.Label);
    } else {
      oopPills.push(opt.Label);
    }
  }

  if (ipPills.length === 0) {
    ipPills.push(locale === "id" ? "Build-Up Seimbang" : "Balanced Build-Up");
  }
  if (trPills.length === 0) {
    trPills.push(locale === "id" ? "Transisi Standar" : "Standard Transition");
  }
  if (oopPills.length === 0) {
    oopPills.push("Mid Block");
  }

  const explanation = buildDeterministicTacticExplanation(
    tactic,
    styleName,
    mentalityLabel,
    locale,
  );
  const descLines = [
    ...wrapSvgLines(explanation.line1, 66, 2),
    ...wrapSvgLines(explanation.line2, 66, 2),
  ].slice(0, 4);

  const renderTenSegmentsSvg = (x: number, y: number, score: number, w = 8, h = 8, gap = 3) => {
    const bars = Math.max(1, Math.min(10, Math.round(score / 10)));
    const activeHex = barColorHex(score);
    return Array.from({ length: 10 })
      .map(
        (_, i) =>
          `<rect x="${x + i * (w + gap)}" y="${y}" width="${w}" height="${h}" rx="1.8" fill="${i < bars ? activeHex : "#1E293B"}"/>`,
      )
      .join("");
  };

  const renderPitch = (phase: "ip" | "oop", offsetX: number, offsetY: number) => {
    const pitchW = 492;
    const pitchH = 568;
    const accent = phase === "ip" ? "#06B6D4" : "#F59E0B";
    const headerTitle =
      phase === "ip"
        ? locale === "id"
          ? `SAAT MENYERANG · IN POSSESSION (${tactic.inFormation})`
          : `IN POSSESSION (${tactic.inFormation})`
        : locale === "id"
          ? `SAAT BERTAHAN · OUT OF POSSESSION (${tactic.outFormation})`
          : `OUT OF POSSESSION (${tactic.outFormation})`;

    const lines: string[] = [
      `<g transform="translate(${offsetX}, ${offsetY})">`,
      `  <rect x="0" y="0" width="${pitchW}" height="32" rx="9" fill="#111827" stroke="${accent}" stroke-opacity="0.4" stroke-width="1.2"/>`,
      `  <circle cx="16" cy="16" r="4.5" fill="${accent}"/>`,
      `  <text x="28" y="20.5" fill="#F8FAFC" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" letter-spacing="0.04em">${escapeXml(headerTitle)}</text>`,
      `  <g transform="translate(0, 40)">`,
      `    <clipPath id="clip-pitch-${phase}">`,
      `      <rect width="${pitchW}" height="${pitchH}" rx="14"/>`,
      `    </clipPath>`,
      `    <g clip-path="url(#clip-pitch-${phase})">`,
    ];

    for (let s = 0; s < 10; s++) {
      lines.push(
        `      <rect x="0" y="${(s * pitchH) / 10}" width="${pitchW}" height="${pitchH / 10 + 1}" fill="${s % 2 === 0 ? "#0B241B" : "#0E2D22"}"/>`,
      );
    }

    lines.push(
      `    </g>`,
      `    <rect width="${pitchW}" height="${pitchH}" rx="14" fill="none" stroke="#10B981" stroke-opacity="0.4" stroke-width="1.8"/>`,
      `    <line x1="20" y1="${pitchH / 2}" x2="${pitchW - 20}" y2="${pitchH / 2}" stroke="#10B981" stroke-opacity="0.32" stroke-width="1.4"/>`,
      `    <circle cx="${pitchW / 2}" cy="${pitchH / 2}" r="52" fill="none" stroke="#10B981" stroke-opacity="0.32" stroke-width="1.4"/>`,
      `    <circle cx="${pitchW / 2}" cy="${pitchH / 2}" r="2.5" fill="#10B981" fill-opacity="0.5"/>`,
      `    <rect x="${pitchW / 2 - 112}" y="16" width="224" height="86" fill="none" stroke="#10B981" stroke-opacity="0.32" stroke-width="1.4"/>`,
      `    <rect x="${pitchW / 2 - 56}" y="16" width="112" height="32" fill="none" stroke="#10B981" stroke-opacity="0.28" stroke-width="1.2"/>`,
      `    <rect x="${pitchW / 2 - 112}" y="${pitchH - 102}" width="224" height="86" fill="none" stroke="#10B981" stroke-opacity="0.32" stroke-width="1.4"/>`,
      `    <rect x="${pitchW / 2 - 56}" y="${pitchH - 48}" width="112" height="32" fill="none" stroke="#10B981" stroke-opacity="0.28" stroke-width="1.2"/>`,
      `    <line x1="${Math.round(pitchW * 0.35)}" y1="16" x2="${Math.round(pitchW * 0.35)}" y2="${pitchH - 16}" stroke="#10B981" stroke-opacity="0.08" stroke-dasharray="4 5" stroke-width="1"/>`,
      `    <line x1="${Math.round(pitchW * 0.65)}" y1="16" x2="${Math.round(pitchW * 0.65)}" y2="${pitchH - 16}" stroke="#10B981" stroke-opacity="0.08" stroke-dasharray="4 5" stroke-width="1"/>`,
    );

    // Subtle transition vectors on IP board
    if (phase === "ip") {
      for (const slot of tactic.slots) {
        if (slot.inPossession.positionId === slot.outOfPossession.positionId) continue;
        const ipC = posMap.get(slot.inPossession.positionId);
        const oopC = posMap.get(slot.outOfPossession.positionId);
        if (!ipC || !oopC) continue;
        const x1 = Math.round(34 + (oopC.X / 100) * (pitchW - 68));
        const y1 = Math.round(34 + (oopC.Y / 100) * (pitchH - 68));
        const x2 = Math.round(34 + (ipC.X / 100) * (pitchW - 68));
        const y2 = Math.round(34 + (ipC.Y / 100) * (pitchH - 68));
        lines.push(
          `    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#38BDF8" stroke-opacity="0.26" stroke-width="1.6" stroke-dasharray="4 4"/>`,
        );
      }
    }

    for (const slot of tactic.slots) {
      const cfg = phase === "ip" ? slot.inPossession : slot.outOfPossession;
      const coord = posMap.get(cfg.positionId) ?? { X: 50, Y: 50 };
      const cx = Math.round(34 + (coord.X / 100) * (pitchW - 68));
      const cy = Math.round(34 + (coord.Y / 100) * (pitchH - 68));
      const isGk = cfg.positionId === "GK";
      const tokenStroke = isGk ? "#10B981" : accent;
      const roleShort = abbreviateRole(cfg.roleId);
      const dutyChar = phase === "ip" ? cfg.duty[0] : "D";
      const eff = effBySlot.get(slot.slotIndex);
      const rawName =
        showPlayerNames && (eff?.playerName || slot.playerName)
          ? (eff?.playerName ?? slot.playerName)!.split(" ").pop() ?? cfg.positionId
          : `#${slot.slotIndex + 1} ${cfg.positionId}`;

      lines.push(
        `    <g transform="translate(${cx}, ${cy})">`,
        `      <circle r="19.5" fill="#0B0F19" stroke="${tokenStroke}" stroke-width="2.6"/>`,
        `      <circle cx="-14" cy="-14" r="7.5" fill="#111827" stroke="${tokenStroke}" stroke-width="1.1"/>`,
        `      <text x="-14" y="-11" text-anchor="middle" fill="#F8FAFC" font-family="monospace" font-size="8.5" font-weight="700">${slot.slotIndex + 1}</text>`,
        `      <text y="-1.5" text-anchor="middle" fill="#F8FAFC" font-family="system-ui, sans-serif" font-size="10" font-weight="800">${escapeXml(roleShort)}</text>`,
        `      <text y="10" text-anchor="middle" fill="${tokenStroke}" font-family="monospace" font-size="8.8" font-weight="700">${escapeXml(cfg.positionId)}·${dutyChar}</text>`,
        `      <rect x="-42" y="22" width="84" height="${eff ? 21 : 16}" rx="4.5" fill="#0B0F19" fill-opacity="0.92" stroke="#334155" stroke-width="0.8"/>`,
        `      <text y="33" text-anchor="middle" fill="#F1F5F9" font-family="system-ui, sans-serif" font-size="9.5" font-weight="600">${escapeXml(truncateText(rawName, 13))}</text>`,
      );
      if (eff) {
        const bars = eff.bars;
        const bHex = barColorHex(eff.score);
        const segs = Array.from({ length: 10 })
          .map(
            (_, idx) =>
              `<rect x="${-35 + idx * 7.1}" y="37" width="5.8" height="2.8" rx="0.7" fill="${idx < bars ? bHex : "#1E293B"}"/>`,
          )
          .join("");
        lines.push(`      ${segs}`);
      }
      lines.push(`    </g>`);
    }

    lines.push(`  </g>`, `</g>`);
    return lines.join("\n");
  };

  const renderInstructionPillRow = (
    y: number,
    label: string,
    pills: string[],
    accentHex: string,
    bgHex: string,
  ) => {
    const out: string[] = [
      `<text x="1068" y="${y}" fill="${accentHex}" font-family="system-ui, sans-serif" font-size="10.5" font-weight="800" letter-spacing="0.05em">${escapeXml(label)}</text>`,
    ];
    let curX = 1068;
    let curY = y + 8;
    let rowIdx = 0;
    for (const pill of pills.slice(0, 6)) {
      const text = truncateText(pill, 24);
      const pillW = Math.min(240, Math.max(54, text.length * 6.5 + 18));
      if (curX + pillW > 1554) {
        rowIdx += 1;
        if (rowIdx > 1) break;
        curX = 1068;
        curY += 24;
      }
      out.push(
        `<rect x="${curX}" y="${curY}" width="${pillW}" height="20" rx="5" fill="${bgHex}" stroke="${accentHex}" stroke-opacity="0.45" stroke-width="1"/>`,
        `<text x="${curX + pillW / 2}" y="${curY + 13.5}" text-anchor="middle" fill="#F1F5F9" font-family="system-ui, sans-serif" font-size="10" font-weight="600">${escapeXml(text)}</text>`,
      );
      curX += pillW + 6;
    }
    return out.join("\n");
  };

  const pillarItems: Array<{ label: string; val: number; color: string }> = [
    {
      label: locale === "id" ? "Ancaman Serangan" : "Attacking Threat",
      val: balance.pillars.attackingThreat,
      color: "#06B6D4",
    },
    {
      label: locale === "id" ? "Progresi Build-Up" : "Build-Up",
      val: balance.pillars.buildUpProgression,
      color: "#38BDF8",
    },
    {
      label: locale === "id" ? "Pertahanan Sisa" : "Rest-Defense",
      val: balance.pillars.restDefenseStability,
      color: "#10B981",
    },
    {
      label: locale === "id" ? "Lebar & Half-Space" : "Width & Channels",
      val: balance.pillars.widthAndHalfSpaceCoverage,
      color: "#A3E635",
    },
    {
      label: locale === "id" ? "Kohesi Pressing" : "Pressing Cohesion",
      val: balance.pillars.pressingCohesion,
      color: "#F59E0B",
    },
    {
      label: locale === "id" ? "Ketahanan Transisi" : "Transition Shield",
      val: balance.pillars.transitionResilience,
      color: "#34D399",
    },
  ];

  const pillarsSvg = pillarItems
    .map((p, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const px = 1068 + col * 246;
      const py = 594 + row * 46;
      const barW = 228;
      const fillW = Math.max(8, Math.round((Math.min(100, p.val) / 100) * barW));
      return [
        `<text x="${px}" y="${py}" fill="#CBD5E1" font-family="system-ui, sans-serif" font-size="10.5" font-weight="600">${escapeXml(p.label)}</text>`,
        `<text x="${px + barW}" y="${py}" text-anchor="end" fill="${p.color}" font-family="monospace" font-size="11" font-weight="800">${p.val.toFixed(0)}</text>`,
        `<rect x="${px}" y="${py + 6}" width="${barW}" height="7" rx="3.5" fill="#0B0F19" stroke="#1E293B" stroke-width="0.8"/>`,
        `<rect x="${px}" y="${py + 6}" width="${fillW}" height="7" rx="3.5" fill="${p.color}"/>`,
      ].join("\n");
    })
    .join("\n");

  const lineupCardsSvg = tactic.slots
    .map((slot, idx) => {
      const cardW = 135;
      const gap = 5.8;
      const lx = Math.round(28 + idx * (cardW + gap));
      const ly = 776;
      const eff = effBySlot.get(slot.slotIndex);
      const pName =
        showPlayerNames && (eff?.playerName || slot.playerName)
          ? (eff?.playerName ?? slot.playerName)!.split(" ").slice(-1)[0] ?? slot.inPossession.positionId
          : `${locale === "id" ? "Slot" : "Slot"} #${slot.slotIndex + 1}`;
      const ipRoleName = truncateText(
        roleMap.get(slot.inPossession.roleId) ?? slot.inPossession.roleId,
        16,
      );
      const oopRoleName = truncateText(
        (roleMap.get(slot.outOfPossession.roleId) ?? slot.outOfPossession.roleId).replace(/^OP/, ""),
        16,
      );

      const segBar = eff
        ? Array.from({ length: 10 })
            .map(
              (_, bIdx) =>
                `<rect x="${lx + 8 + bIdx * 11.9}" y="${ly + 82}" width="10" height="4" rx="1" fill="${bIdx < eff.bars ? barColorHex(eff.score) : "#1E293B"}"/>`,
            )
            .join("")
        : "";

      return [
        `<rect x="${lx}" y="${ly}" width="${cardW}" height="94" rx="9" fill="#0B0F19" stroke="#1E293B" stroke-width="1"/>`,
        `<text x="${lx + 8}" y="${ly + 17}" fill="#F8FAFC" font-family="system-ui, sans-serif" font-size="11" font-weight="700">#${slot.slotIndex + 1} ${escapeXml(truncateText(pName, 12))}</text>`,
        `<text x="${lx + 8}" y="${ly + 35}" fill="#22D3EE" font-family="monospace" font-size="9.5" font-weight="700">IP ${escapeXml(slot.inPossession.positionId)}·${slot.inPossession.duty[0]}</text>`,
        `<text x="${lx + 8}" y="${ly + 48}" fill="#CBD5E1" font-family="system-ui, sans-serif" font-size="9.5">${escapeXml(ipRoleName)}</text>`,
        `<text x="${lx + 8}" y="${ly + 63}" fill="#FBBF24" font-family="monospace" font-size="9.5" font-weight="700">OOP ${escapeXml(slot.outOfPossession.positionId)}</text>`,
        `<text x="${lx + 8}" y="${ly + 75}" fill="#94A3B8" font-family="system-ui, sans-serif" font-size="9">${escapeXml(oopRoleName)}</text>`,
        segBar,
      ].join("\n");
    })
    .join("\n");

  const intBarW = Math.max(8, Math.round((metrics.intensity.score / 100) * 144));
  const compBarW = Math.max(8, Math.round((metrics.complexity.score / 100) * 144));
  const intColor =
    metrics.intensity.score >= 78
      ? "#F43F5E"
      : metrics.intensity.score >= 58
        ? "#FBBF24"
        : "#34D399";
  const compColor =
    metrics.complexity.score >= 78
      ? "#F59E0B"
      : metrics.complexity.score >= 58
        ? "#22D3EE"
        : "#34D399";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">`,
    `  <defs>`,
    `    <linearGradient id="bg-grad" x1="0" y1="0" x2="1" y2="1">`,
    `      <stop offset="0%" stop-color="#070B14"/>`,
    `      <stop offset="100%" stop-color="#0D1424"/>`,
    `    </linearGradient>`,
    `  </defs>`,
    `  <rect width="1600" height="900" fill="url(#bg-grad)"/>`,
    // Header Banner
    `  <rect x="28" y="18" width="1544" height="92" rx="16" fill="#111827" stroke="#1E293B" stroke-width="1.4"/>`,
    `  <rect x="46" y="36" width="10" height="56" rx="5" fill="#10B981"/>`,
    `  <text x="70" y="59" fill="#F8FAFC" font-family="system-ui, -apple-system, sans-serif" font-size="25" font-weight="800">${escapeXml(truncateText(tactic.title, 44))}</text>`,
    `  <text x="70" y="86" fill="#94A3B8" font-family="monospace" font-size="13.5" font-weight="600">${escapeXml(styleName)}  •  ${escapeXml(mentalityLabel)}  •  IP ${escapeXml(tactic.inFormation)} → OOP ${escapeXml(tactic.outFormation)}  •  FM27 v${escapeXml(tactic.patchVersion)}</text>`,
    // Header Score + 3 Indicator Mini-Cards
    `  <rect x="898" y="31" width="118" height="66" rx="11" fill="#0B0F19" stroke="#10B981" stroke-opacity="0.45" stroke-width="1.2"/>`,
    `  <text x="957" y="52" text-anchor="middle" fill="#94A3B8" font-family="system-ui, sans-serif" font-size="10" font-weight="700">${locale === "id" ? "SKOR TAKTIK" : "TACTIC SCORE"}</text>`,
    `  <text x="957" y="81" text-anchor="middle" fill="#34D399" font-family="monospace" font-size="24" font-weight="800">${balance.overallScore.toFixed(0)}<tspan font-size="12" fill="#64748B">/100</tspan></text>`,
    // Intensity mini-card
    `  <rect x="1028" y="31" width="168" height="66" rx="11" fill="#0B0F19" stroke="#1E293B" stroke-width="1"/>`,
    `  <text x="1040" y="51" fill="#CBD5E1" font-family="system-ui, sans-serif" font-size="10.5" font-weight="700">${locale === "id" ? "INTENSITAS" : "INTENSITY"}</text>`,
    `  <text x="1184" y="51" text-anchor="end" fill="${intColor}" font-family="monospace" font-size="12" font-weight="800">${metrics.intensity.score.toFixed(0)}</text>`,
    `  <rect x="1040" y="66" width="144" height="8" rx="4" fill="#1E293B"/>`,
    `  <rect x="1040" y="66" width="${intBarW}" height="8" rx="4" fill="${intColor}"/>`,
    // Complexity mini-card
    `  <rect x="1206" y="31" width="168" height="66" rx="11" fill="#0B0F19" stroke="#1E293B" stroke-width="1"/>`,
    `  <text x="1218" y="51" fill="#CBD5E1" font-family="system-ui, sans-serif" font-size="10.5" font-weight="700">${locale === "id" ? "KOMPLEKSITAS" : "COMPLEXITY"}</text>`,
    `  <text x="1362" y="51" text-anchor="end" fill="${compColor}" font-family="monospace" font-size="12" font-weight="800">${metrics.complexity.score.toFixed(0)}</text>`,
    `  <rect x="1218" y="66" width="144" height="8" rx="4" fill="#1E293B"/>`,
    `  <rect x="1218" y="66" width="${compBarW}" height="8" rx="4" fill="${compColor}"/>`,
    // Effectiveness 10-bar mini-card
    `  <rect x="1384" y="31" width="172" height="66" rx="11" fill="#0B0F19" stroke="#1E293B" stroke-width="1"/>`,
    `  <text x="1396" y="51" fill="#CBD5E1" font-family="system-ui, sans-serif" font-size="10.5" font-weight="700">${locale === "id" ? "EFEKTIVITAS" : "EFFECTIVENESS"}</text>`,
    `  <text x="1544" y="51" text-anchor="end" fill="${barColorHex(metrics.effectiveness.score)}" font-family="monospace" font-size="12" font-weight="800">${metrics.effectiveness.bars}/10</text>`,
    `  ${renderTenSegmentsSvg(1396, 65, metrics.effectiveness.score, 12, 9, 3)}`,

    // Dual Phase Pitches (IP + OOP)
    renderPitch("ip", 28, 124),
    renderPitch("oop", 536, 124),

    // Right Column Card 1: Tactical Identity / Explanation
    `  <rect x="1048" y="124" width="524" height="142" rx="13" fill="#111827" stroke="#1E293B" stroke-width="1.2"/>`,
    `  <text x="1068" y="149" fill="#34D399" font-family="system-ui, sans-serif" font-size="12" font-weight="800" letter-spacing="0.05em">${escapeXml(locale === "id" ? "CARA KERJA & IDENTITAS TAKTIK" : "TACTICAL IDENTITY & GAMEPLAN")}</text>`,
    ...descLines.map(
      (line, idx) =>
        `  <text x="1068" y="${174 + idx * 21}" fill="#E2E8F0" font-family="system-ui, sans-serif" font-size="12" font-weight="500">${escapeXml(line)}</text>`,
    ),

    // Right Column Card 2: Categorized Team Instructions
    `  <rect x="1048" y="278" width="524" height="264" rx="13" fill="#111827" stroke="#1E293B" stroke-width="1.2"/>`,
    `  <text x="1068" y="303" fill="#F8FAFC" font-family="system-ui, sans-serif" font-size="12" font-weight="800" letter-spacing="0.05em">${escapeXml(locale === "id" ? "INSTRUKSI TIM AKTIF" : "ACTIVE TEAM INSTRUCTIONS")}</text>`,
    renderInstructionPillRow(
      326,
      locale === "id" ? "SAAT MENGUASAI BOLA (IP)" : "IN POSSESSION (IP)",
      ipPills,
      "#22D3EE",
      "#082F49",
    ),
    renderInstructionPillRow(
      398,
      locale === "id" ? "TRANSISI" : "TRANSITION",
      trPills,
      "#34D399",
      "#064E3B",
    ),
    renderInstructionPillRow(
      470,
      locale === "id" ? "SAAT BERTAHAN (OOP)" : "OUT OF POSSESSION (OOP)",
      oopPills,
      "#FBBF24",
      "#451A03",
    ),

    // Right Column Card 3: 6 Tactical Balance Pillars
    `  <rect x="1048" y="554" width="524" height="178" rx="13" fill="#111827" stroke="#1E293B" stroke-width="1.2"/>`,
    `  <text x="1068" y="577" fill="#F8FAFC" font-family="system-ui, sans-serif" font-size="12" font-weight="800" letter-spacing="0.05em">${escapeXml(locale === "id" ? "6 PILAR KESEIMBANGAN TAKTIS" : "6 TACTICAL BALANCE PILLARS")}</text>`,
    pillarsSvg,

    // Bottom Lineup Strip
    `  <text x="28" y="764" fill="#94A3B8" font-family="system-ui, sans-serif" font-size="11" font-weight="800" letter-spacing="0.06em">${escapeXml(locale === "id" ? "DAFTAR 11 PEMAIN & PERAN DUA FASE (IP → OOP)" : "STARTING XI & DUAL-PHASE ROLES (IP → OOP)")}</text>`,
    `  <text x="1572" y="764" text-anchor="end" fill="#64748B" font-family="monospace" font-size="10.5" font-weight="700">FM27 TACTICS STUDIO</text>`,
    lineupCardsSvg,
    `</svg>`,
  ].join("\n");
}

/**
 * Rasterizes the Dual-Phase Tactical SVG onto a high-resolution Canvas and returns a PNG Blob.
 */
export async function renderDualPhasePngBlob(
  tactic: DualPhaseTactic,
  options?: TacticCardRenderOptions,
): Promise<Blob> {
  const svgMarkup = buildDualPhaseTacticCardSvg(tactic, options);
  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to rasterize SVG tactical card"));
      image.src = url;
    });

    const scale = 1.5; // 2400x1350 crisp HD output
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(1600 * scale);
    canvas.height = Math.round(900 * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))),
        "image/png",
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Renders the Dual-Phase Tactical SVG onto a high-resolution Canvas and downloads a PNG card.
 */
export async function exportDualPhasePngCard(
  tactic: DualPhaseTactic,
  options?: TacticCardRenderOptions,
): Promise<void> {
  const pngBlob = await renderDualPhasePngBlob(tactic, options);
  const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
  triggerBrowserDownload(sanitizeFileName(tactic.title, ".png"), pngBytes, "image/png");
}
