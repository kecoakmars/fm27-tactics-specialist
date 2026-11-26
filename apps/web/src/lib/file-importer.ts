"use client";

import {
  parseFm27Json,
  parseFmf,
  parseScheduleFmf,
  parseScheduleJson,
  parseShortlistFmf,
  unpackFmfArchive,
  type FmSaveClubEntry,
  type ParsedFmSave,
} from "@fm27/fm-codec";
import { parseStaffCsv, parseStaffHtml, type UnifiedReport } from "@fm27/fm-engine";
import type { DualPhaseTactic, WeeklySchedule } from "@fm27/shared-types";
import { useSquadStore } from "../stores/useSquadStore";
import { useTacticStore } from "../stores/useTacticStore";
import { useTrainingStore } from "../stores/useTrainingStore";
import { FM_SAVE_CANCELLED_ERROR, parseFmSaveInWorker } from "./worker-client";

export type FmSaveImportOutcome =
  | { cancelled: true }
  | {
      cancelled: false;
      parsed: ParsedFmSave;
      selectedClub: FmSaveClubEntry | null;
      report: UnifiedReport | null;
    };

export function formatHexHeader(bytes: Uint8Array, maxBytes = 16): string {
  return Array.from(bytes.subarray(0, maxBytes))
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");
}

export function isFmSaveFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".fm");
}

export function isTacticFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return (
    lower.endsWith(".fmf") ||
    lower.endsWith(".tac") ||
    lower.endsWith(".json")
  );
}

/**
 * Single centralized client-side `.fm` career save importer.
 * Never uploads bytes to any server; transfers ArrayBuffer to `/workers/fm-save-worker.js`.
 */
export async function importFmSaveArrayBuffer(
  fileName: string,
  arrayBuffer: ArrayBuffer,
): Promise<FmSaveImportOutcome> {
  const store = useTacticStore.getState();
  store.setFmImportProgress({
    stage: "Membaca file...",
    pct: 3,
    fileName,
  });

  try {
    if (arrayBuffer.byteLength === 0) {
      throw new Error("File save .fm kosong (0 bytes).");
    }
    const parsed = await parseFmSaveInWorker(arrayBuffer, (stage, pct) => {
      useTacticStore.getState().setFmImportProgress({ stage, pct, fileName });
    });
    const { selectedClub, report } = await useTacticStore
      .getState()
      .ingestParsedFmSave(parsed, fileName);
    return {
      cancelled: false,
      parsed,
      selectedClub,
      report,
    };
  } catch (err) {
    useTacticStore.getState().setFmImportProgress(null);
    const message = err instanceof Error ? err.message : String(err);
    if (message === FM_SAVE_CANCELLED_ERROR) {
      return { cancelled: true };
    }
    throw new Error(message || `Gagal memproses file save ${fileName}`);
  }
}

