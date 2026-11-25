import { describe, expect, it } from "vitest";
import { exportFmf, parseFmf } from "@fm27/fm-codec";
import {
  listFilesInLocalSubdir,
  readFileBytesFromLocalSubdir,
  sanitizeFileName,
  writeBinaryToLocalSubdir,
  type ExtendedDirectoryHandle,
} from "@/lib/local-folder-sync";
import { buildDualPhaseTacticCardSvg } from "@/lib/svg-card-exporter";
import { buildPresetTactic, useTacticStore } from "@/stores/useTacticStore";

function createInMemoryDirectoryHandle(name: string): ExtendedDirectoryHandle {
  const subdirs = new Map<string, ExtendedDirectoryHandle>();
  const files = new Map<string, Uint8Array>();

  const makeFileHandle = (fileName: string): FileSystemFileHandle =>
    ({
      kind: "file",
      name: fileName,
      async getFile() {
        const bytes = files.get(fileName) ?? new Uint8Array();
        return {
          name: fileName,
          size: bytes.byteLength,
          lastModified: 1700000000000,
          async arrayBuffer() {
            return bytes.slice().buffer;
          },
        } as unknown as File;
      },
      async createWritable() {
        let pending = new Uint8Array();
        return {
          async write(data: BufferSource | string) {
            if (typeof data === "string") {
              pending = new TextEncoder().encode(data);
            } else if (data instanceof ArrayBuffer) {
              pending = new Uint8Array(data.slice(0));
            } else {
              pending = new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
            }
          },
          async close() {
            files.set(fileName, pending);
          },
        } as unknown as FileSystemWritableFileStream;
      },
    }) as unknown as FileSystemFileHandle;

  const handle: ExtendedDirectoryHandle = {
    kind: "directory",
    name,
    async getDirectoryHandle(dirName: string, opts?: FileSystemGetDirectoryOptions) {
      const existing = subdirs.get(dirName);
      if (existing) return existing;
      if (!opts?.create) throw new Error(`Directory not found: ${dirName}`);
      const created = createInMemoryDirectoryHandle(dirName);
      subdirs.set(dirName, created);
      return created;
    },
    async getFileHandle(fileName: string, opts?: FileSystemGetFileOptions) {
      if (!files.has(fileName)) {
        if (!opts?.create) throw new Error(`File not found: ${fileName}`);
        files.set(fileName, new Uint8Array());
      }
      return makeFileHandle(fileName);
    },
    async *values() {
      for (const [, d] of subdirs) yield d;
      for (const [fName] of files) yield makeFileHandle(fName);
    },
  } as unknown as ExtendedDirectoryHandle;

  return handle;
}

describe("Phase 2 — Dual-Phase Pitch Store, SVG Card & Local Folder Sync", () => {
  it("builds valid presets, moves/swaps positions, updates formation, Undo/Redoes via zundo, and exports .fmf", async () => {
    const store = useTacticStore.getState();
    store.applyPresetStyle("ControlPossession", "shape-03-433-4141");
    useTacticStore.temporal.getState().clear();

    const initial = useTacticStore.getState().tactic;
    expect(initial.inFormation).toBe("4-3-3 DM");
    expect(initial.outFormation).toBe("4-1-4-1");

    // Move DMC (slot 5) into DC to form a 3-CB back line in possession!
    const dmcIdx = initial.slots.findIndex((s) => s.inPossession.positionId === "DMC");
    expect(dmcIdx).toBeGreaterThanOrEqual(0);
    useTacticStore.getState().moveSlotToPosition(dmcIdx, "ip", "DC");

    const reshaped = useTacticStore.getState().tactic;
    expect(reshaped.slots[dmcIdx]?.inPossession.positionId).toBe("DC");
    expect(useTacticStore.temporal.getState().pastStates.length).toBe(1);

    // Export reshaped board state to binary .fmf and parse back
    const fmfBytes = exportFmf(reshaped);
    const parsed = await parseFmf(fmfBytes);
    expect(parsed.slots).toHaveLength(11);

    // Undo restores 4-3-3 DM, Redo reapplies DC move
    useTacticStore.temporal.getState().undo();
    expect(useTacticStore.getState().tactic.inFormation).toBe("4-3-3 DM");

    useTacticStore.temporal.getState().redo();
    expect(useTacticStore.getState().tactic.slots[dmcIdx]?.inPossession.positionId).toBe("DC");
  });

  it("writes, lists, and reads .fmf files via File System Access handle wrapper without double-nesting /tactics", async () => {
    const fmRoot = createInMemoryDirectoryHandle("Football Manager 27");
    const sampleTactic = buildPresetTactic("TikiTaka");
    const fmfBytes = exportFmf(sampleTactic);

    const fileName = sanitizeFileName("Tiki-Taka: Special/v1", ".fmf");
    expect(fileName).toBe("Tiki-Taka- Special-v1.fmf");

    const relPath = await writeBinaryToLocalSubdir(fmRoot, "tactics", fileName, fmfBytes);
    expect(relPath).toBe(`/tactics/${fileName}`);

    const listed = await listFilesInLocalSubdir(fmRoot, "tactics");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.name).toBe(fileName);

    const readBack = await readFileBytesFromLocalSubdir(fmRoot, "tactics", fileName);
    expect(readBack).toEqual(fmfBytes);

    // Also test direct `/tactics` handle (avoids `/tactics/tactics`)
    const directTacticsDir = createInMemoryDirectoryHandle("tactics");
    const directPath = await writeBinaryToLocalSubdir(
      directTacticsDir,
      "tactics",
      "Direct.fmf",
      fmfBytes,
    );
    expect(directPath).toBe("Direct.fmf");
  });

  it("generates a complete 1600x900 Dual-Phase SVG tactical card", () => {
    const tactic = buildPresetTactic("WingPlay");
    const svg = buildDualPhaseTacticCardSvg(tactic);
    expect(svg).toContain('width="1600" height="900"');
    expect(svg).toContain("IN POSSESSION");
    expect(svg).toContain("OUT OF POSSESSION");
    expect(svg).toContain(tactic.inFormation);
  });
});
