#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  buildRoleProfiles,
  buildStaffFormulasAndSeed,
  buildTacticalStyles,
  buildTrainingSessionsAndPresets,
} from "./lib/v27-catalog-builders.mjs";
import { buildWonderkidsSeed } from "./lib/wonderkids-generator.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function parseArgs(argv) {
  const args = {
    reaSource: null,
    legacyInstall: null,
    seedDefaults: false,
    outDir: path.join(REPO_ROOT, "packages/fm-data/versions/v27.0"),
    patchVersion: "27.0",
  };
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--rea-source" && argv[i + 1]) {
      args.reaSource = path.resolve(argv[++i]);
    } else if (token === "--legacy-install" && argv[i + 1]) {
      args.legacyInstall = path.resolve(argv[++i]);
    } else if (token === "--out" && argv[i + 1]) {
      args.outDir = path.resolve(argv[++i]);
    } else if (token === "--patch-version" && argv[i + 1]) {
      args.patchVersion = argv[++i];
    } else if (token === "--seed-defaults") {
      args.seedDefaults = true;
    }
  }
  return args;
}

function findFirstExisting(candidates) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      // Guard: never read from forbidden REA directories
      const normalized = candidate.replace(/\\/g, "/");
      if (
        normalized.includes("/extracted-runtime/") ||
        normalized.includes("/07-rea-evidence/")
      ) {
        throw new Error(`Security/Token Guard: Refusing to read forbidden path ${candidate}`);
      }
      return candidate;
    }
  }
  return null;
}

function tryFetchFromGdrivePlugin() {
  const tmpDir = "/tmp/fm27-rea-extract";
  fs.mkdirSync(tmpDir, { recursive: true });
  const pitchOut = path.join(tmpDir, "FM27PitchCatalog.json");
  const coachOut = path.join(tmpDir, "FM27CoachingKnowledge.json");
  try {
    // Known read-only file IDs inside 05-data-schemas/embedded-resources/
    execFileSync(
      "gdrive",
      ["readonly", "download", "1Q7AJ-RTMtbE_nppEclVCDhKGruQgpawF", "--out", pitchOut],
      { stdio: "pipe" },
    );
    execFileSync(
      "gdrive",
      ["readonly", "download", "1GazMY9AIKX7Lqfm2xZpUEOjaUDJQx9WQ", "--out", coachOut],
      { stdio: "pipe" },
    );
    if (fs.existsSync(pitchOut) && fs.existsSync(coachOut)) {
      return { pitchPath: pitchOut, coachPath: coachOut };
    }
  } catch {
    return null;
  }
  return null;
}

function extractLegacyInstallAssets(legacyInstallDir) {
  if (!legacyInstallDir || !fs.existsSync(legacyInstallDir)) return;
  const resourcesDir = findFirstExisting([
    path.join(legacyInstallDir, "current/resources"),
    path.join(legacyInstallDir, "resources"),
    legacyInstallDir,
  ]);
  if (!resourcesDir) return;

  const langDir = path.join(resourcesDir, "languages");
  if (fs.existsSync(langDir)) {
    const outMessages = path.join(REPO_ROOT, "apps/web/src/messages");
    fs.mkdirSync(outMessages, { recursive: true });
    for (const entry of fs.readdirSync(langDir)) {
      if (entry.endsWith(".json")) {
        fs.copyFileSync(path.join(langDir, entry), path.join(outMessages, entry));
      }
    }
  }

  const outIcons = path.join(REPO_ROOT, "apps/web/public/icons/instructions");
  for (const entry of fs.readdirSync(resourcesDir)) {
    if (entry.startsWith("Instruction.player-") || entry.startsWith("Instruction.team-")) {
      const fullPath = path.join(resourcesDir, entry);
      if (!fs.statSync(fullPath).isFile()) continue;
      const buf = fs.readFileSync(fullPath);
      if (buf.length >= 4 && buf.subarray(0, 4).equals(PNG_MAGIC)) {
        fs.mkdirSync(outIcons, { recursive: true });
        const outName = entry.endsWith(".png") ? entry : `${entry}.png`;
        fs.writeFileSync(path.join(outIcons, outName), buf);
      }
    }
  }
}

