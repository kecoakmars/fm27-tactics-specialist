# Long-Term Maintenance & Patch Update Workflow (SOP)

All game-specific data, formulas, and AI model identifiers are isolated from UI and engine logic so routine updates require minimal or zero code changes.

---

## 1. Supporting a New FM27 Game Patch (e.g. `v27.0` -> `v27.3`)

1. **Scaffold the new patch directory:**
   ```bash
   pnpm data:new-patch 27.3 --from 27.0
   ```
   This copies `packages/fm-data/versions/v27.0/` into `packages/fm-data/versions/v27.3/`, updates `manifest.json`, registers `"27.3"` in `packages/fm-data/src/patch-registry.ts`, and runs cross-file validation.
2. **Apply patch changes inside `packages/fm-data/versions/v27.3/*.json`:**
   - New or updated Role `Flags` / `Eligibility` / `Instructions` / `Conflicts` -> `pitch-catalog.json`
   - Role key attributes -> `role-profiles.json`
   - Style presets or dual-phase shapes -> `tactical-styles.json`
3. **Validate bitmasks, conflicts, and SHA-256 manifest integrity:**
   ```bash
   pnpm data:validate && pnpm test
   ```
4. **Promote default version (optional):** Update `DEFAULT_PATCH_VERSION` in `packages/fm-data/src/patch-registry.ts` once verified. Existing user tactics automatically migrate via `migrateTacticToPatch()`.

---

## 2. Updating Wonderkids & Free Agent Staff Databases

1. Edit `packages/fm-data/versions/v27.0/wonderkids-seed.json` or `staff-seed.json`.
2. Validate schema and uniqueness:
   ```bash
   pnpm data:validate
   ```
3. Upsert idempotently to Supabase (`wonderkids` table):
   ```bash
   SUPABASE_URL="https://<project>.supabase.co" \
   SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
   pnpm db:seed 27.0
   ```

---

## 3. Calibrating Staff Star Thresholds or Coaching Knowledge

- **Staff 0.5–5.0 Star Thresholds & Weights:** Edit `packages/fm-data/versions/v27.0/staff-formulas.json` (`ddmWeight`, `primaryWeights`, `secondaryWeights`, `thresholds`).
- **UEFA/FIFA Coaching Rules & Auto-Fixes:** Edit `packages/fm-data/versions/v27.0/coaching-knowledge.json` (`Rules`, `Adjustments`).
- Run `pnpm data:validate && pnpm test` to ensure all regression assertions in `tests/engine.spec.ts` and `tests/phase4-modules.spec.ts` pass.

---

## 4. Upgrading Gemini API Models

All Gemini model identifiers live in **one file**: `packages/ai-analyst/src/client.ts` (`AI_MODELS`):
- `TACTICAL_ADVISOR_DEFAULT` (`gemini-4-hydrogen`)
- `TACTICAL_ADVISOR_DEEP` (`gemini-4-neon`)
- `MICRO_TOOLTIP` (`gemini-3.5-flash-lite`)
- `COMMUNITY_DECISION` (`models/gemini-decision-1`)
- `SEMANTIC_EMBEDDING` (`gemini-embedding-2`)

> **Important:** Always retain `@google/genai >= 3.2.0` with `Interactions API v1` (`client.interactions.create`) and `Decisions API v1beta` (`aiBeta.decisions.create`). Never downgrade to `@google/generative-ai` or `generateContent`.

---

## 5. Emergency Rollback Procedure

1. **Patch Data Rollback:** Revert `DEFAULT_PATCH_VERSION` in `packages/fm-data/src/patch-registry.ts` to the previous validated patch string (e.g. `"27.0"`) and redeploy.
2. **Database Migration Rollback:** Every migration in `supabase/migrations/` uses `if not exists` / `create or replace`. To disable a misbehaving public feed item immediately without downtime, update `moderation_status = 'rejected'` in `public.community_tactics`.
3. **Pre-Release Technical Debt Audit:** Run `rg "shortcut:" packages/ apps/ scripts/` before every minor release to review documented Ponytail trade-offs.
