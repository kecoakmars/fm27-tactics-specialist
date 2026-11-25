// Auto-maintained by scripts/new-patch-version.mjs — static imports for Web Worker & SSR compatibility
import type {
  CoachingKnowledge,
  DualPhaseTactic,
  PatchManifest,
  PitchCatalog,
  RoleProfilesCatalog,
  StaffFormulasCatalog,
  StaffSeedCatalog,
  TacticalStylesCatalog,
  TrainingPresetsCatalog,
  TrainingSessionsCatalog,
  WonderkidsSeedCatalog,
} from "@fm27/shared-types";

import v27_0Manifest from "../versions/v27.0/manifest.json" with { type: "json" };
import v27_0PitchCatalog from "../versions/v27.0/pitch-catalog.json" with { type: "json" };
import v27_0CoachingKnowledge from "../versions/v27.0/coaching-knowledge.json" with { type: "json" };
import v27_0RoleProfiles from "../versions/v27.0/role-profiles.json" with { type: "json" };
import v27_0TacticalStyles from "../versions/v27.0/tactical-styles.json" with { type: "json" };
import v27_0TrainingSessions from "../versions/v27.0/training-sessions.json" with { type: "json" };
import v27_0TrainingPresets from "../versions/v27.0/training-presets.json" with { type: "json" };
import v27_0StaffFormulas from "../versions/v27.0/staff-formulas.json" with { type: "json" };
import v27_0StaffSeed from "../versions/v27.0/staff-seed.json" with { type: "json" };
import v27_0WonderkidsSeed from "../versions/v27.0/wonderkids-seed.json" with { type: "json" };

export interface PatchBundle {
  manifest: PatchManifest;
  pitchCatalog: PitchCatalog;
  coachingKnowledge: CoachingKnowledge;
  roleProfiles: RoleProfilesCatalog;
  tacticalStyles: TacticalStylesCatalog;
  trainingSessions: TrainingSessionsCatalog;
  trainingPresets: TrainingPresetsCatalog;
  staffFormulas: StaffFormulasCatalog;
  staffSeed: StaffSeedCatalog;
  wonderkidsSeed: WonderkidsSeedCatalog;
}

export const DEFAULT_PATCH_VERSION = "27.0";

const RAW_BUNDLES: Record<string, unknown> = {
  "27.0": {
    manifest: v27_0Manifest,
    pitchCatalog: v27_0PitchCatalog,
    coachingKnowledge: v27_0CoachingKnowledge,
    roleProfiles: v27_0RoleProfiles,
    tacticalStyles: v27_0TacticalStyles,
    trainingSessions: v27_0TrainingSessions,
    trainingPresets: v27_0TrainingPresets,
    staffFormulas: v27_0StaffFormulas,
    staffSeed: v27_0StaffSeed,
    wonderkidsSeed: v27_0WonderkidsSeed,
  },
};

export function listPatchVersions(): string[] {
  return Object.keys(RAW_BUNDLES);
}

export function resolvePatchVersion(requested?: string): string {
  if (requested && requested in RAW_BUNDLES) {
    return requested;
  }
  return DEFAULT_PATCH_VERSION;
}

export function getRawPatchBundle(requested?: string): PatchBundle {
  const ver = resolvePatchVersion(requested);
  return RAW_BUNDLES[ver] as PatchBundle;
}

export function migrateTacticToPatch(
  tactic: DualPhaseTactic,
  targetPatchVersion?: string,
): DualPhaseTactic {
  const resolved = resolvePatchVersion(targetPatchVersion);
  if (tactic.patchVersion === resolved) return tactic;
  const bundle = getRawPatchBundle(resolved);
  const validRoleIds = new Set(bundle.pitchCatalog.Roles.map((r) => r.Id));

  return {
    ...tactic,
    patchVersion: resolved,
    slots: tactic.slots.map((slot) => ({
      ...slot,
      inPossession: {
        ...slot.inPossession,
        roleId: validRoleIds.has(slot.inPossession.roleId)
          ? slot.inPossession.roleId
          : slot.inPossession.positionId === "GK"
            ? "Goalkeeper"
            : "CentralMidfielder",
      },
      outOfPossession: {
        ...slot.outOfPossession,
        roleId: validRoleIds.has(slot.outOfPossession.roleId)
          ? slot.outOfPossession.roleId
          : slot.outOfPossession.positionId === "GK"
            ? "OPGoalkeeper"
            : "OPCentralMidfielder",
      },
    })),
  };
}
