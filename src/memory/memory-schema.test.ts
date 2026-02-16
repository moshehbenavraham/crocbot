import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ensureMemoryIndexSchema, getSchemaVersion } from "./memory-schema.js";

const FTS_TABLE = "chunks_fts";
const EMBEDDING_CACHE_TABLE = "embedding_cache";

function createFreshDb(): DatabaseSync {
  return new DatabaseSync(":memory:");
}

function runSchema(
  db: DatabaseSync,
  opts?: { ftsEnabled?: boolean },
): { ftsAvailable: boolean; ftsError?: string } {
  return ensureMemoryIndexSchema({
    db,
    embeddingCacheTable: EMBEDDING_CACHE_TABLE,
    ftsTable: FTS_TABLE,
    ftsEnabled: opts?.ftsEnabled ?? true,
  });
}

describe("memory-schema", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createFreshDb();
  });

  afterEach(() => {
    db.close();
  });

  describe("fresh database", () => {
    it("creates all base tables", () => {
      runSchema(db);
      const tables = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
        )
        .all() as Array<{ name: string }>;
      const names = tables.map((t) => t.name);
      expect(names).toContain("meta");
      expect(names).toContain("files");
      expect(names).toContain("chunks");
      expect(names).toContain("embedding_cache");
      expect(names).toContain("consolidation_log");
    });

    it("sets schema version to 2", () => {
      runSchema(db);
      const version = getSchemaVersion(db);
      expect(version).toBe(2);
    });

    it("creates FTS5 table with area column when enabled", () => {
      const result = runSchema(db);
      expect(result.ftsAvailable).toBe(true);
      // Verify FTS table exists by inserting and querying
      db.prepare(
        `INSERT INTO ${FTS_TABLE} (text, id, path, source, model, start_line, end_line, area) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run("test content", "id1", "/test.md", "memory", "test/model", 0, 10, "main");
      const rows = db
        .prepare(`SELECT * FROM ${FTS_TABLE} WHERE ${FTS_TABLE} MATCH ?`)
        .all('"test"') as Array<{
        id: string;
        area: string;
      }>;
      expect(rows.length).toBe(1);
      expect(rows[0].area).toBe("main");
    });

    it("adds consolidation columns to chunks table", () => {
      runSchema(db);
      const columns = db.prepare("PRAGMA table_info(chunks)").all() as Array<{ name: string }>;
      const names = columns.map((c) => c.name);
      expect(names).toContain("area");
      expect(names).toContain("importance");
      expect(names).toContain("consolidated_from");
    });

    it("does not create FTS table when ftsEnabled is false", () => {
      const result = runSchema(db, { ftsEnabled: false });
      expect(result.ftsAvailable).toBe(false);
    });
  });

  describe("schema versioning", () => {
    it("returns version 1 for databases without schema_version key", () => {
      db.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
      const version = getSchemaVersion(db);
      expect(version).toBe(1);
    });

    it("returns stored version number", () => {
      runSchema(db);
      const version = getSchemaVersion(db);
      expect(version).toBe(2);
    });

    it("is idempotent -- running twice keeps version at 2", () => {
      runSchema(db);
      runSchema(db);
      const version = getSchemaVersion(db);
      expect(version).toBe(2);
    });
  });

  describe("existing v1 database migration", () => {
    function createV1Db(): DatabaseSync {
      const d = createFreshDb();
      // Simulate a v1 database: base tables, old FTS without area
      d.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
      d.exec(`
        CREATE TABLE IF NOT EXISTS files (
          path TEXT PRIMARY KEY,
          source TEXT NOT NULL DEFAULT 'memory',
          hash TEXT NOT NULL,
          mtime INTEGER NOT NULL,
          size INTEGER NOT NULL
        )
      `);
      d.exec(`
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
        )
      `);
      // Old FTS table WITHOUT area column
      d.exec(
        `CREATE VIRTUAL TABLE IF NOT EXISTS ${FTS_TABLE} USING fts5(` +
          `text, id UNINDEXED, path UNINDEXED, source UNINDEXED, model UNINDEXED, ` +
          `start_line UNINDEXED, end_line UNINDEXED)`,
      );
      // Insert some v1 data
      d.prepare(
        `INSERT INTO chunks (id, path, source, start_line, end_line, hash, model, text, embedding, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        "chunk1",
        "/test.md",
        "memory",
        0,
        5,
        "h1",
        "test/model",
        "hello world",
        "[]",
        Date.now(),
      );
      d.prepare(
        `INSERT INTO ${FTS_TABLE} (text, id, path, source, model, start_line, end_line) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run("hello world", "chunk1", "/test.md", "memory", "test/model", 0, 5);
      return d;
    }

    it("migrates v1 to v2 -- FTS rebuilt with area, data preserved", () => {
      const v1 = createV1Db();
      try {
        const result = ensureMemoryIndexSchema({
          db: v1,
          embeddingCacheTable: EMBEDDING_CACHE_TABLE,
          ftsTable: FTS_TABLE,
          ftsEnabled: true,
        });
        expect(result.ftsAvailable).toBe(true);
        expect(getSchemaVersion(v1)).toBe(2);

        // FTS data should be repopulated from chunks (with area default 'main')
        const ftsRows = v1
          .prepare(`SELECT id, area FROM ${FTS_TABLE} WHERE ${FTS_TABLE} MATCH ?`)
          .all('"hello"') as Array<{ id: string; area: string }>;
        expect(ftsRows.length).toBe(1);
        expect(ftsRows[0].id).toBe("chunk1");
        expect(ftsRows[0].area).toBe("main");
      } finally {
        v1.close();
      }
    });

    it("preserves chunks data during migration", () => {
      const v1 = createV1Db();
      try {
        ensureMemoryIndexSchema({
          db: v1,
          embeddingCacheTable: EMBEDDING_CACHE_TABLE,
          ftsTable: FTS_TABLE,
          ftsEnabled: true,
        });
        const chunks = v1.prepare(`SELECT id, text, area, importance FROM chunks`).all() as Array<{
          id: string;
          text: string;
          area: string;
          importance: number;
        }>;
        expect(chunks.length).toBe(1);
        expect(chunks[0].id).toBe("chunk1");
        expect(chunks[0].text).toBe("hello world");
        expect(chunks[0].area).toBe("main");
        expect(chunks[0].importance).toBe(0.5);
      } finally {
        v1.close();
      }
    });

    it("skips FTS rebuild when version is already 2", () => {
      // First run: migrates
      runSchema(db);
      // Insert data after migration
      db.prepare(
        `INSERT INTO chunks (id, path, source, start_line, end_line, hash, model, text, embedding, updated_at, area) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run("c1", "/a.md", "memory", 0, 5, "h", "m", "alpha", "[]", Date.now(), "solutions");
      db.prepare(
        `INSERT INTO ${FTS_TABLE} (text, id, path, source, model, start_line, end_line, area) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run("alpha", "c1", "/a.md", "memory", "m", 0, 5, "solutions");

      // Second run: should NOT drop/rebuild FTS (area column already exists)
      runSchema(db);
      const ftsRows = db
        .prepare(`SELECT id, area FROM ${FTS_TABLE} WHERE ${FTS_TABLE} MATCH ?`)
        .all('"alpha"') as Array<{ id: string; area: string }>;
      expect(ftsRows.length).toBe(1);
      expect(ftsRows[0].area).toBe("solutions");
    });
  });
});
