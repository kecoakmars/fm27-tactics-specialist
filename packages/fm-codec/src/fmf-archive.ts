import type { DualPhaseTactic, PitchCatalog } from "@fm27/shared-types";
import {
  decryptAesCtrFmf,
  decryptAfeMemberSlice,
  ENCRYPTED_AFE_HEADER,
  isEncryptedAfeArchive,
  isPerMemberEncryptedAfeArchive,
} from "./aes-ctr-decrypt.js";
import { BinaryReader } from "./binary-reader.js";
import { BinaryWriter } from "./binary-writer.js";
import {
  decodeDetailsAom,
  encodeDetailsAom,
  type AomHandlerType,
  type DetailsAomMetadata,
} from "./details-aom.js";
import { decodeTacPayload, encodeTacPayload } from "./tac-serializer.js";
import { decodeZstdFrame, encodeZstdRawFrame } from "./zstd-raw-frame.js";

export const FMF_ARCHIVE_HEADER = [
  0x02, 0x01, 0x66, 0x6d, 0x66, 0x2e, 0x08, 0x00, 0x00,
] as const;

export const DEFAULT_FMF_TIMESTAMP = 1795265919n;
const ARCHIVE_VERSION_BYTE = 0x03;
const FIRST_MEMBER_REL_OFFSET = 17n;

export interface FmfRootFileInput {
  name: string;
  extension: string;
  rawBytes: Uint8Array;
}

export interface UnpackedFmfArchive {
  rootTitle: string;
  files: Map<string, Uint8Array>;
  details?: DetailsAomMetadata;
}

interface RawTocEntry {
  fullKey: string;
  relOffset: number;
  packedLen: number;
  rawLen: number;
}

function writeTocEntry(
  writer: BinaryWriter,
  name: string,
  extension: string,
  relOffset: bigint,
  packedLen: bigint,
  rawLen: bigint,
  timestamp = DEFAULT_FMF_TIMESTAMP,
): void {
  writer.writeLengthPrefixedUtf8(name);
  writer.writeLengthPrefixedUtf8(extension);
  writer.writeInt64(relOffset);
  writer.writeInt64(packedLen);
  writer.writeInt64(rawLen);
  writer.writeInt64(timestamp);
  writer.writeInt64(timestamp);
}

/**
 * Packs root files + `_data/details.aom` into an authentic FM27 `.fmf` container.
 * Uses 0-based `dataStart`-relative TOC member offsets matching real FM27 `.fmf` files.
 */
export function packFmfArchive(input: {
  rootTitle: string;
  rootFiles: readonly FmfRootFileInput[];
  detailsAomRaw: Uint8Array;
}): Uint8Array {
  if (input.rootFiles.length === 0) {
    throw new Error("packFmfArchive requires at least 1 root file");
  }

  const encodedMembers = input.rootFiles.map((f) => ({
    ...f,
    frameBytes: encodeZstdRawFrame(f.rawBytes),
  }));
  const detailsFrame = encodeZstdRawFrame(input.detailsAomRaw);

  const tocWriter = new BinaryWriter(512);
  tocWriter.writeLengthPrefixedUtf8(input.rootTitle);
  tocWriter.writeInt32(encodedMembers.length);

  // Real FM27 TOC offsets start at 0 relative to dataStart (byte 26)
  let runningDataOffset = 0n;
  for (const member of encodedMembers) {
    const packedLen = BigInt(member.frameBytes.byteLength);
    writeTocEntry(
      tocWriter,
      member.name,
      member.extension,
      runningDataOffset,
      packedLen,
      BigInt(member.rawBytes.byteLength),
    );
    runningDataOffset += packedLen;
  }

  // 1 subdirectory: `_data/details.aom`
  tocWriter.writeInt32(1);
  tocWriter.writeLengthPrefixedUtf8("_data");
  tocWriter.writeInt32(1);
  writeTocEntry(
    tocWriter,
    "details",
    ".aom",
    runningDataOffset,
    BigInt(detailsFrame.byteLength),
    BigInt(input.detailsAomRaw.byteLength),
  );
  runningDataOffset += BigInt(detailsFrame.byteLength);
  tocWriter.writeInt32(0); // 0 nested subdirs inside _data

  const tocRaw = tocWriter.toUint8Array();
  const tocFrame = encodeZstdRawFrame(tocRaw);

  const totalMemberFramesBytes = runningDataOffset;
  const totalOutSize =
    9 + 8 + 8 + 1 + Number(totalMemberFramesBytes) + 9 + tocFrame.byteLength;

  const archiveWriter = new BinaryWriter(totalOutSize);
  archiveWriter.writeBytes(FMF_ARCHIVE_HEADER);
  archiveWriter.writeInt64(FIRST_MEMBER_REL_OFFSET + totalMemberFramesBytes);
  archiveWriter.writeInt64(FIRST_MEMBER_REL_OFFSET);
  archiveWriter.writeUint8(ARCHIVE_VERSION_BYTE);

  for (const member of encodedMembers) {
    archiveWriter.writeBytes(member.frameBytes);
  }
  archiveWriter.writeBytes(detailsFrame);
  archiveWriter.writeBytes(FMF_ARCHIVE_HEADER);
  archiveWriter.writeBytes(tocFrame);

  return archiveWriter.toUint8Array();
}