function sha256Hex(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function writeFormattedJson(filePath, data) {
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  fs.writeFileSync(filePath, serialized, "utf8");
  return sha256Hex(serialized);
}

function main() {
  const args = parseArgs(process.argv);
  fs.mkdirSync(args.outDir, { recursive: true });

  let sourceMode = "seed-defaults";
  let pitchPath = null;
  let coachPath = null;

  if (args.reaSource) {
    pitchPath = findFirstExisting([
      path.join(args.reaSource, "05-data-schemas/embedded-resources/FM27PitchCatalog.json"),
      path.join(args.reaSource, "embedded-resources/FM27PitchCatalog.json"),
      path.join(args.reaSource, "FM27PitchCatalog.json"),
    ]);
    coachPath = findFirstExisting([
      path.join(args.reaSource, "05-data-schemas/embedded-resources/FM27CoachingKnowledge.json"),
      path.join(args.reaSource, "embedded-resources/FM27CoachingKnowledge.json"),
      path.join(args.reaSource, "FM27CoachingKnowledge.json"),
    ]);
    if (pitchPath && coachPath) {
      sourceMode = "gdrive-rea";
    }
  }

  if ((!pitchPath || !coachPath) && !args.seedDefaults) {
    const fetched = tryFetchFromGdrivePlugin();
    if (fetched) {
      pitchPath = fetched.pitchPath;
      coachPath = fetched.coachPath;
      sourceMode = "gdrive-rea";
    }
  }

  if (!pitchPath || !coachPath) {
    pitchPath = findFirstExisting([path.join(args.outDir, "pitch-catalog.json")]);
    coachPath = findFirstExisting([path.join(args.outDir, "coaching-knowledge.json")]);
    if (!pitchPath || !coachPath) {
      throw new Error(
        "Unable to locate FM27PitchCatalog.json / FM27CoachingKnowledge.json via --rea-source, gdrive plugin, or existing seed catalog.",
      );
    }
    sourceMode = args.legacyInstall ? "legacy-install" : "seed-defaults";
  }

  if (args.legacyInstall) {
    extractLegacyInstallAssets(args.legacyInstall);
    if (sourceMode === "seed-defaults") sourceMode = "legacy-install";
  }

  const pitchCatalog = JSON.parse(fs.readFileSync(pitchPath, "utf8"));
  const coachingKnowledge = JSON.parse(fs.readFileSync(coachPath, "utf8"));
  const roleProfiles = buildRoleProfiles(pitchCatalog);
  const tacticalStyles = buildTacticalStyles();
  const { Sessions, Presets } = buildTrainingSessionsAndPresets();
  const { staffFormulas, staffSeed } = buildStaffFormulasAndSeed();
  const wonderkidsSeed = buildWonderkidsSeed();

  const filesToWrite = [
    ["pitch-catalog.json", pitchCatalog],
    ["coaching-knowledge.json", coachingKnowledge],
    ["role-profiles.json", roleProfiles],
    ["tactical-styles.json", tacticalStyles],
    ["training-sessions.json", { Sessions }],
    ["training-presets.json", { Presets }],
    ["staff-formulas.json", staffFormulas],
    ["staff-seed.json", staffSeed],
    ["wonderkids-seed.json", wonderkidsSeed],
  ];

  const checksums = {};
  for (const [fileName, payload] of filesToWrite) {
    checksums[fileName] = writeFormattedJson(path.join(args.outDir, fileName), payload);
  }

  const manifest = {
    patchVersion: args.patchVersion,
    game: "FM27",
    releasedAt: "2026-11-01",
    generatedAt: new Date().toISOString(),
    sourceMode,
    counts: {
      positions: pitchCatalog.Positions.length,
      roles: pitchCatalog.Roles.length,
      teamInstructionGroups: pitchCatalog.Instructions.length,
      playerInstructionGroups: pitchCatalog.PlayerInstructions.length,
      conflicts: pitchCatalog.Conflicts.length,
      coachingSources: coachingKnowledge.Sources.length,
      coachingRules: coachingKnowledge.Rules.length,
      coachingAdjustments: coachingKnowledge.Adjustments.length,
      roleProfiles: roleProfiles.Roles.length,
      tacticalStyles: tacticalStyles.TacticalStyles.length,
      shapes: tacticalStyles.Shapes.length,
      styleShapes: tacticalStyles.StyleShapes.length,
      trainingSessions: Sessions.length,
      trainingPresets: Presets.length,
      staffCategories: staffFormulas.categories.length,
      staffSeed: staffSeed.Staff.length,
      wonderkidsSeed: wonderkidsSeed.Wonderkids.length,
    },
    checksums,
  };

  writeFormattedJson(path.join(args.outDir, "manifest.json"), manifest);
  console.log(
    `[extract-legacy-data] Generated v${args.patchVersion} (${sourceMode}) -> ${path.relative(REPO_ROOT, args.outDir)}`,
  );
}

main();
