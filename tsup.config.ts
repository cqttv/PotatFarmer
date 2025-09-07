import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/application/main.ts"],
  outDir: "dist",
  format: ["esm"],
  target: "node22",
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
});
