import type { DatabaseSync } from "node:sqlite";
import path from "node:path";

import { ensureDir } from "../memory/internal.js";
import { requireNodeSqlite } from "../memory/sqlite.js";
import { loadSqliteVecExtension } from "../memory/sqlite-vec.js";
import type {
  DocumentChunk,
  KnowledgeCategory,
  KnowledgeStorageAdapter,
  VectorSearchResult,
} from "./types.js";

// -- Constants --

const CHUNKS_TABLE = "knowledge_chunks";
const VECTORS_TABLE = "knowledge_vectors";
const META_TABLE = "knowledge_meta";

/** Current schema version for the knowledge subsystem. */
const KNOWLEDGE_SCHEMA_VERSION = 1;

/** Default knowledge database filename. */
const DB_FILENAME = "knowledge.db";

// -- Helpers --

const vectorToBlob = (embedding: number[]): Buffer =>
  Buffer.from(new Float32Array(embedding).buffer);

// -- Schema SQL --

const CREATE_META_SQL = `
CREATE TABLE IF NOT EXISTS ${META_TABLE} (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`;

const CREATE_CHUNKS_SQL = `
CREATE TABLE IF NOT EXISTS ${CHUNKS_TABLE} (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  hash TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  total INTEGER NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  source_value TEXT NOT NULL,
  heading_context TEXT,
  category TEXT NOT NULL DEFAULT 'docs',
  created_at INTEGER NOT NULL
)`;

const CREATE_CHUNKS_HASH_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_hash
  ON ${CHUNKS_TABLE} (hash)`;

const CREATE_CHUNKS_SOURCE_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source
  ON ${CHUNKS_TABLE} (source_value)`;

function createVectorTableSql(dimensions: number): string {
  return (
    `CREATE VIRTUAL TABLE IF NOT EXISTS ${VECTORS_TABLE} USING vec0(\n` +
    `  id TEXT PRIMARY KEY,\n` +
    `  embedding FLOAT[${dimensions}]\n` +
    `)`
  );
}

// -- Storage adapter implementation --

/**
 * Build a KnowledgeStorageAdapter around an already-opened DatabaseSync.
 * The caller is responsible for loading sqlite-vec before calling ensureSchema
 * with a non-zero dimension if vector search is needed.
 */
