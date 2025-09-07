import path from "path";

import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@domain": path.resolve(__dirname, "src/domain"),
      "@application": path.resolve(__dirname, "src/application"),
      "@infrastructure": path.resolve(__dirname, "src/infrastructure"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  test: {
    exclude: [...configDefaults.exclude],
    include: ["src/**/*.spec.ts"],
    coverage: {
      include: ["src/**/*.ts"],
    },
  },
});
