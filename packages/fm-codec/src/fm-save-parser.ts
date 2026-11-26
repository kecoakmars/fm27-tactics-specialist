import { decompress } from "fzstd";
import {
  ALL_49_ATTRIBUTES,
  POSITION_14_KEYS,
  type AttributeName,
  type PaRange,
  type Player,
  type PlayerAttributes,
  type PositionFamiliarity,
  type PositionKey14,
  type StaffAttributes,
  type StaffMember,
  type StaffRole,
  type Wonderkid,
} from "@fm27/shared-types";

const FM_CONTAINER_MAGIC = new Uint8Array([0x02, 0x01, 0x66, 0x6d, 0x66, 0x2e]); // \x02\x01fmf.
const AFE_ENCRYPTED_MAGIC = new Uint8Array([0x02, 0x01, 0x61, 0x66, 0x65, 0x2e]); // \x02\x01afe.
const HEADER_SIZE = 26;
const TRAILER_POINTER_AT = 9;
const TRAILER_MAGIC_SIZE = 9;
const MISSING_U32 = 0xffffffff;
const ALLOCATED_UID_MINIMUM = 2_000_000_000;
const TRANSFER_VALUE_PLACEHOLDER = 300_000_000;

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: false });
const STRICT_UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const ASCII_DECODER = new TextDecoder("latin1");

// Player 52 non-foot attributes in exact FM26/FM27 binary order (54 bytes total; 24=leftFoot, 25=rightFoot)
const BINARY_PLAYER_ATTRIBUTE_ORDER: ReadonlyArray<AttributeName | null> = [
  "crossing",
  "dribbling",
  "finishing",
  "heading",
  "long_shots",
  "marking",
  "off_the_ball",
  "passing",
  "penalty_taking",
  "tackling",
  "vision",
  "handling",
  "aerial_reach",
  "command_of_area",
  "communication",
  "kicking",
  "throwing",
  "anticipation",
  "decisions",
  "one_on_ones",
  "positioning",
  "reflexes",
  "first_touch",
  "technique",
  "flair",
  "corners",
  "teamwork",
  "work_rate",
  "long_throws",
  "eccentricity",
  "rushing_out",
  "punching",
  "acceleration",
  "free_kick_taking",
  "strength",
  "stamina",
  "pace",
  "jumping_reach",
  "leadership",
  "dirtiness",
  "balance",
  "bravery",
  null, // consistency (hidden)
  "aggression",
  "agility",
  null, // important_matches (hidden)
  "injury_proneness",
  null, // versatility (hidden)
  "natural_fitness",
  "determination",
  "composure",
  "concentration",
];

// 15 binary position ratings at +24..+38 (index 1 = SW skipped for PositionKey14)
const BINARY_POSITION_CODES: ReadonlyArray<PositionKey14 | null> = [
  "GK",
  null, // SW
  "DL",
  "DC",
  "DR",
  "DM",
  "ML",
  "MC",
  "MR",
  "AML",
  "AMC",
  "AMR",
  "STC",
  "WBL",
  "WBR",
];

// Standard SI Football Manager Nation Database IDs -> Display Nation Names (verified against FM27 game_db)
const FM_NATION_DB_NAMES: Readonly<Record<number, string>> = {
  5: "Algeria",
  6: "Angola",
  7: "Benin",
  8: "Botswana",
  9: "Burkina Faso",
  10: "Burundi",
  11: "Cameroon",
  12: "Cape Verde",
  13: "Central African Republic",
  14: "Chad",
  15: "Djibouti",
  16: "Egypt",
  17: "Equatorial Guinea",
  18: "Ethiopia",
  19: "Gabon",
  20: "Gambia",
  21: "Ghana",
  22: "Guinea",
  23: "Guinea-Bissau",
  24: "Ivory Coast",
  25: "Kenya",
  26: "Lesotho",
  27: "Liberia",
  28: "Libya",
  29: "Madagascar",
  30: "Malawi",
  31: "Mali",
  32: "Mauritania",
  33: "Mauritius",
  34: "Morocco",
  35: "Mozambique",
  36: "Namibia",
  37: "Niger",
  38: "Nigeria",
  39: "Rwanda",
  40: "Sao Tome & Principe",
  41: "Senegal",
  42: "Seychelles",
  43: "Sierra Leone",
  44: "Somalia",
  45: "South Africa",
  46: "Sudan",
  47: "Eswatini",
  48: "Tanzania",
  49: "Congo",
  50: "Togo",
  51: "Tunisia",
  52: "Uganda",
  53: "DR Congo",
  54: "Zambia",
  55: "Zimbabwe",
  106: "Afghanistan",
  107: "Bahrain",
  108: "Bangladesh",
  109: "Brunei",
  110: "China PR",
  111: "Hong Kong",
  112: "India",
  113: "Indonesia",
  114: "Iran",
  115: "Iraq",
  116: "Japan",
  117: "Jordan",
  118: "Cambodia",
  119: "Kazakhstan",
  120: "Kuwait",
  121: "Kyrgyzstan",
  122: "Laos",
  123: "Lebanon",
  124: "Macau",
  125: "Malaysia",
  126: "Maldives",
  127: "Myanmar",
  128: "Nepal",
  129: "North Korea",
  130: "Oman",
  131: "Pakistan",
  132: "Qatar",
  133: "Saudi Arabia",
  134: "Singapore",
  135: "South Korea",
  136: "Sri Lanka",
  137: "Syria",
  138: "Chinese Taipei",
  139: "Tajikistan",
  140: "Thailand",
  141: "Timor-Leste",
  142: "Turkmenistan",
  143: "UAE",
  144: "Uzbekistan",
  145: "Vietnam",
  146: "Yemen",
  359: "Antigua & Barbuda",
  360: "Aruba",
  361: "Barbados",
  362: "Belize",
  363: "Bermuda",
  364: "Canada",
  365: "Cayman Islands",
  366: "Costa Rica",
  367: "Cuba",
  368: "Dominica",
  370: "El Salvador",
  371: "Grenada",
  373: "Guatemala",
  374: "Guyana",
  375: "Haiti",
  376: "Honduras",
  377: "Jamaica",
  379: "Mexico",
  380: "Curacao",
  381: "Nicaragua",
  382: "Panama",
  383: "Puerto Rico",
  384: "St. Kitts & Nevis",
  385: "St. Lucia",
  386: "St. Vincent & Grenadines",
  387: "Suriname",
  388: "Bahamas",
  389: "Trinidad & Tobago",
  390: "USA",
  752: "Albania",
  753: "Andorra",
  754: "Armenia",
  755: "Austria",
  756: "Azerbaijan",
  757: "Belgium",
  758: "Belarus",
  759: "Bosnia & Herzegovina",
  760: "Bulgaria",
  761: "Croatia",
  762: "Cyprus",
  763: "Czechia",
  764: "Denmark",
  765: "England",
  766: "Estonia",
  767: "Faroe Islands",
  768: "Finland",
  769: "France",
  770: "Georgia",
  771: "Germany",
  772: "Greece",
  773: "Hungary",
  774: "Iceland",
  775: "Israel",
  776: "Italy",
  777: "Latvia",
  778: "Liechtenstein",
  779: "Lithuania",
  780: "Luxembourg",
  781: "North Macedonia",
  782: "Malta",
  783: "Moldova",
  784: "Netherlands",
  785: "Northern Ireland",
  786: "Norway",
  787: "Poland",
  788: "Portugal",
  789: "Republic of Ireland",
  790: "Romania",
  791: "Russia",
  792: "San Marino",
  793: "Scotland",
  794: "Slovakia",
  795: "Slovenia",
  796: "Spain",
  797: "Sweden",
  798: "Switzerland",
  799: "Turkey",
  800: "Ukraine",
  801: "Wales",
  802: "Serbia",
  1435: "Australia",
  1436: "Cook Islands",
  1437: "Fiji",
  1438: "New Zealand",
  1439: "Papua New Guinea",
  1440: "Solomon Islands",
  1441: "Tahiti",
  1442: "Tonga",
  1443: "Vanuatu",
  1444: "Samoa",
  1649: "Argentina",
  1650: "Bolivia",
  1651: "Brazil",
  1652: "Chile",
  1653: "Colombia",
  1654: "Ecuador",
  1655: "Paraguay",
  1656: "Peru",
  1657: "Uruguay",
  1658: "Venezuela",
  1662: "Palestine",
  129505: "Mongolia",
  129508: "Guam",
  129511: "Eritrea",
  131012: "Bhutan",
  142527: "Dominican Republic",
  214394: "Gibraltar",
  217945: "Kosovo",
  918745: "New Caledonia",
  13113220: "South Sudan",
  62002127: "Montenegro",
};

export type FmSaveProgressCallback = (stage: string, pct: number) => void;

export interface FmSaveClubEntry {
  uid: number;
  name: string;
  shortName: string;
  nation: string;
  playerCount: number;
  staffCount: number;
  isHumanControlled: boolean;
}

export interface ParsedFmSave {
  saveName: string;
  gameVersion: string;
  gameDate: string;
  humanClubUid: number | null;
  clubs: FmSaveClubEntry[];
  playersByClub: Record<number, Player[]>;
  staffByClub: Record<number, StaffMember[]>;
  worldWonderkids: Wonderkid[];
  worldStaffPool: StaffMember[];
  stats: {
    totalClubs: number;
    totalPlayers: number;
    totalStaff: number;
    u21Count: number;
  };
}

