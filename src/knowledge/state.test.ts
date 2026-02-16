import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createFileStateStore, readStateFile, resolveStatePath, writeStateFile } from "./state.js";
import type { ImportState } from "./types.js";

// -- Helpers --

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kb-state-test-"));
}

function makeState(overrides?: Partial<ImportState>): ImportState {
  return {
    sourceValue: "https://example.com/docs",
    sourceType: "url",
    contentHash: "abc123",
    status: "original",
    lastImportedAt: new Date().toISOString(),
    chunkCount: 5,
    chunkIds: ["c1", "c2", "c3", "c4", "c5"],
    label: "Example Docs",
    ...overrides,
  };
}

describe("resolveStatePath", () => {
  it("returns knowledge-state.json in the given directory", () => {
    const result = resolveStatePath("/home/user/.crocbot/agents/default");
    expect(result).toBe(path.join("/home/user/.crocbot/agents/default", "knowledge-state.json"));
  });
});

describe("readStateFile", () => {
  let dir: string;
  beforeEach(() => {
    dir = tmpDir();
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns empty state for missing file", () => {
    const result = readStateFile(path.join(dir, "missing.json"));
    expect(result.version).toBe(1);
    expect(result.sources).toEqual({});
  });

  it("returns empty state for corrupt file", () => {
    const filePath = path.join(dir, "corrupt.json");
    fs.writeFileSync(filePath, "not json at all", "utf-8");
    const result = readStateFile(filePath);
    expect(result.version).toBe(1);
    expect(result.sources).toEqual({});
  });

  it("returns empty state for file with wrong structure", () => {
    const filePath = path.join(dir, "bad.json");
    fs.writeFileSync(filePath, JSON.stringify({ foo: "bar" }), "utf-8");
    const result = readStateFile(filePath);
    expect(result.version).toBe(1);
    expect(result.sources).toEqual({});
  });

  it("reads valid state file", () => {
    const filePath = path.join(dir, "valid.json");
    const state = { version: 1, sources: { "https://example.com": makeState() } };
    fs.writeFileSync(filePath, JSON.stringify(state), "utf-8");
    const result = readStateFile(filePath);
    expect(result.version).toBe(1);
    expect(Object.keys(result.sources)).toHaveLength(1);
    expect(result.sources["https://example.com"]?.contentHash).toBe("abc123");
  });
});

describe("writeStateFile", () => {
  let dir: string;
  beforeEach(() => {
    dir = tmpDir();
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("writes state file atomically", () => {
    const filePath = path.join(dir, "state.json");
    const state = { version: 1, sources: { "https://example.com": makeState() } };
    writeStateFile(filePath, state);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(content.version).toBe(1);
    expect(content.sources["https://example.com"].contentHash).toBe("abc123");
  });

  it("creates parent directory if missing", () => {
    const filePath = path.join(dir, "nested", "deep", "state.json");
    const state = { version: 1, sources: {} };
    writeStateFile(filePath, state);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("overwrites existing state file", () => {
    const filePath = path.join(dir, "state.json");
    writeStateFile(filePath, { version: 1, sources: {} });
    const updated = {
      version: 1,
      sources: { "https://new.com": makeState({ sourceValue: "https://new.com" }) },
    };
    writeStateFile(filePath, updated);
    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(Object.keys(content.sources)).toHaveLength(1);
    expect(content.sources["https://new.com"]).toBeDefined();
  });
});

describe("createFileStateStore", () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = tmpDir();
    filePath = path.join(dir, "knowledge-state.json");
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns null for missing source", () => {
    const store = createFileStateStore(filePath);
    expect(store.get("https://missing.com")).toBeNull();
  });

  it("upserts and retrieves a source", () => {
    const store = createFileStateStore(filePath);
    const state = makeState();
    store.upsert(state);
    const retrieved = store.get(state.sourceValue);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.contentHash).toBe("abc123");
    expect(retrieved?.chunkCount).toBe(5);
  });

  it("persists state to disk on upsert", () => {
    const store = createFileStateStore(filePath);
    store.upsert(makeState());
    // Create a new store from the same file
    const store2 = createFileStateStore(filePath);
    expect(store2.get("https://example.com/docs")).not.toBeNull();
  });

  it("lists all sources", () => {
    const store = createFileStateStore(filePath);
    store.upsert(makeState({ sourceValue: "https://a.com" }));
    store.upsert(makeState({ sourceValue: "https://b.com" }));
    const all = store.list();
    expect(all).toHaveLength(2);
  });

  it("lists filtered by status", () => {
    const store = createFileStateStore(filePath);
    store.upsert(makeState({ sourceValue: "https://a.com", status: "original" }));
    store.upsert(makeState({ sourceValue: "https://b.com", status: "removed" }));
    const originals = store.list({ status: "original" });
    expect(originals).toHaveLength(1);
    expect(originals[0]?.sourceValue).toBe("https://a.com");
  });

  it("marks a source as removed", () => {
    const store = createFileStateStore(filePath);
    store.upsert(makeState());
    store.markRemoved("https://example.com/docs");
    const state = store.get("https://example.com/docs");
    expect(state?.status).toBe("removed");
    expect(state?.chunkCount).toBe(0);
    expect(state?.chunkIds).toEqual([]);
  });

  it("markRemoved is no-op for unknown source", () => {
    const store = createFileStateStore(filePath);
    store.markRemoved("https://missing.com");
    expect(store.list()).toHaveLength(0);
  });

  it("deletes a source", () => {
    const store = createFileStateStore(filePath);
    store.upsert(makeState());
    store.delete("https://example.com/docs");
    expect(store.get("https://example.com/docs")).toBeNull();
    expect(store.list()).toHaveLength(0);
  });

  it("delete persists to disk", () => {
    const store = createFileStateStore(filePath);
    store.upsert(makeState());
    store.delete("https://example.com/docs");
    const store2 = createFileStateStore(filePath);
    expect(store2.get("https://example.com/docs")).toBeNull();
  });

  it("updates existing source on upsert", () => {
    const store = createFileStateStore(filePath);
    store.upsert(makeState({ contentHash: "first" }));
    store.upsert(makeState({ contentHash: "second" }));
    const retrieved = store.get("https://example.com/docs");
    expect(retrieved?.contentHash).toBe("second");
    expect(store.list()).toHaveLength(1);
  });
});
