"use client";

import {
  exportFmf,
  parseFmf,
  parseFmSave,
  type FmSaveProgressCallback,
  type ParsedFmSave,
} from "@fm27/fm-codec";
import type {
  DualPhaseTactic,
  Player,
  SquadAuditResult,
  TacticPlanResult,
  WeeklySchedule,
} from "@fm27/shared-types";
import type {
  AnalyzeUnifiedParams,
  Heatmap18ZoneResult,
  SquadAnalysisOptions,
  TacticalBalanceReport,
  UnifiedReport,
} from "@fm27/fm-engine";
import {
  dispatchWorkerTask,
  type EngineWorkerRequest,
} from "../workers/engine.worker";

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
type EngineWorkerPayload = DistributiveOmit<EngineWorkerRequest, "id">;

const SAVE_WORKER_URL = "/workers/fm-save-worker.js?v=2";
const SAVE_WORKER_HANDSHAKE_TIMEOUT_MS = 15_000;
const SAVE_WORKER_HEARTBEAT_TIMEOUT_MS = 90_000;

export const FM_SAVE_CANCELLED_ERROR = "DIBATALKAN_PENGGUNA";

type SaveWorkerIncomingMessage =
  | { type: "PONG" }
  | { id: string; kind: "progress"; stage: string; pct: number }
  | { id: string; kind: "done"; ok: true; result: ParsedFmSave }
  | { id: string; kind: "done"; ok: false; error: string };

let saveWorker: Worker | null = null;
let saveWorkerBlobUrl: string | null = null;
let saveWorkerReady = false;
let seq = 0;

const readyWaiters = new Set<(res: { ok: boolean; error?: string }) => void>();

const pendingSaveTasks = new Map<
  string,
  {
    resolve: (val: ParsedFmSave) => void;
    reject: (err: Error) => void;
    onProgress?: FmSaveProgressCallback;
    watchdog: ReturnType<typeof setTimeout>;
  }
>();

function yieldToBrowserPaint(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        setTimeout(resolve, 0);
      });
    } else {
      setTimeout(resolve, 16);
    }
  });
}

function resetWatchdog(id: string): void {
  const entry = pendingSaveTasks.get(id);
  if (!entry) return;
  clearTimeout(entry.watchdog);
  entry.watchdog = setTimeout(() => {
    pendingSaveTasks.delete(id);
    teardownSaveWorker(
      "Pemrosesan file .fm tidak merespons lebih dari 90 detik (worker dihentikan).",
    );
  }, SAVE_WORKER_HEARTBEAT_TIMEOUT_MS);
}

function teardownSaveWorker(reason: string): void {
  if (saveWorker) {
    saveWorker.terminate();
    saveWorker = null;
  }
  if (saveWorkerBlobUrl) {
    URL.revokeObjectURL(saveWorkerBlobUrl);
    saveWorkerBlobUrl = null;
  }
  saveWorkerReady = false;
  for (const notifyReady of readyWaiters) {
    notifyReady({ ok: false, error: reason });
  }
  readyWaiters.clear();

  for (const [, entry] of pendingSaveTasks) {
    clearTimeout(entry.watchdog);
    entry.reject(new Error(reason));
  }
  pendingSaveTasks.clear();
}

/**
 * Cancels any active `.fm` save parsing worker immediately and frees its memory.
 */
export function cancelActiveFmSaveImport(): void {
  teardownSaveWorker(FM_SAVE_CANCELLED_ERROR);
}

function attachWorkerHandlers(w: Worker): void {
  w.onmessage = (event: MessageEvent<SaveWorkerIncomingMessage>) => {
    const msg = event.data;
    if (!msg) return;

    if ("type" in msg && msg.type === "PONG") {
      saveWorkerReady = true;
      for (const notifyReady of readyWaiters) {
        notifyReady({ ok: true });
      }
      readyWaiters.clear();
      return;
    }

    if ("id" in msg) {
      const entry = pendingSaveTasks.get(msg.id);
      if (!entry) return;

      if (msg.kind === "progress") {
        resetWatchdog(msg.id);
        entry.onProgress?.(msg.stage, msg.pct);
        return;
      }

      clearTimeout(entry.watchdog);
      pendingSaveTasks.delete(msg.id);
      if (msg.ok) {
        entry.resolve(msg.result);
      } else {
        entry.reject(new Error(msg.error));
      }
    }
  };

  w.onerror = (err) => {
    teardownSaveWorker(
      err.message || "Gagal menjalankan Web Worker pembaca .fm",
    );
  };
  w.onmessageerror = () => {
    teardownSaveWorker(
      "Gagal menerima data hasil ekstraksi dari Web Worker",
    );
  };
}

