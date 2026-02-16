import { describe, expect, it, vi } from "vitest";

import { hashText } from "../memory/internal.js";
import type {
  DocumentChunk,
  ImportPipelineOptions,
  ImportProgressUpdate,
  ImportSource,
  KnowledgeStorageAdapter,
  ParsedDocument,
  PipelineDeps,
} from "./types.js";
import { embedChunksInBatches, importDocument } from "./pipeline.js";

// -- Helpers --

function makeParsedDoc(content: string, source?: Partial<ImportSource>): ParsedDocument {
  const src: ImportSource = {
    type: "file",
    value: source?.value ?? "/docs/test.md",
    label: source?.label,
    ...source,
  };
  return {
    title: "Test Document",
    content,
    source: src,
    contentHash: hashText(content),
    contentType: "markdown",
    rawByteLength: Buffer.byteLength(content),
    fetchedAt: new Date().toISOString(),
  };
}

function makeMockStorage(): KnowledgeStorageAdapter {
  const chunks: DocumentChunk[] = [];
  const hashes = new Set<string>();

  return {
    ensureSchema: vi.fn(),
    insertChunk: vi.fn((chunk: DocumentChunk) => {
      chunks.push(chunk);
      hashes.add(chunk.hash);
    }),
    hasHash: vi.fn((hash: string) => hashes.has(hash)),
    getHashesForSource: vi.fn(() => []),
    findSimilar: vi.fn(() => []),
    deleteBySource: vi.fn(() => 0),
    countBySource: vi.fn(() => 0),
    close: vi.fn(),
  };
}

function makeMockDeps(overrides?: Partial<PipelineDeps>): PipelineDeps {
  return {
    embedBatch:
      overrides?.embedBatch ?? vi.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3])),
    embeddingModel: overrides?.embeddingModel ?? "test-model",
    storage: overrides?.storage ?? makeMockStorage(),
    chunking: overrides?.chunking ?? { tokens: 400, overlap: 80, headingAware: true },
    dedup: overrides?.dedup ?? {
      similarityThreshold: 0.95,
      hashDedup: true,
      similarityDedup: true,
    },
    embeddingBatchSize: overrides?.embeddingBatchSize ?? 50,
    category: overrides?.category ?? "docs",
  };
}

function makeOptions(overrides?: Partial<ImportPipelineOptions>): ImportPipelineOptions {
  return {
    source: overrides?.source ?? { type: "file", value: "/docs/test.md" },
    agentId: overrides?.agentId ?? "test-agent",
    projectId: overrides?.projectId,
    force: overrides?.force,
    dryRun: overrides?.dryRun,
    signal: overrides?.signal,
    onProgress: overrides?.onProgress,
  };
}

// -- Tests --

