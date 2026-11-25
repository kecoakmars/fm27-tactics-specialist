import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AI_MODELS } from "@fm27/ai-analyst";

const ROOT = process.cwd();

function listTrackedLikeFiles(dir: string, out: string[] = []): string[] {
  const skip = new Set(["node_modules", ".git", ".next", ".turbo", "dist", "coverage"]);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listTrackedLikeFiles(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

describe("Phase 6 — CI/CD, Documentation, Anti-Leak Hygiene & Gemini SDK Compliance", () => {
  it("verifies all GitHub Actions workflows, technical docs, PWA manifest, and error boundary exist", () => {
    const requiredPaths = [
      ".github/workflows/ci.yml",
      ".github/workflows/data-validation.yml",
      ".github/workflows/sync-trending.yml",
      "docs/ARCHITECTURE.md",
      "docs/BINARY_FMF_SPEC.md",
      "docs/MAINTENANCE_WORKFLOW.md",
      "CHANGELOG.md",
      "README.md",
      ".env.example",
      "apps/web/public/manifest.json",
      "apps/web/src/app/error.tsx",
    ];

    for (const rel of requiredPaths) {
      expect(fs.existsSync(path.join(ROOT, rel)), `Missing ${rel}`).toBe(true);
    }

    const specDoc = fs.readFileSync(
      path.join(ROOT, "docs/BINARY_FMF_SPEC.md"),
      "utf8",
    );
    expect(specDoc).toContain("02 01 66 6D 66 2E 08 00 00");
    expect(specDoc).toContain("28 B5 2F FD");
    expect(specDoc).toContain("0x200000");
  });

  it("enforces zero C# REA leaks, zero /tmp/fm-refs leftovers, and modern @google/genai model IDs", () => {
    expect(fs.existsSync("/tmp/fm-refs")).toBe(false);
    expect(fs.existsSync("/tmp/rea-phase4")).toBe(false);

    const allFiles = listTrackedLikeFiles(ROOT);
    const csFiles = allFiles.filter((f) => f.endsWith(".cs"));
    expect(csFiles).toHaveLength(0);

    // Ensure modern Gemini models only (never 1.5 / 2.0 / 2.5)
    for (const modelName of Object.values(AI_MODELS)) {
      expect(modelName).not.toMatch(/gemini-(1\.5|2\.0|2\.5)/);
    }
  });
});
