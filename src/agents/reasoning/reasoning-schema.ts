/**
 * Schema migration for reasoning trace storage.
 *
 * Creates the `reasoning_traces` table and associated indexes.
 * Uses a separate version key (`reasoning_schema_version`) in the shared
 * `meta` table to avoid conflicts with memory schema versioning.
 *
 * @see docs/adr/0008-reasoning-model-support.md
 */

import type { DatabaseSync } from "node:sqlite";

const CURRENT_REASONING_SCHEMA_VERSION = 1;
const VERSION_KEY = "reasoning_schema_version";

/**
 * Ensure the reasoning trace schema exists. Safe to call multiple times
 * (idempotent). Requires the `meta` table to already exist (created by
 * the base memory schema).
 */
export function ensureReasoningSchema(params: { db: DatabaseSync }): void {
  const { db } = params;

  // Ensure meta table exists (may be called before memory schema on fresh DBs).
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS reasoning_traces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_key TEXT NOT NULL,
      run_id TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT '',
      provider TEXT NOT NULL DEFAULT '',
      reasoning_text TEXT NOT NULL DEFAULT '',
      reasoning_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_rt_session_key ON reasoning_traces(session_key);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_rt_run_id ON reasoning_traces(run_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_rt_model ON reasoning_traces(model);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_rt_created_at ON reasoning_traces(created_at);`);

  const version = getReasoningSchemaVersion(db);
  if (version < CURRENT_REASONING_SCHEMA_VERSION) {
    setReasoningSchemaVersion(db, CURRENT_REASONING_SCHEMA_VERSION);
  }
}

/**
 * Read the current reasoning schema version from the meta table.
 * Returns 0 if no version has been set (fresh database).
 */
export function getReasoningSchemaVersion(db: DatabaseSync): number {
  const row = db.prepare(`SELECT value FROM meta WHERE key = ?`).get(VERSION_KEY) as
    | { value: string }
    | undefined;
  return row ? Number(row.value) : 0;
}

function setReasoningSchemaVersion(db: DatabaseSync, version: number): void {
  db.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(VERSION_KEY, String(version));
}
