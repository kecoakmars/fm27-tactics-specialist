# FM27 Tactics Studio (Dual-Phase Web Platform)

Browser-based tactical companion for **Football Manager 27**: load your `.fm` career save or `.fmf` tactic directly in the browser (zero server upload), get instant dual-phase (`In Possession` & `Out of Possession`) formation and role recommendations tailored to your squad, audit your players, optimize coaching staff & 7×3 training schedules, scout live U-21 wonderkids from your save world, and download ready-to-use `.fmf` files.

## Highlights

- **100% Client-Side `.fm` Career Save & `.fmf` Binary Codec (`@fm27/fm-codec`):** Parses 50–400 MB `.fm` Zstandard career saves locally in a standalone Web Worker (`fm-save-worker.js`) and round-trips `.fmf` tactics (`.tac`), training schedules (`.tsc`), and shortlists (`.slf`) — plus optional 1-click sync to your local `Football Manager 27` folder (`File System Access API`).
- **REA-Calibrated Deterministic Tactical Engine (`@fm27/fm-engine`):** Evaluates `13 Tactical Styles × 16 Dual-Phase Shapes`, isolates `First Team` vs `U21`/`U18`, matches Starting XI + 1-to-1 bench depth via Hungarian optimization, respects dominant foot sides & FM27 role eligibility, and maps 18-zone spatial pitch coverage with a dynamic color legend.
- **100% Live Save Data & Bilingual UI (`ID | EN`):** Zero fake/sample player leakage — Squad, Staff Stars, and U-21 Wonderkids reflect the real clubs, regens, and transfer world inside your `.fm` save, with instant Indonesian / English switching while preserving authentic in-game FM27 role & style names.
- **Patch-Ready Registry (`@fm27/fm-data`):** Data-driven FM27 `v27.0` catalog validated via `pnpm data:validate`; scaffold new patches with `pnpm data:new-patch`.

## Quick Start

```bash
git clone https://github.com/kecoakmars/fm27-tactics-specialist.git
cd fm27-tactics-specialist
pnpm install
pnpm data:validate
pnpm test
pnpm dev
```

## Documentation

- [Session Handoff & Volunteer Testing Guide](HANDOFF.md)
- [Architecture & ADRs](docs/ARCHITECTURE.md)
- [Binary `.fmf` / `.tac` / `details.aom` Specification](docs/BINARY_FMF_SPEC.md)
- [Patch Update & Maintenance Workflow](docs/MAINTENANCE_WORKFLOW.md)
- [Master Specification](MASTER_SPEC.md)
