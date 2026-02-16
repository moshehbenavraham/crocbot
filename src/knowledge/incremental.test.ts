import { describe, expect, it, vi } from "vitest";

import { actionLabel, applyIncremental, classifySource } from "./incremental.js";
import type {
  ImportState,
  ImportStateStore,
  IncrementalResult,
  KnowledgeStorageAdapter,
  ParsedDocument,
} from "./types.js";

// -- Helpers --

function makeDoc(overrides?: Partial<ParsedDocument>): ParsedDocument {
  return {
    title: "Test Document",
    content: "Some test content",
    source: { type: "url", value: "https://example.com/docs" },
    contentHash: "hash123",
    contentType: "markdown",
    rawByteLength: 100,
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeState(overrides?: Partial<ImportState>): ImportState {
  return {
    sourceValue: "https://example.com/docs",
    sourceType: "url",
    contentHash: "hash123",
    status: "original",
    lastImportedAt: new Date().toISOString(),
    chunkCount: 5,
    chunkIds: ["c1", "c2", "c3", "c4", "c5"],
    ...overrides,
  };
}

function mockStateStore(entries?: Record<string, ImportState>): ImportStateStore {
  const data = new Map(Object.entries(entries ?? {}));
  return {
    get: (key: string) => data.get(key) ?? null,
    list: () => Array.from(data.values()),
    upsert: vi.fn(),
    markRemoved: vi.fn(),
    delete: vi.fn(),
  };
}

function mockStorage(): KnowledgeStorageAdapter {
  return {
    ensureSchema: vi.fn(),
    insertChunk: vi.fn(),
    hasHash: vi.fn().mockReturnValue(false),
    getHashesForSource: vi.fn().mockReturnValue([]),
    findSimilar: vi.fn().mockReturnValue([]),
    deleteBySource: vi.fn().mockReturnValue(0),
    countBySource: vi.fn().mockReturnValue(0),
    close: vi.fn(),
  };
}

describe("classifySource", () => {
  it("classifies a new source", () => {
    const doc = makeDoc();
    const store = mockStateStore();
    const result = classifySource(doc, store);
    expect(result.action).toBe("new");
    expect(result.sourceValue).toBe("https://example.com/docs");
    expect(result.incomingHash).toBe("hash123");
    expect(result.storedHash).toBeNull();
    expect(result.previousChunkCount).toBe(0);
  });

  it("classifies an unchanged source", () => {
    const doc = makeDoc({ contentHash: "hash123" });
    const store = mockStateStore({
      "https://example.com/docs": makeState({ contentHash: "hash123" }),
    });
    const result = classifySource(doc, store);
    expect(result.action).toBe("unchanged");
    expect(result.storedHash).toBe("hash123");
    expect(result.previousChunkCount).toBe(5);
  });

  it("classifies a changed source", () => {
    const doc = makeDoc({ contentHash: "newhash456" });
    const store = mockStateStore({
      "https://example.com/docs": makeState({ contentHash: "oldhash789" }),
    });
    const result = classifySource(doc, store);
    expect(result.action).toBe("changed");
    expect(result.incomingHash).toBe("newhash456");
    expect(result.storedHash).toBe("oldhash789");
    expect(result.previousChunkCount).toBe(5);
  });

  it("uses source value for lookup", () => {
    const doc = makeDoc({
      source: { type: "file", value: "/path/to/doc.md" },
      contentHash: "hash1",
    });
    const store = mockStateStore({
      "/path/to/doc.md": makeState({
        sourceValue: "/path/to/doc.md",
        sourceType: "file",
        contentHash: "hash1",
      }),
    });
    const result = classifySource(doc, store);
    expect(result.action).toBe("unchanged");
  });
});

describe("applyIncremental", () => {
  it("returns false for unchanged sources (skip)", () => {
    const result: IncrementalResult = {
      action: "unchanged",
      sourceValue: "https://example.com",
      incomingHash: "hash1",
      storedHash: "hash1",
      previousChunkCount: 5,
    };
    const storage = mockStorage();
    const deleteSpy = vi.fn().mockReturnValue(0);
    storage.deleteBySource = deleteSpy;
    expect(applyIncremental(result, storage)).toBe(false);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("returns true for new sources (proceed)", () => {
    const result: IncrementalResult = {
      action: "new",
      sourceValue: "https://example.com",
      incomingHash: "hash1",
      storedHash: null,
      previousChunkCount: 0,
    };
    const storage = mockStorage();
    const deleteSpy = vi.fn().mockReturnValue(0);
    storage.deleteBySource = deleteSpy;
    expect(applyIncremental(result, storage)).toBe(true);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("returns true and deletes old chunks for changed sources", () => {
    const result: IncrementalResult = {
      action: "changed",
      sourceValue: "https://example.com",
      incomingHash: "newhash",
      storedHash: "oldhash",
      previousChunkCount: 5,
    };
    const storage = mockStorage();
    const deleteSpy = vi.fn().mockReturnValue(0);
    storage.deleteBySource = deleteSpy;
    expect(applyIncremental(result, storage)).toBe(true);
    expect(deleteSpy).toHaveBeenCalledWith("https://example.com");
  });
});

describe("actionLabel", () => {
  it("returns correct label for new", () => {
    expect(actionLabel("new")).toBe("new source");
  });

  it("returns correct label for unchanged", () => {
    expect(actionLabel("unchanged")).toBe("unchanged (skipping)");
  });

  it("returns correct label for changed", () => {
    expect(actionLabel("changed")).toBe("changed (re-importing)");
  });
});
