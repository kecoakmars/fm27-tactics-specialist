import {
  exportFmf,
  exportScheduleFmf,
  exportShortlistFmf,
  parseFmf,
  parseFmSave,
  parseScheduleFmf,
  parseShortlistFmf,
  type FmSaveProgressCallback,
} from "@fm27/fm-codec";
import {
  analyzeSquadAndGenerateTactics,
  analyzeUnified,
  auditSquadAgainstTactic,
  computeHeatmap18Zones,
  computeTacticalBalance,
  gradeImportedTactic,
  type AnalyzeUnifiedParams,
  type SquadAnalysisOptions,
} from "@fm27/fm-engine";
import type {
  DualPhaseTactic,
  Player,
  WeeklySchedule,
} from "@fm27/shared-types";

export type EngineWorkerRequest =
  | { id: string; type: "EXPORT_FMF"; tactic: DualPhaseTactic }
  | { id: string; type: "PARSE_FMF"; bytes: Uint8Array; patchVersion?: string }
  | { id: string; type: "PARSE_FM_SAVE"; buffer: ArrayBuffer }
  | { id: string; type: "ANALYZE_UNIFIED"; params: AnalyzeUnifiedParams }
  | { id: string; type: "COMPUTE_HEATMAP"; tactic: DualPhaseTactic }
  | { id: string; type: "COMPUTE_BALANCE"; tactic: DualPhaseTactic; squad?: Player[] }
  | {
      id: string;
      type: "ANALYZE_SQUAD";
      players: Player[];
      options?: SquadAnalysisOptions;
    }
  | { id: string; type: "AUDIT_SQUAD"; tactic: DualPhaseTactic; players: Player[] }
  | {
      id: string;
      type: "GRADE_IMPORTED";
      tactic: DualPhaseTactic;
      players: Player[];
      improve?: boolean;
    }
  | { id: string; type: "EXPORT_SCHEDULE_FMF"; schedule: WeeklySchedule }
  | { id: string; type: "PARSE_SCHEDULE_FMF"; bytes: Uint8Array; patchVersion?: string }
  | { id: string; type: "EXPORT_SHORTLIST_FMF"; title: string; playerUids: number[] }
  | { id: string; type: "PARSE_SHORTLIST_FMF"; bytes: Uint8Array };

export type EngineWorkerResponse =
  | { id: string; kind?: "done"; ok: true; result: unknown }
  | { id: string; kind?: "done"; ok: false; error: string }
  | { id: string; kind: "progress"; stage: string; pct: number };

export async function dispatchWorkerTask(
  req: EngineWorkerRequest,
  onProgress?: FmSaveProgressCallback,
): Promise<unknown> {
  switch (req.type) {
    case "EXPORT_FMF":
      return exportFmf(req.tactic);
    case "PARSE_FMF":
      return parseFmf(req.bytes, { patchVersion: req.patchVersion });
    case "PARSE_FM_SAVE":
      return parseFmSave(new Uint8Array(req.buffer), onProgress);
    case "ANALYZE_UNIFIED": {
      onProgress?.("Menjalankan Hungarian Solver...", 92);
      return analyzeUnified(req.params);
    }
    case "COMPUTE_HEATMAP":
      return computeHeatmap18Zones(req.tactic);
    case "COMPUTE_BALANCE":
      return computeTacticalBalance(req.tactic, req.squad);
    case "ANALYZE_SQUAD":
      return analyzeSquadAndGenerateTactics(req.players, req.options);
    case "AUDIT_SQUAD":
      return auditSquadAgainstTactic(req.tactic, req.players);
    case "GRADE_IMPORTED":
      return gradeImportedTactic(req.tactic, req.players, { improve: req.improve });
    case "EXPORT_SCHEDULE_FMF":
      return exportScheduleFmf(req.schedule);
    case "PARSE_SCHEDULE_FMF":
      return parseScheduleFmf(req.bytes, req.patchVersion);
    case "EXPORT_SHORTLIST_FMF":
      return exportShortlistFmf(req.title, req.playerUids);
    case "PARSE_SHORTLIST_FMF":
      return parseShortlistFmf(req.bytes);
  }
}

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<EngineWorkerRequest>) => void) | null;
  postMessage: (message: EngineWorkerResponse, transfer?: Transferable[]) => void;
};

if (typeof window === "undefined" && typeof self !== "undefined") {
  workerScope.onmessage = async (event: MessageEvent<EngineWorkerRequest>) => {
    const req = event.data;
    try {
      const result = await dispatchWorkerTask(req, (stage, pct) => {
        workerScope.postMessage({
          id: req.id,
          kind: "progress",
          stage,
          pct,
        });
      });
      if (result instanceof Uint8Array) {
        const copy = result.slice();
        workerScope.postMessage(
          { id: req.id, kind: "done", ok: true, result: copy },
          [copy.buffer],
        );
      } else {
        workerScope.postMessage({ id: req.id, kind: "done", ok: true, result });
      }
    } catch (err) {
      workerScope.postMessage({
        id: req.id,
        kind: "done",
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };
}
