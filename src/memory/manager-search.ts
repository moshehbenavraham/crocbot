import type { DatabaseSync } from "node:sqlite";

import { truncateUtf16Safe } from "../utils.js";
import { cosineSimilarity, parseEmbedding } from "./internal.js";

const vectorToBlob = (embedding: number[]): Buffer =>
  Buffer.from(new Float32Array(embedding).buffer);

export type SearchSource = string;

export type SearchRowResult = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  source: SearchSource;
  area: string;
  importance: number;
};

export async function searchVector(params: {
  db: DatabaseSync;
  vectorTable: string;
  providerModel: string;
  queryVec: number[];
  limit: number;
  snippetMaxChars: number;
  ensureVectorReady: (dimensions: number) => Promise<boolean>;
  sourceFilterVec: { sql: string; params: SearchSource[] };
  sourceFilterChunks: { sql: string; params: SearchSource[] };
  areaFilter?: { sql: string; params: string[] };
}): Promise<SearchRowResult[]> {
  if (params.queryVec.length === 0 || params.limit <= 0) {
    return [];
  }
  const areaFilterSql = params.areaFilter?.sql ?? "";
  const areaFilterParams = params.areaFilter?.params ?? [];
  if (await params.ensureVectorReady(params.queryVec.length)) {
    const rows = params.db
      .prepare(
        `SELECT c.id, c.path, c.start_line, c.end_line, c.text,\n` +
          `       c.source, c.area, c.importance,\n` +
          `       vec_distance_cosine(v.embedding, ?) AS dist\n` +
          `  FROM ${params.vectorTable} v\n` +
          `  JOIN chunks c ON c.id = v.id\n` +
          ` WHERE c.model = ?${params.sourceFilterVec.sql}${areaFilterSql}\n` +
          ` ORDER BY dist ASC\n` +
          ` LIMIT ?`,
      )
      .all(
        vectorToBlob(params.queryVec),
        params.providerModel,
        ...params.sourceFilterVec.params,
        ...areaFilterParams,
        params.limit,
      ) as Array<{
      id: string;
      path: string;
      start_line: number;
      end_line: number;
      text: string;
      source: SearchSource;
      area: string | null;
      importance: number | null;
      dist: number;
    }>;
    return rows.map((row) => ({
      id: row.id,
      path: row.path,
      startLine: row.start_line,
      endLine: row.end_line,
      score: 1 - row.dist,
      snippet: truncateUtf16Safe(row.text, params.snippetMaxChars),
      source: row.source,
      area: row.area ?? "main",
      importance: row.importance ?? 0.5,
    }));
  }

  const candidates = listChunks({
    db: params.db,
    providerModel: params.providerModel,
    sourceFilter: params.sourceFilterChunks,
  });
  const scored = candidates
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(params.queryVec, chunk.embedding),
    }))
    .filter((entry) => Number.isFinite(entry.score));
  const areaValue = areaFilterParams[0];
  const filtered = areaValue ? scored.filter((entry) => entry.chunk.area === areaValue) : scored;
  return filtered
    .toSorted((a, b) => b.score - a.score)
    .slice(0, params.limit)
    .map((entry) => ({
      id: entry.chunk.id,
      path: entry.chunk.path,
      startLine: entry.chunk.startLine,
      endLine: entry.chunk.endLine,
      score: entry.score,
      snippet: truncateUtf16Safe(entry.chunk.text, params.snippetMaxChars),
      source: entry.chunk.source,
      area: entry.chunk.area,
      importance: entry.chunk.importance,
    }));
}

export function listChunks(params: {
  db: DatabaseSync;
  providerModel: string;
  sourceFilter: { sql: string; params: SearchSource[] };
}): Array<{
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  text: string;
  embedding: number[];
  source: SearchSource;
  area: string;
  importance: number;
}> {
  const rows = params.db
    .prepare(
      `SELECT id, path, start_line, end_line, text, embedding, source, area, importance\n` +
        `  FROM chunks\n` +
        ` WHERE model = ?${params.sourceFilter.sql}`,
    )
    .all(params.providerModel, ...params.sourceFilter.params) as Array<{
    id: string;
    path: string;
    start_line: number;
    end_line: number;
    text: string;
    embedding: string;
    source: SearchSource;
    area: string | null;
    importance: number | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    path: row.path,
    startLine: row.start_line,
    endLine: row.end_line,
    text: row.text,
    embedding: parseEmbedding(row.embedding),
    source: row.source,
    area: row.area ?? "main",
    importance: row.importance ?? 0.5,
  }));
}

export async function searchKeyword(params: {
  db: DatabaseSync;
  ftsTable: string;
  providerModel: string;
  query: string;
  limit: number;
  snippetMaxChars: number;
  sourceFilter: { sql: string; params: SearchSource[] };
  buildFtsQuery: (raw: string) => string | null;
  bm25RankToScore: (rank: number) => number;
  areaFilter?: { sql: string; params: string[] };
}): Promise<Array<SearchRowResult & { textScore: number }>> {
  if (params.limit <= 0) {
    return [];
  }
  const ftsQuery = params.buildFtsQuery(params.query);
  if (!ftsQuery) {
    return [];
  }

  // Query FTS table directly (area available as FTS column since v2 schema).
  // Look up importance from chunks table in a second step since FTS5 JOINs
  // can interfere with bm25() ranking.
  const areaFilterSql = params.areaFilter ? ` AND area = ?` : "";
  const areaFilterParams = params.areaFilter?.params ?? [];
  const rows = params.db
    .prepare(
      `SELECT id, path, source, start_line, end_line, text, area,\n` +
        `       bm25(${params.ftsTable}) AS rank\n` +
        `  FROM ${params.ftsTable}\n` +
        ` WHERE ${params.ftsTable} MATCH ? AND model = ?${params.sourceFilter.sql}${areaFilterSql}\n` +
        ` ORDER BY rank ASC\n` +
        ` LIMIT ?`,
    )
    .all(
      ftsQuery,
      params.providerModel,
      ...params.sourceFilter.params,
      ...areaFilterParams,
      params.limit,
    ) as Array<{
    id: string;
    path: string;
    source: SearchSource;
    start_line: number;
    end_line: number;
    text: string;
    area: string | null;
    rank: number;
  }>;

  // Batch lookup importance from chunks table
  const importanceMap = new Map<string, number>();
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(", ");
    const impRows = params.db
      .prepare(`SELECT id, importance FROM chunks WHERE id IN (${placeholders})`)
      .all(...ids) as Array<{ id: string; importance: number | null }>;
    for (const ir of impRows) {
      importanceMap.set(ir.id, ir.importance ?? 0.5);
    }
  }

  return rows.map((row) => {
    const textScore = params.bm25RankToScore(row.rank);
    return {
      id: row.id,
      path: row.path,
      startLine: row.start_line,
      endLine: row.end_line,
      score: textScore,
      textScore,
      snippet: truncateUtf16Safe(row.text, params.snippetMaxChars),
      source: row.source,
      area: row.area ?? "main",
      importance: importanceMap.get(row.id) ?? 0.5,
    };
  });
}
