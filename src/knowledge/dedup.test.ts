import { describe, expect, it } from "vitest";

import type { DocumentChunk, KnowledgeStorageAdapter, VectorSearchResult } from "./types.js";
import {
  checkBatchSimilarity,
  checkHashDuplicate,
  checkSimilarityDuplicate,
  deduplicateChunks,
} from "./dedup.js";

// -- Helpers --

function makeChunk(overrides?: Partial<DocumentChunk>): DocumentChunk {
  return {
    id: overrides?.id ?? "chunk-1",
    text: overrides?.text ?? "Sample text",
    hash: overrides?.hash ?? "abc123",
    index: overrides?.index ?? 0,
    total: overrides?.total ?? 1,
    startLine: overrides?.startLine ?? 1,
    endLine: overrides?.endLine ?? 1,
    sourceValue: overrides?.sourceValue ?? "/test.md",
    headingContext: overrides?.headingContext,
  };
}

function makeMockStorage(options?: {
  hashes?: Set<string>;
  similarResults?: VectorSearchResult[];
}): KnowledgeStorageAdapter {
  const hashes = options?.hashes ?? new Set<string>();
  const similarResults = options?.similarResults ?? [];

  return {
    ensureSchema: () => {},
    insertChunk: () => {},
    hasHash: (hash: string) => hashes.has(hash),
    getHashesForSource: () => [],
    findSimilar: () => similarResults,
    deleteBySource: () => 0,
    countBySource: () => 0,
    close: () => {},
  };
}

