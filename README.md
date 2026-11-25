# FM27 Tactics Generator (Web-Native Platform)

Client-first, patch-ready web platform for **Football Manager 27** dual-phase tactical engineering, binary `.fmf` import/export, Hungarian squad optimization, 18-zone spatial analytics, AI coaching review, U-21 wonderkid scouting, staff workload optimization, 7x3 weekly training schedules, and zero-screenshot `.fmf` community sharing.

## Highlights

- **100% Pure-TypeScript Binary `.fmf` Codec (`@fm27/fm-codec`):** Round-trip `.fmf` / `.tac`, encrypted `afe.` (`AES-128-CTR`), training schedules (`.tsc`), and shortlists (`.slf`) directly in a browser Web Worker — plus 1-click sync to your local `Football Manager 27` folder (`File System Access API`).
- **Deterministic Tactical Engine (`@fm27/fm-engine`):** Full $O(n^2 m)$ Hungarian solver across 13 styles $\times$ 16 dual-phase shapes, UEFA/FIFA coaching review (`tanh` + auto-adjustments), 18-zone spatial density (Zone 14 & Half-Spaces), and `FM-View-Exporter (F9)` / `fmsave` CSV & HTML parsers.
- **Patch-Ready Registry (`@fm27/fm-data`):** Zero hardcoded roles or bitmasks in UI/engine code; scaffold new patches in one command via `pnpm data:new-patch`.
- **Gemini AI Analyst (`@fm27/ai-analyst`):** Multi-turn SSE Tactical Advisor (`Interactions API v1`: `gemini-4-hydrogen` / `gemini-4-neon`), zero-output-token gallery moderation (`Decisions API v1beta`: `gemini-decision-1`), and `gemini-embedding-2` natural-language search — with full offline deterministic fallbacks.

## Quick Start

```bash
git clone https://github.com/listiantohefiredfsen-debug/fm27-tactics-generator-specialist.git
cd fm27-tactics-generator-specialist
pnpm install
pnpm data:validate
pnpm test
pnpm dev
```

## Documentation

- [Architecture & ADRs](docs/ARCHITECTURE.md)
- [Binary `.fmf` / `.tac` / `details.aom` Specification](docs/BINARY_FMF_SPEC.md)
- [Patch Update & Maintenance Workflow](docs/MAINTENANCE_WORKFLOW.md)
- [Master Specification](MASTER_SPEC.md)
