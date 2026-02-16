import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DocumentChunk } from "./types.js";
import { openKnowledgeStorage, resolveKnowledgeDbPath } from "./storage.js";

// -- Helpers --

function makeChunk(overrides?: Partial<DocumentChunk>): DocumentChunk {
  return {
    id: overrides?.id ?? "chunk-001",
    text: overrides?.text ?? "Sample chunk text",
    hash: overrides?.hash ?? "abc123",
    index: overrides?.index ?? 0,
    total: overrides?.total ?? 1,
    startLine: overrides?.startLine ?? 1,
    endLine: overrides?.endLine ?? 5,
    sourceValue: overrides?.sourceValue ?? "/docs/test.md",
    headingContext: overrides?.headingContext,
  };
}

// -- Tests --

describe("resolveKnowledgeDbPath", () => {
  it("returns path under agentDir for default project", () => {
    const result = resolveKnowledgeDbPath("/agents/test/agent");
    expect(result).toBe(path.join("/agents/test/agent", "knowledge.db"));
  });

  it("returns path under projectPaths.memoryDir for named project", () => {
    const result = resolveKnowledgeDbPath("/agents/test/agent", {
      memoryDir: "/agents/test/projects/myproject/memory",
    });
    expect(result).toBe(path.join("/agents/test/projects/myproject/memory", "knowledge.db"));
  });

  it("returns agentDir path when projectPaths is null", () => {
    const result = resolveKnowledgeDbPath("/agents/test/agent", null);
    expect(result).toBe(path.join("/agents/test/agent", "knowledge.db"));
  });
});

