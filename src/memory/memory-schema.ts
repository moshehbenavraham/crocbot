import type { DatabaseSync } from "node:sqlite";

import { ensureConsolidationSchema } from "./consolidation-schema.js";

const CURRENT_SCHEMA_VERSION = 2;

export function ensureMemoryIndexSchema(params: {
  db: DatabaseSync;
  embeddingCacheTable: string;
  ftsTable: string;
  ftsEnabled: boolean;
}): { ftsAvailable: boolean; ftsError?: string } {
  params.db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  params.db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      source TEXT NOT NULL DEFAULT 'memory',
      hash TEXT NOT NULL,
      mtime INTEGER NOT NULL,
      size INTEGER NOT NULL
    );
  `);
  params.db.exec(`
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
  params.db.exec(`
    CREATE TABLE IF NOT EXISTS ${params.embeddingCacheTable} (
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      provider_key TEXT NOT NULL,
      hash TEXT NOT NULL,
      embedding TEXT NOT NULL,
      dims INTEGER,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (provider, model, provider_key, hash)
    );
  `);
  params.db.exec(
    `CREATE INDEX IF NOT EXISTS idx_embedding_cache_updated_at ON ${params.embeddingCacheTable}(updated_at);`,
  );

  ensureColumn(params.db, "files", "source", "TEXT NOT NULL DEFAULT 'memory'");
  ensureColumn(params.db, "chunks", "source", "TEXT NOT NULL DEFAULT 'memory'");
  params.db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_path ON chunks(path);`);
  params.db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source);`);

  ensureConsolidationSchema({ db: params.db });

  const version = getSchemaVersion(params.db);

  let ftsAvailable = false;
  let ftsError: string | undefined;
  if (params.ftsEnabled) {
    const needsRebuild = version < CURRENT_SCHEMA_VERSION;
    try {
      if (needsRebuild) {
        rebuildFtsWithArea(params.db, params.ftsTable);
      } else {
        params.db.exec(
          `CREATE VIRTUAL TABLE IF NOT EXISTS ${params.ftsTable} USING fts5(\n` +
            `  text,\n` +
            `  id UNINDEXED,\n` +
            `  path UNINDEXED,\n` +
            `  source UNINDEXED,\n` +
            `  model UNINDEXED,\n` +
            `  start_line UNINDEXED,\n` +
            `  end_line UNINDEXED,\n` +
            `  area UNINDEXED\n` +
            `);`,
        );
      }
      ftsAvailable = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ftsAvailable = false;
      ftsError = message;
    }
  }

  if (version < CURRENT_SCHEMA_VERSION) {
    setSchemaVersion(params.db, CURRENT_SCHEMA_VERSION);
  }

  return { ftsAvailable, ...(ftsError ? { ftsError } : {}) };
}

// ---------------------------------------------------------------------------
// Schema versioning helpers
// ---------------------------------------------------------------------------

export function getSchemaVersion(db: DatabaseSync): number {
  const row = db.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).get() as
    | { value: string }
    | undefined;
  return row ? Number(row.value) : 1;
}

function setSchemaVersion(db: DatabaseSync, version: number): void {
  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(String(version));
}

// ---------------------------------------------------------------------------
// FTS5 rebuild with area column
// ---------------------------------------------------------------------------

function rebuildFtsWithArea(db: DatabaseSync, ftsTable: string): void {
  // Drop the old FTS table (virtual tables cannot be ALTERed)
  try {
    db.exec(`DROP TABLE IF EXISTS ${ftsTable}`);
  } catch {
    // Table may not exist on fresh databases
  }

  // Recreate with area column
  db.exec(
    `CREATE VIRTUAL TABLE IF NOT EXISTS ${ftsTable} USING fts5(\n` +
      `  text,\n` +
      `  id UNINDEXED,\n` +
      `  path UNINDEXED,\n` +
      `  source UNINDEXED,\n` +
      `  model UNINDEXED,\n` +
      `  start_line UNINDEXED,\n` +
      `  end_line UNINDEXED,\n` +
      `  area UNINDEXED\n` +
      `);`,
  );

  // Repopulate from chunks table
  db.exec(
    `INSERT INTO ${ftsTable} (text, id, path, source, model, start_line, end_line, area)\n` +
      `  SELECT text, id, path, source, model, start_line, end_line, area FROM chunks`,
  );
}

function ensureColumn(
  db: DatabaseSync,
  table: "files" | "chunks",
  column: string,
  definition: string,
): void {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (rows.some((row) => row.name === column)) {
    return;
  }
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
