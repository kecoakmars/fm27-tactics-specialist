import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const rootRequire = createRequire(path.resolve(repoRoot, "package.json"));
const tsxEntry = rootRequire.resolve("tsx");
const tsxRequire = createRequire(tsxEntry);
const { build } = tsxRequire("esbuild");

const entryPoint = path.resolve(
  repoRoot,
  "packages/fm-codec/src/fm-save-worker-entry.ts",
);
const outfile = path.resolve(
  repoRoot,
  "apps/web/public/workers/fm-save-worker.js",
);

await build({
  entryPoints: [entryPoint],
  outfile,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  minify: true,
  legalComments: "none",
});

console.log(`[worker:build] Built standalone worker -> ${path.relative(repoRoot, outfile)}`);
