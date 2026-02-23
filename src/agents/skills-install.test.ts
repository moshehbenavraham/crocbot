import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const thisDir = path.dirname(fileURLToPath(import.meta.url));

describe("skills-install --ignore-scripts", () => {
  it("includes --ignore-scripts in all node package manager commands", () => {
    const source = fs.readFileSync(path.join(thisDir, "skills-install.ts"), "utf-8");
    // All four package managers should have --ignore-scripts
    const pnpmLine = source.match(/pnpm.*--ignore-scripts/);
    const yarnLine = source.match(/yarn.*--ignore-scripts/);
    const bunLine = source.match(/bun.*--ignore-scripts/);
    const npmLine = source.match(/npm.*--ignore-scripts/);
    expect(pnpmLine).not.toBeNull();
    expect(yarnLine).not.toBeNull();
    expect(bunLine).not.toBeNull();
    expect(npmLine).not.toBeNull();
  });
});
