# Binary `.fmf`, `.tac`, `details.aom`, `.tsc`, and `.slf` Specification

This document specifies the exact Little-Endian byte layout implemented in `packages/fm-codec/src/` for Football Manager 27 (`.fmf` archive v27.0).

---

## 1. Outer `.fmf` Archive Container (`fmf-archive.ts`)

### 1.1 Unencrypted `fmf.` Header (`9 bytes` + `8-byte TOC Offset`)
| Byte Offset | Size | Hex / Type | Description |
| :--- | :--- | :--- | :--- |
| `0x00` | `9` | `02 01 66 6D 66 2E 08 00 00` | Magic archive signature (`\x02\x01fmf.\x08\x00\x00`). |
| `0x09` | `8` | `uint64 LE` | Absolute byte offset to the repeated `ArchiveHeader` immediately preceding the compressed TOC directory stream. |
| `0x11..` | var | Zstd Frames | Concatenated Zstandard frames for each file member (`<title>.tac`, `image.img`, `_data/details.aom`). |
| `tocOffset` | `9` | `02 01 66 6D 66 2E 08 00 00` | Repeated 9-byte `ArchiveHeader` marker before the TOC frame. |
| `tocOffset+9` | var | Zstd Frame | Compressed TOC directory tree describing root files and `_data` subdirectory entries (name, extension, relative data offset from `0x11`, compressed size, uncompressed size, Unix timestamp). |

### 1.2 Encrypted `afe.` Header (`aes-ctr-decrypt.ts`)
When a game-saved archive begins with `02 01 61 66 65 2E 08 00 00` (`afe.`):
1. Immediately following the 9-byte `afe.` magic is a **40-byte inline encryption header**:
   - Bytes `[0..3]`: Version/flags (`uint32 LE`)
   - Bytes `[4..19]`: 16-byte `AES-128-CTR` key
   - Bytes `[20..35]`: 16-byte initial counter block (`iv`)
   - Bytes `[36..39]`: Trailer flags
2. Decrypt bytes `[49..EOF]` via Web Crypto `crypto.subtle.decrypt({ name: "AES-CTR", counter: iv, length: 64 }, key, ciphertext)`.
3. Prepend standard `02 01 66 6D 66 2E 08 00 00` and unpack normally.

### 1.3 Pure-TS Zstandard Raw Frame (`zstd-raw-frame.ts`)
Exports wrap payloads in valid RFC 8878 Zstandard frames with 4-byte Frame Content Size (`0xA0` descriptor) and uncompressed Raw Blocks (`Block_Type = 0`, 64 KB max chunk):
- Frame Header: `28 B5 2F FD` (Magic) + `A0` (`Single_Segment_Flag=1`, `FCS_Field_Size=4`) + `uint32 LE` uncompressed byte length.
- Each 64 KB chunk: 3-byte Little-Endian block header `(chunkLen << 3) | (isLastBlock ? 1 : 0)` (`Block_Type = 00b`), followed by raw payload bytes.
- Decoder Guard: `decompressZstdStream` enforces a strict **16 MiB (`16,777,216` bytes)** uncompressed ceiling and maximum TOC directory recursion depth of **8** to prevent zip-bomb / malformed archive DoS.

---

## 2. Dual-Phase Tactic Payload `.tac` (`tac-serializer.ts`)

| Section | Layout / Magic Bytes | Notes |
| :--- | :--- | :--- |
| **Outer `.tac` Header** | `03 01 63 61 74 2E 22 00` (`8 bytes`) | Reversed fourcc `"cat."` v`0x0022`. |
| **PlanHeader** | `22 44 00 1B 00 01 00 01` (`8 bytes`) | Dual-phase plan container version marker. |
| **Title** | `int32 LE` charCount + UTF-16LE bytes (or length-prefixed UTF-8 per codec helpers) | Tactic display title. |
| **Mentality** | `uint8` (`1..7`) | `1=Very Defensive`, `2=Defensive`, `3=Cautious`, `4=Balanced`, `5=Positive`, `6=Attacking`, `7=Very Attacking`. |
| **Team Instructions** | `12 bytes` (`96-bit` bitfield) | Bit `b` (`1..95`) sets `byte[b >> 3] |= (1 << (b & 7))`. Conflicting pairs in `PitchCatalog.Conflicts` must never coexist. |
| **Separator** | `FF 00 4C 4C 55 4E` (`6 bytes`) | `"LLUN"` null-object sentinel before player slots. |
| **11 Dual-Phase Slots** | Ordered by `PhaseOrder = [0x00, 0x01, 0x02, 0x03, 0x04, 0x09, 0x05, 0x06, 0x07, 0x08, 0x0A]` (`GK` always at index `0`) | Each slot writes **In-Possession** (`SlotHeader 44 00 02` + `uint32 Position.Mask` + `uint64 Role.Flags` + `uint64 PI bitfield` + `uint32 MarkingMask` + `uint64 ActiveRoleFlags`) followed by **Out-of-Possession**. |
| **Duty Bit Injection** | Applied to IP `ActiveRoleFlags` after clearing `~0x400E00000n` | `Defend = 0x200000`, `Support = 0x400000`, `Attack = 0x800000`. |
| **DefaultPreferences** | Fixed trailing preference block | Preserves set-piece & match-plan defaults expected by FM27's importer. |

---

## 3. Metadata `_data/details.aom` (`details-aom.ts`)

- **Magic Header (`8 bytes`):** `03 01 6D 6F 61 2E 04 00` (`"moa."`).
- **Handler String:**
  - Tactics: `"TACTICS_TYPE_HANDLER"`
  - Training Schedules: `"SCHEDULE_TYPE_HANDLER"`
  - Player Shortlists: `"PLAYER_SHORTLIST_TYPE_HANDLER"`
- **Fields:** Title, Description, Author, and a unique **10-byte random GUID** (`crypto.getRandomValues(new Uint8Array(10))`).

---

## 4. Training Schedule `.tsc` & Shortlist `.slf` (`schedule-codec.ts`)

### 4.1 Training Schedule (`.tsc` / `"cst."`)
- **Header (`14 bytes`):** `03 01 63 73 74 2E 03 00 05 01 00 00 00 01`.
- **7 Day Records (`Mon`..`Sun`):** Each day writes marker `0x04`, three `uint16 LE` 1-based session catalog indices (`s1`, `s2`, `extra`), and trailing byte `0x00`.
- **Footer:** Length-prefixed UTF-8 schedule name + `int64 LE (0)`.

### 4.2 Player Shortlist (`.slf` / `"fls."`)
- **Header (`13 bytes`):** `03 01 66 6C 73 2E 02 00 01 54 1B 40 00`.
- **Body:** Length-prefixed UTF-8 title + `int32 LE` deduplicated player count + `count` $\times$ `uint32 LE` FM player `Unique ID`s + trailing `0x00`.
