import { getTrainingSessions } from "@fm27/fm-data";
import {
  WeeklyScheduleSchema,
  type DayOfWeek,
  type WeeklySchedule,
} from "@fm27/shared-types";
import { z } from "zod";
import { BinaryReader } from "./binary-reader.js";
import { BinaryWriter } from "./binary-writer.js";
import { encodeDetailsAom } from "./details-aom.js";
import { packFmfArchive, unpackFmfArchive } from "./fmf-archive.js";

export const TRAINING_TSC_HEADER = [
  0x03, 0x01, 0x63, 0x73, 0x74, 0x2e, 0x03, 0x00, 0x05, 0x01, 0x00, 0x00, 0x00, 0x01,
] as const;

export const SHORTLIST_SLF_HEADER = [
  0x03, 0x01, 0x66, 0x6c, 0x73, 0x2e, 0x02, 0x00, 0x01, 0x54, 0x1b, 0x40, 0x00,
] as const;

const PLACEHOLDER_IMAGE_IMG = new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
const DAYS_ORDER: readonly DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ScheduleJsonEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  game: z.literal("FM27"),
  exportedAt: z.string().datetime(),
  schedule: WeeklyScheduleSchema,
});

export function exportScheduleJson(schedule: WeeklySchedule): string {
  const parsed = WeeklyScheduleSchema.parse(schedule);
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      game: "FM27",
      exportedAt: new Date().toISOString(),
      schedule: parsed,
    },
    null,
    2,
  )}\n`;
}

export function parseScheduleJson(input: string | unknown): WeeklySchedule {
  const raw = typeof input === "string" ? JSON.parse(input) : input;
  return ScheduleJsonEnvelopeSchema.parse(raw).schedule;
}

/**
 * Exports a `WeeklySchedule` into an authentic FM27 `.fmf` container wrapping `.tsc` (`cst.`).
 */
export function exportScheduleFmf(schedule: WeeklySchedule): Uint8Array {
  const parsed = WeeklyScheduleSchema.parse(schedule);
  const catalog = getTrainingSessions(parsed.patchVersion);
  const codeToIndex = new Map<string, number>();
  catalog.Sessions.forEach((s, idx) => codeToIndex.set(s.code, idx + 1));

  const writer = new BinaryWriter(256);
  writer.writeBytes(TRAINING_TSC_HEADER);

  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const dayObj = parsed.days[dayIdx]!;
    const c1 = codeToIndex.get(dayObj.s1);
    const c2 = codeToIndex.get(dayObj.s2);
    const c3 = codeToIndex.get(dayObj.extra);
    if (c1 === undefined || c2 === undefined || c3 === undefined) {
      throw new Error(`Unknown session code on ${dayObj.day}`);
    }
    writer.writeUint8(0x04);
    writer.writeUint16(c1);
    writer.writeUint16(c2);
    writer.writeUint16(c3);
    writer.writeUint8(0x00);
  }

  writer.writeLengthPrefixedUtf8(parsed.name);
  writer.writeInt64(0n);

  const tscRaw = writer.toUint8Array();
  const detailsAomRaw = encodeDetailsAom({
    handler: "SCHEDULE_TYPE_HANDLER",
    title: parsed.name,
    description: parsed.description,
  });

  const safeName = parsed.name.trim() || "FM27 Schedule";
  return packFmfArchive({
    rootTitle: safeName,
    rootFiles: [
      { name: safeName, extension: ".tsc", rawBytes: tscRaw },
      { name: "image", extension: ".img", rawBytes: PLACEHOLDER_IMAGE_IMG },
    ],
    detailsAomRaw,
  });
}

/**
 * Parses an FM27 training schedule `.fmf` container (`.tsc`) back into a `WeeklySchedule`.
 */
export async function parseScheduleFmf(
  archiveBytes: Uint8Array,
  patchVersion = "27.0",
): Promise<WeeklySchedule> {
  const unpacked = await unpackFmfArchive(archiveBytes);
  let tscBytes: Uint8Array | undefined;
  for (const [name, content] of unpacked.files.entries()) {
    if (name.toLowerCase().endsWith(".tsc")) {
      tscBytes = content;
      break;
    }
  }
  if (!tscBytes) {
    throw new Error("Archive does not contain a .tsc training schedule member");
  }

  const catalog = getTrainingSessions(patchVersion);
  const indexToCode = new Map<number, string>();
  catalog.Sessions.forEach((s, idx) => indexToCode.set(idx + 1, s.code));

  const reader = new BinaryReader(tscBytes);
  reader.expectBytes(TRAINING_TSC_HEADER, "TrainingTscHeader");

  const days = DAYS_ORDER.map((day) => {
    const marker = reader.readUint8();
    if (marker !== 0x04) {
      throw new Error(`Unexpected day slot marker in .tsc: 0x${marker.toString(16)}`);
    }
    const i1 = reader.readUint16();
    const i2 = reader.readUint16();
    const i3 = reader.readUint16();
    reader.skip(1); // dayFlag
    return {
      day,
      s1: indexToCode.get(i1) ?? "REST",
      s2: indexToCode.get(i2) ?? "REST",
      extra: indexToCode.get(i3) ?? "REST",
    };
  });

  const name = reader.readLengthPrefixedUtf8() || unpacked.rootTitle || "Imported Schedule";
  return WeeklyScheduleSchema.parse({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "imported",
    name,
    description: unpacked.details?.description ?? "",
    focus_tags: [],
    patchVersion,
    days,
  });
}

/**
 * Exports a deduplicated list of player UIDs into an FM27 native `.fmf` shortlist (`.slf` / `fls.`).
 */
export function exportShortlistFmf(title: string, playerUids: readonly number[]): Uint8Array {
  const uniqueUids = Array.from(new Set(playerUids.filter((u) => Number.isInteger(u) && u > 0)));
  const safeTitle = title.trim() || "FM27 Wonderkids Shortlist";

  const writer = new BinaryWriter(64 + uniqueUids.length * 4);
  writer.writeBytes(SHORTLIST_SLF_HEADER);
  writer.writeLengthPrefixedUtf8(safeTitle);
  writer.writeInt32(uniqueUids.length);
  for (const uid of uniqueUids) {
    writer.writeUint32(uid);
  }
  writer.writeUint8(0x00);

  const slfRaw = writer.toUint8Array();
  const detailsAomRaw = encodeDetailsAom({
    handler: "PLAYER_SHORTLIST_TYPE_HANDLER",
    title: safeTitle,
  });

  return packFmfArchive({
    rootTitle: safeTitle,
    rootFiles: [
      { name: safeTitle, extension: ".slf", rawBytes: slfRaw },
      { name: "image", extension: ".img", rawBytes: PLACEHOLDER_IMAGE_IMG },
    ],
    detailsAomRaw,
  });
}

/**
 * Parses an FM27 shortlist `.fmf` (`.slf`) container and returns its title + deduplicated UIDs.
 */
export async function parseShortlistFmf(
  archiveBytes: Uint8Array,
): Promise<{ title: string; playerUids: number[] }> {
  const unpacked = await unpackFmfArchive(archiveBytes);
  let slfBytes: Uint8Array | undefined;
  for (const [name, content] of unpacked.files.entries()) {
    if (name.toLowerCase().endsWith(".slf")) {
      slfBytes = content;
      break;
    }
  }
  if (!slfBytes) {
    throw new Error("Archive does not contain a .slf shortlist member");
  }

  const reader = new BinaryReader(slfBytes);
  reader.expectBytes(SHORTLIST_SLF_HEADER, "ShortlistSlfHeader");
  const title = reader.readLengthPrefixedUtf8() || unpacked.rootTitle;
  const count = reader.readInt32();
  if (count < 0 || count > 100_000) {
    throw new RangeError(`Invalid shortlist player count: ${count}`);
  }
  const uids: number[] = [];
  for (let i = 0; i < count; i++) {
    uids.push(reader.readUint32());
  }
  return { title, playerUids: Array.from(new Set(uids)) };
}