function hasZstdMagicAt(bytes: Uint8Array, offset: number): boolean {
  return (
    offset >= 0 &&
    offset + 4 <= bytes.byteLength &&
    bytes[offset] === 0x28 &&
    bytes[offset + 1] === 0xb5 &&
    bytes[offset + 2] === 0x2f &&
    bytes[offset + 3] === 0xfd
  );
}

function hasAfeMemberHeaderAt(bytes: Uint8Array, offset: number): boolean {
  if (offset < 0 || offset + 8 > bytes.byteLength) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
  return view.getInt32(0, true) === 16 && view.getInt32(4, true) === 16;
}

function resolveTocMemberOffset(
  archiveBytes: Uint8Array,
  relOffset: number,
  packedLen: number,
  dataStart: number,
  perMemberAfe = false,
): number | null {
  if (packedLen < 0) return null;
  const candidates = [dataStart + relOffset, 9 + relOffset, relOffset];
  const validCandidates: number[] = [];

  for (const off of candidates) {
    if (off >= dataStart && off + packedLen <= archiveBytes.byteLength) {
      if (!validCandidates.includes(off)) {
        validCandidates.push(off);
      }
    }
  }

  if (validCandidates.length === 0) return null;
  if (perMemberAfe) {
    const afeMatch = validCandidates.find((off) => hasAfeMemberHeaderAt(archiveBytes, off));
    if (afeMatch !== undefined) return afeMatch;
  }
  const zstdMatch = validCandidates.find((off) => hasZstdMagicAt(archiveBytes, off));
  return zstdMatch ?? validCandidates[0]!;
}

function collectTocEntries(
  tocReader: BinaryReader,
  prefix: string,
  outEntries: RawTocEntry[],
  depth = 0,
): void {
  if (depth > 8) {
    throw new RangeError("FMF TOC directory nesting exceeds maximum depth (8)");
  }
  const fileCount = tocReader.readInt32();
  if (fileCount < 0 || fileCount > 1024) {
    throw new Error(`Invalid TOC fileCount: ${fileCount}`);
  }

  for (let i = 0; i < fileCount; i++) {
    const name = tocReader.readLengthPrefixedUtf8();
    const ext = tocReader.readLengthPrefixedUtf8();
    const relOffset = Number(tocReader.readInt64());
    const packedLen = Number(tocReader.readInt64());
    const rawLen = Number(tocReader.readInt64());
    tocReader.skip(16); // two int64 timestamps

    if (rawLen < 0 || rawLen > 16 * 1024 * 1024) {
      throw new RangeError(`TOC entry "${name}${ext}" rawLen out of safety bounds: ${rawLen}`);
    }
    const fullKey = prefix ? `${prefix}/${name}${ext}` : `${name}${ext}`;
    outEntries.push({ fullKey, relOffset, packedLen, rawLen });
  }

  const subDirCount = tocReader.readInt32();
  if (subDirCount < 0 || subDirCount > 256) {
    throw new Error(`Invalid TOC subDirCount: ${subDirCount}`);
  }
  for (let d = 0; d < subDirCount; d++) {
    const dirName = tocReader.readLengthPrefixedUtf8();
    const nextPrefix = prefix ? `${prefix}/${dirName}` : dirName;
    collectTocEntries(tocReader, nextPrefix, outEntries, depth + 1);
  }
}

