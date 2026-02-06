/**
 * Post-build step: compile pi-extensions into standalone ESM files.
 *
 * The pi-coding-agent extension loader uses `jiti` to load extension
 * files at runtime from paths resolved by `resolvePiExtensionPath()`.
 * After tsdown bundles the main app into `dist/`, the resolved path
 * lands at `<project-root>/pi-extensions/<name>.js`.
 *
 * This script bundles each pi-extension entry point (with internal deps
 * inlined, external @mariozechner/* deps excluded) into that location.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { rolldown } from "rolldown";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const srcDir = path.join(root, "src/agents/pi-extensions");
const outDir = path.join(root, "pi-extensions");

const entries: Array<{ name: string; src: string }> = [
  { name: "compaction-safeguard", src: "compaction-safeguard.ts" },
  { name: "context-pruning", src: "context-pruning.ts" },
];

fs.mkdirSync(outDir, { recursive: true });

for (const entry of entries) {
  const entryPath = path.join(srcDir, entry.src);
  if (!fs.existsSync(entryPath)) {
    console.warn(`[pi-extensions] skipping ${entry.name}: source not found at ${entryPath}`);
    continue;
  }

  const outFile = path.join(outDir, `${entry.name}.js`);
  console.log(`[pi-extensions] compiling ${entry.name} → ${path.relative(root, outFile)}`);

  const bundle = await rolldown({
    input: entryPath,
    platform: "node",
    resolve: {
      extensions: [".ts", ".js", ".mts", ".mjs"],
      conditionNames: ["import", "node", "default"],
    },
    external: [/^@mariozechner\//],
  });

  await bundle.write({
    file: outFile,
    format: "esm",
    exports: "auto",
  });

  await bundle.close();

  if (fs.existsSync(outFile)) {
    console.log(`[pi-extensions] ✓ ${entry.name} compiled`);
  } else {
    console.error(`[pi-extensions] ✗ ${entry.name} output not found at ${outFile}`);
    process.exit(1);
  }
}

console.log("[pi-extensions] all extensions compiled successfully");