export function createKnowledgeStorageFromDb(db: DatabaseSync): KnowledgeStorageAdapter {
  let currentDims = 0;

  const adapter: KnowledgeStorageAdapter = {
    ensureSchema(dimensions: number): void {
      db.exec(CREATE_META_SQL);
      db.exec(CREATE_CHUNKS_SQL);
      db.exec(CREATE_CHUNKS_HASH_INDEX_SQL);
      db.exec(CREATE_CHUNKS_SOURCE_INDEX_SQL);

      db.prepare(`INSERT OR REPLACE INTO ${META_TABLE} (key, value) VALUES (?, ?)`).run(
        "knowledge_schema_version",
        String(KNOWLEDGE_SCHEMA_VERSION),
      );

      if (dimensions > 0 && dimensions !== currentDims) {
        if (currentDims > 0) {
          try {
            db.exec(`DROP TABLE IF EXISTS ${VECTORS_TABLE}`);
          } catch {
            // Ignore drop failure on dimension change
          }
        }
        db.exec(createVectorTableSql(dimensions));
        currentDims = dimensions;
      }
    },

    insertChunk(chunk: DocumentChunk, embedding: number[], category: KnowledgeCategory): void {
      const now = Date.now();

      db.prepare(
        `INSERT OR REPLACE INTO ${CHUNKS_TABLE}
         (id, text, hash, chunk_index, total, start_line, end_line,
          source_value, heading_context, category, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        chunk.id,
        chunk.text,
        chunk.hash,
        chunk.index,
        chunk.total,
        chunk.startLine,
        chunk.endLine,
        chunk.sourceValue,
        chunk.headingContext ?? null,
        category,
        now,
      );

      if (currentDims > 0) {
        db.prepare(`INSERT OR REPLACE INTO ${VECTORS_TABLE} (id, embedding) VALUES (?, ?)`).run(
          chunk.id,
          vectorToBlob(embedding),
        );
      }
    },

    hasHash(hash: string): boolean {
      const row = db.prepare(`SELECT 1 FROM ${CHUNKS_TABLE} WHERE hash = ? LIMIT 1`).get(hash) as
        | Record<string, unknown>
        | undefined;
      return row !== undefined;
    },

    getHashesForSource(sourceValue: string): string[] {
      const rows = db
        .prepare(`SELECT hash FROM ${CHUNKS_TABLE} WHERE source_value = ?`)
        .all(sourceValue) as Array<{ hash: string }>;
      return rows.map((r) => r.hash);
    },

    findSimilar(embedding: number[], limit: number): VectorSearchResult[] {
      if (currentDims === 0 || limit <= 0) {
        return [];
      }

      try {
        const rows = db
          .prepare(
            `SELECT id, vec_distance_cosine(embedding, ?) AS dist\n` +
              `  FROM ${VECTORS_TABLE}\n` +
              ` ORDER BY dist ASC\n` +
              ` LIMIT ?`,
          )
          .all(vectorToBlob(embedding), limit) as Array<{
          id: string;
          dist: number;
        }>;

        return rows.map((row) => ({
          chunkId: row.id,
          distance: row.dist,
          similarity: 1 - row.dist,
        }));
      } catch {
        return [];
      }
    },

    deleteBySource(sourceValue: string): number {
      const rows = db
        .prepare(`SELECT id FROM ${CHUNKS_TABLE} WHERE source_value = ?`)
        .all(sourceValue) as Array<{ id: string }>;

      if (rows.length === 0) {
        return 0;
      }

      if (currentDims > 0) {
        for (const row of rows) {
          try {
            db.prepare(`DELETE FROM ${VECTORS_TABLE} WHERE id = ?`).run(row.id);
          } catch {
            // Ignore individual vector delete failures
          }
        }
      }

      const result = db
        .prepare(`DELETE FROM ${CHUNKS_TABLE} WHERE source_value = ?`)
        .run(sourceValue);

      return Number(result.changes);
    },

    countBySource(sourceValue: string): number {
      const row = db
        .prepare(`SELECT COUNT(*) as cnt FROM ${CHUNKS_TABLE} WHERE source_value = ?`)
        .get(sourceValue) as { cnt: number } | undefined;
      return row?.cnt ?? 0;
    },

    close(): void {
      try {
        db.close();
      } catch {
        // Ignore close errors
      }
    },
  };

  return adapter;
}

// -- Factory helpers --

/**
 * Resolve the knowledge database path for a given agent/project context.
 *
 * For named projects: `{projectPaths.memoryDir}/knowledge.db`
 * For default project: `{agentDir}/knowledge.db`
 */
export function resolveKnowledgeDbPath(
  agentDir: string,
  projectPaths?: { memoryDir: string } | null,
): string {
  if (projectPaths) {
    return path.join(projectPaths.memoryDir, DB_FILENAME);
  }
  return path.join(agentDir, DB_FILENAME);
}

/**
 * Open a knowledge database and create a storage adapter.
 * Does NOT load sqlite-vec. Use `openKnowledgeStorageWithVec` for vector support.
 */
export function openKnowledgeStorage(dbPath: string): KnowledgeStorageAdapter {
  ensureDir(path.dirname(dbPath));
  const { DatabaseSync } = requireNodeSqlite();
  const db: DatabaseSync = new DatabaseSync(dbPath, { allowExtension: true });
  return createKnowledgeStorageFromDb(db);
}

/**
 * Open a knowledge database with sqlite-vec loaded, ready for vector operations.
 * This is the standard factory for production use.
 */
export async function openKnowledgeStorageWithVec(
  dbPath: string,
): Promise<KnowledgeStorageAdapter> {
  ensureDir(path.dirname(dbPath));
  const { DatabaseSync } = requireNodeSqlite();
  const db: DatabaseSync = new DatabaseSync(dbPath, { allowExtension: true });

  const loaded = await loadSqliteVecExtension({ db });
  if (!loaded.ok) {
    db.close();
    throw new Error(`Failed to load sqlite-vec: ${loaded.error ?? "unknown error"}`);
  }

  return createKnowledgeStorageFromDb(db);
}