export async function importFmSaveFile(file: File): Promise<FmSaveImportOutcome> {
  useTacticStore.getState().setFmImportProgress({
    stage: "Membaca file dari disk lokal...",
    pct: 1,
    fileName: file.name,
  });
  try {
    await new Promise((r) => setTimeout(r, 16));
    const ab = await file.arrayBuffer();
    return await importFmSaveArrayBuffer(file.name, ab);
  } catch (err) {
    useTacticStore.getState().setFmImportProgress(null);
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/**
 * Single centralized client-side `.fmf` / `.tac` / `.fm27.json` tactic importer.
 * Runs synchronously/directly on main thread (<100 KB) to avoid worker overhead or BigInt clone errors.
 */
export async function importTacticBytes(
  fileName: string,
  bytes: Uint8Array,
): Promise<{ tactic: DualPhaseTactic; byteLength: number }> {
  if (bytes.byteLength === 0) {
    throw new Error("File kosong (0 bytes).");
  }
  const lower = fileName.toLowerCase();
  const patchVersion = useTacticStore.getState().tactic.patchVersion;

  try {
    const imported = lower.endsWith(".json")
      ? parseFm27Json(new TextDecoder().decode(bytes))
      : await parseFmf(bytes, { patchVersion });
    useTacticStore.getState().loadTactic(imported, { fromUserTactic: true });
    return { tactic: imported, byteLength: bytes.byteLength };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const headerSuffix = ` | Header[0..15]: ${formatHexHeader(bytes, 16)}`;
    throw new Error(`${message}${headerSuffix}`);
  }
}

export async function importTacticFile(
  file: File,
): Promise<{ tactic: DualPhaseTactic; byteLength: number }> {
  const ab = await file.arrayBuffer();
  return importTacticBytes(file.name, new Uint8Array(ab));
}

export type AnyFileImportSummary =
  | { kind: "cancelled"; message: string }
  | { kind: "fm-save"; message: string; parsed: ParsedFmSave }
  | { kind: "tactic"; message: string; tactic: DualPhaseTactic }
  | { kind: "schedule"; message: string; schedule: WeeklySchedule }
  | { kind: "shortlist"; message: string; title: string; count: number }
  | { kind: "squad"; message: string; count: number }
  | { kind: "staff"; message: string; count: number };

function looksLikeStaffTableText(rawText: string): boolean {
  const lower = rawText.slice(0, 4000).toLowerCase();
  const hasStaffKeys =
    lower.includes("working with youngsters") ||
    lower.includes("working_with_youngsters") ||
    lower.includes("gk shot stopping") ||
    lower.includes("gk_shot_stopping") ||
    lower.includes("level of discipline") ||
    lower.includes("level_of_discipline");
  const hasSquadPosKeys =
    lower.includes("pos_gk") ||
    lower.includes("finishing") ||
    lower.includes("dribbling");
  return hasStaffKeys && !hasSquadPosKeys;
}

/**
 * Universal smart client-side file router that accepts `.fm`, `.fmf`, `.tac`, `.json`, `.csv`, `.html`
 * from ANY page in the app and syncs the appropriate stores automatically without dead-end errors.
 */
export async function importAnySupportedFile(file: File): Promise<AnyFileImportSummary> {
  const lower = file.name.toLowerCase();

  if (isFmSaveFileName(lower)) {
    const outcome = await importFmSaveFile(file);
    if (outcome.cancelled) {
      return { kind: "cancelled", message: `Pembacaan file ${file.name} dibatalkan.` };
    }
    const { parsed, selectedClub, report } = outcome;
    if (selectedClub && report) {
      return {
        kind: "fm-save",
        parsed,
        message: `Save "${parsed.saveName}" dimuat! Klub: ${selectedClub.name} (${selectedClub.playerCount} pemain, ${selectedClub.staffCount} staf) · Taktik: ${report.tacticAdvice.activeTactic.title}`,
      };
    }
    return {
      kind: "fm-save",
      parsed,
      message: `Save "${parsed.saveName}" diekstrak (${parsed.stats.totalClubs.toLocaleString()} klub). Silakan pilih klub Anda.`,
    };
  }

  if (lower.endsWith(".fmf") || lower.endsWith(".tac")) {
    const ab = await file.arrayBuffer();
    const bytes = new Uint8Array(ab);
    if (bytes.byteLength === 0) {
      throw new Error("File kosong (0 bytes).");
    }
    const patchVersion = useTacticStore.getState().tactic.patchVersion;

    // Peek inside `.fmf` archive to route `.tsc` schedule and `.slf` shortlist cleanly
    if (lower.endsWith(".fmf")) {
      try {
        const unpacked = await unpackFmfArchive(bytes);
        const fileNames = Array.from(unpacked.files.keys()).map((k) => k.toLowerCase());
        if (fileNames.some((n) => n.endsWith(".tsc"))) {
          const schedule = await parseScheduleFmf(bytes, patchVersion);
          useTrainingStore.getState().loadSchedule(schedule);
          return {
            kind: "schedule",
            schedule,
            message: `Jadwal Latihan "${schedule.name}" dimuat ke tab Training dari ${file.name}`,
          };
        }
        if (fileNames.some((n) => n.endsWith(".slf"))) {
          const sl = await parseShortlistFmf(bytes);
          useTrainingStore.getState().setShortlist(sl.title, sl.playerUids);
          return {
            kind: "shortlist",
            title: sl.title,
            count: sl.playerUids.length,
            message: `Shortlist "${sl.title}" (${sl.playerUids.length} pemain) dimuat dari ${file.name}`,
          };
        }
      } catch {
        // Fall through to parseFmf for detailed error diagnostics (e.g. raw .tac or save header)
      }
    }

    const { tactic, byteLength } = await importTacticBytes(file.name, bytes);
    return {
      kind: "tactic",
      tactic,
      message: `Taktik "${tactic.title}" (IP ${tactic.inFormation} → OOP ${tactic.outFormation}) dimuat dari ${file.name} (${byteLength} B)`,
    };
  }

  if (lower.endsWith(".json")) {
    const text = await file.text();
    const raw = JSON.parse(text) as Record<string, unknown>;
    if (raw && typeof raw === "object" && "schedule" in raw) {
      const schedule = parseScheduleJson(raw);
      useTrainingStore.getState().loadSchedule(schedule);
      return {
        kind: "schedule",
        schedule,
        message: `Jadwal Latihan "${schedule.name}" dimuat ke tab Training dari ${file.name}`,
      };
    }
    const tactic = parseFm27Json(raw);
    useTacticStore.getState().loadTactic(tactic, { fromUserTactic: true });
    return {
      kind: "tactic",
      tactic,
      message: `Taktik "${tactic.title}" (IP ${tactic.inFormation} → OOP ${tactic.outFormation}) dimuat dari ${file.name}`,
    };
  }

  if (lower.endsWith(".csv") || lower.endsWith(".html") || lower.endsWith(".htm")) {
    const text = await file.text();
    const isHtml =
      lower.endsWith(".html") || lower.endsWith(".htm") || /<table\b/i.test(text);
    if (looksLikeStaffTableText(text)) {
      const staff = isHtml ? parseStaffHtml(text) : parseStaffCsv(text);
      useTacticStore.getState().syncClubData({ staff });
      return {
        kind: "staff",
        count: staff.length,
        message: `${staff.length} staf pelatih dimuat ke klub aktif dari ${file.name}`,
      };
    }
    const count = useSquadStore.getState().importFromText(text, file.name);
    return {
      kind: "squad",
      count,
      message: `${count} pemain skuad dimuat & disinkronkan ke Papan Taktik dari ${file.name}`,
    };
  }

  throw new Error(
    `Format file "${file.name}" tidak didukung. Gunakan file .fm (Save Karier), .fmf (Taktik/Jadwal/Shortlist), .json, .csv, atau .html.`,
  );
}
