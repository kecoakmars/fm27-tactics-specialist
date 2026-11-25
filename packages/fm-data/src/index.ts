import {
  CoachingKnowledgeSchema,
  PatchManifestSchema,
  PitchCatalogSchema,
  RoleProfilesCatalogSchema,
  StaffFormulasCatalogSchema,
  StaffSeedCatalogSchema,
  TacticalStylesCatalogSchema,
  TrainingPresetsCatalogSchema,
  TrainingSessionsCatalogSchema,
  WonderkidsSeedCatalogSchema,
  type CoachingKnowledge,
  type PatchManifest,
  type PitchCatalog,
  type RoleProfilesCatalog,
  type StaffFormulasCatalog,
  type StaffSeedCatalog,
  type TacticalStylesCatalog,
  type TrainingPresetsCatalog,
  type TrainingSessionsCatalog,
  type WonderkidsSeedCatalog,
} from "@fm27/shared-types";
import {
  DEFAULT_PATCH_VERSION,
  getRawPatchBundle,
  listPatchVersions,
  migrateTacticToPatch,
  resolvePatchVersion,
  type PatchBundle,
} from "./patch-registry.js";

const validatedCache = new Map<string, PatchBundle>();

export function getPatchData(patchVersion?: string): PatchBundle {
  const ver = resolvePatchVersion(patchVersion);
  const cached = validatedCache.get(ver);
  if (cached) return cached;

  const raw = getRawPatchBundle(ver);
  const parsed: PatchBundle = {
    manifest: PatchManifestSchema.parse(raw.manifest),
    pitchCatalog: PitchCatalogSchema.parse(raw.pitchCatalog),
    coachingKnowledge: CoachingKnowledgeSchema.parse(raw.coachingKnowledge),
    roleProfiles: RoleProfilesCatalogSchema.parse(raw.roleProfiles),
    tacticalStyles: TacticalStylesCatalogSchema.parse(raw.tacticalStyles),
    trainingSessions: TrainingSessionsCatalogSchema.parse(raw.trainingSessions),
    trainingPresets: TrainingPresetsCatalogSchema.parse(raw.trainingPresets),
    staffFormulas: StaffFormulasCatalogSchema.parse(raw.staffFormulas),
    staffSeed: StaffSeedCatalogSchema.parse(raw.staffSeed),
    wonderkidsSeed: WonderkidsSeedCatalogSchema.parse(raw.wonderkidsSeed),
  };

  validatedCache.set(ver, parsed);
  return parsed;
}

export function getManifest(patchVersion?: string): PatchManifest {
  return getPatchData(patchVersion).manifest;
}

export function getPitchCatalog(patchVersion?: string): PitchCatalog {
  return getPatchData(patchVersion).pitchCatalog;
}

export function getCoachingKnowledge(patchVersion?: string): CoachingKnowledge {
  return getPatchData(patchVersion).coachingKnowledge;
}

export function getRoleProfiles(patchVersion?: string): RoleProfilesCatalog {
  return getPatchData(patchVersion).roleProfiles;
}

export function getTacticalStyles(patchVersion?: string): TacticalStylesCatalog {
  return getPatchData(patchVersion).tacticalStyles;
}

export function getTrainingSessions(patchVersion?: string): TrainingSessionsCatalog {
  return getPatchData(patchVersion).trainingSessions;
}

export function getTrainingPresets(patchVersion?: string): TrainingPresetsCatalog {
  return getPatchData(patchVersion).trainingPresets;
}

export function getStaffFormulas(patchVersion?: string): StaffFormulasCatalog {
  return getPatchData(patchVersion).staffFormulas;
}

export function getStaffSeed(patchVersion?: string): StaffSeedCatalog {
  return getPatchData(patchVersion).staffSeed;
}

export function getWonderkidsSeed(patchVersion?: string): WonderkidsSeedCatalog {
  return getPatchData(patchVersion).wonderkidsSeed;
}

export {
  DEFAULT_PATCH_VERSION,
  listPatchVersions,
  migrateTacticToPatch,
  resolvePatchVersion,
  type PatchBundle,
};
