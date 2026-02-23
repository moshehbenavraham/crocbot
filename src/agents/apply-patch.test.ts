import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { applyPatch } from "./apply-patch.js";

async function withTempDir<T>(fn: (dir: string) => Promise<T>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "crocbot-patch-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe("applyPatch", () => {
  it("adds a file", async () => {
    await withTempDir(async (dir) => {
      const patch = `*** Begin Patch
*** Add File: hello.txt
+hello
*** End Patch`;

      const result = await applyPatch(patch, { cwd: dir });
      const contents = await fs.readFile(path.join(dir, "hello.txt"), "utf8");

      expect(contents).toBe("hello\n");
      expect(result.summary.added).toEqual(["hello.txt"]);
    });
  });

  it("updates and moves a file", async () => {
    await withTempDir(async (dir) => {
      const source = path.join(dir, "source.txt");
      await fs.writeFile(source, "foo\nbar\n", "utf8");

      const patch = `*** Begin Patch
*** Update File: source.txt
*** Move to: dest.txt
@@
 foo
-bar
+baz
*** End Patch`;

      const result = await applyPatch(patch, { cwd: dir });
      const dest = path.join(dir, "dest.txt");
      const contents = await fs.readFile(dest, "utf8");

      expect(contents).toBe("foo\nbaz\n");
      await expect(fs.stat(source)).rejects.toBeDefined();
      expect(result.summary.modified).toEqual(["dest.txt"]);
    });
  });

  it("supports end-of-file inserts", async () => {
    await withTempDir(async (dir) => {
      const target = path.join(dir, "end.txt");
      await fs.writeFile(target, "line1\n", "utf8");

      const patch = `*** Begin Patch
*** Update File: end.txt
@@
+line2
*** End of File
*** End Patch`;

      await applyPatch(patch, { cwd: dir });
      const contents = await fs.readFile(target, "utf8");
      expect(contents).toBe("line1\nline2\n");
    });
  });

  it("blocks ../ path traversal in add", async () => {
    await withTempDir(async (dir) => {
      const patch = `*** Begin Patch
*** Add File: ../../../etc/evil.txt
+pwned
*** End Patch`;
      await expect(applyPatch(patch, { cwd: dir })).rejects.toThrow("escapes sandbox");
    });
  });

  it("blocks ../ path traversal in delete", async () => {
    await withTempDir(async (dir) => {
      const patch = `*** Begin Patch
*** Delete File: ../../../etc/passwd
*** End Patch`;
      await expect(applyPatch(patch, { cwd: dir })).rejects.toThrow("escapes sandbox");
    });
  });

  it("blocks ../ path traversal in update", async () => {
    await withTempDir(async (dir) => {
      const patch = `*** Begin Patch
*** Update File: ../../../etc/passwd
@@
-root
+hacked
*** End Patch`;
      await expect(applyPatch(patch, { cwd: dir })).rejects.toThrow("escapes sandbox");
    });
  });

  it("blocks absolute path outside workspace", async () => {
    await withTempDir(async (dir) => {
      const patch = `*** Begin Patch
*** Add File: /etc/evil.txt
+pwned
*** End Patch`;
      await expect(applyPatch(patch, { cwd: dir })).rejects.toThrow("escapes sandbox");
    });
  });

  it("blocks delete of symlink target", async () => {
    await withTempDir(async (dir) => {
      const target = path.join(dir, "link");
      await fs.symlink("/tmp/harmless", target);

      const patch = `*** Begin Patch
*** Delete File: link
*** End Patch`;
      await expect(applyPatch(patch, { cwd: dir })).rejects.toThrow(/[Ss]ymlink/);
    });
  });

  it("allows valid paths within workspace", async () => {
    await withTempDir(async (dir) => {
      const patch = `*** Begin Patch
*** Add File: subdir/new-file.txt
+content
*** End Patch`;
      const result = await applyPatch(patch, { cwd: dir });
      expect(result.summary.added).toContain("subdir/new-file.txt");
      const content = await fs.readFile(path.join(dir, "subdir", "new-file.txt"), "utf8");
      expect(content).toBe("content\n");
    });
  });
});