describe("checkHashDuplicate", () => {
  it("returns isDuplicate: true when hash exists in store", () => {
    const chunk = makeChunk({ hash: "existing-hash" });
    const storage = makeMockStorage({ hashes: new Set(["existing-hash"]) });
    const result = checkHashDuplicate(chunk, storage);

    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toBe("hash");
  });

  it("returns isDuplicate: false when hash does not exist", () => {
    const chunk = makeChunk({ hash: "new-hash" });
    const storage = makeMockStorage({ hashes: new Set(["other-hash"]) });
    const result = checkHashDuplicate(chunk, storage);

    expect(result.isDuplicate).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it("returns isDuplicate: false for empty store", () => {
    const chunk = makeChunk();
    const storage = makeMockStorage();
    const result = checkHashDuplicate(chunk, storage);

    expect(result.isDuplicate).toBe(false);
  });
});

describe("checkSimilarityDuplicate", () => {
  it("returns isDuplicate: true when similarity exceeds threshold", () => {
    const embedding = [1, 0, 0];
    const storage = makeMockStorage({
      similarResults: [{ chunkId: "existing-1", distance: 0.02, similarity: 0.98 }],
    });

    const result = checkSimilarityDuplicate(embedding, storage, 0.95);
    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toBe("similarity");
    expect(result.similarityScore).toBe(0.98);
  });

  it("returns isDuplicate: false when similarity is below threshold", () => {
    const embedding = [1, 0, 0];
    const storage = makeMockStorage({
      similarResults: [{ chunkId: "existing-1", distance: 0.1, similarity: 0.9 }],
    });

    const result = checkSimilarityDuplicate(embedding, storage, 0.95);
    expect(result.isDuplicate).toBe(false);
  });

  it("returns isDuplicate: false for empty store", () => {
    const embedding = [1, 0, 0];
    const storage = makeMockStorage({ similarResults: [] });

    const result = checkSimilarityDuplicate(embedding, storage, 0.95);
    expect(result.isDuplicate).toBe(false);
  });

  it("checks threshold boundary: exactly at threshold is duplicate", () => {
    const embedding = [1, 0, 0];
    const storage = makeMockStorage({
      similarResults: [{ chunkId: "existing-1", distance: 0.05, similarity: 0.95 }],
    });

    const result = checkSimilarityDuplicate(embedding, storage, 0.95);
    expect(result.isDuplicate).toBe(true);
  });

  it("checks threshold boundary: just below threshold is not duplicate", () => {
    const embedding = [1, 0, 0];
    const storage = makeMockStorage({
      similarResults: [{ chunkId: "existing-1", distance: 0.06, similarity: 0.9499 }],
    });

    const result = checkSimilarityDuplicate(embedding, storage, 0.95);
    expect(result.isDuplicate).toBe(false);
  });
});

describe("checkBatchSimilarity", () => {
  it("detects near-duplicate within batch", () => {
    // Two very similar vectors
    const embedding = [1, 0, 0];
    const existing = [[1, 0.01, 0]]; // Almost identical

    const result = checkBatchSimilarity(embedding, existing, 0.95);
    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toBe("similarity");
  });

  it("passes through dissimilar vectors", () => {
    const embedding = [1, 0, 0];
    const existing = [[0, 1, 0]]; // Orthogonal

    const result = checkBatchSimilarity(embedding, existing, 0.95);
    expect(result.isDuplicate).toBe(false);
  });

  it("handles empty existing embeddings", () => {
    const embedding = [1, 0, 0];
    const result = checkBatchSimilarity(embedding, [], 0.95);
    expect(result.isDuplicate).toBe(false);
  });
});

describe("deduplicateChunks", () => {
  it("removes hash duplicates and returns correct counts", () => {
    const chunks = [
      makeChunk({ id: "c1", hash: "existing-hash" }),
      makeChunk({ id: "c2", hash: "new-hash" }),
    ];
    const embeddings = [
      [1, 0, 0],
      [0, 1, 0],
    ];
    const storage = makeMockStorage({ hashes: new Set(["existing-hash"]) });

    const result = deduplicateChunks(chunks, embeddings, storage);

    expect(result.hashDuplicates).toBe(1);
    expect(result.unique).toHaveLength(1);
    expect(result.unique[0]?.id).toBe("c2");
  });

  it("removes similarity duplicates from store", () => {
    const chunks = [makeChunk({ id: "c1", hash: "hash-1" })];
    const embeddings = [[1, 0, 0]];
    const storage = makeMockStorage({
      similarResults: [{ chunkId: "stored-1", distance: 0.01, similarity: 0.99 }],
    });

    const result = deduplicateChunks(chunks, embeddings, storage, {
      similarityThreshold: 0.95,
    });

    expect(result.similarityDuplicates).toBe(1);
    expect(result.unique).toHaveLength(0);
  });

  it("removes in-batch similarity duplicates", () => {
    // Two chunks that are near-identical
    const chunks = [
      makeChunk({ id: "c1", hash: "hash-1" }),
      makeChunk({ id: "c2", hash: "hash-2" }),
    ];
    const embeddings = [
      [1, 0, 0],
      [1, 0.001, 0], // Nearly identical to first
    ];
    const storage = makeMockStorage(); // Empty store

    const result = deduplicateChunks(chunks, embeddings, storage, {
      similarityThreshold: 0.95,
    });

    // First chunk should pass, second should be deduped as batch similarity
    expect(result.unique).toHaveLength(1);
    expect(result.unique[0]?.id).toBe("c1");
    expect(result.similarityDuplicates).toBe(1);
  });

  it("passes all chunks when no duplicates exist", () => {
    const chunks = [
      makeChunk({ id: "c1", hash: "hash-1" }),
      makeChunk({ id: "c2", hash: "hash-2" }),
    ];
    const embeddings = [
      [1, 0, 0],
      [0, 1, 0], // Orthogonal, no similarity
    ];
    const storage = makeMockStorage();

    const result = deduplicateChunks(chunks, embeddings, storage);

    expect(result.unique).toHaveLength(2);
    expect(result.hashDuplicates).toBe(0);
    expect(result.similarityDuplicates).toBe(0);
  });

  it("applies hash dedup before similarity dedup (optimization)", () => {
    // Hash duplicate should be caught first, not requiring embedding comparison
    const chunks = [makeChunk({ id: "c1", hash: "existing-hash" })];
    const embeddings = [[1, 0, 0]];
    const storage = makeMockStorage({
      hashes: new Set(["existing-hash"]),
      similarResults: [{ chunkId: "stored-1", distance: 0.01, similarity: 0.99 }],
    });

    const result = deduplicateChunks(chunks, embeddings, storage);

    // Should count as hash duplicate, not similarity
    expect(result.hashDuplicates).toBe(1);
    expect(result.similarityDuplicates).toBe(0);
  });

  it("respects hashDedup: false option", () => {
    const chunks = [makeChunk({ id: "c1", hash: "existing-hash" })];
    const embeddings = [[1, 0, 0]];
    const storage = makeMockStorage({
      hashes: new Set(["existing-hash"]),
    });

    const result = deduplicateChunks(chunks, embeddings, storage, {
      hashDedup: false,
      similarityDedup: false,
      similarityThreshold: 0.95,
    });

    expect(result.hashDuplicates).toBe(0);
    expect(result.unique).toHaveLength(1);
  });

  it("respects similarityDedup: false option", () => {
    const chunks = [makeChunk({ id: "c1", hash: "hash-1" })];
    const embeddings = [[1, 0, 0]];
    const storage = makeMockStorage({
      similarResults: [{ chunkId: "stored-1", distance: 0.01, similarity: 0.99 }],
    });

    const result = deduplicateChunks(chunks, embeddings, storage, {
      similarityDedup: false,
      similarityThreshold: 0.95,
    });

    expect(result.similarityDuplicates).toBe(0);
    expect(result.unique).toHaveLength(1);
  });

  it("handles empty chunks array", () => {
    const storage = makeMockStorage();
    const result = deduplicateChunks([], [], storage);

    expect(result.unique).toHaveLength(0);
    expect(result.hashDuplicates).toBe(0);
    expect(result.similarityDuplicates).toBe(0);
  });
});
