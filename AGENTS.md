# AGENTS.md — Unified Project Rules for FM27 Tactics Generator

This repository follows a strict rule hierarchy so token-saving skills never degrade mathematical accuracy, binary fidelity, or safety.

## 1. Precedence Matrix (Strict Order)

1. **Priority #1 — `MASTER_SPEC.md` (Scope & Precision):**
   - Single Source of Truth for monorepo architecture, all 9 mandatory web features, deterministic `fm-engine` formulas, and byte-level `.fmf`/`.tac` `fm-codec` specifications.
   - **Never cut features, formulas, bitmasks, magic bytes, or Zod validations.**
2. **Priority #2 — `Ponytail` (`full` mode default — Implementation Discipline):**
   - Solve the complete requirement with the smallest clean diff.
   - Prefer native platform/browser primitives (`DataView`, `Uint8Array`, `BigInt`, Web Crypto API, SVG, native HTML inputs, `fetch`) over unnecessary dependencies or wrappers.
   - No speculative abstractions or unused configuration layers.
   - Document deliberate temporary compromises inline using: `// shortcut: <limit>, <when to upgrade>`.
   - **Every risky logic module** (`.fmf` binary codec, Zstd raw framer, Hungarian solver, fit/coaching math, parsers, auth/RLS) **must include unit tests**.
   - Run the **`ponytail-review`** checklist (correct, safe, holds under load, tested, fast, lean) at every phase verification gate.
3. **Priority #3 — `Caveman` (Skill-Only — Communication & Log Efficiency):**
   - Keep progress reports and phase summaries terse, factual, and free of filler; filter verbose test/build logs (`--reporter=dot` or decisive error lines).
   - **NEVER run `/caveman-compress` or any text-compression tool** on `MASTER_SPEC.md`, JSON catalogs (`packages/fm-data/**`), Zod schemas, SQL migrations, or binary format documentation.
   - **NEVER run a local HTTP proxy daemon** or mutate global OS network settings in Antigravity Web/Remote.
   - **Always switch to clear, full prose** for security warnings, destructive/irreversible actions, critical errors, and user questions.

## 2. Non-Negotiable Technical Invariants

- **Data Separated from Code:** Never hardcode FM27 roles, attributes, instruction bitmasks, tactical styles, training sessions, or staff formulas inside UI components or engine logic. Load all game data from `packages/fm-data/versions/<patch>/` validated via `@fm27/shared-types` Zod schemas.
- **Client-First Execution:** `fm-codec`, `fm-engine`, and 18-Zone Heatmap run 100% client-side (inside Web Worker `engine.worker.ts`) with offline graceful degradation when AI or Supabase is unavailable.
- **Gemini API Standard:** Exclusively use `@google/genai >= 3.2.0` on the server side (`Interactions API v1` with `gemini-4-hydrogen` / `gemini-4-neon` / `gemini-3.5-flash-lite`; `Decisions API v1beta` with `gemini-decision-1`; `gemini-embedding-2` for embeddings). Never use `@google/generative-ai`, `generateContent`, or legacy `gemini-2.5-*` / `gemini-2.0-*` / `gemini-1.5-*` models.
- **Strict TypeScript & Gates:** Keep `"strict": true` across all workspaces. Every phase must pass `pnpm data:validate`, `pnpm typecheck`, `pnpm lint`, and `pnpm test` before advancing.

## 3. Google Drive REA & Git Hygiene Guard

- **STRICTLY READ-ONLY:** Never create, modify, move, or delete any file in the linked Google Drive folder (`fm-tactic-generator-reference`, ID `1z2idN_LJqaw-GDZVOHaBrz0uUQlhaeo5`). Use `gdrive readonly ...` commands exclusively.
- **HARD-IGNORE:**
  - Never read or download `extracted-runtime/`.
  - Ignore `07-rea-evidence/` (only inspect a single specific file if a byte-level `.fmf` test fails in Phase 1).
  - Ignore `01-arsitektur-dan-runtime.md` & `README.md` unless a single quick lookup is strictly required.
- **Phase-Scoped Lazy Reading:**
  - Phase 0: `05-data-schemas/` (plus role/style definitions for `v27.0` catalog generation).
  - Phase 1: `03-format-biner-fmf-dan-save-reader.md`, `02-algoritma-inti-pembuatan-taktik.md`, and targeted files in `06-reconstructed-code/`.
  - Phase 4: `04-modul-pendukung-dan-fitur-sekunder.md` + ephemeral shallow clones in `/tmp/fm-refs/` (must be deleted before commit).
- **Anti-Leak Git Hygiene:** Never copy reconstructed C# files or raw REA dumps into the Git repository. Only clean Zod-validated JSON catalogs and original TypeScript source files may be committed.