export interface ParseFmSaveOptions {
  maxWonderkids?: number;
  maxStaffPool?: number;
}

/**
 * Converts a stored FM26/FM27 raw attribute (0..125 internal scale) to the 1..20 display scale.
 * Matches `fmsave` display rounding: `min(20, max(1, floor((raw + 2) / 5)))`.
 */
export function scaleFmRawAttribute(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return Math.min(20, Math.max(1, Math.floor((raw + 2) / 5)));
}

function clamp1to20(val: number): number {
  if (!Number.isFinite(val)) return 1;
  return Math.min(20, Math.max(1, Math.round(val)));
}

function readU16LE(buf: Uint8Array, offset: number): number {
  return buf[offset]! | (buf[offset + 1]! << 8);
}

function readI16LE(buf: Uint8Array, offset: number): number {
  const u = readU16LE(buf, offset);
  return u >= 0x8000 ? u - 0x10000 : u;
}

function readU32LE(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset]! |
      (buf[offset + 1]! << 8) |
      (buf[offset + 2]! << 16) |
      (buf[offset + 3]! << 24)) >>>
    0
  );
}

function readU64LE(buf: Uint8Array, offset: number): number {
  const lo = readU32LE(buf, offset);
  const hi = readU32LE(buf, offset + 4);
  return hi * 4294967296 + lo;
}

function startsWithBytes(
  buf: Uint8Array,
  offset: number,
  needle: Uint8Array,
): boolean {
  if (offset < 0 || offset + needle.length > buf.length) return false;
  for (let i = 0; i < needle.length; i++) {
    if (buf[offset + i] !== needle[i]) return false;
  }
  return true;
}

function findSequence(
  buf: Uint8Array,
  needle: Uint8Array,
  fromIndex = 0,
  endIndex = buf.length,
): number {
  const nLen = needle.length;
  if (nLen === 0) return Math.max(0, fromIndex);
  const limit = Math.min(endIndex, buf.length);
  const maxPos = limit - nLen;
  if (fromIndex > maxPos) return -1;
  const first = needle[0]!;
  let i = buf.indexOf(first, Math.max(0, fromIndex));
  while (i >= 0 && i <= maxPos) {
    let match = true;
    for (let j = 1; j < nLen; j++) {
      if (buf[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
    i = buf.indexOf(first, i + 1);
  }
  return -1;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

interface DecodedFmDate {
  year: number;
  month: number;
  day: number;
  iso: string;
}

function decodeFmDate(
  buf: Uint8Array,
  offset: number,
  requireZeroTimeSlot = false,
): DecodedFmDate | null {
  if (offset < 0 || offset + 4 > buf.length) return null;
  const raw = readU32LE(buf, offset);
  const packed = raw & 0xffff;
  const year = raw >>> 16;
  if (year < 1901 || year > 2200) return null;
  if (requireZeroTimeSlot && packed >>> 9 !== 0) return null;
  const dayOfYear = packed & 0x1ff;
  const maxDay = isLeapYear(year) ? 366 : 365;
  if (dayOfYear < 1 || dayOfYear > maxDay) return null;

  const d = new Date(Date.UTC(year, 0, dayOfYear));
  const m = d.getUTCMonth() + 1;
  const dom = d.getUTCDate();
  const iso = `${year}-${String(m).padStart(2, "0")}-${String(dom).padStart(2, "0")}`;
  return { year, month: m, day: dom, iso };
}

function computeAge(birth: DecodedFmDate, clock: DecodedFmDate): number {
  let age = clock.year - birth.year;
  if (
    clock.month < birth.month ||
    (clock.month === birth.month && clock.day < birth.day)
  ) {
    age -= 1;
  }
  return age;
}

interface DirectorySection {
  name: string;
  ext: string;
  relOffset: number;
  compSize: number;
  decompSize: number;
}

function parseContainerDirectory(buffer: Uint8Array): {
  saveName: string;
  sections: Map<string, DirectorySection>;
} {
  if (buffer.byteLength < HEADER_SIZE) {
    throw new Error(
      "File save .fm tidak valid atau kosong (ukuran kurang dari 26 byte header fmf.).",
    );
  }
  if (startsWithBytes(buffer, 0, AFE_ENCRYPTED_MAGIC)) {
    throw new Error(
      "File terenkripsi afe. terdeteksi: ini adalah file taktik .fmf, bukan file save karier .fm.",
    );
  }
  if (!startsWithBytes(buffer, 0, FM_CONTAINER_MAGIC)) {
    throw new Error(
      "Format file tidak dikenali: header biner Football Manager (\\x02\\x01fmf.) tidak ditemukan.",
    );
  }

  const relTrailer = readU64LE(buffer, TRAILER_POINTER_AT);
  const trailerOffset = TRAILER_POINTER_AT + relTrailer;
  if (
    !Number.isSafeInteger(trailerOffset) ||
    trailerOffset < HEADER_SIZE ||
    trailerOffset + TRAILER_MAGIC_SIZE >= buffer.byteLength ||
    !startsWithBytes(buffer, trailerOffset, FM_CONTAINER_MAGIC)
  ) {
    throw new Error(
      "File save .fm rusak atau terpotong: penunjuk direktori Zstandard tidak valid.",
    );
  }

  let dirBytes: Uint8Array;
  try {
    dirBytes = decompress(buffer.subarray(trailerOffset + TRAILER_MAGIC_SIZE));
  } catch {
    throw new Error(
      "Gagal mendekode direktori Zstandard pada file save .fm (file korup atau terpotong).",
    );
  }

  if (dirBytes.byteLength < 8) {
    throw new Error("Direktori internal file save .fm kosong atau rusak.");
  }

  const saveNameLen = readU32LE(dirBytes, 0);
  if (saveNameLen > 1024 || 8 + saveNameLen > dirBytes.byteLength) {
    throw new Error("Metadata nama karier pada file save .fm rusak.");
  }
  const saveName =
    saveNameLen > 0
      ? UTF8_DECODER.decode(dirBytes.subarray(4, 4 + saveNameLen)).trim()
      : "Career Save";

  const sections = new Map<string, DirectorySection>();
  let cursor = 8 + saveNameLen;
  while (cursor + 8 <= dirBytes.byteLength) {
    const nameLen = readU32LE(dirBytes, cursor);
    if (nameLen < 1 || nameLen > 256 || cursor + 12 + nameLen + 40 > dirBytes.byteLength) {
      break;
    }
    const name = ASCII_DECODER.decode(dirBytes.subarray(cursor + 4, cursor + 4 + nameLen));
    const extLen = readU32LE(dirBytes, cursor + 4 + nameLen);
    if (extLen !== 4) break;
    const ext = ASCII_DECODER.decode(
      dirBytes.subarray(cursor + 8 + nameLen, cursor + 12 + nameLen),
    );
    const metaAt = cursor + 12 + nameLen;
    const relOffset = readU64LE(dirBytes, metaAt);
    const compSize = readU64LE(dirBytes, metaAt + 8);
    const decompSize = readU64LE(dirBytes, metaAt + 16);
    sections.set(name, { name, ext, relOffset, compSize, decompSize });
    cursor = metaAt + 40;
  }

  return { saveName, sections };
}

function decompressSection(
  buffer: Uint8Array,
  sec: DirectorySection,
  label: string,
): Uint8Array {
  const start = HEADER_SIZE + sec.relOffset;
  const end = start + sec.compSize;
  if (start < HEADER_SIZE || end > buffer.byteLength || sec.compSize === 0) {
    throw new Error(`Bagian ${label} pada file save .fm terpotong di luar batas file.`);
  }
  try {
    return decompress(buffer.subarray(start, end));
  } catch {
    throw new Error(`Gagal dekompresi Zstandard pada bagian ${label}.`);
  }
}

const NATION_STEPS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 4, 0, 0],
  [2, 4, 0, 0],
  [4, 4, 0, 0],
  [2, 1, 4, 20],
  [0, 48, 0, 0],
  [4, 25, 0, 0],
  [4, 12, 0, 0],
  [4, 14, 0, 0],
  [0, 24, 0, 0],
  [1, 5, 0, 0],
  [4, 28, 0, 0],
  [4, 28, 0, 0],
  [4, 12, 0, 0],
  [0, 54, 0, 0],
];

function extractNationMap(gameDb: Uint8Array): Map<number, string> {
  const nationByRow = new Map<number, string>();
  const head = new Uint8Array([251, 0, 0, 0, 0, 0]);
  let idx = findSequence(gameDb, head, 0);
  while (idx >= 0) {
    let pos = idx + 5;
    let ok = true;
    const dbIds: number[] = [];
    for (let r = 0; r < 251; r++) {
      if (pos >= gameDb.length || gameDb[pos] !== 0) {
        ok = false;
        break;
      }
      pos += 1;
      for (const [countBytes, leadBytes, strCount, tailBytes] of NATION_STEPS) {
        let count = 1;
        if (countBytes === 1) {
          if (pos + 1 > gameDb.length) {
            ok = false;
            break;
          }
          count = gameDb[pos]!;
          pos += 1;
        } else if (countBytes === 2) {
          if (pos + 2 > gameDb.length) {
            ok = false;
            break;
          }
          count = readU16LE(gameDb, pos);
          pos += 2;
        } else if (countBytes === 4) {
          if (pos + 4 > gameDb.length) {
            ok = false;
            break;
          }
          count = readU32LE(gameDb, pos);
          pos += 4;
        }
        if (count > 100_000) {
          ok = false;
          break;
        }
        if (strCount === 0) {
          pos += count * (leadBytes + tailBytes);
        } else {
          for (let i = 0; i < count; i++) {
            pos += leadBytes;
            for (let s = 0; s < strCount; s++) {
              if (pos + 4 > gameDb.length) {
                ok = false;
                break;
              }
              const sLen = readU32LE(gameDb, pos);
              if (sLen > 1024 || pos + 4 + sLen > gameDb.length) {
                ok = false;
                break;
              }
              pos += 4 + sLen;
            }
            if (!ok) break;
            pos += tailBytes;
          }
        }
        if (!ok || pos > gameDb.length) {
          ok = false;
          break;
        }
      }
      if (!ok || pos + 12 > gameDb.length || readU32LE(gameDb, pos) !== r) {
        ok = false;
        break;
      }
      dbIds.push(readU32LE(gameDb, pos + 4));
      pos += 12;
    }
    if (ok && dbIds.length === 251) {
      for (let r = 0; r < 251; r++) {
        const dbId = dbIds[r]!;
        nationByRow.set(r, FM_NATION_DB_NAMES[dbId] ?? `Nation #${dbId}`);
      }
      return nationByRow;
    }
    idx = findSequence(gameDb, head, idx + 1);
  }
  return nationByRow;
}

interface NamePoolIndex {
  firstOffsets: Uint32Array;
  surnameOffsets: Uint32Array;
  commonOffsets: Uint32Array;
  endOffset: number;
  firstCache: Map<number, string>;
  surnameCache: Map<number, string>;
  commonCache: Map<number, string>;
}

function readNamePools(gameDb: Uint8Array): NamePoolIndex {
  const sigLead = new Uint8Array([0x55, 0xb5, 0x00, 0x00, 0x00]); // u32(46421) + byte(0)
  let hit = findSequence(gameDb, sigLead, 0);
  while (hit >= 0 && hit + 24 <= gameDb.length) {
    const w2 = readU32LE(gameDb, hit + 8);
    const w3 = readU32LE(gameDb, hit + 12);
    const w4 = readU32LE(gameDb, hit + 16);
    const w5 = readU32LE(gameDb, hit + 20);
    if (
      w5 === 0 &&
      w2 >= 1024 &&
      w2 % 1024 === 0 &&
      w2 <= 1024 * 1024 &&
      w3 === (w2 >>> 2) &&
      w4 === w2 * 2
    ) {
      let cursor = hit + 24;
      const pools: Uint32Array[] = [];
      let valid = true;
      for (let p = 0; p < 3; p++) {
        if (cursor + 4 > gameDb.length) {
          valid = false;
          break;
        }
        const count = readU32LE(gameDb, cursor);
        cursor += 4;
        if (count > 2_000_000 || cursor + count * 8 > gameDb.length) {
          valid = false;
          break;
        }
        const offsets = new Uint32Array(count);
        for (let i = 0; i < count; i++) {
          if (cursor + 8 > gameDb.length || readU32LE(gameDb, cursor) !== i) {
            valid = false;
            break;
          }
          const bLen = readU32LE(gameDb, cursor + 4);
          if (bLen > 1024 || cursor + 8 + bLen > gameDb.length) {
            valid = false;
            break;
          }
          offsets[i] = cursor + 4;
          cursor += 8 + bLen;
        }
        if (!valid) break;
        pools.push(offsets);
      }
      if (valid && pools.length === 3) {
        return {
          firstOffsets: pools[0]!,
          surnameOffsets: pools[1]!,
          commonOffsets: pools[2]!,
          endOffset: cursor,
          firstCache: new Map(),
          surnameCache: new Map(),
          commonCache: new Map(),
        };
      }
    }
    hit = findSequence(gameDb, sigLead, hit + 1);
  }
  throw new Error("Tabel nama pemain (NamePools) tidak ditemukan di dalam game_db.");
}

function lookupPoolString(
  gameDb: Uint8Array,
  offsets: Uint32Array,
  cache: Map<number, string>,
  id: number,
): string | null {
  if (id === MISSING_U32 || id >= offsets.length) return null;
  const cached = cache.get(id);
  if (cached !== undefined) return cached;
  const lenAt = offsets[id]!;
  const bLen = readU32LE(gameDb, lenAt);
  const text =
    bLen === 0 ? "" : UTF8_DECODER.decode(gameDb.subarray(lenAt + 4, lenAt + 4 + bLen)).trim();
  cache.set(id, text);
  return text;
}

interface RawClubSpan {
  clubIndex: number;
  uid: number;
  nationId: number | null;
  name: string;
  shortName: string;
  recordStart: number;
  recordEnd: number;
  teamListEnd: number | null;
  teamIds: number[];
  affiliateTeamIds: number[];
}

function isPrintableName(s: string): boolean {
  if (s.length === 0) return false;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) < 0x20) return false;
  }
  return true;
}

