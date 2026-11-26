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

const SAVE_WORKER_URL = "/workers/fm-save-worker.js";
const SAVE_WORKER_HANDSHAKE_TIMEOUT_MS = 1000;
const SAVE_WORKER_HEARTBEAT_TIMEOUT_MS = 60_000;

export const FM_SAVE_CANCELLED_ERROR = "DIBATALKAN_PENGGUNA";

type SaveWorkerIncomingMessage =
  | { type: "PONG" }
  | { id: string; kind: "progress"; stage: string; pct: number }
  | { id: string; kind: "done"; ok: true; result: ParsedFmSave }
  | { id: string; kind: "done"; ok: false; error: string };

let saveWorker: Worker | null = null;
let saveWorkerReady = false;
let saveWorkerBroken = false;
let seq = 0;

const readyWaiters = new Set<(ready: boolean) => void>();

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
      "Pemrosesan file .fm tidak merespons lebih dari 60 detik (worker dihentikan).",
      false,
    );
  }, SAVE_WORKER_HEARTBEAT_TIMEOUT_MS);
}

function teardownSaveWorker(reason: string, markBroken: boolean): void {
  if (saveWorker) {
    saveWorker.terminate();
    saveWorker = null;
  }
  saveWorkerReady = false;
  if (markBroken) {
    saveWorkerBroken = true;
  }
  for (const notifyReady of readyWaiters) {
    notifyReady(false);
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
  teardownSaveWorker(FM_SAVE_CANCELLED_ERROR, false);
}

/**
 * Ensures `/workers/fm-save-worker.js` is alive and responds to `PING -> PONG`
 * BEFORE transferring any `ArrayBuffer` (preventing detached-buffer deadlocks).
 */
async function ensureSaveWorkerReady(): Promise<Worker | null> {
  if (
    saveWorkerBroken ||
    typeof window === "undefined" ||
    typeof Worker === "undefined"
  ) {
    return null;
  }

  if (saveWorker && saveWorkerReady) {
    return saveWorker;
  }

  if (!saveWorker) {
    try {
      const w = new Worker(SAVE_WORKER_URL);
      saveWorker = w;
      w.onmessage = (event: MessageEvent<SaveWorkerIncomingMessage>) => {
        const msg = event.data;
        if (!msg) return;

        if ("type" in msg && msg.type === "PONG") {
          saveWorkerReady = true;
          for (const notifyReady of readyWaiters) {
            notifyReady(true);
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
          true,
        );
      };
      w.onmessageerror = () => {
        teardownSaveWorker(
          "Gagal menerima data hasil ekstraksi dari Web Worker",
          true,
        );
      };
    } catch {
      saveWorker = null;
      saveWorkerBroken = true;
      return null;
    }
  }

  if (saveWorkerReady && saveWorker) {
    return saveWorker;
  }

  const alive = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      readyWaiters.delete(onDone);
      resolve(false);
    }, SAVE_WORKER_HANDSHAKE_TIMEOUT_MS);

    const onDone = (ok: boolean) => {
      clearTimeout(timer);
      readyWaiters.delete(onDone);
      resolve(ok);
    };

    readyWaiters.add(onDone);
    try {
      saveWorker?.postMessage({ type: "PING" });
    } catch {
      onDone(false);
    }
  });

  if (!alive || !saveWorker) {
    teardownSaveWorker("Web Worker tidak merespons handshake awal", true);
    return null;
  }

  return saveWorker;
}

/**
 * Parses a 50-400 MB `.fm` career save 100% client-side inside the standalone
 * `/workers/fm-save-worker.js` using zero-copy Transferable `ArrayBuffer`.
 * Verified via `PING -> PONG` handshake first; if Workers are unavailable/blocked,
 * `arrayBuffer` remains intact and falls back safely after yielding a UI paint frame.
 */
export async function parseFmSaveInWorker(
  arrayBuffer: ArrayBuffer,
  onProgress?: FmSaveProgressCallback,
): Promise<ParsedFmSave> {
  const worker = await ensureSaveWorkerReady();

  if (!worker) {
    onProgress?.("Membaca file...", 5);
    await yieldToBrowserPaint();
    return parseFmSave(new Uint8Array(arrayBuffer), onProgress);
  }

  const id = `fm-${++seq}-${Date.now()}`;
  return new Promise<ParsedFmSave>((resolve, reject) => {
    const watchdog = setTimeout(() => {
      pendingSaveTasks.delete(id);
      teardownSaveWorker(
        "Pemrosesan file .fm melebihi batas waktu tanpa progres (60 detik).",
        false,
      );
      reject(
        new Error("Pemrosesan file .fm melebihi batas waktu tanpa progres (60 detik)."),
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
