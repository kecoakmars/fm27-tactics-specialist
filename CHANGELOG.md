# Changelog

All notable changes to **FM27 Tactics Generator** are documented in this file following [Conventional Commits](https://www.conventionalcommits.org/).

## [1.1.0] - 2026-11-26

### Added & Improved
- **Client-Side `.fm` Career Save Analyzer (`@fm27/fm-codec`, `@fm27/web`):**
  - Standalone browser Web Worker (`fm-save-worker.js`) with `PING/PONG` handshake, CDN Blob Worker fallback, `Transferable ArrayBuffer`, and cancellation support for 50–400 MB `.fm` career saves without uploading files to any server.
  - Automatic club roster separation (`First Team`, `U21 / Reserve`, `U18 / Youth`), 8 hidden personality attribute extraction, **500 Live U-21 Wonderkids**, and **200 Live Coaching Staff / Free Agents** directly from the active career save (`0%` static sample data leakage in UI).
- **REA-Calibrated Tactical & Role Recommendation Overhaul (`@fm27/fm-engine`):**
  - Curated solver candidate roles (`getSolverCandidateRolesForSlot`), capped OOP `Outlet` roles, 1-to-1 non-cloned bench cover matching, senior ability & accomplished familiarity compensation, dominant-foot central pairing (`DCL/DCR`, `DML/DMR`, `MCL/MCR`), and squad-aware `13 Styles × 16 Shapes` ranking.
- **Unified Cross-Page Workflow, `ID | EN` Localization & FM-Player UI Simplification (`@fm27/web`):**
  - Universal `.fm` / `.fmf` importer (`importAnySupportedFile`) in `TopNavShell` that automatically syncs Tactic Board, Squad Audit, 7×3 Weekly Training, Coaching Staff, and Wonderkid targets in one step.
  - Instant `ID | EN` language switcher (`useLocaleStore`), football-native copywriting (stripped developer jargon/formulas and intermediate JSON/CSV/HTML clutter), repaired 1-click **Optimize Roles** on `/squad`, and compact **Pitch Color Legend** beneath the dual-phase pitch.

## [1.0.0] - 2026-11-25

### Added
- **Phase 0 (`@fm27/shared-types`, `@fm27/fm-data`, `scripts/`):**
  - Full Zod schema registry and cross-file validator (`pnpm data:validate`), patch scaffolder (`pnpm data:new-patch`), and Supabase idempotent seeder (`pnpm db:seed`).
  - Complete `v27.0` game data registry: 24 pitch positions, 79 IP/OOP roles with 64-bit `Flags`, 29 TI groups, 17 PI groups, 7 conflict pairs, 23 UEFA/FIFA/SI coaching sources, 13 tactical styles, 16 dual-phase `StyleShapes`, 28 training sessions, 4 weekly schedule presets, 10-category staff star formulas, 42 curated staff, and 189 U-21 wonderkids.
- **Phase 1 (`@fm27/fm-codec`, `@fm27/fm-engine`):**
  - Pure-TypeScript binary `.fmf` / `.tac` / `_data/details.aom` / `.tsc` / `.slf` codec with Zstandard Raw Block framing (`0xA0`), Web Crypto `AES-128-CTR` (`afe.`) decryption, `.fm27.json` v1, and `lz-string` `#t=` URL sharing.
  - Deterministic engine: raw `0-125 -> 1-20` normalizer, `selectBestRole`, dual-phase `computeSlotFit`, $O(n^2 m)$ Hungarian solver with `+10000` lineup locks, `refineAssignment`, `reviewCoachingKnowledge` (`tanh` + auto-adjustments + `ScoreInstructionDemands`), 18-zone spatial heatmap, and 6-pillar balance scorer.
- **Phase 2 (`@fm27/web` Core Board):**
  - Dual-Phase SVG Pitch Board (`In-Possession`, `Out-of-Possession`, synchronized `Split View` with transition vectors), real-time formation detector, Mentality/TI/PI editors, `zundo` Undo/Redo, Web Worker execution (`engine.worker.ts`), and File System Access API local FM27 folder sync (`/tactics/`, `/schedules/`, `/shortlists/`).
- **Phase 3 (`@fm27/ai-analyst` & Spatial Analytics):**
  - 18-Zone Heatmap pitch overlay (Zone 14 & Half-Spaces), 6-Pillar Radar, Coaching Findings auto-fix cards, and `@google/genai` SSE Tactical Advisor (`Interactions API v1`, `gemini-4-hydrogen` / `gemini-4-neon`, `previous_interaction_id`).
- **Phase 4 (Supporting Club Modules):**
  - `/squad` Audit & Hungarian Best-Tactic Generator + `FM-View-Exporter (F9)` & `fmsave` CSV/HTML parsers, `/wonderkids` ValueRatio & 7d Trending Scout, `/staff` 10-Category Star Calculator & Workload Optimizer, and `/training` 7x3 Drag-and-Drop Weekly Schedule Builder.
- **Phase 5 (Community Hub & Supabase):**
  - Supabase SQL migrations (`0001`–`0003`) with `pgvector` HNSW index, strict RLS, atomic interaction triggers, and `weekly_trending_wonderkids` 7-day weighted time-decay materialized view.
  - Zero-screenshot `.fmf` uploader with automatic Dual-Phase SVG previews, `gemini-decision-1` (`v1beta`) safety/playstyle/quality moderation, and `gemini-embedding-2` semantic search.
- **Phase 6 (CI/CD, Documentation & Production Hardening):**
  - GitHub Actions pipelines (`ci.yml`, `data-validation.yml`, `sync-trending.yml`), `docs/ARCHITECTURE.md`, `docs/BINARY_FMF_SPEC.md`, `docs/MAINTENANCE_WORKFLOW.md`, and App Router error boundaries.
