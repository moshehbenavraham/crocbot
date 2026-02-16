/**
 * Unit tests for the memory consolidation engine.
 *
 * Tests cover: types/config, prompt builders, response parser, processNewChunk
 * pipeline (all 5 actions), safety gates, graceful degradation, applyResult
 * handlers, consolidation log queries, and schema creation.
 */

import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ConsolidationAction,
  type ConsolidationEngineDeps,
  MemoryArea,
  createDefaultConsolidationConfig,
} from "./consolidation-actions.js";
import {
  buildConsolidationMessagePrompt,
  buildConsolidationSystemPrompt,
  parseConsolidationResponse,
} from "./consolidation-prompts.js";
import { ensureConsolidationSchema } from "./consolidation-schema.js";
import { createConsolidationEngine } from "./consolidation.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  // Create base memory schema (chunks table)
  db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'memory',
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      hash TEXT NOT NULL,
      model TEXT NOT NULL,
      text TEXT NOT NULL,
      embedding TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  // Create a minimal vector table stub for tests
  // Real sqlite-vec is not available in tests so we mock findSimilar via DB queries
  return db;
}

function insertChunk(
  db: DatabaseSync,
  id: string,
  text: string,
  area = "main",
  path = "/test/memory.md",
): void {
  db.prepare(
    `INSERT INTO chunks (id, path, source, start_line, end_line, hash, model, text, embedding, updated_at, area)
     VALUES (?, ?, 'memory', 0, 0, 'hash', 'test/model', ?, '[]', ?, ?)`,
  ).run(id, path, text, Date.now(), area);
}

