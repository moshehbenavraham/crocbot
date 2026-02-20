import { defineConfig } from "tsdown";

const env = {
  NODE_ENV: "production",
};

const shared = {
  env,
  external: [
    "@napi-rs/canvas",
    "@reflink/reflink",
  ],
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
    entry: "src/extensionAPI.ts",
    ...shared,
  },
  {
    dts: false,
    entry: "src/plugin-sdk/index.ts",
    outDir: "dist/plugin-sdk",
    ...shared,
  },
]);