function decodeStrictUtf8(buf: Uint8Array, start: number, end: number): string | null {
  try {
    return STRICT_UTF8_DECODER.decode(buf.subarray(start, end));
  } catch {
    return null;
  }
}

const FOUR_FF = new Uint8Array([0xff, 0xff, 0xff, 0xff]);
const NULL_DATE_TRIPLE = new Uint8Array([
  0x01, 0x00, 0x6c, 0x07, 0x01, 0x00, 0x6c, 0x07, 0x01, 0x00, 0x6c, 0x07,
]);
const FLOAT_ONE = new Uint8Array([0x00, 0x00, 0x80, 0x3f]);

function tryParseTeamListAt(
  gameDb: Uint8Array,
  teamListStart: number,
  recordEnd: number,
): { teamIds: number[]; affiliateTeamIds: number[]; affiliateCountOffset: number } | null {
  let cursor = teamListStart + 37;
  for (const [entryBytes, leadByte] of [
    [25, 0x02],
    [12, 0x01],
  ] as const) {
    if (cursor >= recordEnd) return null;
    const count = gameDb[cursor]!;
    const entriesStart = cursor + 1;
    const entriesEnd = entriesStart + count * entryBytes;
    if (entriesEnd > recordEnd) return null;
    for (let pos = entriesStart; pos < entriesEnd; pos += entryBytes) {
      if (gameDb[pos] !== leadByte) return null;
    }
    cursor = entriesEnd;
  }

  const teamCountAt = cursor + 9;
  if (teamCountAt >= recordEnd) return null;
  const teamCount = gameDb[teamCountAt]!;
  if (teamCount < 1 || teamCount > 8) return null;
  const idsStart = teamCountAt + 1;
  const idsEnd = idsStart + teamCount * 4;
  if (idsEnd > recordEnd) return null;

  const teamIds: number[] = [];
  for (let pos = idsStart; pos < idsEnd; pos += 4) {
    const tid = readU32LE(gameDb, pos);
    if (tid < 1 || tid > 3_000_000) return null;
    teamIds.push(tid);
  }

  const affiliateCountOffset = idsEnd;
  const affiliateTeamIds: number[] = [];
  if (affiliateCountOffset < recordEnd) {
    const affCount = gameDb[affiliateCountOffset]!;
    if (affCount >= 1 && affCount <= 8 && affiliateCountOffset + 1 + affCount * 4 <= recordEnd) {
      let allValid = true;
      for (let i = 0; i < affCount; i++) {
        const atid = readU32LE(gameDb, affiliateCountOffset + 1 + i * 4);
        if (atid < 1 || atid > 3_000_000) {
          allValid = false;
          break;
        }
        affiliateTeamIds.push(atid);
      }
      if (!allValid) affiliateTeamIds.length = 0;
    }
  }

  return { teamIds, affiliateTeamIds, affiliateCountOffset };
}

