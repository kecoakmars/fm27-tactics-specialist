import {
  exportFmf,
  exportScheduleFmf,
  exportShortlistFmf,
  parseFmf,
  parseScheduleFmf,
  parseShortlistFmf,
} from "@fm27/fm-codec";
import {
  analyzeSquadAndGenerateTactics,
  auditSquadAgainstTactic,
  computeHeatmap18Zones,
  computeTacticalBalance,
  gradeImportedTactic,
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
  | { id: string; ok: true; result: unknown }
  | { id: string; ok: false; error: string };

export async function dispatchWorkerTask(req: EngineWorkerRequest): Promise<unknown> {
  switch (req.type) {
    case "EXPORT_FMF":
      return exportFmf(req.tactic);
    case "PARSE_FMF":
      return parseFmf(req.bytes, { patchVersion: req.patchVersion });
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
      const result = await dispatchWorkerTask(req);
      if (result instanceof Uint8Array) {
        const copy = result.slice();
        workerScope.postMessage({ id: req.id, ok: true, result: copy }, [copy.buffer]);
      } else {
        workerScope.postMessage({ id: req.id, ok: true, result });
      }
    } catch (err) {
      workerScope.postMessage({
        id: req.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };
}
