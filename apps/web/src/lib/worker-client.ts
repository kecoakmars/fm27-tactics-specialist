"use client";

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

let sharedWorker: Worker | null = null;
let seq = 0;
const pending = new Map<
  string,
  { resolve: (val: unknown) => void; reject: (err: Error) => void }
>();

function getOrCreateWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
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
        pending.delete(msg.id);
        if (msg.ok) {
          entry.resolve(msg.result);
        } else {
          entry.reject(new Error(msg.error));
        }
      };
      sharedWorker.onerror = (err) => {
        for (const [, entry] of pending) {
          entry.reject(new Error(err.message || "Worker execution error"));
        }
        pending.clear();
      };
    } catch {
      sharedWorker = null;
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

  return new Promise<T>((resolve, reject) => {
    pending.set(id, {
      resolve: (val) => resolve(val as T),
      reject,
    });
    worker.postMessage(fullReq);
  });
}

export function exportFmfInWorker(tactic: DualPhaseTactic): Promise<Uint8Array> {
  return callEngineWorker<Uint8Array>({ type: "EXPORT_FMF", tactic });
}

export function parseFmfInWorker(
  bytes: Uint8Array,
  patchVersion?: string,
): Promise<DualPhaseTactic> {
  return callEngineWorker<DualPhaseTactic>({
    type: "PARSE_FMF",
    bytes,
    patchVersion,
  });
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