function scanClubsAndTeams(
  gameDb: Uint8Array,
  searchLimit: number,
): {
  clubs: RawClubSpan[];
  clubByUid: Map<number, RawClubSpan>;
  teamToClubUid: Map<number, number>;
} {
  const rawClubs: RawClubSpan[] = [];
  const seenUids = new Set<number>();
  const seenClubIdx = new Set<number>();

  let hit = findSequence(gameDb, FOUR_FF, 17, searchLimit);
  let lastAcceptedStart = -1;
  while (hit >= 0) {
    const recStart = hit - 17;
    if (lastAcceptedStart >= 0 && recStart - lastAcceptedStart > 256 * 1024 && rawClubs.length > 50) {
      break;
    }
    if (recStart + 52 <= gameDb.length && gameDb[recStart + 12] === 0) {
      const storedUid = readU32LE(gameDb, recStart + 4);
      const uidCopy = readU32LE(gameDb, recStart + 8);
      if (storedUid === uidCopy && storedUid !== 0 && storedUid !== MISSING_U32) {
        const nation = readU32LE(gameDb, recStart + 13);
        const faNation = readU32LE(gameDb, recStart + 21);
        const nationCopy = readU32LE(gameDb, recStart + 25);
        const nationOk =
          (nation <= 999 || nation === MISSING_U32) &&
          faNation <= 999 &&
          (nationCopy === nation || nationCopy <= 999);

        if (nationOk) {
          const longLen = readU32LE(gameDb, recStart + 39);
          const shortLenAt = recStart + 43 + longLen;
          if (longLen >= 1 && longLen <= 255 && shortLenAt + 4 <= gameDb.length) {
            const shortLen = readU32LE(gameDb, shortLenAt);
            const shortEnd = shortLenAt + 4 + shortLen;
            if (shortLen >= 1 && shortLen <= 255 && shortEnd <= gameDb.length) {
              const longName = decodeStrictUtf8(gameDb, recStart + 43, shortLenAt);
              const shortName = decodeStrictUtf8(gameDb, shortLenAt + 4, shortEnd);
              if (
                longName !== null &&
                shortName !== null &&
                isPrintableName(longName) &&
                isPrintableName(shortName)
              ) {
                const clubIndex = readU32LE(gameDb, recStart) + 1;
                const uid = storedUid + 1;
                if (!seenUids.has(uid) && !seenClubIdx.has(clubIndex)) {
                  seenUids.add(uid);
                  seenClubIdx.add(clubIndex);
                  rawClubs.push({
                    clubIndex,
                    uid,
                    nationId: nation === MISSING_U32 ? null : nation,
                    name: longName.trim(),
                    shortName: shortName.trim(),
                    recordStart: recStart,
                    recordEnd: recStart,
                    teamListEnd: null,
                    teamIds: [],
                    affiliateTeamIds: [],
                  });
                  lastAcceptedStart = recStart;
                }
              }
            }
          }
        }
      }
    }
    hit = findSequence(gameDb, FOUR_FF, hit + 1, searchLimit);
  }

  const scanEnd =
    rawClubs.length > 0
      ? Math.min(searchLimit, rawClubs[rawClubs.length - 1]!.recordStart + 65536)
      : 0;

  const teamToClubUid = new Map<number, number>();
  const clubByUid = new Map<number, RawClubSpan>();

  for (let i = 0; i < rawClubs.length; i++) {
    const club = rawClubs[i]!;
    const recEnd = i + 1 < rawClubs.length ? rawClubs[i + 1]!.recordStart : scanEnd;
    club.recordEnd = recEnd;
    clubByUid.set(club.uid, club);

    let parsed = null;
    const tripleAt = findSequence(gameDb, NULL_DATE_TRIPLE, club.recordStart, recEnd);
    if (tripleAt >= 0) {
      parsed = tryParseTeamListAt(gameDb, tripleAt, recEnd);
    }
    if (!parsed) {
      let floatAt = findSequence(gameDb, FLOAT_ONE, club.recordStart + 40, recEnd);
      while (floatAt >= 0) {
        parsed = tryParseTeamListAt(gameDb, floatAt - 33, recEnd);
        if (parsed) break;
        floatAt = findSequence(gameDb, FLOAT_ONE, floatAt + 1, recEnd);
      }
    }
    if (parsed) {
      club.teamIds = parsed.teamIds;
      club.affiliateTeamIds = parsed.affiliateTeamIds;
      club.teamListEnd = parsed.affiliateCountOffset;
      for (const tid of parsed.teamIds) {
        if (!teamToClubUid.has(tid)) {
          teamToClubUid.set(tid, club.uid);
        }
      }
    }
  }

  // Link affiliate team IDs (B-teams / II-teams) to parent club if unclaimed or secondary
  for (const club of rawClubs) {
    for (const affTid of club.affiliateTeamIds) {
      if (!teamToClubUid.has(affTid)) {
        teamToClubUid.set(affTid, club.uid);
      }
    }
  }

  return { clubs: rawClubs, clubByUid, teamToClubUid };
}

interface DecodedPerson {
  name: string;
  age: number;
  nationId: number;
  adaptability: number;
  blockStart: number;
}

function decodePersonBlockInWindow(
  gameDb: Uint8Array,
  windowStart: number,
  windowEnd: number,
  isFm27: boolean,
  clock: DecodedFmDate,
  pools: NamePoolIndex,
): DecodedPerson | null {
  const zeroOffsetFromBirth = isFm27 ? 21 : 20;
  const dateZeroOffset = isFm27 ? 15 : 14;
  const nationOffset = isFm27 ? 14 : 13;
  const personalityOffset = isFm27 ? 22 : 21;

  const start = Math.max(0, windowStart + zeroOffsetFromBirth);
  const limit = Math.min(windowEnd, gameDb.length) - 9;

  let z = gameDb.indexOf(0, start);
  while (z >= 0 && z <= limit) {
    // Next 8 bytes must be personality values in 1..20
    let persOk = true;
    for (let k = 1; k <= 8; k++) {
      const pv = gameDb[z + k]!;
      if (pv < 1 || pv > 20) {
        persOk = false;
        break;
      }
    }
    if (!persOk) {
      z = gameDb.indexOf(0, z + 1);
      continue;
    }

    const birthAt = z - zeroOffsetFromBirth;
    if (birthAt < 27) {
      z = gameDb.indexOf(0, z + 1);
      continue;
    }

    // Check 7 zero bytes before personality
    let zerosOk = true;
    for (let k = 0; k < 7; k++) {
      if (gameDb[birthAt + dateZeroOffset + k] !== 0) {
        zerosOk = false;
        break;
      }
    }
    if (!zerosOk) {
      z = gameDb.indexOf(0, z + 1);
      continue;
    }

    const birth = decodeFmDate(gameDb, birthAt, true);
    if (!birth || birth.year > clock.year) {
      z = gameDb.indexOf(0, z + 1);
      continue;
    }

    // Legal name length right before birthAt
    let legalLen = -1;
    if (readU32LE(gameDb, birthAt - 4) === 0) {
      legalLen = 0;
    } else {
      for (let len = 2; len <= 80; len++) {
        const lenAt = birthAt - 4 - len;
        if (lenAt < 23) break;
        if (readU32LE(gameDb, lenAt) === len) {
          legalLen = len;
          break;
        }
      }
    }
    if (legalLen < 0) {
      z = gameDb.indexOf(0, z + 1);
      continue;
    }

    const blockStart = birthAt - 19 - legalLen;
    if (
      blockStart < 8 ||
      gameDb[blockStart + 4] !== 0 ||
      gameDb[blockStart + 9] !== 0 ||
      gameDb[blockStart + 14] !== 0
    ) {
      z = gameDb.indexOf(0, z + 1);
      continue;
    }

    const firstId = readU32LE(gameDb, blockStart);
    const surnameId = readU32LE(gameDb, blockStart + 5);
    const commonId = readU32LE(gameDb, blockStart + 10);
    const idLimit = 1 << 23;
    if (
      (firstId !== MISSING_U32 && firstId >= idLimit) ||
      (surnameId !== MISSING_U32 && surnameId >= idLimit) ||
      (commonId !== MISSING_U32 && commonId >= idLimit)
    ) {
      z = gameDb.indexOf(0, z + 1);
      continue;
    }

    const firstName = lookupPoolString(gameDb, pools.firstOffsets, pools.firstCache, firstId);
    const surname = lookupPoolString(gameDb, pools.surnameOffsets, pools.surnameCache, surnameId);
    const commonName = lookupPoolString(gameDb, pools.commonOffsets, pools.commonCache, commonId);

    let displayName = "";
    if (commonName && commonName.length > 0) {
      displayName = commonName;
    } else {
      const parts = [firstName, surname].filter((x): x is string => Boolean(x && x.length > 0));
      displayName = parts.join(" ");
    }
    if (!displayName && legalLen > 0) {
      displayName = UTF8_DECODER.decode(
        gameDb.subarray(blockStart + 19, blockStart + 19 + legalLen),
      ).trim();
    }
    if (!displayName) {
      z = gameDb.indexOf(0, z + 1);
      continue;
    }

    const age = computeAge(birth, clock);
    const nationId = readU16LE(gameDb, birthAt + nationOffset);
    const adaptability = gameDb[birthAt + personalityOffset]!;

    return {
      name: displayName,
      age,
      nationId,
      adaptability,
      blockStart,
    };
  }
  return null;
}

const CONTRACT_TAG = new Uint8Array([0x01, 0x00, 0x6c, 0x07]);

function resolvePaRange(pa: number, ca: number): PaRange {
  if (pa >= 175 || pa === -10) return "170-200";
  if (pa >= 165 || pa === -95 || pa === -9) return "160-190";
  if (pa >= 158 || pa === -85) return "155-185";
  if (pa >= 150 || pa === -8 || ca >= 135) return "150-180";
  return "145-175";
}

function estimatePaNumeric(pa: number, ca: number): number {
  if (pa > 0) return pa;
  if (pa === -10) return 185;
  if (pa === -95) return 175;
  if (pa === -9) return 165;
  if (pa === -85) return 158;
  if (pa === -8) return 150;
  if (pa === -75) return 142;
  if (pa === -7) return 135;
  return Math.max(ca, 130);
}

