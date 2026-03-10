import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/index.ts"],
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "structured-llm": "/Users/piyushgupta/Documents/GitHub/personal_projects/structured-llm/src/index.ts",
    },
  },
});
