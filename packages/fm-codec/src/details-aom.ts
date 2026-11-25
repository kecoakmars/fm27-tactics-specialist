import { BinaryReader } from "./binary-reader.js";
import { BinaryWriter } from "./binary-writer.js";

export const AOM_HEADER_V2 = [
  0x02, 0x01, 0x6d, 0x6f, 0x61, 0x2e, 0x01, 0x00, 0x03, 0x00,
] as const;

export const AOM_HEADER_V3 = [
  0x03, 0x01, 0x6d, 0x6f, 0x61, 0x2e, 0x04, 0x00,
] as const;

const AOM_V3_TRAILER_PREFIX = [
  0x02, 0x00, 0x01, 0x00, 0x02, 0x81, 0x49, 0x0d, 0x03, 0x01, 0x00, 0x10,
] as const;

export type AomHandlerType =
  | "TACTICS_TYPE_HANDLER"
  | "TACTIC_TYPE_HANDLER"
  | "PLAYER_SHORTLIST_TYPE_HANDLER"
  | "SCHEDULE_TYPE_HANDLER";

export interface DetailsAomMetadata {
  handler: AomHandlerType;
  title: string;
  description: string;
  author: string;
  guidHex: string;
}

function unescapeXml(value: string): string {
  return value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >>> 1);
  for (let i = 0; i < out.byteLength; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function generateGuid10Hex(): string {
  const random10 = globalThis.crypto.getRandomValues(new Uint8Array(10));
  return bytesToHex(random10);
}

function normalizeHandler(rawHandler: string): AomHandlerType {
  if (
    rawHandler === "TACTIC_TYPE_HANDLER" ||
    rawHandler === "PLAYER_SHORTLIST_TYPE_HANDLER" ||
    rawHandler === "SCHEDULE_TYPE_HANDLER"
  ) {
    return rawHandler;
  }
  return "TACTICS_TYPE_HANDLER";
}

/**
 * Encodes `_data/details.aom` binary payload using authentic FM27 v3 `moa.` binary layout:
 * `03 01 6d 6f 61 2e 04 00` + length-prefixed handler, title, description, reserved sentinel,
 * author, trailer version bytes, and 10-byte random GUID.
 */
export function encodeDetailsAom(input: {
  handler?: AomHandlerType;
  title: string;
  description?: string;
  author?: string;
  guidHex?: string;
}): Uint8Array {
  const handler = input.handler ?? "TACTICS_TYPE_HANDLER";
  const guidHex =
    input.guidHex && /^[0-9a-fA-F]{20}$/.test(input.guidHex)
      ? input.guidHex.toLowerCase()
      : generateGuid10Hex();
  const guidBytes = hexToBytes(guidHex);

  const writer = new BinaryWriter(256 + input.title.length * 2 + (input.description?.length ?? 0) * 2);
  writer.writeBytes(AOM_HEADER_V3);
  writer.writeLengthPrefixedUtf8(handler);
  writer.writeLengthPrefixedUtf8(input.title);
  writer.writeLengthPrefixedUtf8(input.description ?? "");
  writer.writeInt32(0); // empty secondary notes string
  writer.writeUint16(0);
  writer.writeInt64(-1n);
  writer.writeInt64(-1n);
  writer.writeLengthPrefixedUtf8(input.author ?? "");
  writer.writeBytes(AOM_V3_TRAILER_PREFIX);
  writer.writeBytes(guidBytes);
  return writer.toUint8Array();
}

function extractXmlAttr(xml: string, id: string): string {
  const regex = new RegExp(`<string\\s+id="${id}"\\s+value="([^"]*)"\\s*/>`, "i");
  const match = xml.match(regex);
  return match?.[1] ? unescapeXml(match[1]) : "";
}

/**
 * Decodes `_data/details.aom` metadata payload (supports authentic FM27 binary v3 `03 01 moa.`
 * as well as legacy XML v2 `02 01 moa.` payloads).
 */
export function decodeDetailsAom(raw: Uint8Array): DetailsAomMetadata {
  if (raw.byteLength < 12) {
    throw new Error(`details.aom payload too short (${raw.byteLength} bytes)`);
  }
  if (raw[2] !== 0x6d || raw[3] !== 0x6f || raw[4] !== 0x61 || raw[5] !== 0x2e) {
    throw new Error("Invalid details.aom header: missing 'moa.' FourCC");
  }

  const reader = new BinaryReader(raw);
  const headerLen = raw[0] === 0x03 ? 8 : 10;
  reader.skip(headerLen);

  const firstStr = reader.readLengthPrefixedUtf8();
  if (firstStr.trimStart().startsWith("<")) {
    return {
      handler: normalizeHandler(extractXmlAttr(firstStr, "type_handler")),
      title: extractXmlAttr(firstStr, "title"),
      description: extractXmlAttr(firstStr, "description"),
      author: extractXmlAttr(firstStr, "author"),
      guidHex: extractXmlAttr(firstStr, "guid"),
    };
  }

  const handler = normalizeHandler(firstStr);
  const title = reader.remaining >= 4 ? reader.readLengthPrefixedUtf8() : "";
  const description = reader.remaining >= 4 ? reader.readLengthPrefixedUtf8() : "";
  if (reader.remaining >= 4) {
    reader.readLengthPrefixedUtf8(); // optional extra string
  }
  if (reader.remaining >= 18) {
    reader.skip(18); // uint16(0) + two int64(-1)
  }
  const author = reader.remaining >= 4 ? reader.readLengthPrefixedUtf8() : "";

  let guidHex = "";
  if (reader.remaining >= 10) {
    const tail = raw.subarray(raw.byteLength - 10);
    guidHex = bytesToHex(tail);
  } else if (reader.remaining > 0) {
    guidHex = bytesToHex(reader.readBytes(reader.remaining));
  }

  return {
    handler,
    title,
    description,
    author,
    guidHex,
  };
}
