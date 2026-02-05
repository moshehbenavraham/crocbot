import { defineConfig } from "tsdown";

const env = {
  NODE_ENV: "production",
};

const shared = {
  env,
  fixedExtension: false,
  platform: "node" as const,
  skipNodeModulesBundle: true,
};

export default defineConfig([
  {
    entry: "src/index.ts",
    ...shared,
  },
  {
    entry: "src/entry.ts",
    ...shared,
  },
  {
    dts: true,
    entry: "src/plugin-sdk/index.ts",
    outDir: "dist/plugin-sdk",
    ...shared,
  },
]);