function resolveHumanClubUid(params: {
  summaryBytes: Uint8Array | null;
  saveName: string;
  firstHumanSelector: number | null;
  gameDb: Uint8Array;
  clubs: RawClubSpan[];
  teamToClubUid: Map<number, number>;
}): number | null {
  const { summaryBytes, saveName, firstHumanSelector, gameDb, clubs, teamToClubUid } = params;

  // Route 1: Direct summary link (`u32 shortNameLen` + `shortName` + `u32 clubUid`) in save_game_summary
  if (summaryBytes && summaryBytes.byteLength >= 16) {
    const encoder = new TextEncoder();
    for (const club of clubs) {
      const sb = encoder.encode(club.shortName);
      if (sb.length < 2 || sb.length > 120) continue;
      const needle = new Uint8Array(4 + sb.length + 4);
      const dv = new DataView(needle.buffer);
      dv.setUint32(0, sb.length, true);
      needle.set(sb, 4);
      dv.setUint32(4 + sb.length, club.uid, true);
      if (findSequence(summaryBytes, needle, 8) >= 0) {
        return club.uid;
      }
    }
  }

  // Route 2: Human manager contract chain record in game_db
  if (firstHumanSelector !== null) {
    const selNeedle = new Uint8Array(8);
    selNeedle.set(CONTRACT_TAG, 0);
    // Tag is 4 bytes; selector sits at tag + 5
    let hit = findSequence(gameDb, CONTRACT_TAG, 0);
    while (hit >= 0 && hit + 14 <= gameDb.length) {
      if (readU32LE(gameDb, hit + 5) === firstHumanSelector) {
        const teamId = readU32LE(gameDb, hit + 9);
        const clubUid = teamToClubUid.get(teamId);
        if (clubUid !== undefined) return clubUid;
      }
      hit = findSequence(gameDb, CONTRACT_TAG, hit + 4);
    }
  }

  // Route 3: Save name suffix ("Manager Name - Club Short Name")
  const dashIdx = saveName.lastIndexOf(" - ");
  if (dashIdx >= 0) {
    const clubHint = saveName.slice(dashIdx + 3).trim().toLowerCase();
    if (clubHint.length >= 2) {
      const exact = clubs.find(
        (c) =>
          c.shortName.toLowerCase() === clubHint || c.name.toLowerCase() === clubHint,
      );
      if (exact) return exact.uid;
    }
  }

  return null;
}

function mapStaffRoleFromJobAndRatings(params: {
  jobCode: number | null;
  gkRaw: number;
  fitnessRaw: number;
  physioRaw: number;
  jpaRaw: number;
  jppRaw: number;
  attRaw: number;
  defRaw: number;
  tacRaw: number;
  techRaw: number;
  wwy20: number;
  pmRaw: number;
  tkRaw: number;
}): StaffRole | null {
  const {
    jobCode,
    gkRaw,
    fitnessRaw,
    physioRaw,
    jpaRaw,
    jppRaw,
    attRaw,
    defRaw,
    tacRaw,
    techRaw,
    wwy20,
    pmRaw,
    tkRaw,
  } = params;

  // Exclude non-coaching club roles (board, medical, pure scouts, analysts)
  if (
    jobCode !== null &&
    (jobCode === 4 ||
      jobCode === 6 ||
      jobCode === 8 ||
      jobCode === 10 ||
      jobCode === 12 ||
      jobCode === 14 ||
      jobCode === 38 ||
      jobCode === 40 ||
      jobCode === 44 ||
      jobCode === 46 ||
      jobCode === 48 ||
      jobCode === 50 ||
      jobCode === 58 ||
      jobCode === 60 ||
      jobCode === 62 ||
      jobCode === 66 ||
      jobCode === 70 ||
      jobCode === 86 ||
      jobCode === 88)
  ) {
    return null;
  }

  if (jobCode === 16) return "Manager";
  if (jobCode === 20) return "Assistant Manager";
  if (jobCode === 26) return "Fitness Coach";
  if (jobCode === 34) return "Goalkeeping Coach";
  if (jobCode === 64) return "Head of Youth Development";
  if (jobCode === 2 || jobCode === 22) return "Coach";

  const bestCoachingRaw = Math.max(gkRaw, fitnessRaw, attRaw, defRaw, tacRaw, techRaw);
  // Skip unlabelled physios or pure scouts with negligible coaching ratings
  if (physioRaw >= 60 && bestCoachingRaw < 45) return null;
  if (jpaRaw >= 65 && jppRaw >= 65 && bestCoachingRaw < 40) return null;

  if (gkRaw >= 60 && gkRaw >= bestCoachingRaw - 5) return "Goalkeeping Coach";
  if (fitnessRaw >= 62 && fitnessRaw >= Math.max(attRaw, defRaw, tacRaw, techRaw) + 8) {
    return "Fitness Coach";
  }
  if (wwy20 >= 16 && jppRaw >= 65 && bestCoachingRaw >= 50) {
    return "Head of Youth Development";
  }
  if (pmRaw >= 65 && tkRaw >= 65 && bestCoachingRaw >= 55) {
    return "Assistant Manager";
  }
  return "Coach";
}

function scoreCoachBestCategory(attrs: StaffAttributes): number {
  const ddm = (attrs.determination + attrs.level_of_discipline + attrs.motivating) * 2;
  const scores = [
    attrs.defending * 6 + attrs.tactical * 3 + ddm,
    attrs.defending * 6 + attrs.technical * 3 + ddm,
    attrs.attacking * 6 + attrs.tactical * 3 + ddm,
    attrs.attacking * 6 + attrs.technical * 3 + ddm,
    attrs.mental * 6 + attrs.tactical * 3 + ddm,
    attrs.mental * 3 + attrs.technical * 6 + ddm,
    attrs.gk_shot_stopping * 9 + ddm,
    attrs.gk_handling * 6 + attrs.gk_distribution * 3 + ddm,
    attrs.fitness * 9 + ddm,
  ];
  return Math.max(...scores);
}

/**
 * Pure-TS Client-Side `.fm` Binary Save Parser (FM26 / FM27 Zstandard `fmf.` format).
 * Runs inside Web Worker or Node CLI without server uploads or native dependencies.
 */
