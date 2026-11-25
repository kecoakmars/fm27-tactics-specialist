import { BinaryReader } from "./binary-reader.js";
import { BinaryWriter } from "./binary-writer.js";

export const AOM_HEADER_V2 = [
  0x02, 0x01, 0x6d, 0x6f, 0x61, 0x2e, 0x01, 0x00, 0x03, 0x00,
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

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

export function generateGuid10Hex(): string {
  const random10 = globalThis.crypto.getRandomValues(new Uint8Array(10));
  return bytesToHex(random10);
}

/**
 * Encodes `_data/details.aom` binary payload containing `moa.` header, SI XML handler,
 * title, description, author, and unique 10-byte random GUID.
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

  const xml = [
    `<record>`,
    `  <string id="type_handler" value="${escapeXml(handler)}"/>`,
    `  <string id="title" value="${escapeXml(input.title)}"/>`,
    `  <string id="description" value="${escapeXml(input.description ?? "")}"/>`,
    `  <string id="author" value="${escapeXml(input.author ?? "")}"/>`,
    `  <string id="guid" value="${escapeXml(guidHex)}"/>`,
    `</record>`,
  ].join("\n");

  const writer = new BinaryWriter(256 + xml.length * 2);
  writer.writeBytes(AOM_HEADER_V2);
  writer.writeLengthPrefixedUtf8(xml);
  return writer.toUint8Array();
}

function extractXmlAttr(xml: string, id: string): string {
  const regex = new RegExp(`<string\\s+id="${id}"\\s+value="([^"]*)"\\s*/>`, "i");
  const match = xml.match(regex);
  return match?.[1] ? unescapeXml(match[1]) : "";
}

/**
 * Decodes `_data/details.aom` metadata payload (supports both v2 10-byte and v3 8-byte `moa.` headers).
 */
export function decodeDetailsAom(raw: Uint8Array): DetailsAomMetadata {
  if (raw.byteLength < 12) {
    throw new Error(`details.aom payload too short (${raw.byteLength} bytes)`);
  }
  // Verify reversed FourCC "moa." at bytes [2..5]
  if (raw[2] !== 0x6d || raw[3] !== 0x6f || raw[4] !== 0x61 || raw[5] !== 0x2e) {
    throw new Error("Invalid details.aom header: missing 'moa.' FourCC");
  }

  const reader = new BinaryReader(raw);
  const headerLen = raw[0] === 0x03 ? 8 : 10;
  reader.skip(headerLen);
  const xml = reader.readLengthPrefixedUtf8();

  const rawHandler = extractXmlAttr(xml, "type_handler");
  const handler: AomHandlerType =
    rawHandler === "TACTIC_TYPE_HANDLER" ||
    rawHandler === "PLAYER_SHORTLIST_TYPE_HANDLER" ||
    rawHandler === "SCHEDULE_TYPE_HANDLER"
      ? rawHandler
      : "TACTICS_TYPE_HANDLER";

  return {
    handler,
    title: extractXmlAttr(xml, "title"),
    description: extractXmlAttr(xml, "description"),
    author: extractXmlAttr(xml, "author"),
    guidHex: extractXmlAttr(xml, "guid"),
  };
}
