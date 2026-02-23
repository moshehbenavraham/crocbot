import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import * as tar from "tar";
import { afterEach, describe, expect, it } from "vitest";
import { extractArchive, resolveArchiveKind, resolvePackedRootDir } from "./archive.js";

const tempDirs: string[] = [];

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "crocbot-archive-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures
    }
  }
});

describe("archive utils", () => {
  it("detects archive kinds", () => {
    expect(resolveArchiveKind("/tmp/file.zip")).toBe("zip");
    expect(resolveArchiveKind("/tmp/file.tgz")).toBe("tar");
    expect(resolveArchiveKind("/tmp/file.tar.gz")).toBe("tar");
    expect(resolveArchiveKind("/tmp/file.tar")).toBe("tar");
    expect(resolveArchiveKind("/tmp/file.txt")).toBeNull();
  });

  it("extracts zip archives", async () => {
    const workDir = await makeTempDir();
    const archivePath = path.join(workDir, "bundle.zip");
    const extractDir = path.join(workDir, "extract");

    const zip = new JSZip();
    zip.file("package/hello.txt", "hi");
    await fs.writeFile(archivePath, await zip.generateAsync({ type: "nodebuffer" }));

    await fs.mkdir(extractDir, { recursive: true });
    await extractArchive({ archivePath, destDir: extractDir, timeoutMs: 5_000 });
    const rootDir = await resolvePackedRootDir(extractDir);
    const content = await fs.readFile(path.join(rootDir, "hello.txt"), "utf-8");
    expect(content).toBe("hi");
  });

  it("extracts tar archives", async () => {
    const workDir = await makeTempDir();
    const archivePath = path.join(workDir, "bundle.tar");
    const extractDir = path.join(workDir, "extract");
    const packageDir = path.join(workDir, "package");

    await fs.mkdir(packageDir, { recursive: true });
    await fs.writeFile(path.join(packageDir, "hello.txt"), "yo");
    await tar.c({ cwd: workDir, file: archivePath }, ["package"]);

    await fs.mkdir(extractDir, { recursive: true });
    await extractArchive({ archivePath, destDir: extractDir, timeoutMs: 5_000 });
    const rootDir = await resolvePackedRootDir(extractDir);
    const content = await fs.readFile(path.join(rootDir, "hello.txt"), "utf-8");
    expect(content).toBe("yo");
  });
});

describe("zip-slip prevention", () => {
  it("blocks zip entries with ../ path traversal", async () => {
    const workDir = await makeTempDir();
    const archivePath = path.join(workDir, "evil.zip");
    const extractDir = path.join(workDir, "extract");

    const zip = new JSZip();
    zip.file("../../etc/passwd", "pwned");
    await fs.writeFile(archivePath, await zip.generateAsync({ type: "nodebuffer" }));
    await fs.mkdir(extractDir, { recursive: true });

    await expect(
      extractArchive({ archivePath, destDir: extractDir, timeoutMs: 5_000 }),
    ).rejects.toThrow(/traversal|escapes|absolute/);
  });

  it("blocks zip entries with absolute paths", async () => {
    const workDir = await makeTempDir();
    const archivePath = path.join(workDir, "evil.zip");
    const extractDir = path.join(workDir, "extract");

    const zip = new JSZip();
    zip.file("/etc/passwd", "pwned");
    await fs.writeFile(archivePath, await zip.generateAsync({ type: "nodebuffer" }));
    await fs.mkdir(extractDir, { recursive: true });

    await expect(
      extractArchive({ archivePath, destDir: extractDir, timeoutMs: 5_000 }),
    ).rejects.toThrow(/absolute|escapes/);
  });
});

describe("archive resource limits", () => {
  it("rejects zip exceeding max file count", async () => {
    const workDir = await makeTempDir();
    const archivePath = path.join(workDir, "many.zip");
    const extractDir = path.join(workDir, "extract");

    const zip = new JSZip();
    for (let i = 0; i < 10; i++) {
      zip.file(`file-${i}.txt`, `content-${i}`);
    }
    await fs.writeFile(archivePath, await zip.generateAsync({ type: "nodebuffer" }));
    await fs.mkdir(extractDir, { recursive: true });

    await expect(
      extractArchive({
        archivePath,
        destDir: extractDir,
        timeoutMs: 5_000,
        limits: { maxFiles: 5 },
      }),
    ).rejects.toThrow(/max file count/);
  });

  it("rejects zip exceeding max entry size", async () => {
    const workDir = await makeTempDir();
    const archivePath = path.join(workDir, "big.zip");
    const extractDir = path.join(workDir, "extract");

    const zip = new JSZip();
    zip.file("big.txt", "x".repeat(1000));
    await fs.writeFile(archivePath, await zip.generateAsync({ type: "nodebuffer" }));
    await fs.mkdir(extractDir, { recursive: true });

    await expect(
      extractArchive({
        archivePath,
        destDir: extractDir,
        timeoutMs: 5_000,
        limits: { maxEntryBytes: 500 },
      }),
    ).rejects.toThrow(/max size/);
  });

  it("rejects zip exceeding max total size", async () => {
    const workDir = await makeTempDir();
    const archivePath = path.join(workDir, "total.zip");
    const extractDir = path.join(workDir, "extract");

    const zip = new JSZip();
    zip.file("a.txt", "x".repeat(600));
    zip.file("b.txt", "y".repeat(600));
    await fs.writeFile(archivePath, await zip.generateAsync({ type: "nodebuffer" }));
    await fs.mkdir(extractDir, { recursive: true });

    await expect(
      extractArchive({
        archivePath,
        destDir: extractDir,
        timeoutMs: 5_000,
        limits: { maxTotalBytes: 1000 },
      }),
    ).rejects.toThrow(/max total size/);
  });

  it("passes with entries within limits", async () => {
    const workDir = await makeTempDir();
    const archivePath = path.join(workDir, "ok.zip");
    const extractDir = path.join(workDir, "extract");

    const zip = new JSZip();
    zip.file("package/a.txt", "hello");
    zip.file("package/b.txt", "world");
    await fs.writeFile(archivePath, await zip.generateAsync({ type: "nodebuffer" }));
    await fs.mkdir(extractDir, { recursive: true });

    await expect(
      extractArchive({
        archivePath,
        destDir: extractDir,
        timeoutMs: 5_000,
        limits: { maxFiles: 100, maxTotalBytes: 10_000, maxEntryBytes: 5_000 },
      }),
    ).resolves.toBeUndefined();
  });
});
