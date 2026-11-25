import { decompress } from "fzstd";
export { decompress as decompressWithFzstd };
import { BinaryReader } from "./binary-reader.js";
import { BinaryWriter } from "./binary-writer.js";

export const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd] as const;
export const ZSTD_RAW_DESCRIPTOR = 0xa0;
export const MAX_ZSTD_RAW_BLOCK_SIZE = 65_536; // 64 KiB per RFC 8878 raw block limit
export const MAX_DECOMPRESSED_FRAME_BYTES = 16 * 1024 * 1024; // 16 MiB anti-bomb cap

/**
 * Wraps an arbitrary payload into a valid RFC 8878 Zstandard frame using
 * uncompressed Raw_Blocks (Block_Type = 00b), matching DirectTacticExport.Frame.
 */
export function encodeZstdRawFrame(raw: Uint8Array): Uint8Array {
  const writer = new BinaryWriter(raw.byteLength + 32);
  writer.writeBytes(ZSTD_MAGIC);
  writer.writeUint8(ZSTD_RAW_DESCRIPTOR);
  writer.writeUint32(raw.byteLength);

  let offset = 0;
  do {
    const chunkLen = Math.min(MAX_ZSTD_RAW_BLOCK_SIZE, raw.byteLength - offset);
    const isLastBlock = offset + chunkLen >= raw.byteLength;
    const blockHeader24 = (chunkLen << 3) | (isLastBlock ? 1 : 0);

    writer.writeUint8(blockHeader24 & 0xff);
    writer.writeUint8((blockHeader24 >>> 8) & 0xff);
    writer.writeUint8((blockHeader24 >>> 16) & 0xff);

    if (chunkLen > 0) {
      writer.writeBytes(raw.subarray(offset, offset + chunkLen));
    }
    offset += chunkLen;
  } while (offset < raw.byteLength);

  return writer.toUint8Array();
}

/**
 * Decompresses any valid Zstandard frame (both compressed FM27 frames via fzstd
 * and uncompressed 0xA0 Raw_Block frames).
 */
export function decodeZstdFrame(frame: Uint8Array): Uint8Array {
  if (frame.byteLength < 8) {
    throw new Error(`Zstandard frame too short (${frame.byteLength} bytes)`);
  }
  for (let i = 0; i < 4; i++) {
    if (frame[i] !== ZSTD_MAGIC[i]) {
      throw new Error("Invalid Zstandard frame magic bytes (expected 28 B5 2F FD)");
    }
  }

  // Fast-path verification for pure Raw_Block frames; falls back to fzstd for compressed blocks
  if (frame[4] === ZSTD_RAW_DESCRIPTOR && frame.byteLength >= 9) {
    const reader = new BinaryReader(frame);
    reader.skip(5);
    const declaredSize = reader.readUint32();
    if (declaredSize > MAX_DECOMPRESSED_FRAME_BYTES) {
      throw new RangeError(
        `Zstd Frame_Content_Size (${declaredSize}) exceeds safety limit (${MAX_DECOMPRESSED_FRAME_BYTES})`,
      );
    }
    const out = new Uint8Array(declaredSize);
    let writePos = 0;
    let isLast = false;
    let allRaw = true;

    while (!isLast && reader.remaining >= 3) {
      const b0 = reader.readUint8();
      const b1 = reader.readUint8();
      const b2 = reader.readUint8();
      const header24 = b0 | (b1 << 8) | (b2 << 16);
      isLast = (header24 & 1) === 1;
      const blockType = (header24 >>> 1) & 0x03;
      const blockSize = header24 >>> 3;

      if (blockType !== 0) {
        allRaw = false;
        break;
      }
      const chunk = reader.readBytes(blockSize);
      if (writePos + chunk.byteLength > out.byteLength) {
        throw new RangeError("Zstd Raw_Block content exceeds declared Frame_Content_Size");
      }
      out.set(chunk, writePos);
      writePos += chunk.byteLength;
    }

    if (allRaw && isLast && writePos === declaredSize) {
      return out;
    }
  }

  const decompressed = decompress(frame);
  if (decompressed.byteLength > MAX_DECOMPRESSED_FRAME_BYTES) {
    throw new RangeError(
      `Decompressed Zstd payload (${decompressed.byteLength}) exceeds safety limit (${MAX_DECOMPRESSED_FRAME_BYTES})`,
    );
  }
  return decompressed;
}
