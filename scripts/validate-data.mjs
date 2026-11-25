#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
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
} from "../packages/shared-types/src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const VERSIONS_DIR = path.join(REPO_ROOT, "packages/fm-data/versions");

function sha256File(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function readJson(dir, fileName) {
  const fullPath = path.join(dir, fileName);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing required file: ${fullPath}`);
  }
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

/**
 * Validates all schemas, SHA-256 checksums, and cross-catalog invariants for a patch folder.
 * @param {string} versionDir
 */
export function validateVersionFolder(versionDir) {
  const versionLabel = path.basename(versionDir);

  // 1. Zod Schema Validation
  const manifest = PatchManifestSchema.parse(readJson(versionDir, "manifest.json"));
  const pitchCatalog = PitchCatalogSchema.parse(readJson(versionDir, "pitch-catalog.json"));
  const coachingKnowledge = CoachingKnowledgeSchema.parse(
    readJson(versionDir, "coaching-knowledge.json"),
  );
  const roleProfiles = RoleProfilesCatalogSchema.parse(readJson(versionDir, "role-profiles.json"));
  const tacticalStyles = TacticalStylesCatalogSchema.parse(
    readJson(versionDir, "tactical-styles.json"),
  );
  const trainingSessions = TrainingSessionsCatalogSchema.parse(
    readJson(versionDir, "training-sessions.json"),
  );
  const trainingPresets = TrainingPresetsCatalogSchema.parse(
    readJson(versionDir, "training-presets.json"),
  );
  const staffFormulas = StaffFormulasCatalogSchema.parse(
    readJson(versionDir, "staff-formulas.json"),
  );
  const staffSeed = StaffSeedCatalogSchema.parse(readJson(versionDir, "staff-seed.json"));
  const wonderkidsSeed = WonderkidsSeedCatalogSchema.parse(
    readJson(versionDir, "wonderkids-seed.json"),
  );

  // Checksum integrity
  for (const [fileName, expectedHash] of Object.entries(manifest.checksums)) {
    const actualHash = sha256File(path.join(versionDir, fileName));
    if (actualHash !== expectedHash) {
      throw new Error(
        `[${versionLabel}] Checksum mismatch on ${fileName}: expected ${expectedHash}, got ${actualHash}`,
      );
    }
  }

  // 2. Role ID & 64-bit BigInt Flags cross-file check
  const roleMap = new Map();
  for (const role of pitchCatalog.Roles) {
    const flags = BigInt(role.Flags);
    if (flags <= 0n || flags > 0xffffffffffffffffn) {
      throw new Error(`[${versionLabel}] Invalid 64-bit Flags on Role ${role.Id}: ${role.Flags}`);
    }
    if (roleMap.has(role.Id)) {
      throw new Error(`[${versionLabel}] Duplicate Role.Id in pitch-catalog: ${role.Id}`);
    }
    roleMap.set(role.Id, flags);
  }

  const allAttrSet = new Set(roleProfiles.AllAttributes);
  for (const rp of roleProfiles.Roles) {
    if (!roleMap.has(rp.Id)) {
      throw new Error(
        `[${versionLabel}] role-profiles Role.Id "${rp.Id}" missing from pitch-catalog.json`,
      );
    }
    if (new Set(rp.Keys).size !== 5) {
      throw new Error(
        `[${versionLabel}] role-profiles Role "${rp.Id}" must have 5 distinct key attributes`,
      );
    }
    for (const key of rp.Keys) {
      if (!allAttrSet.has(key)) {
        throw new Error(
          `[${versionLabel}] role-profiles Role "${rp.Id}" references unknown attribute "${key}"`,
        );
      }
    }
  }
  for (const specRole of roleProfiles.SpecialistRoles) {
    if (!roleMap.has(specRole)) {
      throw new Error(
        `[${versionLabel}] SpecialistRoles entry "${specRole}" missing from pitch-catalog.json`,
      );
    }
  }

  // Eligibility & Policies role/position cross-check
  const positionIds = new Set(pitchCatalog.Positions.map((p) => p.Id));
  for (const [eligKey, posRecord] of Object.entries(pitchCatalog.Eligibility)) {
    for (const [posId, [ipRoles, oopRoles]] of Object.entries(posRecord)) {
      if (!positionIds.has(posId)) {
        throw new Error(
          `[${versionLabel}] Eligibility[${eligKey}] references unknown position "${posId}"`,
        );
      }
      for (const rId of [...ipRoles, ...oopRoles]) {
        if (!roleMap.has(rId)) {
          throw new Error(
            `[${versionLabel}] Eligibility[${eligKey}][${posId}] references unknown role "${rId}"`,
          );
        }
      }
    }
  }

  for (const policyKey of Object.keys(pitchCatalog.PlayerInstructionPolicies)) {
    const parts = policyKey.split(":");
    const posId = parts[1];
    const roleId = parts[2];
    if (!posId || !roleId || !positionIds.has(posId) || !roleMap.has(roleId)) {
      throw new Error(
        `[${versionLabel}] Invalid PlayerInstructionPolicies key "${policyKey}"`,
      );
    }
  }

  // 3. Team Instructions bit index & Conflicts check
  const instructionGroupMap = new Map();
  const allNonZeroInstructionBits = new Set();
  for (const group of pitchCatalog.Instructions) {
    const groupBits = new Set();
    for (const opt of group.Options) {
      groupBits.add(opt.Bit);
      if (opt.Bit > 0) {
        if (allNonZeroInstructionBits.has(opt.Bit)) {
          throw new Error(
            `[${versionLabel}] Duplicate non-zero Team Instruction Bit ${opt.Bit} in group ${group.Group}`,
          );
        }
        allNonZeroInstructionBits.add(opt.Bit);
      }
    }
    instructionGroupMap.set(group.Group, groupBits);
  }

  for (const [bitA, bitB] of pitchCatalog.Conflicts) {
    if (!allNonZeroInstructionBits.has(bitA) || !allNonZeroInstructionBits.has(bitB)) {
      throw new Error(
        `[${versionLabel}] Conflict pair [${bitA}, ${bitB}] references non-existent instruction bit`,
      );
    }
  }

  // 4. CoachingKnowledge Sources & Adjustments cross-check
  const sourceIds = new Set(coachingKnowledge.Sources.map((s) => s.Id));
  for (const rule of coachingKnowledge.Rules) {
    for (const src of rule.Sources) {
      if (!sourceIds.has(src)) {
        throw new Error(
          `[${versionLabel}] CoachingRule "${rule.Id}" references unknown source "${src}"`,
        );
      }
    }
  }

  const styleNameSet = new Set(tacticalStyles.TacticalStyles.map((s) => s.Name));
  for (const adj of coachingKnowledge.Adjustments) {
    if (!styleNameSet.has(adj.Style)) {
      throw new Error(
        `[${versionLabel}] CoachingAdjustment references unknown style "${adj.Style}"`,
      );
    }
    const groupBits = instructionGroupMap.get(adj.Group);
    if (!groupBits) {
      throw new Error(
        `[${versionLabel}] CoachingAdjustment references unknown group "${adj.Group}"`,
      );
    }
    if (!groupBits.has(adj.From) || !groupBits.has(adj.To)) {
      throw new Error(
        `[${versionLabel}] CoachingAdjustment ${adj.Group} (${adj.From} -> ${adj.To}) has invalid bit for group`,
      );
    }
  }

  // 5. Shapes (8) & StyleShapes (16) + TacticalStyles cross-check
  const checkShapeList = (shapes, label) => {
    for (const shape of shapes) {
      const inUnique = new Set(shape.InSlots);
      const outUnique = new Set(shape.OutSlots);
      if (inUnique.size !== 11 || outUnique.size !== 11) {
        throw new Error(
          `[${versionLabel}] ${label} "${shape.Id}" must have 11 unique InSlots and 11 unique OutSlots`,
        );
      }
      if (!inUnique.has("GK") || !outUnique.has("GK")) {
        throw new Error(`[${versionLabel}] ${label} "${shape.Id}" must include GK in both phases`);
      }
      for (const slotId of [...shape.InSlots, ...shape.OutSlots]) {
        if (!positionIds.has(slotId)) {
          throw new Error(
            `[${versionLabel}] ${label} "${shape.Id}" uses invalid position slot "${slotId}"`,
          );
        }
      }
    }
  };

  checkShapeList(tacticalStyles.Shapes, "Shapes");
  checkShapeList(tacticalStyles.StyleShapes, "StyleShapes");

  const styleShapeIds = new Set(tacticalStyles.StyleShapes.map((s) => s.Id));
  for (const style of tacticalStyles.TacticalStyles) {
    for (const attr of style.Attributes) {
      if (!allAttrSet.has(attr)) {
        throw new Error(
          `[${versionLabel}] TacticalStyle "${style.Id}" references unknown attribute "${attr}"`,
        );
      }
    }
    for (const allowedShapeId of style.Allows) {
      if (!styleShapeIds.has(allowedShapeId)) {
        throw new Error(
          `[${versionLabel}] TacticalStyle "${style.Id}" allows unknown shape "${allowedShapeId}"`,
        );
      }
    }
    for (const rId of style.PreferredRoles ?? []) {
      if (!roleMap.has(rId)) {
        throw new Error(
          `[${versionLabel}] TacticalStyle "${style.Id}" references unknown PreferredRole "${rId}"`,
        );
      }
    }
    const activeStyleBits = new Set();
    for (const [groupName, bit] of Object.entries(style.InstructionBits)) {
      const groupBits = instructionGroupMap.get(groupName);
      if (!groupBits || !groupBits.has(bit)) {
        throw new Error(
          `[${versionLabel}] TacticalStyle "${style.Id}" sets invalid bit ${bit} for group "${groupName}"`,
        );
      }
      if (bit > 0) activeStyleBits.add(bit);
    }
    for (const [bitA, bitB] of pitchCatalog.Conflicts) {
      if (activeStyleBits.has(bitA) && activeStyleBits.has(bitB)) {
        throw new Error(
          `[${versionLabel}] TacticalStyle "${style.Id}" activates conflicting bits [${bitA}, ${bitB}]`,
        );
      }
    }
  }

  // 6. Training Presets vs Sessions & Seed UID uniqueness
  const sessionMaxMap = new Map();
  for (const s of trainingSessions.Sessions) {
    if (sessionMaxMap.has(s.code)) {
      throw new Error(`[${versionLabel}] Duplicate training session code "${s.code}"`);
    }
    sessionMaxMap.set(s.code, s.max_sessions_per_week);
  }
  for (const preset of trainingPresets.Presets) {
    const counts = new Map();
    for (const d of preset.days) {
      for (const code of [d.s1, d.s2, d.extra]) {
        if (!sessionMaxMap.has(code)) {
          throw new Error(
            `[${versionLabel}] TrainingPreset "${preset.id}" uses unknown session "${code}"`,
          );
        }
        counts.set(code, (counts.get(code) ?? 0) + 1);
      }
    }
    for (const [code, used] of counts.entries()) {
      const maxAllowed = sessionMaxMap.get(code) ?? 0;
      if (used > maxAllowed) {
        throw new Error(
          `[${versionLabel}] TrainingPreset "${preset.id}" uses "${code}" ${used}x (max ${maxAllowed})`,
        );
      }
    }
  }

  const staffUids = new Set();
  for (const st of staffSeed.Staff) {
    if (staffUids.has(st.uid)) {
      throw new Error(`[${versionLabel}] Duplicate Staff UID ${st.uid}`);
    }
    staffUids.add(st.uid);
  }

  const wonderkidUids = new Set();
  for (const wk of wonderkidsSeed.Wonderkids) {
    if (wonderkidUids.has(wk.uid)) {
      throw new Error(`[${versionLabel}] Duplicate Wonderkid UID ${wk.uid}`);
    }
    wonderkidUids.add(wk.uid);
  }

  if (staffFormulas.categories.length !== 10) {
    throw new Error(`[${versionLabel}] Expected 10 staff formula categories`);
  }
}

function main() {
  if (!fs.existsSync(VERSIONS_DIR)) {
    throw new Error(`Versions directory does not exist: ${VERSIONS_DIR}`);
  }
  const versionFolders = fs
    .readdirSync(VERSIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("v"))
    .map((d) => path.join(VERSIONS_DIR, d.name))
    .sort();

  if (versionFolders.length === 0) {
    throw new Error(`No version folders (v*) found inside ${VERSIONS_DIR}`);
  }

  for (const folder of versionFolders) {
    validateVersionFolder(folder);
    console.log(`[validate-data] OK ${path.basename(folder)}`);
  }
  console.log(`[validate-data] Validated ${versionFolders.length} patch version(s) with 0 errors.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
