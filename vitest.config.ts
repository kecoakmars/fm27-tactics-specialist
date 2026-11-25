import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@fm27/shared-types": path.resolve(__dirname, "packages/shared-types/src/index.ts"),
      "@fm27/fm-data": path.resolve(__dirname, "packages/fm-data/src/index.ts"),
      "@fm27/fm-codec": path.resolve(__dirname, "packages/fm-codec/src/index.ts"),
      "@fm27/fm-engine": path.resolve(__dirname, "packages/fm-engine/src/index.ts"),
      "@": path.resolve(__dirname, "apps/web/src"),
    },
  },
  test: {
    include: ["tests/**/*.spec.ts", "packages/**/*.spec.ts"],
    environment: "node",
  },
});
