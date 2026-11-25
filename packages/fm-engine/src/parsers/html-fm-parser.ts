import type { Player, StaffMember, StaffRole } from "@fm27/shared-types";
import { parseSquadCsv } from "./csv-squad-parser.js";

function stripHtmlTags(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

/**
 * Extracts rows and cells from an FM-View-Exporter (`F9`) or legacy FM HTML `<table>`.
 * Works in both Node.js and browser Web Workers with zero DOM dependencies.
 */
export function extractHtmlTableRows(htmlText: string): string[][] {
  const rows: string[][] = [];
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(htmlText)) !== null) {
    const rowInner = rowMatch[1] ?? "";
    const cells: string[] = [];
    const cellRegex = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowInner)) !== null) {
      cells.push(stripHtmlTags(cellMatch[1] ?? ""));
    }
    if (cells.some((c) => c.length > 0)) {
      rows.push(cells);
    }
  }
  return rows;
}

/**
 * Parses Squad `Player[]` from an FM-View-Exporter (`F9`) or legacy FM HTML export.
 */
export function parseSquadHtml(htmlText: string): Player[] {
  const rows = extractHtmlTableRows(htmlText);
  if (rows.length < 2) {
    throw new Error("HTML input must contain a header row and at least 1 player row");
  }
  const csvEquivalent = rows
    .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  return parseSquadCsv(csvEquivalent);
}

function clampStaffAttr(val: string | undefined, fallback = 10): number {
  if (!val) return fallback;
  const n = Number(val.trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(20, Math.round(n)));
}

function normalizeStaffRole(raw: string | undefined): StaffRole {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("assistant")) return "Assistant Manager";
  if (s.includes("fitness")) return "Fitness Coach";
  if (s.includes("gk") || s.includes("goalkeep")) return "Goalkeeping Coach";
  if (s.includes("youth") || s.includes("hoyd")) return "Head of Youth Development";
  if (s.includes("manager")) return "Manager";
  return "Coach";
}

/**
 * Parses Coaching `StaffMember[]` from an FM-View-Exporter (`F9`) HTML or CSV-converted table.
 */
export function parseStaffHtml(htmlText: string): StaffMember[] {
  const rows = extractHtmlTableRows(htmlText);
  if (rows.length < 2) {
    throw new Error("HTML staff table must contain a header row and at least 1 staff row");
  }

  const headers = rows[0]!.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const staff: StaffMember[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i]!;
    const map: Record<string, string> = {};
    headers.forEach((h, idx) => {
      map[h] = cells[idx] ?? "";
    });

    const name = map.name || map.staff || "";
    if (!name) continue;

    const club = map.club || map.team || "Free Agent";
    const isFreeAgent =
      club.toLowerCase() === "free agent" || club === "-" || club.length === 0;

    staff.push({
      uid: Number(map.uid || map.uniqueid || 950_000 + i),
      name,
      age: Math.max(20, Math.min(85, Number(map.age) || 42)),
      nationality: map.nat || map.nationality || "Unknown",
      club: isFreeAgent ? "Free Agent" : club,
      isFreeAgent,
      preferredRole: normalizeStaffRole(map.role || map.job || map.preferredjob),
      wageEstimateEurWeekly: Math.max(0, Number(map.wage) || 8000),
      attributes: {
        attacking: clampStaffAttr(map.att || map.attacking, 10),
        defending: clampStaffAttr(map.def || map.defending, 10),
        fitness: clampStaffAttr(map.fit || map.fitness, 10),
        mental: clampStaffAttr(map.men || map.mental, 10),
        tactical: clampStaffAttr(map.tac || map.tactical, 10),
        technical: clampStaffAttr(map.tec || map.technical, 10),
        working_with_youngsters: clampStaffAttr(map.wwy || map.youngsters, 10),
        gk_distribution: clampStaffAttr(map.gkd || map.gkdistribution, 1),
        gk_handling: clampStaffAttr(map.gkh || map.gkhandling, 1),
        gk_shot_stopping: clampStaffAttr(map.gks || map.gkshotstopping, 1),
        determination: clampStaffAttr(map.det || map.determination, 12),
        level_of_discipline: clampStaffAttr(map.lod || map.discipline || map.levelofdiscipline, 12),
        motivating: clampStaffAttr(map.mot || map.motivating, 12),
        tactical_knowledge: clampStaffAttr(map.tkn || map.tacticalknowledge, 10),
        judging_player_ability: clampStaffAttr(map.jpa || map.judgingability, 10),
        judging_player_potential: clampStaffAttr(map.jpp || map.judgingpotential, 10),
      },
    });
  }

  return staff;
}