async function waitForWorkerPong(w: Worker): Promise<{ ok: boolean; error?: string }> {
  if (saveWorkerReady && saveWorker === w) {
    return { ok: true };
  }
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const timer = setTimeout(() => {
      readyWaiters.delete(onDone);
      resolve({
        ok: false,
        error: `Web Worker tidak merespons handshake PING/PONG dalam ${Math.round(SAVE_WORKER_HANDSHAKE_TIMEOUT_MS / 1000)} detik.`,
      });
    }, SAVE_WORKER_HANDSHAKE_TIMEOUT_MS);

    const onDone = (res: { ok: boolean; error?: string }) => {
      clearTimeout(timer);
      readyWaiters.delete(onDone);
      resolve(res);
    };

    readyWaiters.add(onDone);
    try {
      w.postMessage({ type: "PING" });
    } catch (err) {
      onDone({
        ok: false,
        error: err instanceof Error ? err.message : "Gagal mengirim PING ke Web Worker",
      });
    }
  });
}

async function createBlobFallbackWorker(): Promise<Worker> {
  const res = await fetch(SAVE_WORKER_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `Gagal mengunduh script Web Worker (${SAVE_WORKER_URL}): HTTP ${res.status} ${res.statusText}. Pastikan deploy Vercel menyertakan public/workers/fm-save-worker.js.`,
    );
  }
  const scriptText = await res.text();
  const trimmed = scriptText.trimStart();
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html")) {
    throw new Error(
      `Respon ${SAVE_WORKER_URL} berupa HTML bukan JavaScript (kemungkinan 404/redirect Vercel).`,
    );
  }
  const blob = new Blob([scriptText], { type: "application/javascript" });
  const blobUrl = URL.createObjectURL(blob);
  saveWorkerBlobUrl = blobUrl;
  const w = new Worker(blobUrl);
  saveWorker = w;
  attachWorkerHandlers(w);
  return w;
}

/**
 * Ensures `/workers/fm-save-worker.js` is alive and responds to `PING -> PONG`
 * BEFORE transferring any `ArrayBuffer` (preventing detached-buffer deadlocks).
 * Automatically falls back to `fetch() + Blob Worker` if direct URL Worker fails on Vercel.
 */
async function ensureSaveWorkerReady(): Promise<Worker> {
  if (saveWorker && saveWorkerReady) {
    return saveWorker;
  }

  // Attempt 1: Direct URL Worker
  if (!saveWorker) {
    try {
      const w = new Worker(SAVE_WORKER_URL);
      saveWorker = w;
      attachWorkerHandlers(w);
      const firstHandshake = await waitForWorkerPong(w);
      if (firstHandshake.ok && saveWorker === w) {
        return w;
      }
      teardownSaveWorker(firstHandshake.error ?? "Direct worker handshake gagal");
    } catch {
      teardownSaveWorker("Gagal inisialisasi direct Worker URL");
    }
  } else {
    const existingHandshake = await waitForWorkerPong(saveWorker);
    if (existingHandshake.ok && saveWorker) {
      return saveWorker;
    }
    teardownSaveWorker(existingHandshake.error ?? "Worker existing tidak merespons");
  }

  // Attempt 2: Fetch + Blob Worker (recovers from Vercel CDN/MIME/redirect edge cases and reports exact HTTP status)
  const blobWorker = await createBlobFallbackWorker();
  const blobHandshake = await waitForWorkerPong(blobWorker);
  if (!blobHandshake.ok || saveWorker !== blobWorker) {
    const errText =
      blobHandshake.error ?? "Web Worker gagal merespons setelah Blob fallback.";
    teardownSaveWorker(errText);
    throw new Error(errText);
  }
  return blobWorker;
}

/**
 * Parses a 50-400 MB `.fm` career save 100% client-side inside the standalone
 * `/workers/fm-save-worker.js` using zero-copy Transferable `ArrayBuffer`.
 * Never falls back to synchronous main-thread parsing in a browser (which would freeze the UI).
 */
