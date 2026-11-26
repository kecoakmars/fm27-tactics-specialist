"use client";

import {
  parseFm27Json,
  parseFmf,
  type FmSaveClubEntry,
  type ParsedFmSave,
} from "@fm27/fm-codec";
import type { UnifiedReport } from "@fm27/fm-engine";
import type { DualPhaseTactic } from "@fm27/shared-types";
import { useTacticStore } from "../stores/useTacticStore";
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
    useTacticStore.getState().loadTactic(imported);
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
