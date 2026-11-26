import { parseFmSave } from "./fm-save-parser.js";

type SaveWorkerRequest =
  | { type: "PING" }
  | { id: string; type: "PARSE_FM_SAVE"; buffer: ArrayBuffer };

const workerGlobal = self as unknown as {
  onmessage: ((event: MessageEvent<SaveWorkerRequest>) => void) | null;
  postMessage: (message: unknown) => void;
};

workerGlobal.onmessage = (event: MessageEvent<SaveWorkerRequest>) => {
  const msg = event.data;
  if (!msg) return;

  if (msg.type === "PING") {
    workerGlobal.postMessage({ type: "PONG" });
    return;
  }

  if (msg.type === "PARSE_FM_SAVE") {
    try {
      workerGlobal.postMessage({
        id: msg.id,
        kind: "progress",
        stage: "Worker aktif — memeriksa header .fm...",
        pct: 9,
      });
      const result = parseFmSave(new Uint8Array(msg.buffer), (stage, pct) => {
        workerGlobal.postMessage({
          id: msg.id,
          kind: "progress",
          stage,
          pct,
        });
      });
      workerGlobal.postMessage({
        id: msg.id,
        kind: "done",
        ok: true,
        result,
      });
    } catch (err) {
      workerGlobal.postMessage({
        id: msg.id,
        kind: "done",
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
};

workerGlobal.postMessage({ type: "PONG" });
