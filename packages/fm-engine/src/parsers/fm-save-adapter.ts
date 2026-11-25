import type { Player, StaffMember } from "@fm27/shared-types";

export const LARGE_SAVE_THRESHOLD_BYTES = 536_870_912; // 512 MiB

export interface SaveFileSnapshot {
  name: string;
  byteLength: number;
  lastModifiedMs: number;
}

export interface SaveClubSummary {
  clubUid: number;
  clubName: string;
  nation: string;
  playerCount: number;
}

export interface SaveClubExtract {
  club: SaveClubSummary;
  players: Player[];
  staff: StaffMember[];
}

export interface FmSaveProgressEvent {
  stage: string;
  done: number;
  total: number;
}

/**
 * Modular adapter contract for connecting a future WASM/Pyodide or local CLI `.fm` binary save reader.
 */
export interface FmSaveConnector {
  readonly id: string;
  listClubs(
    saveBytes: Uint8Array,
    snapshot: SaveFileSnapshot,
    onProgress?: (event: FmSaveProgressEvent) => void,
  ): Promise<SaveClubSummary[]>;
  extractClub(
    saveBytes: Uint8Array,
    clubUid: number,
    snapshot: SaveFileSnapshot,
    onProgress?: (event: FmSaveProgressEvent) => void,
  ): Promise<SaveClubExtract>;
}

/**
 * Verifies that Football Manager did not concurrently mutate the `.fm` save file mid-read
 * (mirrors `CareerSave.SameAs` in `SaveRuntimeAndUpdater.cs`).
 */
export function assertSaveSnapshotUnchanged(
  before: SaveFileSnapshot,
  after: SaveFileSnapshot,
): void {
  if (
    before.byteLength !== after.byteLength ||
    before.lastModifiedMs !== after.lastModifiedMs
  ) {
    throw new Error(
      `Football Manager modified "${before.name}" while it was being read. Please wait for saving to finish and retry.`,
    );
  }
}