export async function parseFmSaveInWorker(
  arrayBuffer: ArrayBuffer,
  onProgress?: FmSaveProgressCallback,
): Promise<ParsedFmSave> {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    onProgress?.("Membaca file...", 5);
    return parseFmSave(new Uint8Array(arrayBuffer), onProgress);
  }

  onProgress?.("Menyiapkan Web Worker lokal...", 5);
  await yieldToBrowserPaint();

  const worker = await ensureSaveWorkerReady();
  const sizeMb = (arrayBuffer.byteLength / (1024 * 1024)).toFixed(1);
  onProgress?.(`Mengirim buffer (${sizeMb} MB) ke Web Worker...`, 8);

  const id = `fm-${++seq}-${Date.now()}`;
  return new Promise<ParsedFmSave>((resolve, reject) => {
    const watchdog = setTimeout(() => {
      pendingSaveTasks.delete(id);
      teardownSaveWorker(
        "Pemrosesan file .fm melebihi batas waktu tanpa progres (90 detik).",
      );
      reject(
        new Error("Pemrosesan file .fm melebihi batas waktu tanpa progres (90 detik)."),
      );
    }, SAVE_WORKER_HEARTBEAT_TIMEOUT_MS);

    pendingSaveTasks.set(id, {
      resolve,
      reject,
      onProgress,
      watchdog,
    });

    try {
      worker.postMessage(
        { id, type: "PARSE_FM_SAVE", buffer: arrayBuffer },
        [arrayBuffer],
      );
    } catch (err) {
      clearTimeout(watchdog);
      pendingSaveTasks.delete(id);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

async function runEngineTaskWithPaintYield<T>(
  payload: EngineWorkerPayload,
  onProgress?: FmSaveProgressCallback,
): Promise<T> {
  await yieldToBrowserPaint();
  const fullReq = { ...payload, id: `local-${++seq}` } as EngineWorkerRequest;
  return (await dispatchWorkerTask(fullReq, onProgress)) as T;
}

export async function analyzeUnifiedInWorker(
  params: AnalyzeUnifiedParams,
  onProgress?: FmSaveProgressCallback,
): Promise<UnifiedReport> {
  onProgress?.("Menjalankan Hungarian Solver...", 92);
  return runEngineTaskWithPaintYield<UnifiedReport>(
    { type: "ANALYZE_UNIFIED", params },
    onProgress,
  );
}

export async function exportFmfInWorker(tactic: DualPhaseTactic): Promise<Uint8Array> {
  return exportFmf(tactic);
}

export async function parseFmfInWorker(
  bytes: Uint8Array,
  patchVersion?: string,
): Promise<DualPhaseTactic> {
  return parseFmf(bytes, { patchVersion });
}

export function computeHeatmapInWorker(
  tactic: DualPhaseTactic,
): Promise<Heatmap18ZoneResult> {
  return runEngineTaskWithPaintYield<Heatmap18ZoneResult>({
    type: "COMPUTE_HEATMAP",
    tactic,
  });
}

export function computeBalanceInWorker(
  tactic: DualPhaseTactic,
  squad?: Player[],
): Promise<TacticalBalanceReport> {
  return runEngineTaskWithPaintYield<TacticalBalanceReport>({
    type: "COMPUTE_BALANCE",
    tactic,
    squad,
  });
}

export function analyzeSquadInWorker(
  players: Player[],
  options?: SquadAnalysisOptions,
): Promise<TacticPlanResult[]> {
  return runEngineTaskWithPaintYield<TacticPlanResult[]>({
    type: "ANALYZE_SQUAD",
    players,
    options,
  });
}

export function auditSquadInWorker(
  tactic: DualPhaseTactic,
  players: Player[],
): Promise<SquadAuditResult> {
  return runEngineTaskWithPaintYield<SquadAuditResult>({
    type: "AUDIT_SQUAD",
    tactic,
    players,
  });
}

export function exportScheduleFmfInWorker(
  schedule: WeeklySchedule,
): Promise<Uint8Array> {
  return runEngineTaskWithPaintYield<Uint8Array>({
    type: "EXPORT_SCHEDULE_FMF",
    schedule,
  });
}

export function parseScheduleFmfInWorker(
  bytes: Uint8Array,
  patchVersion?: string,
): Promise<WeeklySchedule> {
  return runEngineTaskWithPaintYield<WeeklySchedule>({
    type: "PARSE_SCHEDULE_FMF",
    bytes,
    patchVersion,
  });
}

export function exportShortlistFmfInWorker(
  title: string,
  playerUids: number[],
): Promise<Uint8Array> {
  return runEngineTaskWithPaintYield<Uint8Array>({
    type: "EXPORT_SHORTLIST_FMF",
    title,
    playerUids,
  });
}

export function parseShortlistFmfInWorker(
  bytes: Uint8Array,
): Promise<{ title: string; playerUids: number[] }> {
  return runEngineTaskWithPaintYield<{ title: string; playerUids: number[] }>({
    type: "PARSE_SHORTLIST_FMF",
    bytes,
  });
}

export function gradeImportedTacticInWorker(
  tactic: DualPhaseTactic,
  players: Player[],
  improve = true,
): Promise<TacticPlanResult> {
  return runEngineTaskWithPaintYield<TacticPlanResult>({
    type: "GRADE_IMPORTED",
    tactic,
    players,
    improve,
  });
}