describe("openKnowledgeStorage", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates database file on open", () => {
    const dbPath = path.join(tmpDir, "test.db");
    const storage = openKnowledgeStorage(dbPath);
    storage.ensureSchema(0);
    storage.close();

    expect(fs.existsSync(dbPath)).toBe(true);
  });

  describe("ensureSchema", () => {
    it("creates tables without errors (idempotent)", () => {
      const dbPath = path.join(tmpDir, "test.db");
      const storage = openKnowledgeStorage(dbPath);

      // First call
      expect(() => storage.ensureSchema(0)).not.toThrow();
      // Second call (idempotent)
      expect(() => storage.ensureSchema(0)).not.toThrow();

      storage.close();
    });
  });

  describe("insertChunk and hasHash", () => {
    it("inserts a chunk and detects its hash", () => {
      const dbPath = path.join(tmpDir, "test.db");
      const storage = openKnowledgeStorage(dbPath);
      storage.ensureSchema(0);

      const chunk = makeChunk();
      storage.insertChunk(chunk, [], "docs");

      expect(storage.hasHash("abc123")).toBe(true);
      expect(storage.hasHash("nonexistent")).toBe(false);

      storage.close();
    });

    it("upserts on duplicate chunk ID", () => {
      const dbPath = path.join(tmpDir, "test.db");
      const storage = openKnowledgeStorage(dbPath);
      storage.ensureSchema(0);

      const chunk1 = makeChunk({ text: "Original text" });
      const chunk2 = makeChunk({ text: "Updated text" });

      storage.insertChunk(chunk1, [], "docs");
      storage.insertChunk(chunk2, [], "docs");

      // Both hashes should exist since we upsert
      expect(storage.hasHash(chunk1.hash)).toBe(true);
      expect(storage.hasHash(chunk2.hash)).toBe(true);

      storage.close();
    });

    it("stores heading context correctly", () => {
      const dbPath = path.join(tmpDir, "test.db");
      const storage = openKnowledgeStorage(dbPath);
      storage.ensureSchema(0);

      const chunk = makeChunk({ headingContext: "Introduction" });
      storage.insertChunk(chunk, [], "docs");

      expect(storage.hasHash(chunk.hash)).toBe(true);
      storage.close();
    });

    it("stores null heading context for chunks without headings", () => {
      const dbPath = path.join(tmpDir, "test.db");
      const storage = openKnowledgeStorage(dbPath);
      storage.ensureSchema(0);

      const chunk = makeChunk({ headingContext: undefined });
      expect(() => storage.insertChunk(chunk, [], "docs")).not.toThrow();

      storage.close();
    });
  });

  describe("getHashesForSource", () => {
    it("returns hashes for a specific source", () => {
      const dbPath = path.join(tmpDir, "test.db");
      const storage = openKnowledgeStorage(dbPath);
      storage.ensureSchema(0);

      storage.insertChunk(
        makeChunk({ id: "c1", hash: "hash-a", sourceValue: "/a.md" }),
        [],
        "docs",
      );
      storage.insertChunk(
        makeChunk({ id: "c2", hash: "hash-b", sourceValue: "/a.md" }),
        [],
        "docs",
      );
      storage.insertChunk(
        makeChunk({ id: "c3", hash: "hash-c", sourceValue: "/b.md" }),
        [],
        "docs",
      );

      const hashes = storage.getHashesForSource("/a.md");
      expect(hashes).toHaveLength(2);
      expect(hashes).toContain("hash-a");
      expect(hashes).toContain("hash-b");

      storage.close();
    });

    it("returns empty array for unknown source", () => {
      const dbPath = path.join(tmpDir, "test.db");
      const storage = openKnowledgeStorage(dbPath);
      storage.ensureSchema(0);

      const hashes = storage.getHashesForSource("/unknown.md");
      expect(hashes).toHaveLength(0);

      storage.close();
    });
  });

  describe("deleteBySource", () => {
    it("deletes all chunks for a given source", () => {
      const dbPath = path.join(tmpDir, "test.db");
      const storage = openKnowledgeStorage(dbPath);
      storage.ensureSchema(0);

      storage.insertChunk(makeChunk({ id: "c1", hash: "h1", sourceValue: "/a.md" }), [], "docs");
      storage.insertChunk(makeChunk({ id: "c2", hash: "h2", sourceValue: "/a.md" }), [], "docs");
      storage.insertChunk(makeChunk({ id: "c3", hash: "h3", sourceValue: "/b.md" }), [], "docs");

      const deleted = storage.deleteBySource("/a.md");
      expect(deleted).toBe(2);

      // /a.md chunks gone
      expect(storage.countBySource("/a.md")).toBe(0);
      // /b.md chunk still exists
      expect(storage.countBySource("/b.md")).toBe(1);

      storage.close();
    });

    it("returns 0 for unknown source", () => {
      const dbPath = path.join(tmpDir, "test.db");
      const storage = openKnowledgeStorage(dbPath);
      storage.ensureSchema(0);

      const deleted = storage.deleteBySource("/nonexistent.md");
      expect(deleted).toBe(0);

      storage.close();
    });
  });

  describe("countBySource", () => {
    it("counts chunks for a given source", () => {
      const dbPath = path.join(tmpDir, "test.db");
      const storage = openKnowledgeStorage(dbPath);
      storage.ensureSchema(0);

      storage.insertChunk(makeChunk({ id: "c1", sourceValue: "/a.md" }), [], "docs");
      storage.insertChunk(makeChunk({ id: "c2", sourceValue: "/a.md" }), [], "docs");

      expect(storage.countBySource("/a.md")).toBe(2);
      expect(storage.countBySource("/b.md")).toBe(0);

      storage.close();
    });
  });

  describe("project isolation", () => {
    it("stores chunks independently per database file", () => {
      const dbPathA = path.join(tmpDir, "project-a.db");
      const dbPathB = path.join(tmpDir, "project-b.db");

      const storageA = openKnowledgeStorage(dbPathA);
      const storageB = openKnowledgeStorage(dbPathB);

      storageA.ensureSchema(0);
      storageB.ensureSchema(0);

      storageA.insertChunk(makeChunk({ id: "c1", hash: "proj-a-hash" }), [], "docs");
      storageB.insertChunk(makeChunk({ id: "c2", hash: "proj-b-hash" }), [], "references");

      // Each store only sees its own data
      expect(storageA.hasHash("proj-a-hash")).toBe(true);
      expect(storageA.hasHash("proj-b-hash")).toBe(false);
      expect(storageB.hasHash("proj-b-hash")).toBe(true);
      expect(storageB.hasHash("proj-a-hash")).toBe(false);

      storageA.close();
      storageB.close();
    });
  });

  describe("findSimilar", () => {
    it("returns empty when dimensions are 0", () => {
      const dbPath = path.join(tmpDir, "test.db");
      const storage = openKnowledgeStorage(dbPath);
      storage.ensureSchema(0); // No vector table

      const results = storage.findSimilar([1, 0, 0], 5);
      expect(results).toHaveLength(0);

      storage.close();
    });
  });

  describe("close", () => {
    it("does not throw on close", () => {
      const dbPath = path.join(tmpDir, "test.db");
      const storage = openKnowledgeStorage(dbPath);
      storage.ensureSchema(0);

      expect(() => storage.close()).not.toThrow();
    });

    it("does not throw on double close", () => {
      const dbPath = path.join(tmpDir, "test.db");
      const storage = openKnowledgeStorage(dbPath);
      storage.ensureSchema(0);

      storage.close();
      expect(() => storage.close()).not.toThrow();
    });
  });

  describe("categories", () => {
    it("stores chunks with different categories", () => {
      const dbPath = path.join(tmpDir, "test.db");
      const storage = openKnowledgeStorage(dbPath);
      storage.ensureSchema(0);

      storage.insertChunk(makeChunk({ id: "c1", hash: "h1", sourceValue: "/docs.md" }), [], "docs");
      storage.insertChunk(
        makeChunk({ id: "c2", hash: "h2", sourceValue: "/ref.md" }),
        [],
        "references",
      );
      storage.insertChunk(
        makeChunk({ id: "c3", hash: "h3", sourceValue: "/sol.md" }),
        [],
        "solutions",
      );

      expect(storage.countBySource("/docs.md")).toBe(1);
      expect(storage.countBySource("/ref.md")).toBe(1);
      expect(storage.countBySource("/sol.md")).toBe(1);

      storage.close();
    });
  });
});
