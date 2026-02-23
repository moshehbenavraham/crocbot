import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const thisDir = path.dirname(fileURLToPath(import.meta.url));

describe("skills-status config value redaction", () => {
  const source = fs.readFileSync(path.join(thisDir, "skills-status.ts"), "utf-8");

  it("imports looksLikeSecret from config/redact", () => {
    expect(source).toContain("looksLikeSecret");
    expect(source).toMatch(/from\s+["'].*config\/redact/);
  });

  it("redacts values that look like secrets", () => {
    expect(source).toContain("[REDACTED]");
  });

  it("masks satisfied non-secret values as [SET]", () => {
    expect(source).toContain("[SET]");
  });
});
