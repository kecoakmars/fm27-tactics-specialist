"use client";

import { create } from "zustand";
import {
  clearPersistedFolderHandle,
  isFileSystemAccessSupported,
  listExportFilesInRoot,
  listFilesInLocalSubdir,
  loadPersistedFolderHandle,
  pickFm27Directory,
  readFileBytesFromLocalSubdir,
  readRootFileText,
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
  saveGameFiles: LocalFolderFileEntry[];
  exportFiles: LocalFolderFileEntry[];
  lastMessage: string | null;

  hydrateFromIndexedDb: () => Promise<void>;
  connectNewFolder: () => Promise<boolean>;
  reconnectSavedFolder: () => Promise<boolean>;
  disconnectFolder: () => Promise<void>;
  refreshTacticFiles: () => Promise<void>;
  saveTacticFmfDirect: (title: string, fmfBytes: Uint8Array) => Promise<string>;
  saveScheduleFmfDirect: (title: string, fmfBytes: Uint8Array) => Promise<string>;
  saveShortlistFmfDirect: (title: string, fmfBytes: Uint8Array) => Promise<string>;
  readTacticFileBytes: (fileName: string) => Promise<Uint8Array>;
  readSaveGameArrayBuffer: (fileName: string) => Promise<ArrayBuffer>;
  readExportFileText: (fileName: string) => Promise<string>;
}

export const useFolderSyncStore = create<FolderSyncState>((set, get) => ({
  status: "disconnected",
  folderName: null,
  handle: null,
  tacticFiles: [],
  saveGameFiles: [],
  exportFiles: [],
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
      const [tacticFiles, saveGameFiles, exportFiles] = await Promise.all([
        listFilesInLocalSubdir(handle, "tactics"),
        listFilesInLocalSubdir(handle, "games", [".fm"]),
        listExportFilesInRoot(handle),
      ]);
      set({
        status: "connected",
        handle,
        folderName: handle.name,
        tacticFiles,
        saveGameFiles,
        exportFiles,
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
      const [tacticFiles, saveGameFiles, exportFiles] = await Promise.all([
        listFilesInLocalSubdir(handle, "tactics"),
        listFilesInLocalSubdir(handle, "games", [".fm"]),
        listExportFilesInRoot(handle),
      ]);
      set({
        status: "connected",
        handle,
        folderName: handle.name,
        tacticFiles,
        saveGameFiles,
        exportFiles,
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
      const [tacticFiles, saveGameFiles, exportFiles] = await Promise.all([
        listFilesInLocalSubdir(handle, "tactics"),
        listFilesInLocalSubdir(handle, "games", [".fm"]),
        listExportFilesInRoot(handle),
      ]);
      set({
        status: "connected",
        tacticFiles,
        saveGameFiles,
        exportFiles,
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
      saveGameFiles: [],
      exportFiles: [],
      lastMessage: "Disconnected local FM27 folder",
    });
  },

  refreshTacticFiles: async () => {
    const { handle, status } = get();
    if (!handle || status !== "connected") return;
    const [tacticFiles, saveGameFiles, exportFiles] = await Promise.all([
      listFilesInLocalSubdir(handle, "tactics"),
      listFilesInLocalSubdir(handle, "games", [".fm"]),
      listExportFilesInRoot(handle),
    ]);
    set({ tacticFiles, saveGameFiles, exportFiles });
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

  saveScheduleFmfDirect: async (title, fmfBytes) => {
    const { handle, status } = get();
    if (!handle || status !== "connected") {
      throw new Error("FM27 folder is not connected");
    }
    const fileName = sanitizeFileName(title, ".fmf");
    const savedPath = await writeBinaryToLocalSubdir(handle, "schedules", fileName, fmfBytes);
    set({ lastMessage: `Saved ${savedPath}` });
    return savedPath;
  },

  saveShortlistFmfDirect: async (title, fmfBytes) => {
    const { handle, status } = get();
    if (!handle || status !== "connected") {
      throw new Error("FM27 folder is not connected");
    }
    const fileName = sanitizeFileName(title, ".fmf");
    const savedPath = await writeBinaryToLocalSubdir(handle, "shortlists", fileName, fmfBytes);
    set({ lastMessage: `Saved ${savedPath}` });
    return savedPath;
  },

  readTacticFileBytes: async (fileName) => {
    const { handle, status } = get();
    if (!handle || status !== "connected") {
      throw new Error("FM27 folder is not connected");
    }
    return readFileBytesFromLocalSubdir(handle, "tactics", fileName);
  },

  readSaveGameArrayBuffer: async (fileName) => {
    const { handle, status } = get();
    if (!handle || status !== "connected") {
      throw new Error("Folder FM27 belum ditautkan");
    }
    const bytes = await readFileBytesFromLocalSubdir(handle, "games", fileName);
    return bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
  },

  readExportFileText: async (fileName) => {
    const { handle, status } = get();
    if (!handle || status !== "connected") {
      throw new Error("FM27 folder is not connected");
    }
    return readRootFileText(handle, fileName);
  },
}));
