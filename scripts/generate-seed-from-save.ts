import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFmSave } from "../packages/fm-codec/src/fm-save-parser.js";
import {
  PatchManifestSchema,
  StaffSeedCatalogSchema,
  WonderkidsSeedCatalogSchema,
} from "../packages/shared-types/src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function main(): void {
  const inputRel = process.argv[2] ?? "tests/fixtures/sample-real.fm";
  const savePath = path.resolve(repoRoot, inputRel);

  if (!fs.existsSync(savePath)) {
    console.error(`[generate:seed] File save .fm tidak ditemukan: ${savePath}`);
    process.exit(1);
  }

  console.log(`[generate:seed] Membaca ${savePath}...`);
  const rawBuffer = fs.readFileSync(savePath);
  const bytes = new Uint8Array(
    rawBuffer.buffer,
    rawBuffer.byteOffset,
    rawBuffer.byteLength,
  );

  const parsed = parseFmSave(
    bytes,
    (stage, pct) => {
      console.log(`  [${String(pct).padStart(3, " ")}%] ${stage}`);
    },
    { maxWonderkids: 500, maxStaffPool: 300 },
  );

  const topWonderkids = parsed.worldWonderkids.slice(0, 300).map((wk) => ({
    ...wk,
    isCurated: true,
  }));
  const topStaff = parsed.worldStaffPool.slice(0, 150);

  const validatedWonderkids = WonderkidsSeedCatalogSchema.parse({
    Wonderkids: topWonderkids,
  });
  const validatedStaff = StaffSeedCatalogSchema.parse({
    Staff: topStaff,
  });

  const wonderkidsOutPath = path.resolve(
    repoRoot,
    "packages/fm-data/versions/v27.0/wonderkids-seed.json",
  );
  const staffOutPath = path.resolve(
    repoRoot,
    "packages/fm-data/versions/v27.0/staff-seed.json",
  );

  const wonderkidsJson = `${JSON.stringify(validatedWonderkids, null, 2)}\n`;
  const staffJson = `${JSON.stringify(validatedStaff, null, 2)}\n`;

  fs.writeFileSync(wonderkidsOutPath, wonderkidsJson, "utf8");
  fs.writeFileSync(staffOutPath, staffJson, "utf8");

  const manifestPath = path.resolve(
    repoRoot,
    "packages/fm-data/versions/v27.0/manifest.json",
  );
  if (fs.existsSync(manifestPath)) {
    const manifest = PatchManifestSchema.parse(
      JSON.parse(fs.readFileSync(manifestPath, "utf8")),
    );
    manifest.counts.wonderkidsSeed = validatedWonderkids.Wonderkids.length;
    manifest.counts.staffSeed = validatedStaff.Staff.length;
    manifest.checksums["wonderkids-seed.json"] = crypto
      .createHash("sha256")
      .update(wonderkidsJson, "utf8")
      .digest("hex");
    manifest.checksums["staff-seed.json"] = crypto
      .createHash("sha256")
      .update(staffJson, "utf8")
      .digest("hex");
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  console.log(
    `[generate:seed] Sukses! Save="${parsed.saveName}" (${parsed.gameVersion}, ${parsed.gameDate})`,
  );
  console.log(
    `  Klub=${parsed.stats.totalClubs}, Pemain=${parsed.stats.totalPlayers} (U-21=${parsed.stats.u21Count}), Staf Pelatih=${parsed.stats.totalStaff}`,
  );
  console.log(
    `  Ditulis: ${validatedWonderkids.Wonderkids.length} wonderkids -> ${path.relative(repoRoot, wonderkidsOutPath)}`,
  );
  console.log(
    `  Ditulis: ${validatedStaff.Staff.length} staf -> ${path.relative(repoRoot, staffOutPath)}`,
  );
}

main();