describe("embedChunksInBatches", () => {
  it("embeds all chunks in a single batch", async () => {
    const chunks: DocumentChunk[] = [
      {
        id: "c1",
        text: "Hello",
        hash: "h1",
        index: 0,
        total: 2,
        startLine: 1,
        endLine: 1,
        sourceValue: "/test.md",
      },
      {
        id: "c2",
        text: "World",
        hash: "h2",
        index: 1,
        total: 2,
        startLine: 2,
        endLine: 2,
        sourceValue: "/test.md",
      },
    ];
    const embedBatch = vi.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2]));

    const result = await embedChunksInBatches(chunks, embedBatch, 50);
    expect(result).toHaveLength(2);
    expect(embedBatch).toHaveBeenCalledTimes(1);
  });

  it("splits into multiple batches when batch size is small", async () => {
    const chunks: DocumentChunk[] = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`,
      text: `Chunk ${i}`,
      hash: `h${i}`,
      index: i,
      total: 5,
      startLine: i + 1,
      endLine: i + 1,
      sourceValue: "/test.md",
    }));
    const embedBatch = vi.fn(async (texts: string[]) => texts.map(() => [0.1]));

    const result = await embedChunksInBatches(chunks, embedBatch, 2);
    expect(result).toHaveLength(5);
    expect(embedBatch).toHaveBeenCalledTimes(3); // 2 + 2 + 1
  });

  it("fires onBatchComplete callback", async () => {
    const chunks: DocumentChunk[] = Array.from({ length: 4 }, (_, i) => ({
      id: `c${i}`,
      text: `Chunk ${i}`,
      hash: `h${i}`,
      index: i,
      total: 4,
      startLine: 1,
      endLine: 1,
      sourceValue: "/test.md",
    }));
    const embedBatch = vi.fn(async (texts: string[]) => texts.map(() => [0.1]));
    const onBatchComplete = vi.fn();

    await embedChunksInBatches(chunks, embedBatch, 2, undefined, onBatchComplete);

    expect(onBatchComplete).toHaveBeenCalledTimes(2);
    expect(onBatchComplete).toHaveBeenCalledWith(2, 4);
    expect(onBatchComplete).toHaveBeenCalledWith(4, 4);
  });

  it("throws on abort signal", async () => {
    const chunks: DocumentChunk[] = [
      {
        id: "c1",
        text: "Hello",
        hash: "h1",
        index: 0,
        total: 1,
        startLine: 1,
        endLine: 1,
        sourceValue: "/test.md",
      },
    ];
    const embedBatch = vi.fn();
    const controller = new AbortController();
    controller.abort();

    await expect(embedChunksInBatches(chunks, embedBatch, 50, controller.signal)).rejects.toThrow(
      "Import aborted",
    );
  });
});

describe("importDocument", () => {
  describe("successful import", () => {
    it("processes a document through the full pipeline", async () => {
      const storage = makeMockStorage();
      const deps = makeMockDeps({ storage });
      const options = makeOptions();
      const doc = makeParsedDoc("# Heading\n\nSome content here.");

      const result = await importDocument(doc, options, deps);

      expect(result.status).toBe("imported");
      expect(result.chunksStored).toBeGreaterThan(0);
      expect(result.contentHash).toBe(doc.contentHash);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
      expect((storage.insertChunk as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
        0,
      );
    });

    it("returns correct chunk counts", async () => {
      const storage = makeMockStorage();
      const deps = makeMockDeps({ storage });
      const options = makeOptions();
      const doc = makeParsedDoc("Paragraph one.\n\nParagraph two.");

      const result = await importDocument(doc, options, deps);

      expect(result.chunksStored).toBeGreaterThan(0);
      expect(result.chunksSkipped).toBe(0);
    });
  });

  describe("empty document", () => {
    it("handles empty content gracefully", async () => {
      const deps = makeMockDeps();
      const options = makeOptions();
      const doc = makeParsedDoc("");

      const result = await importDocument(doc, options, deps);

      expect(result.status).toBe("imported");
      expect(result.chunksStored).toBe(0);
      expect(result.chunksSkipped).toBe(0);
    });
  });

  describe("dry-run mode", () => {
    it("does not store chunks in dry-run mode", async () => {
      const storage = makeMockStorage();
      const deps = makeMockDeps({ storage });
      const options = makeOptions({ dryRun: true });
      const doc = makeParsedDoc("Some content to import.");

      const result = await importDocument(doc, options, deps);

      expect(result.status).toBe("dry-run");
      expect(result.chunksStored).toBe(0);
      expect((storage.insertChunk as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    });

    it("does not call embedBatch in dry-run mode", async () => {
      const embedBatch = vi.fn();
      const deps = makeMockDeps({ embedBatch });
      const options = makeOptions({ dryRun: true });
      const doc = makeParsedDoc("Content here.");

      await importDocument(doc, options, deps);

      expect(embedBatch).not.toHaveBeenCalled();
    });
  });

  describe("progress callbacks", () => {
    it("fires progress callbacks for each stage", async () => {
      const progressUpdates: ImportProgressUpdate[] = [];
      const deps = makeMockDeps();
      const options = makeOptions({
        onProgress: (update) => progressUpdates.push(update),
      });
      const doc = makeParsedDoc("Some content for progress tracking.");

      await importDocument(doc, options, deps);

      const stages = progressUpdates.map((u) => u.stage);
      expect(stages).toContain("chunk");
      expect(stages).toContain("embed");
      expect(stages).toContain("dedup");
      expect(stages).toContain("store");
    });

    it("includes document title as label", async () => {
      const progressUpdates: ImportProgressUpdate[] = [];
      const deps = makeMockDeps();
      const options = makeOptions({
        onProgress: (update) => progressUpdates.push(update),
      });
      const doc = makeParsedDoc("Content.");

      await importDocument(doc, options, deps);

      const withLabel = progressUpdates.find((u) => u.label);
      expect(withLabel?.label).toBe("Test Document");
    });
  });

  describe("abort signal", () => {
    it("returns failed status when aborted before chunk stage", async () => {
      const controller = new AbortController();
      controller.abort();

      const deps = makeMockDeps();
      const options = makeOptions({ signal: controller.signal });
      const doc = makeParsedDoc("Content to abort.");

      const result = await importDocument(doc, options, deps);

      expect(result.status).toBe("failed");
      expect(result.error).toContain("aborted");
    });
  });

  describe("error handling", () => {
    it("returns failed status when embedding throws", async () => {
      const embedBatch = vi.fn(async () => {
        throw new Error("Embedding API error");
      });
      const deps = makeMockDeps({ embedBatch });
      const options = makeOptions();
      const doc = makeParsedDoc("Content that will fail embedding.");

      const result = await importDocument(doc, options, deps);

      expect(result.status).toBe("failed");
      expect(result.error).toContain("Embedding API error");
      expect(result.chunksStored).toBe(0);
    });

    it("captures error message in result", async () => {
      const embedBatch = vi.fn(async () => {
        throw new Error("Rate limit exceeded");
      });
      const deps = makeMockDeps({ embedBatch });
      const options = makeOptions();
      const doc = makeParsedDoc("Content.");

      const result = await importDocument(doc, options, deps);

      expect(result.error).toBe("Rate limit exceeded");
    });

    it("includes duration even on failure", async () => {
      const embedBatch = vi.fn(async () => {
        throw new Error("fail");
      });
      const deps = makeMockDeps({ embedBatch });
      const options = makeOptions();
      const doc = makeParsedDoc("Content.");

      const result = await importDocument(doc, options, deps);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("deduplication integration", () => {
    it("counts skipped chunks from dedup", async () => {
      // Make storage report that hash already exists for all chunks
      const storage = makeMockStorage();
      (storage.hasHash as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const deps = makeMockDeps({ storage });
      const options = makeOptions();
      const doc = makeParsedDoc("Already imported content.");

      const result = await importDocument(doc, options, deps);

      expect(result.chunksSkipped).toBeGreaterThan(0);
      expect(result.chunksStored).toBe(0);
    });
  });

  describe("source reference", () => {
    it("returns the original source in result", async () => {
      const source: ImportSource = {
        type: "url",
        value: "https://example.com/docs",
        label: "Example Docs",
      };
      const deps = makeMockDeps();
      const options = makeOptions({ source });
      const doc = makeParsedDoc("Content.", { value: source.value, label: source.label });

      const result = await importDocument(doc, options, deps);

      expect(result.source).toEqual(source);
    });
  });

  describe("category", () => {
    it("passes category to storage.insertChunk", async () => {
      const storage = makeMockStorage();
      const deps = makeMockDeps({ storage, category: "references" });
      const options = makeOptions();
      const doc = makeParsedDoc("Reference content.");

      await importDocument(doc, options, deps);

      if ((storage.insertChunk as ReturnType<typeof vi.fn>).mock.calls.length > 0) {
        const lastCall = (storage.insertChunk as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(lastCall?.[2]).toBe("references");
      }
    });
  });
});