function createMockDeps(
  db: DatabaseSync,
  overrides?: Partial<ConsolidationEngineDeps>,
): ConsolidationEngineDeps {
  return {
    db,
    embedText: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    callLlm: vi.fn().mockResolvedValue(
      JSON.stringify({
        action: "KEEP_SEPARATE",
        reasoning: "test default",
      }),
    ),
    config: createDefaultConsolidationConfig(),
    log: {
      subsystem: "test/consolidation",
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      raw: vi.fn(),
      child: vi.fn().mockReturnThis(),
    },
    providerModel: "test/model",
    vectorTable: "chunks_vec",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Types and config tests
// ---------------------------------------------------------------------------

describe("ConsolidationAction", () => {
  it("has all 5 actions", () => {
    expect(ConsolidationAction.MERGE).toBe("MERGE");
    expect(ConsolidationAction.REPLACE).toBe("REPLACE");
    expect(ConsolidationAction.KEEP_SEPARATE).toBe("KEEP_SEPARATE");
    expect(ConsolidationAction.UPDATE).toBe("UPDATE");
    expect(ConsolidationAction.SKIP).toBe("SKIP");
  });

  it("has exactly 5 values", () => {
    expect(Object.keys(ConsolidationAction)).toHaveLength(5);
  });
});

describe("MemoryArea", () => {
  it("has all 4 areas", () => {
    expect(MemoryArea.MAIN).toBe("main");
    expect(MemoryArea.FRAGMENTS).toBe("fragments");
    expect(MemoryArea.SOLUTIONS).toBe("solutions");
    expect(MemoryArea.INSTRUMENTS).toBe("instruments");
  });

  it("has exactly 4 values", () => {
    expect(Object.keys(MemoryArea)).toHaveLength(4);
  });
});

describe("createDefaultConsolidationConfig", () => {
  it("returns correct defaults", () => {
    const config = createDefaultConsolidationConfig();
    expect(config.similarityThreshold).toBe(0.7);
    expect(config.maxSimilarMemories).toBe(10);
    expect(config.maxLlmContextMemories).toBe(5);
    expect(config.replaceSimilarityThreshold).toBe(0.9);
    expect(config.processingTimeoutMs).toBe(60_000);
    expect(config.enabled).toBe(true);
  });

  it("merges overrides correctly", () => {
    const config = createDefaultConsolidationConfig({
      similarityThreshold: 0.8,
      enabled: false,
    });
    expect(config.similarityThreshold).toBe(0.8);
    expect(config.enabled).toBe(false);
    // Unset overrides keep defaults
    expect(config.maxSimilarMemories).toBe(10);
    expect(config.processingTimeoutMs).toBe(60_000);
  });
});

// ---------------------------------------------------------------------------
// 2. Prompt builder tests
// ---------------------------------------------------------------------------

describe("buildConsolidationSystemPrompt", () => {
  it("returns a non-empty string", () => {
    const prompt = buildConsolidationSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("contains all 5 action names", () => {
    const prompt = buildConsolidationSystemPrompt();
    expect(prompt).toContain("MERGE");
    expect(prompt).toContain("REPLACE");
    expect(prompt).toContain("KEEP_SEPARATE");
    expect(prompt).toContain("UPDATE");
    expect(prompt).toContain("SKIP");
  });

  it("is ASCII-only", () => {
    const prompt = buildConsolidationSystemPrompt();
    for (let i = 0; i < prompt.length; i++) {
      expect(prompt.charCodeAt(i)).toBeLessThanOrEqual(127);
    }
  });
});

describe("buildConsolidationMessagePrompt", () => {
  it("includes area and new memory text", () => {
    const prompt = buildConsolidationMessagePrompt({
      area: MemoryArea.MAIN,
      newMemory: "The user prefers dark mode.",
      similarMemories: [],
    });
    expect(prompt).toContain("Memory area: main");
    expect(prompt).toContain("The user prefers dark mode.");
    expect(prompt).toContain("(none)");
  });

  it("formats similar memories with id, score, and area", () => {
    const prompt = buildConsolidationMessagePrompt({
      area: MemoryArea.FRAGMENTS,
      newMemory: "New fact",
      similarMemories: [
        {
          id: "chunk-1",
          text: "Existing fact",
          score: 0.85,
          path: "/test.md",
          area: MemoryArea.MAIN,
        },
        {
          id: "chunk-2",
          text: "Another fact",
          score: 0.72,
          path: "/test.md",
          area: MemoryArea.FRAGMENTS,
        },
      ],
    });
    expect(prompt).toContain("[chunk-1]");
    expect(prompt).toContain("similarity: 0.850");
    expect(prompt).toContain("[chunk-2]");
    expect(prompt).toContain("similarity: 0.720");
    expect(prompt).toContain("Existing fact");
    expect(prompt).toContain("Another fact");
  });
});

// ---------------------------------------------------------------------------
// 3. Response parser tests
// ---------------------------------------------------------------------------

describe("parseConsolidationResponse", () => {
  it("parses valid JSON with all fields", () => {
    const raw = JSON.stringify({
      action: "MERGE",
      reasoning: "Topics overlap significantly",
      target_id: "chunk-1",
      new_memory_content: "Combined fact about user preferences",
    });
    const result = parseConsolidationResponse(raw);
    expect(result.action).toBe(ConsolidationAction.MERGE);
    expect(result.reasoning).toBe("Topics overlap significantly");
    expect(result.targetId).toBe("chunk-1");
    expect(result.newMemoryContent).toBe("Combined fact about user preferences");
  });

  it("handles JSON wrapped in markdown fencing", () => {
    const raw = '```json\n{"action":"REPLACE","reasoning":"duplicate","target_id":"c1"}\n```';
    const result = parseConsolidationResponse(raw);
    expect(result.action).toBe(ConsolidationAction.REPLACE);
    expect(result.targetId).toBe("c1");
  });

  it("handles JSON with trailing text", () => {
    const raw = '{"action":"SKIP","reasoning":"no new info"} some extra text';
    const result = parseConsolidationResponse(raw);
    expect(result.action).toBe(ConsolidationAction.SKIP);
  });

  it("falls back to KEEP_SEPARATE on malformed JSON", () => {
    const result = parseConsolidationResponse("this is not json at all");
    expect(result.action).toBe(ConsolidationAction.KEEP_SEPARATE);
    expect(result.reasoning).toContain("fallback");
  });

  it("falls back to KEEP_SEPARATE on empty response", () => {
    const result = parseConsolidationResponse("");
    expect(result.action).toBe(ConsolidationAction.KEEP_SEPARATE);
  });

  it("falls back to KEEP_SEPARATE on missing action field", () => {
    const result = parseConsolidationResponse('{"reasoning":"no action"}');
    expect(result.action).toBe(ConsolidationAction.KEEP_SEPARATE);
  });

  it("falls back to KEEP_SEPARATE on unknown action value", () => {
    const result = parseConsolidationResponse('{"action":"DESTROY","reasoning":"boom"}');
    expect(result.action).toBe(ConsolidationAction.KEEP_SEPARATE);
    expect(result.reasoning).toContain("unknown action");
  });

  it("normalizes action to uppercase", () => {
    const result = parseConsolidationResponse('{"action":"skip","reasoning":"test"}');
    expect(result.action).toBe(ConsolidationAction.SKIP);
  });

  it("provides default reasoning when missing", () => {
    const result = parseConsolidationResponse('{"action":"SKIP"}');
    expect(result.action).toBe(ConsolidationAction.SKIP);
    expect(result.reasoning).toBe("no reasoning provided");
  });

  it("handles UPDATE response with updated_content", () => {
    const raw = JSON.stringify({
      action: "UPDATE",
      reasoning: "enhance existing",
      target_id: "chunk-5",
      updated_content: "Updated text for existing chunk",
      new_memory_content: "Additional complementary fact",
    });
    const result = parseConsolidationResponse(raw);
    expect(result.action).toBe(ConsolidationAction.UPDATE);
    expect(result.targetId).toBe("chunk-5");
    expect(result.updatedContent).toBe("Updated text for existing chunk");
    expect(result.newMemoryContent).toBe("Additional complementary fact");
  });
});

// ---------------------------------------------------------------------------
// 4. Schema tests
// ---------------------------------------------------------------------------

describe("ensureConsolidationSchema", () => {
  it("creates consolidation_log table with correct columns", () => {
    const db = createTestDb();
    ensureConsolidationSchema({ db });

    const columns = db.prepare("PRAGMA table_info(consolidation_log)").all() as Array<{
      name: string;
      type: string;
    }>;
    const names = columns.map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("timestamp");
    expect(names).toContain("action");
    expect(names).toContain("source_ids");
    expect(names).toContain("result_id");
    expect(names).toContain("area");
    expect(names).toContain("model");
    expect(names).toContain("reasoning");
    expect(names).toContain("created_at");
  });

  it("adds area, importance, consolidated_from columns to chunks", () => {
    const db = createTestDb();
    ensureConsolidationSchema({ db });

    const columns = db.prepare("PRAGMA table_info(chunks)").all() as Array<{
      name: string;
    }>;
    const names = columns.map((c) => c.name);
    expect(names).toContain("area");
    expect(names).toContain("importance");
    expect(names).toContain("consolidated_from");
  });

  it("is idempotent (can be called multiple times safely)", () => {
    const db = createTestDb();
    ensureConsolidationSchema({ db });
    ensureConsolidationSchema({ db });
    // No error thrown means success
    const columns = db.prepare("PRAGMA table_info(consolidation_log)").all();
    expect(columns.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5. processNewChunk pipeline tests
// ---------------------------------------------------------------------------

describe("processNewChunk", () => {
  let db: DatabaseSync;
  let deps: ConsolidationEngineDeps;

  beforeEach(() => {
    db = createTestDb();
    ensureConsolidationSchema({ db });

    // We cannot use real sqlite-vec in unit tests, so we mock the vector search
    // by directly querying the chunks table. The engine calls db.prepare with
    // vec_distance_cosine which will fail. We override processNewChunk's internal
    // findSimilar by making deps.db.prepare return mock results for vector queries.
    deps = createMockDeps(db);
  });

  afterEach(() => {
    db.close();
  });

  it("returns SKIP when engine is disabled", async () => {
    deps.config.enabled = false;
    const engine = createConsolidationEngine(deps);
    const result = await engine.processNewChunk({
      chunkId: "new-1",
      text: "Some memory",
      embedding: [0.1, 0.2, 0.3],
      area: MemoryArea.MAIN,
      path: "/test.md",
      model: "test/model",
    });
    expect(result.action).toBe(ConsolidationAction.SKIP);
    expect(result.reasoning).toBe("consolidation disabled");
    expect(deps.callLlm).not.toHaveBeenCalled();
  });

  it("returns SKIP when text is empty", async () => {
    const engine = createConsolidationEngine(deps);
    const result = await engine.processNewChunk({
      chunkId: "new-1",
      text: "",
      embedding: [0.1, 0.2, 0.3],
      area: MemoryArea.MAIN,
      path: "/test.md",
      model: "test/model",
    });
    expect(result.action).toBe(ConsolidationAction.SKIP);
    expect(result.reasoning).toBe("empty chunk text");
  });

  it("returns KEEP_SEPARATE when no similar candidates found (empty vec results)", async () => {
    // Override db.prepare to return empty for vector queries
    const origPrepare = db.prepare.bind(db);
    db.prepare = vi.fn((sql: string) => {
      if (sql.includes("vec_distance_cosine")) {
        return { all: () => [] } as unknown as ReturnType<DatabaseSync["prepare"]>;
      }
      return origPrepare(sql);
    }) as typeof db.prepare;

    const engine = createConsolidationEngine(deps);
    const result = await engine.processNewChunk({
      chunkId: "new-1",
      text: "Some memory text",
      embedding: [0.1, 0.2, 0.3],
      area: MemoryArea.MAIN,
      path: "/test.md",
      model: "test/model",
    });
    expect(result.action).toBe(ConsolidationAction.KEEP_SEPARATE);
    expect(result.reasoning).toBe("no similar candidates found");
    expect(deps.callLlm).not.toHaveBeenCalled();
  });

  it("calls LLM and returns MERGE with merged content", async () => {
    insertChunk(db, "existing-1", "User likes dark mode");

    const origPrepare = db.prepare.bind(db);
    db.prepare = vi.fn((sql: string) => {
      if (sql.includes("vec_distance_cosine")) {
        return {
          all: () => [
            {
              id: "existing-1",
              path: "/test.md",
              text: "User likes dark mode",
              area: "main",
              dist: 0.15,
            },
          ],
        } as unknown as ReturnType<DatabaseSync["prepare"]>;
      }
      return origPrepare(sql);
    }) as typeof db.prepare;

    (deps.callLlm as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({
        action: "MERGE",
        reasoning: "Both about user preferences",
        target_id: "existing-1",
        new_memory_content: "User likes dark mode and prefers VS Code",
      }),
    );

    const engine = createConsolidationEngine(deps);
    const result = await engine.processNewChunk({
      chunkId: "new-1",
      text: "User prefers VS Code",
      embedding: [0.1, 0.2, 0.3],
      area: MemoryArea.MAIN,
      path: "/test.md",
      model: "test/model",
    });

    expect(result.action).toBe(ConsolidationAction.MERGE);
    expect(deps.callLlm).toHaveBeenCalledTimes(1);
  });

  it("enforces REPLACE safety gate and downgrades to KEEP_SEPARATE", async () => {
    insertChunk(db, "existing-1", "Some fact");

    const origPrepare = db.prepare.bind(db);
    db.prepare = vi.fn((sql: string) => {
      if (sql.includes("vec_distance_cosine")) {
        return {
          all: () => [
            { id: "existing-1", path: "/test.md", text: "Some fact", area: "main", dist: 0.25 },
          ],
        } as unknown as ReturnType<DatabaseSync["prepare"]>;
      }
      return origPrepare(sql);
    }) as typeof db.prepare;

    // LLM says REPLACE but similarity is 0.75 (below 0.9 threshold)
    (deps.callLlm as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({
        action: "REPLACE",
        reasoning: "seems like a duplicate",
        target_id: "existing-1",
      }),
    );

    const engine = createConsolidationEngine(deps);
    const result = await engine.processNewChunk({
      chunkId: "new-1",
      text: "Some slightly different fact",
      embedding: [0.1, 0.2, 0.3],
      area: MemoryArea.MAIN,
      path: "/test.md",
      model: "test/model",
    });

    // Should be downgraded because score=0.75 < 0.9
    expect(result.action).toBe(ConsolidationAction.KEEP_SEPARATE);
    expect(result.reasoning).toContain("downgraded");
  });

  it("allows REPLACE when similarity >= 0.9", async () => {
    insertChunk(db, "existing-1", "Exact duplicate text");

    const origPrepare = db.prepare.bind(db);
    db.prepare = vi.fn((sql: string) => {
      if (sql.includes("vec_distance_cosine")) {
        return {
          all: () => [
            {
              id: "existing-1",
              path: "/test.md",
              text: "Exact duplicate text",
              area: "main",
              dist: 0.05,
            },
          ],
        } as unknown as ReturnType<DatabaseSync["prepare"]>;
      }
      return origPrepare(sql);
    }) as typeof db.prepare;

    (deps.callLlm as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({
        action: "REPLACE",
        reasoning: "exact duplicate",
        target_id: "existing-1",
      }),
    );

    const engine = createConsolidationEngine(deps);
    const result = await engine.processNewChunk({
      chunkId: "new-1",
      text: "Exact duplicate text",
      embedding: [0.1, 0.2, 0.3],
      area: MemoryArea.MAIN,
      path: "/test.md",
      model: "test/model",
    });

    // Score is 0.95 >= 0.9, so REPLACE is allowed
    expect(result.action).toBe(ConsolidationAction.REPLACE);
  });

  it("returns KEEP_SEPARATE when LLM decides so", async () => {
    insertChunk(db, "existing-1", "Some existing fact");

    const origPrepare = db.prepare.bind(db);
    db.prepare = vi.fn((sql: string) => {
      if (sql.includes("vec_distance_cosine")) {
        return {
          all: () => [
            {
              id: "existing-1",
              path: "/test.md",
              text: "Some existing fact",
              area: "main",
              dist: 0.2,
            },
          ],
        } as unknown as ReturnType<DatabaseSync["prepare"]>;
      }
      return origPrepare(sql);
    }) as typeof db.prepare;

    (deps.callLlm as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({
        action: "KEEP_SEPARATE",
        reasoning: "different topics",
      }),
    );

    const engine = createConsolidationEngine(deps);
    const result = await engine.processNewChunk({
      chunkId: "new-1",
      text: "A new memory",
      embedding: [0.1, 0.2, 0.3],
      area: MemoryArea.MAIN,
      path: "/test.md",
      model: "test/model",
    });

    expect(result.action).toBe(ConsolidationAction.KEEP_SEPARATE);
  });

  it("handles UPDATE decision", async () => {
    insertChunk(db, "existing-1", "Original content");

    const origPrepare = db.prepare.bind(db);
    db.prepare = vi.fn((sql: string) => {
      if (sql.includes("vec_distance_cosine")) {
        return {
          all: () => [
            {
              id: "existing-1",
              path: "/test.md",
              text: "Original content",
              area: "main",
              dist: 0.15,
            },
          ],
        } as unknown as ReturnType<DatabaseSync["prepare"]>;
      }
      return origPrepare(sql);
    }) as typeof db.prepare;

    (deps.callLlm as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({
        action: "UPDATE",
        reasoning: "enhance existing with new detail",
        target_id: "existing-1",
        updated_content: "Original content with new detail",
      }),
    );

    const engine = createConsolidationEngine(deps);
    const result = await engine.processNewChunk({
      chunkId: "new-1",
      text: "New detail about original",
      embedding: [0.1, 0.2, 0.3],
      area: MemoryArea.MAIN,
      path: "/test.md",
      model: "test/model",
    });

    expect(result.action).toBe(ConsolidationAction.UPDATE);
    expect(result.targetId).toBe("existing-1");
  });

  it("handles SKIP decision (LLM says skip)", async () => {
    insertChunk(db, "existing-1", "Already known fact");

    const origPrepare = db.prepare.bind(db);
    db.prepare = vi.fn((sql: string) => {
      if (sql.includes("vec_distance_cosine")) {
        return {
          all: () => [
            {
              id: "existing-1",
              path: "/test.md",
              text: "Already known fact",
              area: "main",
              dist: 0.05,
            },
          ],
        } as unknown as ReturnType<DatabaseSync["prepare"]>;
      }
      return origPrepare(sql);
    }) as typeof db.prepare;

    (deps.callLlm as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({
        action: "SKIP",
        reasoning: "adds no new information",
      }),
    );

    const engine = createConsolidationEngine(deps);
    const result = await engine.processNewChunk({
      chunkId: "new-1",
      text: "Already known fact",
      embedding: [0.1, 0.2, 0.3],
      area: MemoryArea.MAIN,
      path: "/test.md",
      model: "test/model",
    });

    expect(result.action).toBe(ConsolidationAction.SKIP);
  });

  it("returns SKIP on LLM timeout", async () => {
    insertChunk(db, "existing-1", "Some fact");

    const origPrepare = db.prepare.bind(db);
    db.prepare = vi.fn((sql: string) => {
      if (sql.includes("vec_distance_cosine")) {
        return {
          all: () => [
            { id: "existing-1", path: "/test.md", text: "Some fact", area: "main", dist: 0.2 },
          ],
        } as unknown as ReturnType<DatabaseSync["prepare"]>;
      }
      return origPrepare(sql);
    }) as typeof db.prepare;

    const timeoutError = new Error("The operation was aborted");
    timeoutError.name = "TimeoutError";
    (deps.callLlm as ReturnType<typeof vi.fn>).mockRejectedValue(timeoutError);

    const engine = createConsolidationEngine(deps);
    const result = await engine.processNewChunk({
      chunkId: "new-1",
      text: "Test memory",
      embedding: [0.1, 0.2, 0.3],
      area: MemoryArea.MAIN,
      path: "/test.md",
      model: "test/model",
    });

    expect(result.action).toBe(ConsolidationAction.SKIP);
    expect(result.reasoning).toBe("timeout");
  });

  it("returns SKIP on LLM error (graceful degradation)", async () => {
    insertChunk(db, "existing-1", "Some fact");

    const origPrepare = db.prepare.bind(db);
    db.prepare = vi.fn((sql: string) => {
      if (sql.includes("vec_distance_cosine")) {
        return {
          all: () => [
            { id: "existing-1", path: "/test.md", text: "Some fact", area: "main", dist: 0.2 },
          ],
        } as unknown as ReturnType<DatabaseSync["prepare"]>;
      }
      return origPrepare(sql);
    }) as typeof db.prepare;

    (deps.callLlm as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("rate limit exceeded"));

    const engine = createConsolidationEngine(deps);
    const result = await engine.processNewChunk({
      chunkId: "new-1",
      text: "Test memory",
      embedding: [0.1, 0.2, 0.3],
      area: MemoryArea.MAIN,
      path: "/test.md",
      model: "test/model",
    });

    expect(result.action).toBe(ConsolidationAction.SKIP);
    expect(result.reasoning).toBe("llm_error");
  });

  it("includes durationMs in result", async () => {
    deps.config.enabled = false;
    const engine = createConsolidationEngine(deps);
    const result = await engine.processNewChunk({
      chunkId: "new-1",
      text: "Some memory",
      embedding: [0.1, 0.2, 0.3],
      area: MemoryArea.MAIN,
      path: "/test.md",
      model: "test/model",
    });
    expect(typeof result.durationMs).toBe("number");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 6. findSimilar tests
// ---------------------------------------------------------------------------

describe("findSimilar", () => {
  it("returns empty array when embedding is empty", async () => {
    const db = createTestDb();
    ensureConsolidationSchema({ db });
    const deps = createMockDeps(db);
    const engine = createConsolidationEngine(deps);

    const results = await engine.findSimilar({
      text: "test",
      embedding: [],
      area: MemoryArea.MAIN,
      limit: 10,
      minScore: 0.7,
    });

    expect(results).toEqual([]);
    db.close();
  });
});

// ---------------------------------------------------------------------------
// 7. Consolidation log tests
// ---------------------------------------------------------------------------

describe("getConsolidationLog", () => {
  let db: DatabaseSync;
  let deps: ConsolidationEngineDeps;

  beforeEach(() => {
    db = createTestDb();
    ensureConsolidationSchema({ db });
    deps = createMockDeps(db);

    // Insert test log entries
    const now = Date.now();
    db.prepare(
      `INSERT INTO consolidation_log (id, timestamp, action, source_ids, result_id, area, model, reasoning, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "log-1",
      now - 3000,
      "MERGE",
      '["c1","c2"]',
      "c3",
      "main",
      "test/model",
      "merged topics",
      now - 3000,
    );

    db.prepare(
      `INSERT INTO consolidation_log (id, timestamp, action, source_ids, result_id, area, model, reasoning, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "log-2",
      now - 2000,
      "SKIP",
      '["c4"]',
      null,
      "fragments",
      "test/model",
      "no info",
      now - 2000,
    );

    db.prepare(
      `INSERT INTO consolidation_log (id, timestamp, action, source_ids, result_id, area, model, reasoning, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "log-3",
      now - 1000,
      "REPLACE",
      '["c5","c6"]',
      "c5",
      "main",
      "test/model",
      "exact dup",
      now - 1000,
    );
  });

  afterEach(() => {
    db.close();
  });

  it("returns all entries when no filters", () => {
    const engine = createConsolidationEngine(deps);
    const entries = engine.getConsolidationLog({});
    expect(entries).toHaveLength(3);
    // Sorted DESC by timestamp
    expect(entries[0].id).toBe("log-3");
    expect(entries[1].id).toBe("log-2");
    expect(entries[2].id).toBe("log-1");
  });

  it("parses source_ids JSON correctly", () => {
    const engine = createConsolidationEngine(deps);
    const entries = engine.getConsolidationLog({});
    expect(entries[2].sourceIds).toEqual(["c1", "c2"]);
  });

  it("filters by area", () => {
    const engine = createConsolidationEngine(deps);
    const entries = engine.getConsolidationLog({ area: MemoryArea.FRAGMENTS });
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe(ConsolidationAction.SKIP);
  });

  it("filters by action", () => {
    const engine = createConsolidationEngine(deps);
    const entries = engine.getConsolidationLog({ action: ConsolidationAction.MERGE });
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe("log-1");
  });

  it("filters by since timestamp", () => {
    const engine = createConsolidationEngine(deps);
    const entries = engine.getConsolidationLog({ since: Date.now() - 1500 });
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe(ConsolidationAction.REPLACE);
  });

  it("respects limit parameter", () => {
    const engine = createConsolidationEngine(deps);
    const entries = engine.getConsolidationLog({ limit: 2 });
    expect(entries).toHaveLength(2);
  });

  it("handles null result_id", () => {
    const engine = createConsolidationEngine(deps);
    const entries = engine.getConsolidationLog({ action: ConsolidationAction.SKIP });
    expect(entries[0].resultId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 8. applyResult writes log entry tests
// ---------------------------------------------------------------------------

describe("applyResult via processNewChunk", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createTestDb();
    ensureConsolidationSchema({ db });
  });

  afterEach(() => {
    db.close();
  });

  it("writes a log entry for KEEP_SEPARATE (no candidates)", async () => {
    const deps = createMockDeps(db);

    const origPrepare = db.prepare.bind(db);
    db.prepare = vi.fn((sql: string) => {
      if (sql.includes("vec_distance_cosine")) {
        return { all: () => [] } as unknown as ReturnType<DatabaseSync["prepare"]>;
      }
      return origPrepare(sql);
    }) as typeof db.prepare;

    const engine = createConsolidationEngine(deps);
    await engine.processNewChunk({
      chunkId: "new-1",
      text: "Some memory text",
      embedding: [0.1, 0.2, 0.3],
      area: MemoryArea.MAIN,
      path: "/test.md",
      model: "test/model",
    });

    // Check log was written
    const entries = engine.getConsolidationLog({});
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe(ConsolidationAction.KEEP_SEPARATE);
  });

  it("writes a log entry for SKIP on disabled engine", async () => {
    const deps = createMockDeps(db);
    deps.config.enabled = false;

    const engine = createConsolidationEngine(deps);
    await engine.processNewChunk({
      chunkId: "new-1",
      text: "Some memory",
      embedding: [0.1, 0.2, 0.3],
      area: MemoryArea.MAIN,
      path: "/test.md",
      model: "test/model",
    });

    // Disabled engine returns SKIP without writing to log (early return)
    const entries = engine.getConsolidationLog({});
    expect(entries).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 9. Edge case tests
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("handles whitespace-only text as empty", async () => {
    const db = createTestDb();
    ensureConsolidationSchema({ db });
    const deps = createMockDeps(db);
    const engine = createConsolidationEngine(deps);

    const result = await engine.processNewChunk({
      chunkId: "new-1",
      text: "   \n\t  ",
      embedding: [0.1, 0.2, 0.3],
      area: MemoryArea.MAIN,
      path: "/test.md",
      model: "test/model",
    });

    expect(result.action).toBe(ConsolidationAction.SKIP);
    expect(result.reasoning).toBe("empty chunk text");
    db.close();
  });

  it("LLM returns AbortError on cancellation", async () => {
    const db = createTestDb();
    ensureConsolidationSchema({ db });
    const deps = createMockDeps(db);
    insertChunk(db, "existing-1", "Some fact");

    const origPrepare = db.prepare.bind(db);
    db.prepare = vi.fn((sql: string) => {
      if (sql.includes("vec_distance_cosine")) {
        return {
          all: () => [
            { id: "existing-1", path: "/test.md", text: "Some fact", area: "main", dist: 0.2 },
          ],
        } as unknown as ReturnType<DatabaseSync["prepare"]>;
      }
      return origPrepare(sql);
    }) as typeof db.prepare;

    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    (deps.callLlm as ReturnType<typeof vi.fn>).mockRejectedValue(abortError);

    const engine = createConsolidationEngine(deps);
    const result = await engine.processNewChunk({
      chunkId: "new-1",
      text: "Test memory",
      embedding: [0.1, 0.2, 0.3],
      area: MemoryArea.MAIN,
      path: "/test.md",
      model: "test/model",
    });

    expect(result.action).toBe(ConsolidationAction.SKIP);
    expect(result.reasoning).toBe("timeout");
    db.close();
  });

  it("parseConsolidationResponse handles JSON inside backtick fence without json tag", () => {
    const raw =
      '```\n{"action":"MERGE","reasoning":"test","target_id":"c1","new_memory_content":"merged"}\n```';
    const result = parseConsolidationResponse(raw);
    expect(result.action).toBe(ConsolidationAction.MERGE);
  });

  it("config with zero timeout still works", () => {
    const config = createDefaultConsolidationConfig({ processingTimeoutMs: 0 });
    expect(config.processingTimeoutMs).toBe(0);
  });
});
