import { DatabaseSync } from "node:sqlite";

import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { ensureReasoningSchema, getReasoningSchemaVersion } from "./reasoning-schema.js";

describe("ensureReasoningSchema", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  describe("fresh database", () => {
    it("creates the reasoning_traces table", () => {
      ensureReasoningSchema({ db });

      const tables = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'reasoning_traces'`,
        )
        .all() as Array<{ name: string }>;
      expect(tables).toHaveLength(1);
    });

    it("creates the meta table", () => {
      ensureReasoningSchema({ db });

      const tables = db
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'meta'`)
        .all() as Array<{ name: string }>;
      expect(tables).toHaveLength(1);
    });

    it("creates expected columns", () => {
      ensureReasoningSchema({ db });

      const columns = db.prepare(`PRAGMA table_info(reasoning_traces)`).all() as Array<{
        name: string;
      }>;
      const names = columns.map((c) => c.name);

      expect(names).toContain("id");
      expect(names).toContain("session_key");
      expect(names).toContain("run_id");
      expect(names).toContain("model");
      expect(names).toContain("provider");
      expect(names).toContain("reasoning_text");
      expect(names).toContain("reasoning_tokens");
      expect(names).toContain("total_tokens");
      expect(names).toContain("duration_ms");
      expect(names).toContain("metadata");
      expect(names).toContain("created_at");
    });

    it("creates expected indexes", () => {
      ensureReasoningSchema({ db });

      const indexes = db
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_rt_%'`)
        .all() as Array<{ name: string }>;
      const names = indexes.map((i) => i.name);

      expect(names).toContain("idx_rt_session_key");
      expect(names).toContain("idx_rt_run_id");
      expect(names).toContain("idx_rt_model");
      expect(names).toContain("idx_rt_created_at");
    });

    it("sets schema version to 1", () => {
      ensureReasoningSchema({ db });
      expect(getReasoningSchemaVersion(db)).toBe(1);
    });
  });

  describe("idempotent re-run", () => {
    it("runs twice without errors", () => {
      ensureReasoningSchema({ db });
      expect(() => ensureReasoningSchema({ db })).not.toThrow();
    });

    it("preserves existing data on re-run", () => {
      ensureReasoningSchema({ db });

      db.prepare(
        `INSERT INTO reasoning_traces
         (session_key, run_id, model, provider, reasoning_text,
          reasoning_tokens, total_tokens, duration_ms, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run("s1", "r1", "m1", "p1", "text", 100, 200, 500, "{}", Date.now());

      ensureReasoningSchema({ db });

      const count = db.prepare(`SELECT COUNT(*) as cnt FROM reasoning_traces`).get() as {
        cnt: number;
      };
      expect(count.cnt).toBe(1);
    });

    it("maintains schema version on re-run", () => {
      ensureReasoningSchema({ db });
      const v1 = getReasoningSchemaVersion(db);

      ensureReasoningSchema({ db });
      const v2 = getReasoningSchemaVersion(db);

      expect(v1).toBe(v2);
    });
  });

  describe("version tracking", () => {
    it("returns 0 for fresh database without schema", () => {
      db.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
      expect(getReasoningSchemaVersion(db)).toBe(0);
    });

    it("uses reasoning_schema_version key (separate from memory schema)", () => {
      ensureReasoningSchema({ db });

      const row = db
        .prepare(`SELECT value FROM meta WHERE key = 'reasoning_schema_version'`)
        .get() as { value: string } | undefined;
      expect(row).toBeDefined();
      expect(Number(row!.value)).toBe(1);
    });
  });
});
