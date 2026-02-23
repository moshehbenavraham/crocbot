import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { resolveContainedPath, resolveSandboxPath } from "./sandbox-paths.js";

const tempDirs: string[] = [];

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "crocbot-sandbox-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});

describe("resolveSandboxPath", () => {
  it("resolves a valid relative path", () => {
    const result = resolveSandboxPath({
      filePath: "foo/bar.txt",
      cwd: "/workspace",
      root: "/workspace",
    });
    expect(result.resolved).toBe(path.resolve("/workspace", "foo/bar.txt"));
    expect(result.relative).toBe(path.join("foo", "bar.txt"));
  });

  it("throws on ../ traversal", () => {
    expect(() =>
      resolveSandboxPath({
        filePath: "../../../etc/passwd",
        cwd: "/workspace",
        root: "/workspace",
      }),
    ).toThrow("escapes sandbox root");
  });

  it("throws on absolute path outside root", () => {
    expect(() =>
      resolveSandboxPath({ filePath: "/etc/passwd", cwd: "/workspace", root: "/workspace" }),
    ).toThrow("escapes sandbox root");
  });

  it("allows root path itself", () => {
    const result = resolveSandboxPath({ filePath: ".", cwd: "/workspace", root: "/workspace" });
    expect(result.resolved).toBe(path.resolve("/workspace"));
  });
});

describe("resolveContainedPath", () => {
  it("resolves a valid path with symlink check", async () => {
    const dir = await makeTempDir();
    await fs.writeFile(path.join(dir, "file.txt"), "test");
    const result = await resolveContainedPath({ filePath: "file.txt", root: dir });
    expect(result.resolved).toBe(path.join(dir, "file.txt"));
  });

  it("throws on ../ traversal", async () => {
    const dir = await makeTempDir();
    await expect(
      resolveContainedPath({ filePath: "../../../etc/passwd", root: dir }),
    ).rejects.toThrow("escapes sandbox root");
  });

  it("blocks symlink in path", async () => {
    const dir = await makeTempDir();
    const subdir = path.join(dir, "sub");
    await fs.mkdir(subdir);
    await fs.symlink("/tmp", path.join(subdir, "link"));
    await expect(resolveContainedPath({ filePath: "sub/link/file", root: dir })).rejects.toThrow(
      "Symlink not allowed",
    );
  });

  it("allows non-existent paths (no symlink to check)", async () => {
    const dir = await makeTempDir();
    const result = await resolveContainedPath({ filePath: "new/file.txt", root: dir });
    expect(result.resolved).toBe(path.join(dir, "new", "file.txt"));
  });
});
