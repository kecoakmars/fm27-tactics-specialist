#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const VERSIONS_DIR = path.join(REPO_ROOT, "packages/fm-data/versions");
const REGISTRY_FILE = path.join(REPO_ROOT, "packages/fm-data/src/patch-registry.ts");

function sha256Hex(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function sanitizeIdentifier(version) {
  return `v${version.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

function generatePatchRegistrySource(versions, defaultVersion) {
  const imports = [];
  const entries = [];

  for (const ver of versions) {
    const id = sanitizeIdentifier(ver);
    const folder = `v${ver}`;
    imports.push(
      `import ${id}Manifest from "../versions/${folder}/manifest.json" with { type: "json" };`,
      `import ${id}PitchCatalog from "../versions/${folder}/pitch-catalog.json" with { type: "json" };`,
      `import ${id}CoachingKnowledge from "../versions/${folder}/coaching-knowledge.json" with { type: "json" };`,
      `import ${id}RoleProfiles from "../versions/${folder}/role-profiles.json" with { type: "json" };`,
      `import ${id}TacticalStyles from "../versions/${folder}/tactical-styles.json" with { type: "json" };`,
      `import ${id}TrainingSessions from "../versions/${folder}/training-sessions.json" with { type: "json" };`,
      `import ${id}TrainingPresets from "../versions/${folder}/training-presets.json" with { type: "json" };`,
      `import ${id}StaffFormulas from "../versions/${folder}/staff-formulas.json" with { type: "json" };`,
      `import ${id}StaffSeed from "../versions/${folder}/staff-seed.json" with { type: "json" };`,
      `import ${id}WonderkidsSeed from "../versions/${folder}/wonderkids-seed.json" with { type: "json" };`,
    );

    entries.push(`  "${ver}": {
    manifest: ${id}Manifest,
    pitchCatalog: ${id}PitchCatalog,
    coachingKnowledge: ${id}CoachingKnowledge,
    roleProfiles: ${id}RoleProfiles,
    tacticalStyles: ${id}TacticalStyles,
    trainingSessions: ${id}TrainingSessions,
    trainingPresets: ${id}TrainingPresets,
    staffFormulas: ${id}StaffFormulas,
    staffSeed: ${id}StaffSeed,
    wonderkidsSeed: ${id}WonderkidsSeed,
  }`);
  }

  return `// Auto-maintained by scripts/new-patch-version.mjs — static imports for Web Worker & SSR compatibility
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

${imports.join("\n")}

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

export const DEFAULT_PATCH_VERSION = "${defaultVersion}";

const RAW_BUNDLES: Record<string, unknown> = {
${entries.join(",\n")}
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
`;
}

function main() {
  const argv = process.argv.slice(2);
  const newVersion = argv[0]?.replace(/^v/, "");
  let fromVersion = "27.0";
  let setDefault = false;

  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--from" && argv[i + 1]) {
      fromVersion = argv[++i].replace(/^v/, "");
    } else if (argv[i] === "--set-default") {
      setDefault = true;
    }
  }

  if (!newVersion || !/^\d+\.\d+(\.\d+)?$/.test(newVersion)) {
    console.error("Usage: pnpm data:new-patch <newVersion> [--from 27.0] [--set-default]");
    process.exit(1);
  }

  const srcDir = path.join(VERSIONS_DIR, `v${fromVersion}`);
  const destDir = path.join(VERSIONS_DIR, `v${newVersion}`);

  if (!fs.existsSync(srcDir)) {
    throw new Error(`Source patch folder not found: ${srcDir}`);
  }
  if (fs.existsSync(destDir)) {
    throw new Error(`Target patch folder already exists: ${destDir}`);
  }

  fs.mkdirSync(destDir, { recursive: true });
  const checksums = {};
  for (const fileName of fs.readdirSync(srcDir)) {
    if (!fileName.endsWith(".json") || fileName === "manifest.json") continue;
    const raw = fs.readFileSync(path.join(srcDir, fileName), "utf8");
    fs.writeFileSync(path.join(destDir, fileName), raw, "utf8");
    checksums[fileName] = sha256Hex(raw);
  }

  const baseManifest = JSON.parse(fs.readFileSync(path.join(srcDir, "manifest.json"), "utf8"));
  const nextManifest = {
    ...baseManifest,
    patchVersion: newVersion,
    releasedAt: new Date().toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    checksums,
  };
  fs.writeFileSync(
    path.join(destDir, "manifest.json"),
    `${JSON.stringify(nextManifest, null, 2)}\n`,
    "utf8",
  );

  const existingRegistry = fs.existsSync(REGISTRY_FILE)
    ? fs.readFileSync(REGISTRY_FILE, "utf8")
    : "";
  const prevDefaultMatch = existingRegistry.match(/DEFAULT_PATCH_VERSION\s*=\s*"([^"]+)"/);
  const prevDefault = prevDefaultMatch?.[1] ?? "27.0";

  const allVersions = fs
    .readdirSync(VERSIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("v"))
    .map((d) => d.name.slice(1))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const currentDefault = setDefault ? newVersion : prevDefault;
  fs.writeFileSync(
    REGISTRY_FILE,
    generatePatchRegistrySource(allVersions, currentDefault),
    "utf8",
  );

  execFileSync("pnpm", ["run", "data:validate"], { cwd: REPO_ROOT, stdio: "inherit" });
  console.log(`[new-patch-version] Created and validated v${newVersion} from v${fromVersion}.`);
}

main();