function readArchiveToc(
  archiveBytes: Uint8Array,
  allowAfeHeader = false,
): {
  rootTitle: string;
  dataStart: number;
  entries: RawTocEntry[];
} {
  const reader = new BinaryReader(archiveBytes);
  if (allowAfeHeader && isEncryptedAfeArchive(archiveBytes)) {
    reader.expectBytes(ENCRYPTED_AFE_HEADER, "AFE ArchiveHeader");
  } else {
    reader.expectBytes(FMF_ARCHIVE_HEADER, "FMF ArchiveHeader");
  }

  const tocRelOffset = Number(reader.readInt64());
  const firstMemberRelOffset = Number(reader.readInt64());
  if (firstMemberRelOffset < 17) {
    throw new Error(`Unexpected firstMemberRelOffset: ${firstMemberRelOffset}`);
  }
  reader.skip(1); // container version byte

  const dataStart = 9 + firstMemberRelOffset;
  const secondHeaderAbsOffset = 9 + tocRelOffset;
  if (secondHeaderAbsOffset < dataStart || secondHeaderAbsOffset + 9 > archiveBytes.byteLength) {
    throw new RangeError(`Invalid TOC offset in FMF header: ${secondHeaderAbsOffset}`);
  }

  reader.seek(secondHeaderAbsOffset);
  reader.expectBytes(FMF_ARCHIVE_HEADER, "Trailing FMF ArchiveHeader");
  const tocFrame = archiveBytes.subarray(reader.offset);
  const tocRaw = decodeZstdFrame(tocFrame);

  const tocReader = new BinaryReader(tocRaw);
  const rootTitle = tocReader.readLengthPrefixedUtf8();
  const entries: RawTocEntry[] = [];
  collectTocEntries(tocReader, "", entries);
  return { rootTitle, dataStart, entries };
}

/**
 * Unpacks an unencrypted `fmf.` archive buffer.
 */
export function unpackPlainFmfArchive(archiveBytes: Uint8Array): UnpackedFmfArchive {
  const { rootTitle, dataStart, entries } = readArchiveToc(archiveBytes, false);
  const files = new Map<string, Uint8Array>();

  for (const entry of entries) {
    const absOffset = resolveTocMemberOffset(
      archiveBytes,
      entry.relOffset,
      entry.packedLen,
      dataStart,
      false,
    );
    if (absOffset === null) {
      throw new RangeError(
        `TOC entry "${entry.fullKey}" points outside archive bounds (relOffset=${entry.relOffset}, packedLen=${entry.packedLen}, rawLen=${entry.rawLen}, dataStart=${dataStart}, archiveLen=${archiveBytes.byteLength})`,
      );
    }
    const frameSlice = archiveBytes.subarray(absOffset, absOffset + entry.packedLen);
    const decompressed = hasZstdMagicAt(archiveBytes, absOffset)
      ? decodeZstdFrame(frameSlice)
      : entry.packedLen === entry.rawLen
        ? frameSlice.slice()
        : decodeZstdFrame(frameSlice);
    if (entry.rawLen > 0 && decompressed.byteLength !== entry.rawLen) {
      throw new Error(
        `Decompressed size mismatch for "${entry.fullKey}": expected ${entry.rawLen}, got ${decompressed.byteLength}`,
      );
    }
    files.set(entry.fullKey, decompressed);
  }

  const detailsBytes = files.get("_data/details.aom");
  const details = detailsBytes ? decodeDetailsAom(detailsBytes) : undefined;

  return { rootTitle, files, details };
}

/**
 * Unpacks either a plain `fmf.`, a native FM27 per-member `afe.`, or a whole-stream AES-128-CTR `afe.` archive.
 */
