"use client";

import { create } from "zustand";
import {
  clearPersistedFolderHandle,
  isFileSystemAccessSupported,
  listFilesInLocalSubdir,
  loadPersistedFolderHandle,
  pickFm27Directory,
  readFileBytesFromLocalSubdir,
  requestFolderReadWritePermission,
  sanitizeFileName,
  writeBinaryToLocalSubdir,
  type ExtendedDirectoryHandle,
  type LocalFolderFileEntry,
} from "../lib/local-folder-sync";

export type FolderSyncStatus =
  | "unsupported"
  | "disconnected"
  | "needs-permission"
  | "connected";

export interface FolderSyncState {
  status: FolderSyncStatus;
  folderName: string | null;
  handle: ExtendedDirectoryHandle | null;
  tacticFiles: LocalFolderFileEntry[];
  lastMessage: string | null;

  hydrateFromIndexedDb: () => Promise<void>;
  connectNewFolder: () => Promise<boolean>;
  reconnectSavedFolder: () => Promise<boolean>;
  disconnectFolder: () => Promise<void>;
  refreshTacticFiles: () => Promise<void>;
  saveTacticFmfDirect: (title: string, fmfBytes: Uint8Array) => Promise<string>;
  readTacticFileBytes: (fileName: string) => Promise<Uint8Array>;
}

export const useFolderSyncStore = create<FolderSyncState>((set, get) => ({
  status: "disconnected",
  folderName: null,
  handle: null,
  tacticFiles: [],
  lastMessage: null,

  hydrateFromIndexedDb: async () => {
    if (!isFileSystemAccessSupported()) {
      set({ status: "unsupported", handle: null, folderName: null });
      return;
    }
    const { handle, permission } = await loadPersistedFolderHandle();
    if (!handle) {
      set({ status: "disconnected", handle: null, folderName: null });
      return;
    }
    if (permission === "granted") {
      const tacticFiles = await listFilesInLocalSubdir(handle, "tactics");
      set({
        status: "connected",
        handle,
        folderName: handle.name,
        tacticFiles,
      });
    } else {
      set({
        status: "needs-permission",
        handle,
        folderName: handle.name,
      });
    }
  },

  connectNewFolder: async () => {
    try {
      const handle = await pickFm27Directory();
      const tacticFiles = await listFilesInLocalSubdir(handle, "tactics");
      set({
        status: "connected",
        handle,
        folderName: handle.name,
        tacticFiles,
        lastMessage: `Connected to "${handle.name}"`,
      });
      return true;
    } catch {
      return false;
    }
  },

  reconnectSavedFolder: async () => {
    const { handle } = get();
    if (!handle) return false;
    try {
      const granted = await requestFolderReadWritePermission(handle);
      if (!granted) return false;
      const tacticFiles = await listFilesInLocalSubdir(handle, "tactics");
      set({
        status: "connected",
        tacticFiles,
        lastMessage: `Reconnected "${handle.name}"`,
      });
      return true;
    } catch {
      return false;
    }
  },

  disconnectFolder: async () => {
    await clearPersistedFolderHandle();
    set({
      status: isFileSystemAccessSupported() ? "disconnected" : "unsupported",
      handle: null,
      folderName: null,
      tacticFiles: [],
      lastMessage: "Disconnected local FM27 folder",
    });
  },

  refreshTacticFiles: async () => {
    const { handle, status } = get();
    if (!handle || status !== "connected") return;
    const tacticFiles = await listFilesInLocalSubdir(handle, "tactics");
    set({ tacticFiles });
  },

  saveTacticFmfDirect: async (title, fmfBytes) => {
    const { handle, status } = get();
    if (!handle || status !== "connected") {
      throw new Error("FM27 folder is not connected");
    }
    const fileName = sanitizeFileName(title, ".fmf");
    const savedPath = await writeBinaryToLocalSubdir(handle, "tactics", fileName, fmfBytes);
    const tacticFiles = await listFilesInLocalSubdir(handle, "tactics");
    set({
      tacticFiles,
      lastMessage: `Saved ${savedPath}`,
    });
    return savedPath;
  },

  readTacticFileBytes: async (fileName) => {
    const { handle, status } = get();
    if (!handle || status !== "connected") {
      throw new Error("FM27 folder is not connected");
    }
    return readFileBytesFromLocalSubdir(handle, "tactics", fileName);
  },
}));
