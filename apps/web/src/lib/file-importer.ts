"use client";

import {
  parseFmf,
  parseScheduleFmf,
  parseShortlistFmf,
  unpackFmfArchive,
  type FmSaveClubEntry,
  type ParsedFmSave,
} from "@fm27/fm-codec";
import type { UnifiedReport } from "@fm27/fm-engine";
import type { DualPhaseTactic, WeeklySchedule } from "@fm27/shared-types";
import { tr } from "../stores/useLocaleStore";
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

export function isFmSaveFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".fm");
}

export function isTacticFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".fmf") || lower.endsWith(".tac");
}

export async function importFmSaveArrayBuffer(
  fileName: string,
  arrayBuffer: ArrayBuffer,
): Promise<FmSaveImportOutcome> {
  const store = useTacticStore.getState();
  store.setFmImportProgress({
    stage: tr("Membuka file karier...", "Opening career save..."),
    pct: 3,
    fileName,
  });

  try {
    if (arrayBuffer.byteLength === 0) {
      throw new Error(tr("File save .fm kosong.", "Empty .fm save file."));
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
    throw new Error(
      message || tr(`Gagal membuka file save ${fileName}`, `Could not open save ${fileName}`),
    );
  }
}

export async function importFmSaveFile(file: File): Promise<FmSaveImportOutcome> {
  useTacticStore.getState().setFmImportProgress({
    stage: tr("Membuka file karier...", "Opening career save..."),
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

export async function importTacticBytes(
  fileName: string,
  bytes: Uint8Array,
): Promise<{ tactic: DualPhaseTactic; byteLength: number }> {
  if (bytes.byteLength === 0) {
    throw new Error(tr("File taktik kosong.", "Empty tactic file."));
  }
  const patchVersion = useTacticStore.getState().tactic.patchVersion;

  try {
    const imported = await parseFmf(bytes, { patchVersion });
    useTacticStore.getState().loadTactic(imported, { fromUserTactic: true });
    return { tactic: imported, byteLength: bytes.byteLength };
  } catch {
    throw new Error(
      tr(
        `File "${fileName}" bukan file taktik FM27 (.fmf) yang valid.`,
        `File "${fileName}" is not a valid FM27 tactic (.fmf).`,
      ),
    );
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
  | { kind: "shortlist"; message: string; title: string; count: number };

export async function importAnySupportedFile(file: File): Promise<AnyFileImportSummary> {
  const lower = file.name.toLowerCase();

  if (isFmSaveFileName(lower)) {
    const outcome = await importFmSaveFile(file);
    if (outcome.cancelled) {
      return {
        kind: "cancelled",
        message: tr(
          `Pembacaan ${file.name} dibatalkan.`,
          `Cancelled loading ${file.name}.`,
        ),
      };
    }
    const { parsed, selectedClub, report } = outcome;
    if (selectedClub && report) {
      return {
        kind: "fm-save",
        parsed,
        message: tr(
          `${selectedClub.name} berhasil dimuat · Taktik: ${report.tacticAdvice.activeTactic.title}`,
          `${selectedClub.name} loaded · Tactic: ${report.tacticAdvice.activeTactic.title}`,
        ),
      };
    }
    return {
      kind: "fm-save",
      parsed,
      message: tr(
        `Save "${parsed.saveName}" berhasil dibuka. Silakan pilih klub Anda.`,
        `Save "${parsed.saveName}" opened. Please select your club.`,
      ),
    };
  }

  if (lower.endsWith(".fmf") || lower.endsWith(".tac")) {
    const ab = await file.arrayBuffer();
    const bytes = new Uint8Array(ab);
    if (bytes.byteLength === 0) {
      throw new Error(tr("File kosong.", "Empty file."));
    }
    const patchVersion = useTacticStore.getState().tactic.patchVersion;

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
            message: tr(
              `Jadwal latihan "${schedule.name}" dimuat.`,
              `Training schedule "${schedule.name}" loaded.`,
            ),
          };
        }
        if (fileNames.some((n) => n.endsWith(".slf"))) {
          const sl = await parseShortlistFmf(bytes);
          useTrainingStore.getState().setShortlist(sl.title, sl.playerUids);
          return {
            kind: "shortlist",
            title: sl.title,
            count: sl.playerUids.length,
            message: tr(
              `Shortlist "${sl.title}" (${sl.playerUids.length} pemain) dimuat.`,
              `Shortlist "${sl.title}" (${sl.playerUids.length} players) loaded.`,
            ),
          };
        }
      } catch {
        // Continue to tactic parser below
      }
    }

    const { tactic } = await importTacticBytes(file.name, bytes);
    return {
      kind: "tactic",
      tactic,
      message: tr(
        `Taktik "${tactic.title}" (${tactic.inFormation} → ${tactic.outFormation}) dimuat.`,
        `Tactic "${tactic.title}" (${tactic.inFormation} → ${tactic.outFormation}) loaded.`,
      ),
    };
  }

  throw new Error(
    tr(
      `Format "${file.name}" belum didukung. Gunakan file Save Karier (.fm) atau file Taktik / Jadwal / Shortlist (.fmf).`,
      `Unsupported file "${file.name}". Please choose a Career Save (.fm) or Tactic / Schedule / Shortlist (.fmf).`,
    ),
  );
}
