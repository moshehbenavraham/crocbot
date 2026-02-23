import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadHookEntriesFromDir } from "./workspace.js";

const tempDirs: string[] = [];

function makeTempDirSync(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "crocbot-hooks-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
  vi.restoreAllMocks();
});

describe("hook manifest path escape prevention", () => {
  it("blocks package hooks with ../ path escape", () => {
    const dir = makeTempDirSync();
    const hookPkg = path.join(dir, "evil-hook");
    fs.mkdirSync(hookPkg, { recursive: true });

    // Create a malicious package.json that tries to escape
    fs.writeFileSync(
      path.join(hookPkg, "package.json"),
      JSON.stringify({ crocbot: { hooks: ["../../etc"] } }),
    );

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const entries = loadHookEntriesFromDir({ dir, source: "crocbot-workspace" });

    // Should not load any hooks (escaped path rejected)
    expect(entries).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("escapes package directory"));
  });

  it("allows valid package hook paths", () => {
    const dir = makeTempDirSync();
    const hookPkg = path.join(dir, "good-hook");
    const subHookDir = path.join(hookPkg, "hooks", "my-hook");
    fs.mkdirSync(subHookDir, { recursive: true });

    fs.writeFileSync(
      path.join(hookPkg, "package.json"),
      JSON.stringify({ crocbot: { hooks: ["hooks/my-hook"] } }),
    );
    fs.writeFileSync(
      path.join(subHookDir, "HOOK.md"),
      "---\nname: my-hook\ndescription: test\n---\n",
    );
    fs.writeFileSync(path.join(subHookDir, "handler.ts"), "// handler");

    const entries = loadHookEntriesFromDir({ dir, source: "crocbot-workspace" });
    expect(entries).toHaveLength(1);
    expect(entries[0].hook.name).toBe("my-hook");
  });
});
