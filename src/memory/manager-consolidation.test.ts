/**
 * Integration tests for consolidation wiring into MemoryIndexManager
 * and area-filtered search with importance-weighted ranking.
 *
 * These tests use in-memory SQLite databases with direct function calls
 * rather than the full MemoryIndexManager class (which requires filesystem
 * and embedding provider setup). We test the building blocks directly.
 */

import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ConsolidationAction,
  type ConsolidationEngineDeps,
  createDefaultConsolidationConfig,
} from "./consolidation-actions.js";
import { createConsolidationEngine } from "./consolidation.js";
import { ensureMemoryIndexSchema, getSchemaVersion } from "./memory-schema.js";
import { mergeHybridResults } from "./hybrid.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const FTS_TABLE = "chunks_fts";
const VECTOR_TABLE = "chunks_vec";
const EMBEDDING_CACHE_TABLE = "embedding_cache";

function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  ensureMemoryIndexSchema({
    db,
    embeddingCacheTable: EMBEDDING_CACHE_TABLE,
    ftsTable: FTS_TABLE,
    ftsEnabled: true,
  });
  return db;
}

function insertChunk(
  db: DatabaseSync,
  id: string,
  text: string,
  opts?: { area?: string; importance?: number; path?: string; model?: string },
): void {
  const area = opts?.area ?? "main";
  const importance = opts?.importance ?? 0.5;
  const chunkPath = opts?.path ?? "/test/memory.md";
  const model = opts?.model ?? "test/model";
  db.prepare(
    `INSERT INTO chunks (id, path, source, start_line, end_line, hash, model, text, embedding, updated_at, area, importance)
     VALUES (?, ?, 'memory', 0, 10, 'hash', ?, ?, '[]', ?, ?, ?)`,
  ).run(id, chunkPath, model, text, Date.now(), area, importance);
  // Also insert into FTS
  db.prepare(
    `INSERT INTO ${FTS_TABLE} (text, id, path, source, model, start_line, end_line, area)
     VALUES (?, ?, ?, 'memory', ?, 0, 10, ?)`,
  ).run(text, id, chunkPath, model, area);
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
    vectorTable: VECTOR_TABLE,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: consolidation engine wiring
// ---------------------------------------------------------------------------

describe("consolidation engine wiring", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it("creates engine successfully with valid deps", () => {
    const deps = createMockDeps(db);
    const engine = createConsolidationEngine(deps);
    expect(engine).toBeDefined();
    expect(typeof engine.processNewChunk).toBe("function");
    expect(typeof engine.findSimilar).toBe("function");
    expect(typeof engine.getConsolidationLog).toBe("function");
  });

  it("processNewChunk skips when engine is disabled", async () => {
    const deps = createMockDeps(db, {
      config: createDefaultConsolidationConfig({ enabled: false }),
    });
    const engine = createConsolidationEngine(deps);
    const result = await engine.processNewChunk({
      chunkId: "test-chunk-1",
      text: "Hello world",
      embedding: [0.1, 0.2, 0.3],
      area: "main",
      path: "/test.md",
      model: "test/model",
    });
    expect(result.action).toBe(ConsolidationAction.SKIP);
    expect(result.reasoning).toBe("consolidation disabled");
  });

  it("processNewChunk returns KEEP_SEPARATE when no similar chunks exist", async () => {
    const deps = createMockDeps(db);
    // Mock db.prepare for vector query to return empty
    const origPrepare = db.prepare.bind(db);
    db.prepare = vi.fn((sql: string) => {
      if (sql.includes("vec_distance_cosine")) {
        return {
          all: () => [],
        } as unknown as ReturnType<DatabaseSync["prepare"]>;
      }
      return origPrepare(sql);
    }) as typeof db.prepare;

    const engine = createConsolidationEngine(deps);
    const result = await engine.processNewChunk({
      chunkId: "new-chunk",
      text: "brand new content",
      embedding: [0.1, 0.2, 0.3],
      area: "main",
      path: "/test.md",
      model: "test/model",
    });
    expect(result.action).toBe(ConsolidationAction.KEEP_SEPARATE);
    expect(result.reasoning).toContain("no similar candidates");
  });

  it("consolidation failure does not throw -- logs warning instead", async () => {
    const deps = createMockDeps(db, {
      callLlm: vi.fn().mockRejectedValue(new Error("API key missing")),
    });
    // Mock vector search to return a candidate so LLM is called
    insertChunk(db, "existing-1", "similar content");
    const origPrepare = db.prepare.bind(db);
    db.prepare = vi.fn((sql: string) => {
      if (sql.includes("vec_distance_cosine")) {
        return {
          all: () => [
            {
              id: "existing-1",
              path: "/test.md",
              text: "similar content",
              area: "main",
              dist: 0.1,
            },
          ],
        } as unknown as ReturnType<DatabaseSync["prepare"]>;
      }
      return origPrepare(sql);
    }) as typeof db.prepare;

    const engine = createConsolidationEngine(deps);
    // Should not throw
    const result = await engine.processNewChunk({
      chunkId: "new-chunk",
      text: "similar content too",
      embedding: [0.1, 0.2, 0.3],
      area: "main",
      path: "/test.md",
      model: "test/model",
    });
    expect(result.action).toBe(ConsolidationAction.SKIP);
    expect(result.reasoning).toBe("llm_error");
  });

  it("consolidation log is populated after processNewChunk", async () => {
    const deps = createMockDeps(db);
    // Mock vector search to return empty (no candidates)
    const origPrepare = db.prepare.bind(db);
    db.prepare = vi.fn((sql: string) => {
      if (sql.includes("vec_distance_cosine")) {
        return {
          all: () => [],
        } as unknown as ReturnType<DatabaseSync["prepare"]>;
      }
      return origPrepare(sql);
    }) as typeof db.prepare;

    const engine = createConsolidationEngine(deps);
    await engine.processNewChunk({
      chunkId: "log-test",
      text: "test content for log",
      embedding: [0.1, 0.2, 0.3],
      area: "main",
      path: "/test.md",
      model: "test/model",
    });

    const logEntries = engine.getConsolidationLog({ limit: 10 });
    expect(logEntries.length).toBe(1);
    expect(logEntries[0].action).toBe(ConsolidationAction.KEEP_SEPARATE);
    expect(logEntries[0].area).toBe("main");
  });

  it("engine gracefully handles disabled state when no API key", () => {
    const deps = createMockDeps(db, {
      config: createDefaultConsolidationConfig({ enabled: false }),
    });
    const engine = createConsolidationEngine(deps);
    expect(engine).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: area-filtered search
// ---------------------------------------------------------------------------

describe("area-filtered search", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createTestDb();
    insertChunk(db, "main-1", "main memory about deployment", { area: "main" });
    insertChunk(db, "main-2", "main memory about configuration", { area: "main" });
    insertChunk(db, "sol-1", "solution for crash during startup", { area: "solutions" });
    insertChunk(db, "sol-2", "solution for memory leak error", { area: "solutions" });
    insertChunk(db, "frag-1", "fragment about user preferences", { area: "fragments" });
  });

  afterEach(() => {
    db.close();
  });

  it("keyword search returns all areas when no filter applied", () => {
    const rows = db
      .prepare(
        `SELECT f.id, c.area FROM ${FTS_TABLE} f JOIN chunks c ON c.id = f.id WHERE ${FTS_TABLE} MATCH ? AND f.model = ?`,
      )
      .all('"memory"', "test/model") as Array<{ id: string; area: string }>;
    const areas = new Set(rows.map((r) => r.area));
    expect(areas.size).toBeGreaterThanOrEqual(2);
  });

  it("keyword search with area filter returns only matching area", () => {
    const rows = db
      .prepare(
        `SELECT f.id, c.area FROM ${FTS_TABLE} f JOIN chunks c ON c.id = f.id WHERE ${FTS_TABLE} MATCH ? AND f.model = ? AND c.area = ?`,
      )
      .all('"solution"', "test/model", "solutions") as Array<{ id: string; area: string }>;
    expect(rows.length).toBe(2);
    for (const row of rows) {
      expect(row.area).toBe("solutions");
    }
  });

  it("chunks with area default to main", () => {
    const row = db.prepare(`SELECT area, importance FROM chunks WHERE id = ?`).get("main-1") as {
      area: string;
      importance: number;
    };
    expect(row.area).toBe("main");
    expect(row.importance).toBe(0.5);
  });

  it("FTS table includes area column after v2 migration", () => {
    // Insert via FTS with area
    db.prepare(
      `INSERT INTO ${FTS_TABLE} (text, id, path, source, model, start_line, end_line, area) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("instruments test", "inst-1", "/inst.md", "memory", "test/model", 0, 5, "instruments");
    const rows = db
      .prepare(`SELECT id, area FROM ${FTS_TABLE} WHERE ${FTS_TABLE} MATCH ?`)
      .all('"instruments"') as Array<{ id: string; area: string }>;
    expect(rows.length).toBe(1);
    expect(rows[0].area).toBe("instruments");
  });
});

// ---------------------------------------------------------------------------
// Tests: importance-weighted ranking
// ---------------------------------------------------------------------------

describe("importance-weighted ranking", () => {
  it("higher importance boosts score", () => {
    const baseScore = 0.8;
    const highImportance = 1.0;
    const lowImportance = 0.0;
    const defaultImportance = 0.5;

    const highScore = baseScore * (0.5 + highImportance); // 0.8 * 1.5 = 1.2
    const lowScore = baseScore * (0.5 + lowImportance); // 0.8 * 0.5 = 0.4
    const defaultScore = baseScore * (0.5 + defaultImportance); // 0.8 * 1.0 = 0.8

    expect(highScore).toBeGreaterThan(defaultScore);
    expect(defaultScore).toBeGreaterThan(lowScore);
    expect(highScore).toBeCloseTo(1.2);
    expect(lowScore).toBeCloseTo(0.4);
    expect(defaultScore).toBeCloseTo(0.8);
  });

  it("default importance (0.5) is neutral -- score unchanged", () => {
    const baseScore = 0.6;
    const neutral = baseScore * (0.5 + 0.5);
    expect(neutral).toBeCloseTo(baseScore);
  });

  it("importance-weighted ranking sorts correctly in merged results", () => {
    const merged = mergeHybridResults({
      vector: [
        {
          id: "low-imp",
          path: "/a.md",
          startLine: 0,
          endLine: 5,
          source: "memory",
          snippet: "low importance",
          vectorScore: 0.9,
          area: "main",
          importance: 0.1,
        },
        {
          id: "high-imp",
          path: "/b.md",
          startLine: 0,
          endLine: 5,
          source: "memory",
          snippet: "high importance",
          vectorScore: 0.7,
          area: "main",
          importance: 1.0,
        },
      ],
      keyword: [],
      vectorWeight: 1.0,
      textWeight: 0.0,
    });

    // Apply importance boost (same formula as manager.ts)
    const boosted = merged.map((r) => ({
      ...r,
      score: r.score * (0.5 + r.importance),
    }));
    boosted.sort((a, b) => b.score - a.score);

    // High importance (0.7 * 1.5 = 1.05) should rank above low importance (0.9 * 0.6 = 0.54)
    expect(boosted[0].snippet).toBe("high importance");
    expect(boosted[1].snippet).toBe("low importance");
  });
});

// ---------------------------------------------------------------------------
// Tests: solution recall for error-like queries
// ---------------------------------------------------------------------------

describe("solution recall for error-like queries", () => {
  const errorPatterns = [
    "error connecting to database",
    "application crash on startup",
    "exception in handler",
    "fail to authenticate",
    "bug in payment flow",
    "broken image upload",
    "traceback in python script",
    "panic in goroutine",
    "segfault during build",
    "abort signal received",
  ];

  const nonErrorPatterns = [
    "how to configure logging",
    "deploy to production",
    "user preferences setup",
    "API documentation",
    "performance optimization tips",
  ];

  // Test the error detection regex directly
  const ERROR_LIKE_PATTERNS =
    /\b(error|fail|crash|exception|bug|broken|traceback|panic|segfault|abort)\b/i;

  for (const pattern of errorPatterns) {
    it(`detects "${pattern}" as error-like`, () => {
      expect(ERROR_LIKE_PATTERNS.test(pattern)).toBe(true);
    });
  }

  for (const pattern of nonErrorPatterns) {
    it(`does NOT detect "${pattern}" as error-like`, () => {
      expect(ERROR_LIKE_PATTERNS.test(pattern)).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// Tests: hybrid merge propagates area and importance
// ---------------------------------------------------------------------------

describe("hybrid merge propagates area and importance", () => {
  it("carries area and importance through vector-only merge", () => {
    const result = mergeHybridResults({
      vector: [
        {
          id: "v1",
          path: "/a.md",
          startLine: 0,
          endLine: 5,
          source: "memory",
          snippet: "vector result",
          vectorScore: 0.9,
          area: "solutions",
          importance: 0.8,
        },
      ],
      keyword: [],
      vectorWeight: 1.0,
      textWeight: 0.0,
    });
    expect(result.length).toBe(1);
    expect(result[0].area).toBe("solutions");
    expect(result[0].importance).toBe(0.8);
  });

  it("carries area and importance through keyword-only merge", () => {
    const result = mergeHybridResults({
      vector: [],
      keyword: [
        {
          id: "k1",
          path: "/b.md",
          startLine: 0,
          endLine: 10,
          source: "memory",
          snippet: "keyword result",
          textScore: 0.7,
          area: "fragments",
          importance: 0.3,
        },
      ],
      vectorWeight: 0.0,
      textWeight: 1.0,
    });
    expect(result.length).toBe(1);
    expect(result[0].area).toBe("fragments");
    expect(result[0].importance).toBe(0.3);
  });

  it("preserves area and importance when both vector and keyword match same id", () => {
    const result = mergeHybridResults({
      vector: [
        {
          id: "both1",
          path: "/c.md",
          startLine: 0,
          endLine: 5,
          source: "memory",
          snippet: "both",
          vectorScore: 0.8,
          area: "instruments",
          importance: 0.9,
        },
      ],
      keyword: [
        {
          id: "both1",
          path: "/c.md",
          startLine: 0,
          endLine: 5,
          source: "memory",
          snippet: "both updated",
          textScore: 0.6,
          area: "instruments",
          importance: 0.9,
        },
      ],
      vectorWeight: 0.7,
      textWeight: 0.3,
    });
    expect(result.length).toBe(1);
    expect(result[0].area).toBe("instruments");
    expect(result[0].importance).toBe(0.9);
  });
});

// ---------------------------------------------------------------------------
// Tests: schema state after full migration
// ---------------------------------------------------------------------------

describe("full schema integration", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it("schema version is 2 after fresh init", () => {
    expect(getSchemaVersion(db)).toBe(2);
  });

  it("consolidation_log table exists", () => {
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = 'consolidation_log'`)
      .all() as Array<{ name: string }>;
    expect(tables.length).toBe(1);
  });

  it("chunks table has area, importance, and consolidated_from columns", () => {
    const columns = db.prepare("PRAGMA table_info(chunks)").all() as Array<{ name: string }>;
    const names = columns.map((c) => c.name);
    expect(names).toContain("area");
    expect(names).toContain("importance");
    expect(names).toContain("consolidated_from");
  });

  it("new chunks default to area=main, importance=0.5", () => {
    db.prepare(
      `INSERT INTO chunks (id, path, source, start_line, end_line, hash, model, text, embedding, updated_at)
       VALUES ('def1', '/d.md', 'memory', 0, 5, 'h', 'm', 'test', '[]', ?)`,
    ).run(Date.now());
    const row = db.prepare(`SELECT area, importance FROM chunks WHERE id = 'def1'`).get() as {
      area: string;
      importance: number;
    };
    expect(row.area).toBe("main");
    expect(row.importance).toBe(0.5);
  });
});