export async function unpackFmfArchive(archiveBytes: Uint8Array): Promise<UnpackedFmfArchive> {
  if (isPerMemberEncryptedAfeArchive(archiveBytes)) {
    const { rootTitle, dataStart, entries } = readArchiveToc(archiveBytes, true);
    const files = new Map<string, Uint8Array>();
    for (const entry of entries) {
      const absOffset = resolveTocMemberOffset(
        archiveBytes,
        entry.relOffset,
        entry.packedLen,
        dataStart,
        true,
      );
      if (absOffset === null) {
        throw new RangeError(`Encrypted TOC entry "${entry.fullKey}" points outside archive bounds`);
      }
      const memberSlice = archiveBytes.subarray(absOffset, absOffset + entry.packedLen);
      const decryptedFrame = await decryptAfeMemberSlice(memberSlice);
      const decompressed = hasZstdMagicAt(decryptedFrame, 0)
        ? decodeZstdFrame(decryptedFrame)
        : decryptedFrame;
      if (entry.rawLen > 0 && decompressed.byteLength !== entry.rawLen) {
        throw new Error(
          `Decompressed size mismatch for "${entry.fullKey}": expected ${entry.rawLen}, got ${decompressed.byteLength}`,
        );
      }
      files.set(entry.fullKey, decompressed);
    }
    const detailsBytes = files.get("_data/details.aom");
    const details = detailsBytes ? decodeDetailsAom(detailsBytes) : undefined;
    return { rootTitle, files, details };
  }

  const plainBytes = isEncryptedAfeArchive(archiveBytes)
    ? await decryptAesCtrFmf(archiveBytes)
    : archiveBytes;
  return unpackPlainFmfArchive(plainBytes);
}

/**
 * High-level `.fmf` tactic exporter (`DualPhaseTactic` -> `.fmf` Uint8Array).
 */
export function exportFmf(
  tactic: DualPhaseTactic,
  options?: { catalog?: PitchCatalog; handler?: AomHandlerType },
): Uint8Array {
  const tacRaw = encodeTacPayload(tactic, { catalog: options?.catalog });
  const detailsAomRaw = encodeDetailsAom({
    handler: options?.handler ?? "TACTICS_TYPE_HANDLER",
    title: tactic.title,
    description: tactic.description,
    author: tactic.author,
  });

  const safeBaseName = tactic.title.trim() || "FM27 Tactic";
  return packFmfArchive({
    rootTitle: safeBaseName,
    rootFiles: [
      {
        name: safeBaseName,
        extension: ".tac",
        rawBytes: tacRaw,
      },
    ],
    detailsAomRaw,
  });
}

function isRawTacPayload(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 16) return false;
  if (bytes[0] === 0x22 && bytes[1] === 0x44) return true;
  return (
    bytes[2] === 0x63 &&
    bytes[3] === 0x61 &&
    bytes[4] === 0x74 &&
    bytes[5] === 0x2e
  );
}

/**
 * High-level `.fmf` (or raw `.tac` / encrypted `afe.`) tactic importer.
 */
export async function parseFmf(
  inputBytes: Uint8Array,
  options?: { patchVersion?: string; catalog?: PitchCatalog },
): Promise<DualPhaseTactic> {
  if (isRawTacPayload(inputBytes)) {
    return decodeTacPayload(inputBytes, options);
  }

  const unpacked = await unpackFmfArchive(inputBytes);
  let tacBytes: Uint8Array | undefined;
  for (const [fileName, content] of unpacked.files.entries()) {
    if (fileName.toLowerCase().endsWith(".tac")) {
      tacBytes = content;
      break;
    }
  }
  if (!tacBytes) {
    throw new Error("Archive does not contain any .tac tactic member");
  }

  const tactic = decodeTacPayload(tacBytes, options);
  if (unpacked.details) {
    if (
      unpacked.details.title &&
      (!tactic.title || tactic.title === "Imported FM27 Tactic")
    ) {
      tactic.title = unpacked.details.title;
    }
    if (unpacked.details.description) tactic.description = unpacked.details.description;
    if (unpacked.details.author) tactic.author = unpacked.details.author;
  } else if (unpacked.rootTitle && (!tactic.title || tactic.title === "Imported FM27 Tactic")) {
    tactic.title = unpacked.rootTitle;
  }
  return tactic;
}
