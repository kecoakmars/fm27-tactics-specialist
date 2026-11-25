"use client";

import { exportFmf, parseFmf } from "@fm27/fm-codec";
import type {
  DualPhaseTactic,
  Player,
  SquadAuditResult,
  TacticPlanResult,
  WeeklySchedule,
} from "@fm27/shared-types";
import type {
  Heatmap18ZoneResult,
  SquadAnalysisOptions,
  TacticalBalanceReport,
} from "@fm27/fm-engine";
import {
  dispatchWorkerTask,
  type EngineWorkerRequest,
  type EngineWorkerResponse,
} from "../workers/engine.worker";

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
type EngineWorkerPayload = DistributiveOmit<EngineWorkerRequest, "id">;

const WORKER_TIMEOUT_MS = 2000;

let sharedWorker: Worker | null = null;
let workerDisabled = false;
let seq = 0;
const pending = new Map<
  string,
  {
    resolve: (val: unknown) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();

function teardownWorker(reason: string): void {
  if (sharedWorker) {
    sharedWorker.terminate();
    sharedWorker = null;
  }
  workerDisabled = true;
  for (const [, entry] of pending) {
    clearTimeout(entry.timer);
    entry.reject(new Error(reason));
  }
  pending.clear();
}

function getOrCreateWorker(): Worker | null {
  if (workerDisabled || typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }
  if (!sharedWorker) {
    try {
      sharedWorker = new Worker(
        new URL("../workers/engine.worker.ts", import.meta.url),
        { type: "module" },
      );
      sharedWorker.onmessage = (event: MessageEvent<EngineWorkerResponse>) => {
        const msg = event.data;
        const entry = pending.get(msg.id);
        if (!entry) return;
        clearTimeout(entry.timer);
        pending.delete(msg.id);
        if (msg.ok) {
          entry.resolve(msg.result);
        } else {
          entry.reject(new Error(msg.error));
        }
      };
      sharedWorker.onerror = (err) => {
        teardownWorker(err.message || "Worker execution error");
      };
      sharedWorker.onmessageerror = () => {
        teardownWorker("Worker message deserialization error");
      };
    } catch (initErr) {
      sharedWorker = null;
      workerDisabled = true;
      console.warn("[fm27-worker] Falling back to main thread:", initErr);
    }
  }
  return sharedWorker;
}

async function callEngineWorker<T>(payload: EngineWorkerPayload): Promise<T> {
  const id = `w-${++seq}-${Date.now()}`;
  const fullReq = { ...payload, id } as EngineWorkerRequest;
  const worker = getOrCreateWorker();

  if (!worker) {
    return (await dispatchWorkerTask(fullReq)) as T;
  }

  try {
    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        teardownWorker("Worker timed out");
        reject(new Error("Worker timed out"));
      }, WORKER_TIMEOUT_MS);

      pending.set(id, {
        resolve: (val) => resolve(val as T),
        reject,
        timer,
      });

      try {
        worker.postMessage(fullReq);
      } catch (err) {
        clearTimeout(timer);
        pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const shouldFallback =
      workerDisabled ||
      err instanceof DOMException ||
      msg.includes("Worker") ||
      msg.includes("DataCloneError") ||
      msg.includes("BigInt");
    if (shouldFallback) {
      return (await dispatchWorkerTask(fullReq)) as T;
    }
    throw err;
  }
}

export async function exportFmfInWorker(tactic: DualPhaseTactic): Promise<Uint8Array> {
  // Direct main-thread execution avoids Web Worker hang or BigInt DataCloneError
  return exportFmf(tactic);
}

export async function parseFmfInWorker(
  bytes: Uint8Array,
  patchVersion?: string,
): Promise<DualPhaseTactic> {
  // Direct main-thread execution avoids Web Worker hang or BigInt DataCloneError
  return parseFmf(bytes, { patchVersion });
}

export function computeHeatmapInWorker(
  tactic: DualPhaseTactic,
): Promise<Heatmap18ZoneResult> {
  return callEngineWorker<Heatmap18ZoneResult>({ type: "COMPUTE_HEATMAP", tactic });
}

export function computeBalanceInWorker(
  tactic: DualPhaseTactic,
  squad?: Player[],
): Promise<TacticalBalanceReport> {
  return callEngineWorker<TacticalBalanceReport>({
    type: "COMPUTE_BALANCE",
    tactic,
    squad,
  });
}

export function analyzeSquadInWorker(
  players: Player[],
  options?: SquadAnalysisOptions,
): Promise<TacticPlanResult[]> {
  return callEngineWorker<TacticPlanResult[]>({
    type: "ANALYZE_SQUAD",
    players,
    options,
  });
}

export function auditSquadInWorker(
  tactic: DualPhaseTactic,
  players: Player[],
): Promise<SquadAuditResult> {
  return callEngineWorker<SquadAuditResult>({
    type: "AUDIT_SQUAD",
    tactic,
    players,
  });
}

export function exportScheduleFmfInWorker(
  schedule: WeeklySchedule,
): Promise<Uint8Array> {
  return callEngineWorker<Uint8Array>({ type: "EXPORT_SCHEDULE_FMF", schedule });
}

export function parseScheduleFmfInWorker(
  bytes: Uint8Array,
  patchVersion?: string,
): Promise<WeeklySchedule> {
  return callEngineWorker<WeeklySchedule>({
    type: "PARSE_SCHEDULE_FMF",
    bytes,
    patchVersion,
  });
}

export function exportShortlistFmfInWorker(
  title: string,
  playerUids: number[],
): Promise<Uint8Array> {
  return callEngineWorker<Uint8Array>({
    type: "EXPORT_SHORTLIST_FMF",
    title,
    playerUids,
  });
}

export function parseShortlistFmfInWorker(
  bytes: Uint8Array,
): Promise<{ title: string; playerUids: number[] }> {
  return callEngineWorker<{ title: string; playerUids: number[] }>({
    type: "PARSE_SHORTLIST_FMF",
    bytes,
  });
}

export function gradeImportedTacticInWorker(
  tactic: DualPhaseTactic,
  players: Player[],
  improve = true,
): Promise<TacticPlanResult> {
  return callEngineWorker<TacticPlanResult>({
    type: "GRADE_IMPORTED",
    tactic,
    players,
    improve,
  });
}
