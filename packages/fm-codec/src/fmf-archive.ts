import type { DualPhaseTactic, PitchCatalog } from "@fm27/shared-types";
import { decryptAesCtrFmf, isEncryptedAfeArchive } from "./aes-ctr-decrypt.js";
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

export const DEFAULT_FMF_TIMESTAMP = 1010308434000000064n; // 0x0E055598B8B70140n
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

  let runningRelOffset = FIRST_MEMBER_REL_OFFSET;
  for (const member of encodedMembers) {
    const packedLen = BigInt(member.frameBytes.byteLength);
    writeTocEntry(
      tocWriter,
      member.name,
      member.extension,
      runningRelOffset,
      packedLen,
      BigInt(member.rawBytes.byteLength),
    );
    runningRelOffset += packedLen;
  }

  // 1 subdirectory: `_data/details.aom`
  tocWriter.writeInt32(1);
  tocWriter.writeLengthPrefixedUtf8("_data");
  tocWriter.writeInt32(1);
  writeTocEntry(
    tocWriter,
    "details",
    ".aom",
    runningRelOffset,
    BigInt(detailsFrame.byteLength),
    BigInt(input.detailsAomRaw.byteLength),
  );
  runningRelOffset += BigInt(detailsFrame.byteLength);
  tocWriter.writeInt32(0); // 0 nested subdirs inside _data

  const tocRaw = tocWriter.toUint8Array();
  const tocFrame = encodeZstdRawFrame(tocRaw);

  const totalMemberFramesBytes = runningRelOffset - FIRST_MEMBER_REL_OFFSET;
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

function readTocDirectory(
  tocReader: BinaryReader,
  archiveBytes: Uint8Array,
  prefix: string,
  outFiles: Map<string, Uint8Array>,
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
    const absOffset = 9 + relOffset;
    if (absOffset < 26 || absOffset + packedLen > archiveBytes.byteLength) {
      throw new RangeError(`TOC entry "${name}${ext}" points outside archive bounds`);
    }
    const frameSlice = archiveBytes.subarray(absOffset, absOffset + packedLen);
    const decompressed = decodeZstdFrame(frameSlice);
    if (rawLen > 0 && decompressed.byteLength !== rawLen) {
      throw new Error(
        `Decompressed size mismatch for "${name}${ext}": expected ${rawLen}, got ${decompressed.byteLength}`,
      );
    }
    const fullKey = prefix ? `${prefix}/${name}${ext}` : `${name}${ext}`;
    outFiles.set(fullKey, decompressed);
  }

  const subDirCount = tocReader.readInt32();
  if (subDirCount < 0 || subDirCount > 256) {
    throw new Error(`Invalid TOC subDirCount: ${subDirCount}`);
  }
  for (let d = 0; d < subDirCount; d++) {
    const dirName = tocReader.readLengthPrefixedUtf8();
    const nextPrefix = prefix ? `${prefix}/${dirName}` : dirName;
    readTocDirectory(tocReader, archiveBytes, nextPrefix, outFiles, depth + 1);
  }
}

/**
 * Unpacks an unencrypted `fmf.` archive buffer.
 */
export function unpackPlainFmfArchive(archiveBytes: Uint8Array): UnpackedFmfArchive {
  const reader = new BinaryReader(archiveBytes);
  reader.expectBytes(FMF_ARCHIVE_HEADER, "FMF ArchiveHeader");

  const tocRelOffset = Number(reader.readInt64());
  const firstMemberRelOffset = Number(reader.readInt64());
  if (firstMemberRelOffset < 17) {
    throw new Error(`Unexpected firstMemberRelOffset: ${firstMemberRelOffset}`);
  }
  reader.skip(1); // container version byte

  const secondHeaderAbsOffset = 9 + tocRelOffset;
  if (secondHeaderAbsOffset < 26 || secondHeaderAbsOffset + 9 > archiveBytes.byteLength) {
    throw new RangeError(`Invalid TOC offset in FMF header: ${secondHeaderAbsOffset}`);
  }

  reader.seek(secondHeaderAbsOffset);
  reader.expectBytes(FMF_ARCHIVE_HEADER, "Trailing FMF ArchiveHeader");
  const tocFrame = archiveBytes.subarray(reader.offset);
  const tocRaw = decodeZstdFrame(tocFrame);

  const tocReader = new BinaryReader(tocRaw);
  const rootTitle = tocReader.readLengthPrefixedUtf8();
  const files = new Map<string, Uint8Array>();
  readTocDirectory(tocReader, archiveBytes, "", files);

  const detailsBytes = files.get("_data/details.aom");
  const details = detailsBytes ? decodeDetailsAom(detailsBytes) : undefined;

  return { rootTitle, files, details };
}

/**
 * Unpacks either a plain `fmf.` or an AES-128-CTR encrypted `afe.` archive.
 */
export async function unpackFmfArchive(archiveBytes: Uint8Array): Promise<UnpackedFmfArchive> {
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

/**
 * High-level `.fmf` (or raw `.tac` / encrypted `afe.`) tactic importer.
 */
export async function parseFmf(
  inputBytes: Uint8Array,
  options?: { patchVersion?: string; catalog?: PitchCatalog },
): Promise<DualPhaseTactic> {
  // Support raw .tac directly if user drops an extracted .tac file
  if (
    inputBytes.byteLength >= 16 &&
    inputBytes[2] === 0x63 &&
    inputBytes[3] === 0x61 &&
    inputBytes[4] === 0x74 &&
    inputBytes[5] === 0x2e
  ) {
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
    if (unpacked.details.description) tactic.description = unpacked.details.description;
    if (unpacked.details.author) tactic.author = unpacked.details.author;
  }
  return tactic;
}
