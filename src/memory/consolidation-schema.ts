/**
 * Schema extensions for the memory consolidation engine.
 *
 * Adds the `consolidation_log` audit table and three new columns to the
 * existing `chunks` table: area, importance, consolidated_from.
 *
 * @see docs/adr/0007-memory-consolidation-architecture.md
 */

import type { DatabaseSync } from "node:sqlite";

// ---------------------------------------------------------------------------
// Column helper (same pattern as memory-schema.ts ensureColumn)
// ---------------------------------------------------------------------------

function ensureColumn(db: DatabaseSync, table: string, column: string, definition: string): void {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (rows.some((row) => row.name === column)) {
    return;
  }
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Ensure consolidation-related schema extensions exist.
 *
 * Safe to call multiple times (idempotent). Must be called after the base
 * memory schema (chunks table) has been created.
 */
export function ensureConsolidationSchema(params: { db: DatabaseSync }): void {
  const { db } = params;

  // -- New columns on chunks table --
  ensureColumn(db, "chunks", "area", "TEXT NOT NULL DEFAULT 'main'");
  ensureColumn(db, "chunks", "importance", "REAL NOT NULL DEFAULT 0.5");
  ensureColumn(db, "chunks", "consolidated_from", "TEXT DEFAULT NULL");

  // -- Consolidation log table --
  db.exec(`
    CREATE TABLE IF NOT EXISTS consolidation_log (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      action TEXT NOT NULL,
      source_ids TEXT NOT NULL,
      result_id TEXT,
      area TEXT NOT NULL DEFAULT 'main',
      model TEXT NOT NULL,
      reasoning TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // -- Indexes --
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_consolidation_log_timestamp ON consolidation_log(timestamp);`,
  );
  db.exec(`CREATE INDEX IF NOT EXISTS idx_consolidation_log_action ON consolidation_log(action);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_area ON chunks(area);`);
}
