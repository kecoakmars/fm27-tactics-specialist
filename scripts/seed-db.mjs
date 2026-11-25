#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

async function upsertBatch(supabaseUrl, serviceRoleKey, table, rows, conflictColumn) {
  const endpoint = new URL(`/rest/v1/${table}`, supabaseUrl);
  endpoint.searchParams.set("on_conflict", conflictColumn);

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase upsert into ${table} failed (${response.status}): ${body}`);
  }
}

async function main() {
  const versionArg = process.argv[2]?.replace(/^v/, "") || "27.0";
  const versionDir = path.join(REPO_ROOT, `packages/fm-data/versions/v${versionArg}`);
  const wonderkidsData = JSON.parse(
    fs.readFileSync(path.join(versionDir, "wonderkids-seed.json"), "utf8"),
  );
  const staffData = JSON.parse(
    fs.readFileSync(path.join(versionDir, "staff-seed.json"), "utf8"),
  );

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.log(
      `[seed-db] Dry-run validated ${wonderkidsData.Wonderkids.length} wonderkids & ${staffData.Staff.length} staff (set SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY to execute live upsert).`,
    );
    return;
  }

  const wonderkidRows = wonderkidsData.Wonderkids.map((wk) => ({
    uid: wk.uid,
    name: wk.name,
    age: wk.age,
    club: wk.club,
    nationality: wk.nationality,
    positions: wk.positions,
    estimated_price: wk.estimatedPriceEurM,
    pa_range: wk.paRange,
    attributes_json: {
      preferredFoot: wk.preferredFoot,
      leftFoot: wk.leftFoot,
      rightFoot: wk.rightFoot,
      currentAbilityEstimate: wk.currentAbilityEstimate,
      attributes: wk.attributes,
      positionFamiliarity: wk.positionFamiliarity,
    },
    game_version: versionArg,
    is_curated: wk.isCurated,
    updated_at: new Date().toISOString(),
  }));

  const chunkSize = 100;
  for (let i = 0; i < wonderkidRows.length; i += chunkSize) {
    await upsertBatch(
      supabaseUrl,
      serviceRoleKey,
      "wonderkids",
      wonderkidRows.slice(i, i + chunkSize),
      "uid",
    );
  }

  console.log(`[seed-db] Upserted ${wonderkidRows.length} wonderkids for v${versionArg}.`);
}

main().catch((err) => {
  console.error("[seed-db] Error:", err);
  process.exit(1);
});