export function parseFmSave(
  buffer: Uint8Array,
  onProgress?: FmSaveProgressCallback,
  options?: ParseFmSaveOptions,
): ParsedFmSave {
  const maxWonderkids = options?.maxWonderkids ?? 500;
  const maxStaffPool = options?.maxStaffPool ?? 200;

  onProgress?.("Membaca header & direktori save .fm...", 10);
  const { saveName, sections } = parseContainerDirectory(buffer);

  const dbSec = sections.get("game_db");
  if (!dbSec) {
    throw new Error(
      "Bagian database karier (game_db.dat) tidak ditemukan. Pastikan file yang dipilih adalah save karier .fm (bukan file taktik .fmf).",
    );
  }

  const summarySec = sections.get("save_game_summary");
  const gameInfoSec = sections.get("game_info");
  const humansSec = sections.get("humans");

  const summaryBytes = summarySec
    ? decompressSection(buffer, summarySec, "save_game_summary")
    : null;
  const gameInfoBytes = gameInfoSec
    ? decompressSection(buffer, gameInfoSec, "game_info")
    : null;
  const humansBytes = humansSec ? decompressSection(buffer, humansSec, "humans") : null;

  let gameVersion = "27.0.0";
  let isFm27 = true;
  if (summaryBytes) {
    const ascii = ASCII_DECODER.decode(summaryBytes);
    const m = ascii.match(/([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,4})\+([0-9]{1,10})/);
    if (m?.[0] && m[1]) {
      gameVersion = m[0];
      const major = Number(m[1]);
      if (major < 26) {
        throw new Error(
          `Versi Football Manager (${gameVersion}) tidak didukung. Hanya mendukung save FM26 dan FM27.`,
        );
      }
      isFm27 = major >= 27;
    }
  } else if (gameInfoBytes && gameInfoBytes.byteLength >= 8) {
    const schema = readU16LE(gameInfoBytes, 6);
    isFm27 = schema >= 47;
    gameVersion = isFm27 ? "27.0.0" : "26.3.2";
  }

  // Decode in-game clock date
  let clock: DecodedFmDate | null = null;
  if (gameInfoBytes && gameInfoBytes.byteLength >= 200) {
    const dbVerLen = readU32LE(gameInfoBytes, 8);
    if (dbVerLen <= 64) {
      const clockOffset = 12 + dbVerLen + (isFm27 ? 174 : 172);
      clock = decodeFmDate(gameInfoBytes, clockOffset, false);
    }
  }
  if (!clock && summaryBytes) {
    for (let pos = 8; pos + 4 <= summaryBytes.byteLength; pos++) {
      const cand = decodeFmDate(summaryBytes, pos, false);
      if (cand && cand.year >= 2023 && cand.year <= 2120) {
        clock = cand;
        break;
      }
    }
  }
  if (!clock) {
    clock = { year: 2026, month: 7, day: 1, iso: "2026-07-01" };
  }

  let firstHumanSelector: number | null = null;
  if (humansBytes && humansBytes.byteLength >= 14) {
    const humanCount = readU16LE(humansBytes, 8);
    const sel = readU32LE(humansBytes, 10);
    if (humanCount >= 1 && sel >= 1 && sel <= 0x0fffffff) {
      firstHumanSelector = sel;
    }
  }

  onProgress?.("Dekompresi Zstd...", 20);
  let gameDb: Uint8Array | null = decompressSection(buffer, dbSec, "game_db");
  if (gameDb.byteLength < 1024 || gameDb[0] !== 0x03 || gameDb[1] !== 0x01) {
    gameDb = null;
    throw new Error("Struktur biner game_db.dat tidak valid atau korup.");
  }

  onProgress?.("Mengekstrak klub, pemain & staf...", 42);
  const nationByRow = extractNationMap(gameDb);
  const namePools = readNamePools(gameDb);
  const { clubs: rawClubs, clubByUid, teamToClubUid } = scanClubsAndTeams(
    gameDb,
    namePools.endOffset,
  );

  if (rawClubs.length === 0) {
    gameDb = null;
    throw new Error("Tidak ada data klub yang berhasil diekstrak dari file save .fm.");
  }

  const humanClubUid = resolveHumanClubUid({
    summaryBytes,
    saveName,
    firstHumanSelector,
    gameDb,
    clubs: rawClubs,
    teamToClubUid,
  });

  // Scan all player records after NamePools
  const playerRecOffsets: number[] = [];
  const playerPindexSet = new Set<number>();
  const playerUidSet = new Set<number>();

  let pHit = findSequence(gameDb, CONTRACT_TAG, namePools.endOffset + 121);
  while (pHit >= 0) {
    const rec = pHit - 102;
    if (rec - 19 >= namePools.endOffset && rec + 122 <= gameDb.length) {
      const kind = gameDb[rec - 7]!;
      if (kind === 2 || kind === 3) {
        const uid = readU32LE(gameDb, rec - 15);
        const uidCopy = readU32LE(gameDb, rec - 11);
        if (
          uid !== 0 &&
          uid !== MISSING_U32 &&
          uidCopy !== 0 &&
          uidCopy !== MISSING_U32 &&
          (uid === uidCopy || uid >= ALLOCATED_UID_MINIMUM)
        ) {
          const ca = readU16LE(gameDb, rec);
          const pa = readI16LE(gameDb, rec + 2);
          const repBucket = gameDb[rec + 8]!;
          if (ca <= 255 && pa >= -10 && pa <= 255 && repBucket <= 200) {
            let ratingsOk = true;
            for (let r = 0; r < 15; r++) {
              const rv = gameDb[rec + 24 + r]!;
              if (rv < 1 || rv > 20) {
                ratingsOk = false;
                break;
              }
            }
            if (ratingsOk) {
              let attrsOk = true;
              for (let a = 0; a < 54; a++) {
                const av = gameDb[rec + 39 + a]!;
                if (av < 1 || av > 125) {
                  attrsOk = false;
                  break;
                }
              }
              if (attrsOk) {
                const pindex = readU32LE(gameDb, rec - 19);
                if (!playerUidSet.has(uid) && !playerPindexSet.has(pindex)) {
                  playerRecOffsets.push(rec);
                  playerPindexSet.add(pindex);
                  playerUidSet.add(uid);
                }
              }
            }
          }
        }
      }
    }
    pHit = findSequence(gameDb, CONTRACT_TAG, pHit + 4);
  }

  onProgress?.("Mengekstrak klub, pemain & staf...", 62);

  const playersByClub: Record<number, Player[]> = {};
  const wonderkidCandidates: Array<{ wk: Wonderkid; sortScore: number }> = [];
  let totalPlayers = 0;
  let u21Count = 0;

  for (let i = 0; i < playerRecOffsets.length; i++) {
    const rec = playerRecOffsets[i]!;
    const nextHeader =
      i + 1 < playerRecOffsets.length ? playerRecOffsets[i + 1]! - 19 : gameDb.length;
    const uid = readU32LE(gameDb, rec - 15);
    const caRaw = readU16LE(gameDb, rec);
    const paRaw = readI16LE(gameDb, rec + 2);
    const teamId = readU32LE(gameDb, rec + 16);
    const clubUid = teamToClubUid.get(teamId);
    const clubObj = clubUid !== undefined ? clubByUid.get(clubUid) : undefined;
    const transferValRaw = readU32LE(gameDb, rec + 93);

    const personWindowEnd = Math.min(nextHeader, rec + 8192);
    const person = decodePersonBlockInWindow(
      gameDb,
      rec + 100,
      personWindowEnd,
      isFm27,
      clock,
      namePools,
    );

    const isClubPlayer = clubObj !== undefined;
    const isU21 = person !== null && person.age >= 15 && person.age <= 21;
    if (!isClubPlayer && !isU21) continue;

    // Decode 14 positions
    const positions = {} as Record<PositionKey14, number>;
    const naturalPositions: PositionKey14[] = [];
    let bestPosKey: PositionKey14 = "MC";
    let bestPosVal = -1;
    for (let p = 0; p < 15; p++) {
      const code = BINARY_POSITION_CODES[p];
      if (!code) continue;
      const val = clamp1to20(gameDb[rec + 24 + p]!);
      positions[code] = val;
      if (val >= 15) naturalPositions.push(code);
      if (val > bestPosVal) {
        bestPosVal = val;
        bestPosKey = code;
      }
    }
    if (naturalPositions.length === 0) {
      naturalPositions.push(bestPosKey);
    }

    // Decode 49 attributes + leftFoot (idx 24) + rightFoot (idx 25)
    const attributes = {} as Record<AttributeName, number>;
    let attrIdx = 0;
    let attrSum = 0;
    let leftFoot = 10;
    let rightFoot = 10;
    for (let b = 0; b < 54; b++) {
      const rawByte = gameDb[rec + 39 + b]!;
      const scaled = scaleFmRawAttribute(rawByte);
      if (b === 24) {
        leftFoot = scaled;
        continue;
      }
      if (b === 25) {
        rightFoot = scaled;
        continue;
      }
      const attrName = BINARY_PLAYER_ATTRIBUTE_ORDER[attrIdx];
      attrIdx += 1;
      if (attrName) {
        attributes[attrName] = scaled;
        attrSum += scaled;
      }
    }
    for (const key of ALL_49_ATTRIBUTES) {
      if (attributes[key] === undefined) attributes[key] = 10;
    }

    const nationality =
      person !== null ? (nationByRow.get(person.nationId) ?? "International") : "International";
    const playerName = person?.name ?? `Player #${uid}`;
    const playerAge =
      person !== null && person.age >= 14 && person.age <= 50 ? person.age : undefined;
    const caClamped = Math.min(200, Math.max(0, caRaw));
    const paResolved = Math.min(200, Math.max(0, estimatePaNumeric(paRaw, caClamped)));

    if (isClubPlayer && clubObj) {
      const teamIdx = clubObj.teamIds.indexOf(teamId);
      const teamSlot =
        teamIdx === 0
          ? "First Team"
          : teamIdx === 1
            ? "U21 / Reserve"
            : teamIdx >= 2
              ? "U18 / Youth"
              : "Affiliate / B";
      const playerObj: Player = {
        uid,
        name: playerName,
        ...(playerAge !== undefined ? { age: playerAge } : {}),
        clubUid: clubObj.uid,
        clubName: clubObj.name,
        nationality,
        teamId,
        teamSlot,
        leftFoot,
        rightFoot,
        currentAbility: caClamped,
        potentialAbility: paResolved,
        attributes: attributes as PlayerAttributes,
        positions: positions as PositionFamiliarity,
      };
      let list = playersByClub[clubObj.uid];
      if (!list) {
        list = [];
        playersByClub[clubObj.uid] = list;
      }
      list.push(playerObj);
      totalPlayers += 1;
    }

    if (isU21 && person && person.name.length >= 2) {
      u21Count += 1;
      const avgAttr = attrSum / 49;
      const caEst = Math.max(
        80,
        Math.min(185, caClamped > 0 ? caClamped : Math.round(avgAttr * 7.5)),
      );
      const sortScore = caClamped * 1.35 + paResolved * 0.65 + avgAttr * 2.5;

      // Fast pre-filter: only materialize U-21s with competitive CA/PA
      if (caClamped >= 95 || paResolved >= 145 || avgAttr >= 11.2) {
        const preferredFoot: "Right" | "Left" | "Either" =
          leftFoot >= 15 && rightFoot >= 15
            ? "Either"
            : leftFoot > rightFoot
              ? "Left"
              : "Right";
        const estPrice =
          transferValRaw > 0 && transferValRaw !== TRANSFER_VALUE_PLACEHOLDER
            ? Math.round((transferValRaw / 1_000_000) * 10) / 10
            : Math.max(0.5, Math.round(Math.max(0.5, (caEst - 85) * 0.55) * 10) / 10);

        wonderkidCandidates.push({
          sortScore,
          wk: {
            uid,
            name: person.name,
            age: person.age,
            club: clubObj?.shortName || clubObj?.name || "Free Agent",
            nationality,
            positions: naturalPositions,
            preferredFoot,
            leftFoot,
            rightFoot,
            estimatedPriceEurM: estPrice,
            paRange: resolvePaRange(paRaw, caClamped),
            currentAbilityEstimate: caEst,
            attributes: attributes as PlayerAttributes,
            positionFamiliarity: positions as PositionFamiliarity,
            isCurated: false,
          },
        });
      }
    }
  }

  wonderkidCandidates.sort(
    (a, b) => b.sortScore - a.sortScore || a.wk.uid - b.wk.uid,
  );
  const worldWonderkids = wonderkidCandidates.slice(0, maxWonderkids).map((c) => c.wk);
  wonderkidCandidates.length = 0;

  onProgress?.("Mengekstrak klub, pemain & staf...", 82);

  // Build club staff list lookup (`personId -> clubUid`) from each club's 3 staff lists
  const listedClubByPersonId = new Map<number, number>();
  const listCountBytes = isFm27 ? 2 : 1;
  for (const club of rawClubs) {
    if (club.teamListEnd === null || club.teamListEnd >= club.recordEnd) continue;
    const affCount = gameDb[club.teamListEnd]!;
    let cursor = club.teamListEnd + 1 + affCount * 4;
    const lists: number[][] = [];
    let ok = true;
    for (let l = 0; l < 3; l++) {
      if (cursor + listCountBytes > club.recordEnd) {
        ok = false;
        break;
      }
      const cnt =
        listCountBytes === 1 ? gameDb[cursor]! : readU16LE(gameDb, cursor);
      cursor += listCountBytes;
      const end = cursor + cnt * 4;
      if (end > club.recordEnd) {
        ok = false;
        break;
      }
      const ids: number[] = [];
      for (let p = cursor; p < end; p += 4) {
        const val = readU32LE(gameDb, p);
        if (val !== 0 && val > 0xffffff) {
          ok = false;
          break;
        }
        if (val > 0) ids.push(val - 1);
      }
      if (!ok) break;
      lists.push(ids);
      cursor = end;
    }
    if (ok && lists.length === 3) {
      for (const list of lists) {
        for (const pid of list) {
          if (!playerPindexSet.has(pid) && !listedClubByPersonId.has(pid)) {
            listedClubByPersonId.set(pid, club.uid);
          }
        }
      }
    }
  }

  // Helper to validate a staff header + ability block at `header`
  const tryReadStaffHeaderAt = (
    buf: Uint8Array,
    header: number,
  ): { header: number; abilityAt: number; personId: number; uid: number } | null => {
    if (header < namePools.endOffset || header + 16 >= buf.length) return null;
    if (buf[header + 12] !== 1) return null;
    const uid = readU32LE(buf, header + 4);
    const uidCopy = readU32LE(buf, header + 8);
    const personId = readU32LE(buf, header);
    if (
      personId >= 0xffffff ||
      uid === 0 ||
      uid === MISSING_U32 ||
      uidCopy === 0 ||
      uidCopy === MISSING_U32 ||
      (uid !== uidCopy && uid < ALLOCATED_UID_MINIMUM) ||
      playerPindexSet.has(personId) ||
      playerUidSet.has(uid)
    ) {
      return null;
    }
    const entryCount = buf[header + 13]!;
    const abilityAt = header + 21 + 7 * entryCount;
    if (abilityAt + 66 > buf.length) return null;
    if (buf[abilityAt + 13] !== 12) return null;
    const ca = readU16LE(buf, abilityAt);
    const pa = readI16LE(buf, abilityAt + 2);
    if (ca < 1 || ca > 200 || pa < 1 || pa > 200) return null;
    for (let k = 0; k < 26; k++) {
      const bv = buf[abilityAt + 40 + k]!;
      if (bv < 1 || bv > 100) return null;
    }
    return { header, abilityAt, personId, uid };
  };

  const staffHeaders: Array<{ header: number; abilityAt: number; personId: number; uid: number }> =
    [];
  const seenStaffUids = new Set<number>();
  const seenStaffPids = new Set<number>();

  // Pass 1: Discover contracted & role-holding club staff via CONTRACT_TAG
  let cHit = findSequence(gameDb, CONTRACT_TAG, namePools.endOffset + 24);
  while (cHit >= 0) {
    if (cHit + 25 <= gameDb.length) {
      let candPid = -1;
      let validTeam = false;
      const sel1 = readU32LE(gameDb, cHit + 5);
      const tid1 = readU32LE(gameDb, cHit + 9);
      if (sel1 >= 1 && sel1 <= 0xffffff && teamToClubUid.has(tid1)) {
        candPid = sel1 - 1;
        validTeam = true;
      } else if (
        isFm27 &&
        cHit + 33 <= gameDb.length &&
        gameDb[cHit + 14] === 0x05 &&
        gameDb[cHit + 15] === 0x05
      ) {
        const sel2 = readU32LE(gameDb, cHit + 16);
        const tid2 = readU32LE(gameDb, cHit + 20);
        if (sel2 >= 1 && sel2 <= 0xffffff && teamToClubUid.has(tid2)) {
          candPid = sel2 - 1;
          validTeam = true;
        }
      }

      if (
        validTeam &&
        candPid >= 0 &&
        !playerPindexSet.has(candPid) &&
        !seenStaffPids.has(candPid)
      ) {
        const b0 = candPid & 0xff;
        const b1 = (candPid >>> 8) & 0xff;
        const b2 = (candPid >>> 16) & 0xff;
        const b3 = (candPid >>> 24) & 0xff;
        const minPos = Math.max(namePools.endOffset, cHit - 32_768);
        let h = gameDb.lastIndexOf(b0, cHit - 16);
        while (h >= minPos) {
          if (
            gameDb[h + 1] === b1 &&
            gameDb[h + 2] === b2 &&
            gameDb[h + 3] === b3 &&
            gameDb[h + 12] === 1
          ) {
            const parsedHeader = tryReadStaffHeaderAt(gameDb, h);
            if (parsedHeader && !seenStaffUids.has(parsedHeader.uid)) {
              seenStaffUids.add(parsedHeader.uid);
              seenStaffPids.add(parsedHeader.personId);
              staffHeaders.push(parsedHeader);
              break;
            }
          }
          if (h === 0) break;
          h = gameDb.lastIndexOf(b0, h - 1);
        }
      }
    }
    cHit = findSequence(gameDb, CONTRACT_TAG, cHit + 4);
  }

  // Pass 2: Scan free-agent / unlisted staff ability blocks via 4xFF trailer at ability + 66 & sentinel 12 at ability + 13
  let sHit = findSequence(gameDb, FOUR_FF, namePools.endOffset + 87);
  while (sHit >= 0) {
    const abilityAt = sHit - 66;
    if (abilityAt >= namePools.endOffset + 21 && gameDb[abilityAt + 13] === 12) {
      const p0 = gameDb[abilityAt + 14]!;
      const p1 = gameDb[abilityAt + 15]!;
      const ca = readU16LE(gameDb, abilityAt);
      const pa = readI16LE(gameDb, abilityAt + 2);
      if (
        p0 >= 1 &&
        p0 <= 20 &&
        p1 >= 1 &&
        p1 <= 20 &&
        ca >= 1 &&
        ca <= 200 &&
        pa >= 1 &&
        pa <= 200
      ) {
        let header = abilityAt - 21;
        let entryStart = header + 15;
        for (let count = 0; count < 256; count++) {
          if (header < namePools.endOffset) break;
          if (
            gameDb[header + 12] === 1 &&
            gameDb[header + 13] === count &&
            gameDb[entryStart - 1] === 0
          ) {
            const parsedHeader = tryReadStaffHeaderAt(gameDb, header);
            if (
              parsedHeader &&
              !seenStaffUids.has(parsedHeader.uid) &&
              !seenStaffPids.has(parsedHeader.personId)
            ) {
              seenStaffUids.add(parsedHeader.uid);
              seenStaffPids.add(parsedHeader.personId);
              staffHeaders.push(parsedHeader);
              break;
            }
          }
          entryStart -= 7;
          if (
            entryStart < 0 ||
            gameDb[entryStart] !== 0x01 ||
            gameDb[entryStart + 1] !== 0x05 ||
            gameDb[entryStart + 4] !== 0x05
          ) {
            break;
          }
          header -= 7;
        }
      }
    }
    sHit = findSequence(gameDb, FOUR_FF, sHit + 1);
  }

  // Merge player headers + staff headers so each staff object's window stops cleanly before the next person
  const allBoundaries = new Int32Array(playerRecOffsets.length + staffHeaders.length);
  let bIdx = 0;
  for (let i = 0; i < playerRecOffsets.length; i++) {
    allBoundaries[bIdx++] = playerRecOffsets[i]! - 19;
  }
  for (let i = 0; i < staffHeaders.length; i++) {
    allBoundaries[bIdx++] = staffHeaders[i]!.header;
  }
  allBoundaries.sort();

  const findNextBoundaryAfter = (pos: number): number => {
    let lo = 0;
    let hi = allBoundaries.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (allBoundaries[mid]! <= pos) lo = mid + 1;
      else hi = mid;
    }
    return lo < allBoundaries.length ? allBoundaries[lo]! : gameDb!.length;
  };

  staffHeaders.sort((a, b) => a.header - b.header);

  const staffByClub: Record<number, StaffMember[]> = {};
  const allStaffScored: Array<{ member: StaffMember; bestScore: number }> = [];
  let totalStaff = 0;

  for (let i = 0; i < staffHeaders.length; i++) {
    const item = staffHeaders[i]!;
    const nextBoundary = findNextBoundaryAfter(item.header);
    const objEnd = Math.min(nextBoundary, item.header + 32_768, gameDb.length);
    const selector = item.personId + 1;

    let clubUid: number | undefined = listedClubByPersonId.get(item.personId);
    let wageWeekly = 0;
    let jobCode: number | null = null;
    let lastTagAt: number | null = null;
    let hasAnyRoleEvidence = clubUid !== undefined;

    let tagAt = findSequence(gameDb, CONTRACT_TAG, item.header + 13, objEnd);
    while (tagAt >= 0) {
      // Contract record: selector at tagAt + 5, teamId at tagAt + 9, wage at tagAt + 17
      if (tagAt + 21 <= objEnd && readU32LE(gameDb, tagAt + 5) === selector) {
        const isOffer =
          isFm27 &&
          tagAt + 28 <= objEnd &&
          startsWithBytes(gameDb, tagAt + 24, CONTRACT_TAG);
        if (!isOffer) {
          hasAnyRoleEvidence = true;
          lastTagAt = tagAt;
          const tid = readU32LE(gameDb, tagAt + 9);
          const w = readU32LE(gameDb, tagAt + 17);
          const resolvedClub = teamToClubUid.get(tid);
          if (resolvedClub !== undefined) {
            clubUid = resolvedClub;
            wageWeekly = w;
            if (isFm27 && tagAt + 22 <= objEnd) {
              jobCode = gameDb[tagAt + 21]!;
            }
          }
        }
      } else if (
        isFm27 &&
        tagAt + 33 <= objEnd &&
        gameDb[tagAt + 14] === 0x05 &&
        gameDb[tagAt + 15] === 0x05 &&
        readU32LE(gameDb, tagAt + 16) === selector
      ) {
        hasAnyRoleEvidence = true;
        const tid = readU32LE(gameDb, tagAt + 20);
        const resolvedClub = teamToClubUid.get(tid);
        if (resolvedClub !== undefined) {
          clubUid = resolvedClub;
          jobCode = gameDb[tagAt + 32]!;
        }
      }
      tagAt = findSequence(gameDb, CONTRACT_TAG, tagAt + 4, objEnd);
    }

    const personStart = lastTagAt !== null ? lastTagAt + 60 : item.header + 12;
    const personEnd =
      lastTagAt !== null ? Math.min(objEnd, lastTagAt + 4096) : Math.min(objEnd, item.header + 20_000);
    let person = decodePersonBlockInWindow(
      gameDb,
      personStart,
      personEnd,
      isFm27,
      clock,
      namePools,
    );
    if (!person && lastTagAt !== null) {
      person = decodePersonBlockInWindow(
        gameDb,
        item.header + 12,
        Math.min(objEnd, item.header + 20_000),
        isFm27,
        clock,
        namePools,
      );
    }
    if (!person || person.age < 20 || person.age > 85) continue;

    const ab = item.abilityAt;
    const r4 = gameDb[ab + 4]!;
    const prefAt = ab + 14;
    const furAt = ab + 40;

    const gkRaw = gameDb[furAt + 1]!;
    const jpaRaw = gameDb[furAt + 2]!;
    const jppRaw = gameDb[furAt + 3]!;
    const pmRaw = gameDb[furAt + 4]!;
    const motRaw = gameDb[furAt + 5]!;
    const physioRaw = gameDb[furAt + 6]!;
    const tkRaw = gameDb[furAt + 7]!;
    const attRaw = gameDb[furAt + 8]!;
    const defRaw = gameDb[furAt + 9]!;
    const fitnessRaw = gameDb[furAt + 10]!;
    const possRaw = gameDb[furAt + 11]!;
    const techRaw = gameDb[furAt + 12]!;
    const tacRaw = gameDb[furAt + 13]!;

    const authority20 = clamp1to20(gameDb[prefAt + 4]!);
    const wwy20 = clamp1to20(gameDb[prefAt + 12]!);
    const detRaw = gameDb[prefAt + 13]!;

    const effectiveJobCode = jobCode ?? (r4 > 0 ? r4 : null);
    const role = mapStaffRoleFromJobAndRatings({
      jobCode: effectiveJobCode,
      gkRaw,
      fitnessRaw,
      physioRaw,
      jpaRaw,
      jppRaw,
      attRaw,
      defRaw,
      tacRaw,
      techRaw,
      wwy20,
      pmRaw,
      tkRaw,
    });
    if (!role) continue;

    const gkScaled = scaleFmRawAttribute(gkRaw);
    const techScaled = scaleFmRawAttribute(techRaw);
    const tacScaled = scaleFmRawAttribute(tacRaw);

    const staffAttrs: StaffAttributes = {
      attacking: scaleFmRawAttribute(attRaw),
      defending: scaleFmRawAttribute(defRaw),
      fitness: scaleFmRawAttribute(fitnessRaw),
      mental: scaleFmRawAttribute(possRaw),
      tactical: tacScaled,
      technical: techScaled,
      working_with_youngsters: wwy20,
      gk_shot_stopping: gkScaled,
      gk_handling: gkScaled,
      gk_distribution:
        gkScaled >= 12
          ? clamp1to20(Math.round(gkScaled * 0.75 + Math.max(techScaled, tacScaled) * 0.25))
          : gkScaled,
      determination: scaleFmRawAttribute(detRaw),
      level_of_discipline: authority20,
      motivating: scaleFmRawAttribute(motRaw),
      tactical_knowledge: scaleFmRawAttribute(tkRaw),
      judging_player_ability: scaleFmRawAttribute(jpaRaw),
      judging_player_potential: scaleFmRawAttribute(jppRaw),
    };

    const clubObj = clubUid !== undefined ? clubByUid.get(clubUid) : undefined;
    const isFreeAgent = clubObj === undefined && !hasAnyRoleEvidence && r4 !== 0;
    if (!clubObj && !isFreeAgent) continue;

    const bestScore = scoreCoachBestCategory(staffAttrs);
    const estWage =
      wageWeekly > 0
        ? wageWeekly
        : isFreeAgent
          ? Math.max(800, Math.round((bestScore - 110) * 45))
          : Math.max(1500, Math.round((bestScore - 100) * 65));

    const staffMember: StaffMember = {
      uid: item.uid,
      name: person.name,
      age: person.age,
      nationality: nationByRow.get(person.nationId) ?? "International",
      club: clubObj ? clubObj.shortName || clubObj.name : "Free Agent",
      isFreeAgent,
      preferredRole: role,
      wageEstimateEurWeekly: Math.max(0, estWage),
      attributes: staffAttrs,
    };

    if (clubObj) {
      let sList = staffByClub[clubObj.uid];
      if (!sList) {
        sList = [];
        staffByClub[clubObj.uid] = sList;
      }
      sList.push(staffMember);
      totalStaff += 1;
    }

    allStaffScored.push({ member: staffMember, bestScore });
  }

  // Release large decompressed gameDb buffer immediately so GC reclaims ~140-350 MB
  gameDb = null;

  // Build worldStaffPool (max 200: prioritize top free agents + top global coaches across roles)
  const freeAgents = allStaffScored
    .filter((s) => s.member.isFreeAgent)
    .sort((a, b) => b.bestScore - a.bestScore || a.member.uid - b.member.uid);
  const employed = allStaffScored
    .filter((s) => !s.member.isFreeAgent)
    .sort((a, b) => b.bestScore - a.bestScore || a.member.uid - b.member.uid);

  const pickedStaffUids = new Set<number>();
  const worldStaffPool: StaffMember[] = [];
  const pushStaff = (m: StaffMember) => {
    if (worldStaffPool.length >= maxStaffPool || pickedStaffUids.has(m.uid)) return;
    pickedStaffUids.add(m.uid);
    worldStaffPool.push(m);
  };

  const faTarget = Math.min(Math.floor(maxStaffPool * 0.5), freeAgents.length);
  for (let i = 0; i < faTarget; i++) pushStaff(freeAgents[i]!.member);
  // Ensure specialist GK & Fitness coaches are well represented in worldStaffPool
  for (const s of freeAgents) {
    if (
      s.member.preferredRole === "Goalkeeping Coach" ||
      s.member.preferredRole === "Fitness Coach"
    ) {
      if (
        worldStaffPool.filter((x) => x.preferredRole === s.member.preferredRole).length < 15
      ) {
        pushStaff(s.member);
      }
    }
  }
  for (const s of employed) {
    if (
      s.member.preferredRole === "Goalkeeping Coach" ||
      s.member.preferredRole === "Fitness Coach"
    ) {
      if (
        worldStaffPool.filter((x) => x.preferredRole === s.member.preferredRole).length < 25
      ) {
        pushStaff(s.member);
      }
    }
  }
  for (const s of employed) {
    if (worldStaffPool.length >= maxStaffPool) break;
    pushStaff(s.member);
  }
  for (const s of freeAgents) {
    if (worldStaffPool.length >= maxStaffPool) break;
    pushStaff(s.member);
  }
  allStaffScored.length = 0;

  // Build sorted club list (clubs with >= 11 players first, human club at top)
  const clubs: FmSaveClubEntry[] = rawClubs
    .map((c) => ({
      uid: c.uid,
      name: c.name,
      shortName: c.shortName,
      nation: c.nationId !== null ? (nationByRow.get(c.nationId) ?? "International") : "International",
      playerCount: playersByClub[c.uid]?.length ?? 0,
      staffCount: staffByClub[c.uid]?.length ?? 0,
      isHumanControlled: c.uid === humanClubUid,
    }))
    .filter((c) => c.playerCount > 0 || c.isHumanControlled)
    .sort(
      (a, b) =>
        Number(b.isHumanControlled) - Number(a.isHumanControlled) ||
        b.playerCount - a.playerCount ||
        a.name.localeCompare(b.name),
    );

  onProgress?.("Selesai mengekstrak data karier .fm", 100);

  return {
    saveName,
    gameVersion,
    gameDate: clock.iso,
    humanClubUid,
    clubs,
    playersByClub,
    staffByClub,
    worldWonderkids,
    worldStaffPool,
    stats: {
      totalClubs: clubs.length,
      totalPlayers,
      totalStaff,
      u21Count,
    },
  };
}
