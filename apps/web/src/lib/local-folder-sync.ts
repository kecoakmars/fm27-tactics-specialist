"use client";

import { del, get, set } from "idb-keyval";

const IDB_FOLDER_HANDLE_KEY = "fm27-local-folder-handle-v1";

// Browser File System Access API ambient extension
interface FsPermissionDescriptor {
  mode?: "read" | "readwrite";
}

export interface ExtendedDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission?: (descriptor?: FsPermissionDescriptor) => Promise<PermissionState>;
  requestPermission?: (descriptor?: FsPermissionDescriptor) => Promise<PermissionState>;
  values?: () => AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>;
}

export type LocalFolderSubdir = "tactics" | "schedules" | "shortlists";

export interface LocalFolderFileEntry {
  name: string;
  size: number;
  lastModified: number;
}

export function isFileSystemAccessSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker ===
      "function"
  );
}

export async function pickFm27Directory(): Promise<ExtendedDirectoryHandle> {
  if (!isFileSystemAccessSupported()) {
    throw new Error(
      "File System Access API is not supported in this browser. Use drag-and-drop or standard file download instead.",
    );
  }
  const picker = (
    window as unknown as {
      showDirectoryPicker: (opts?: { mode?: "read" | "readwrite" }) => Promise<ExtendedDirectoryHandle>;
    }
  ).showDirectoryPicker;

  const handle = await picker({ mode: "readwrite" });
  await set(IDB_FOLDER_HANDLE_KEY, handle);
  return handle;
}

export async function loadPersistedFolderHandle(): Promise<{
  handle: ExtendedDirectoryHandle | null;
  permission: PermissionState | "unsupported";
}> {
  if (!isFileSystemAccessSupported()) {
    return { handle: null, permission: "unsupported" };
  }
  try {
    const saved = (await get(IDB_FOLDER_HANDLE_KEY)) as ExtendedDirectoryHandle | undefined;
    if (!saved) return { handle: null, permission: "prompt" };
    const perm = saved.queryPermission
      ? await saved.queryPermission({ mode: "readwrite" })
      : "granted";
    return { handle: saved, permission: perm };
  } catch {
    return { handle: null, permission: "prompt" };
  }
}

export async function requestFolderReadWritePermission(
  handle: ExtendedDirectoryHandle,
): Promise<boolean> {
  if (!handle.requestPermission) return true;
  const state = await handle.requestPermission({ mode: "readwrite" });
  return state === "granted";
}

export async function clearPersistedFolderHandle(): Promise<void> {
  try {
    await del(IDB_FOLDER_HANDLE_KEY);
  } catch {
    // ignore IndexedDB cleanup errors in private browsing
  }
}

async function resolveSubdirHandle(
  rootHandle: ExtendedDirectoryHandle,
  subdir: LocalFolderSubdir,
  create: boolean,
): Promise<ExtendedDirectoryHandle> {
  // Smart check: if user directly picked `/Football Manager 27/tactics`, don't nest `/tactics/tactics`!
  if (rootHandle.name.toLowerCase() === subdir.toLowerCase()) {
    return rootHandle;
  }
  return (await rootHandle.getDirectoryHandle(subdir, {
    create,
  })) as ExtendedDirectoryHandle;
}

const WINDOWS_RESERVED_BASENAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function sanitizeFileName(rawTitle: string, extension: string): string {
  let base =
    rawTitle
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/[. ]+$/g, "")
      .slice(0, 80) || "FM27-Export";
  if (WINDOWS_RESERVED_BASENAMES.test(base)) {
    base = `FM27-${base}`;
  }
  const cleanExt = extension.startsWith(".") ? extension : `.${extension}`;
  return base.toLowerCase().endsWith(cleanExt.toLowerCase()) ? base : `${base}${cleanExt}`;
}

export async function writeBinaryToLocalSubdir(
  rootHandle: ExtendedDirectoryHandle,
  subdir: LocalFolderSubdir,
  fileName: string,
  content: Uint8Array | string,
): Promise<string> {
  const dir = await resolveSubdirHandle(rootHandle, subdir, true);
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  if (typeof content === "string") {
    await writable.write(content);
  } else {
    await writable.write(content.slice().buffer);
  }
  await writable.close();
  return `${rootHandle.name.toLowerCase() === subdir ? "" : `/${subdir}/`}${fileName}`;
}

export async function listFilesInLocalSubdir(
  rootHandle: ExtendedDirectoryHandle,
  subdir: LocalFolderSubdir,
  extensions: readonly string[] = [".fmf", ".fm27.json"],
): Promise<LocalFolderFileEntry[]> {
  let dir: ExtendedDirectoryHandle;
  try {
    dir = await resolveSubdirHandle(rootHandle, subdir, false);
  } catch {
    return [];
  }

  if (!dir.values) return [];
  const entries: LocalFolderFileEntry[] = [];
  for await (const item of dir.values()) {
    if (item.kind !== "file") continue;
    const lower = item.name.toLowerCase();
    if (!extensions.some((ext) => lower.endsWith(ext))) continue;
    try {
      const file = await (item as FileSystemFileHandle).getFile();
      entries.push({
        name: item.name,
        size: file.size,
        lastModified: file.lastModified,
      });
    } catch {
      // skip unreadable file
    }
  }

  return entries.sort((a, b) => b.lastModified - a.lastModified);
}

export async function readFileBytesFromLocalSubdir(
  rootHandle: ExtendedDirectoryHandle,
  subdir: LocalFolderSubdir,
  fileName: string,
): Promise<Uint8Array> {
  const dir = await resolveSubdirHandle(rootHandle, subdir, false);
  const fileHandle = await dir.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  const ab = await file.arrayBuffer();
  return new Uint8Array(ab);
}

export async function listExportFilesInRoot(
  rootHandle: ExtendedDirectoryHandle,
  extensions: readonly string[] = [".csv", ".html", ".htm"],
): Promise<LocalFolderFileEntry[]> {
  if (!rootHandle.values) return [];
  const entries: LocalFolderFileEntry[] = [];
  for await (const item of rootHandle.values()) {
    if (item.kind !== "file") continue;
    const lower = item.name.toLowerCase();
    if (!extensions.some((ext) => lower.endsWith(ext))) continue;
    try {
      const file = await (item as FileSystemFileHandle).getFile();
      entries.push({
        name: item.name,
        size: file.size,
        lastModified: file.lastModified,
      });
    } catch {
      // skip unreadable file
    }
  }
  return entries.sort((a, b) => b.lastModified - a.lastModified);
}

export async function readRootFileText(
  rootHandle: ExtendedDirectoryHandle,
  fileName: string,
): Promise<string> {
  const fileHandle = await rootHandle.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  return file.text();
}

/**
 * Universal fallback file download (works in Chrome, Edge, Firefox, and Safari).
 */
export function triggerBrowserDownload(
  fileName: string,
  payload: Uint8Array | string,
  mimeType = "application/octet-stream",
): void {
  const blob =
    typeof payload === "string"
      ? new Blob([payload], { type: mimeType })
      : new Blob([payload.slice().buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
