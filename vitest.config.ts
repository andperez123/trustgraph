import { defineConfig } from "vitest/config";
import tsconfig from "./tsconfig.json" with { type: "json" };

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "e2e/**/*.test.ts"],
    environment: "node",
    testTimeout: 15_000,
  },
  resolve: {
    extensions: [".ts"],
  },
  esbuild: {
    target: (tsconfig.compilerOptions as { target?: string }).target ?? "ES2022",
  },
});
