/**
 * Memory consolidation engine.
 *
 * Analyzes new memory chunks against existing ones using vector similarity
 * search, routes decisions through the utility model, and applies the chosen
 * action (MERGE, REPLACE, KEEP_SEPARATE, UPDATE, SKIP) atomically.
 *
 * @see docs/adr/0007-memory-consolidation-architecture.md
 */

import { randomUUID } from "node:crypto";

import {
  ConsolidationAction,
  type ConsolidationEngine,
  type ConsolidationEngineDeps,
  type ConsolidationLogEntry,
  type ConsolidationResult,
  type MemoryArea,
  type SimilarChunk,
} from "./consolidation-actions.js";
import {
  buildConsolidationMessagePrompt,
  buildConsolidationSystemPrompt,
  parseConsolidationResponse,
} from "./consolidation-prompts.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const vectorToBlob = (embedding: number[]): Buffer =>
  Buffer.from(new Float32Array(embedding).buffer);

const SNIPPET_MAX_CHARS = 700;

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return text.slice(0, maxChars) + "...";
}

// ---------------------------------------------------------------------------
// Internal: consolidation log writer
// ---------------------------------------------------------------------------

function logConsolidationResult(deps: ConsolidationEngineDeps, result: ConsolidationResult): void {
  const id = randomUUID();
  const now = Date.now();
  deps.db
    .prepare(
      `INSERT INTO consolidation_log (id, timestamp, action, source_ids, result_id, area, model, reasoning, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      now,
      result.action,
      JSON.stringify(result.sourceChunkIds),
      result.resultChunkId ?? null,
      result.area,
      result.model,
      result.reasoning,
      now,
    );
}

// ---------------------------------------------------------------------------
// Internal: apply result handlers
// ---------------------------------------------------------------------------

function applyMerge(deps: ConsolidationEngineDeps, result: ConsolidationResult): void {
  if (!result.newMemoryContent || result.newMemoryContent.trim().length === 0) {
    deps.log.warn("MERGE action has empty newMemoryContent, downgrading to KEEP_SEPARATE");
    result.action = ConsolidationAction.KEEP_SEPARATE;
    result.reasoning = `${result.reasoning} (downgraded: empty merged content)`;
    return;
  }

  if (!result.targetId) {
    deps.log.warn("MERGE action missing targetId, downgrading to KEEP_SEPARATE");
    result.action = ConsolidationAction.KEEP_SEPARATE;
    result.reasoning = `${result.reasoning} (downgraded: no target)`;
    return;
  }

  // Update the target chunk text with merged content
  deps.db
    .prepare(`UPDATE chunks SET text = ?, updated_at = ? WHERE id = ?`)
    .run(result.newMemoryContent, Date.now(), result.targetId);
}

function applyReplace(deps: ConsolidationEngineDeps, result: ConsolidationResult): void {
  if (!result.targetId) {
    deps.log.warn("REPLACE action missing targetId, downgrading to KEEP_SEPARATE");
    result.action = ConsolidationAction.KEEP_SEPARATE;
    result.reasoning = `${result.reasoning} (downgraded: no target)`;
    return;
  }

  // Delete the target chunk (the new chunk is already inserted or will be by the caller)
  deps.db.prepare(`DELETE FROM chunks WHERE id = ?`).run(result.targetId);
}

function applyUpdate(deps: ConsolidationEngineDeps, result: ConsolidationResult): void {
  if (!result.targetId) {
    deps.log.warn("UPDATE action missing targetId, downgrading to KEEP_SEPARATE");
    result.action = ConsolidationAction.KEEP_SEPARATE;
    result.reasoning = `${result.reasoning} (downgraded: no target)`;
    return;
  }

  if (result.updatedContent && result.updatedContent.trim().length > 0) {
    deps.db
      .prepare(`UPDATE chunks SET text = ?, updated_at = ? WHERE id = ?`)
      .run(result.updatedContent, Date.now(), result.targetId);
  }
}

// ---------------------------------------------------------------------------
// Internal: apply result dispatcher
// ---------------------------------------------------------------------------

function applyResult(deps: ConsolidationEngineDeps, result: ConsolidationResult): void {
  const txn = deps.db.prepare("BEGIN");
  const commit = deps.db.prepare("COMMIT");
  const rollback = deps.db.prepare("ROLLBACK");

  txn.run();
  try {
    switch (result.action) {
      case ConsolidationAction.MERGE:
        applyMerge(deps, result);
        break;
      case ConsolidationAction.REPLACE:
        applyReplace(deps, result);
        break;
      case ConsolidationAction.UPDATE:
        applyUpdate(deps, result);
        break;
      case ConsolidationAction.KEEP_SEPARATE:
      case ConsolidationAction.SKIP:
        // No database mutations for these actions
        break;
    }

    logConsolidationResult(deps, result);
    commit.run();
  } catch (err) {
    rollback.run();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Internal: find similar chunks
// ---------------------------------------------------------------------------

async function findSimilarImpl(
  deps: ConsolidationEngineDeps,
  params: {
    text: string;
    embedding: number[];
    area: MemoryArea;
    limit: number;
    minScore: number;
  },
): Promise<SimilarChunk[]> {
  if (params.embedding.length === 0) {
    return [];
  }

  // Query sqlite-vec for cosine distance, filter by threshold
  const rows = deps.db
    .prepare(
      `SELECT c.id, c.path, c.text, c.area,
              vec_distance_cosine(v.embedding, ?) AS dist
         FROM ${deps.vectorTable} v
         JOIN chunks c ON c.id = v.id
        WHERE c.model = ?
        ORDER BY dist ASC
        LIMIT ?`,
    )
    .all(vectorToBlob(params.embedding), deps.providerModel, params.limit) as Array<{
    id: string;
    path: string;
    text: string;
    area: string;
    dist: number;
  }>;

  return rows
    .map((row) => ({
      id: row.id,
      text: truncateText(row.text, SNIPPET_MAX_CHARS),
      score: 1 - row.dist,
      path: row.path,
      area: (row.area || "main") as MemoryArea,
    }))
    .filter((r) => r.score >= params.minScore);
}

// ---------------------------------------------------------------------------
// Internal: process new chunk pipeline
// ---------------------------------------------------------------------------

async function processNewChunkImpl(
  deps: ConsolidationEngineDeps,
  params: {
    chunkId: string;
    text: string;
    embedding: number[];
    area: MemoryArea;
    path: string;
    model: string;
  },
): Promise<ConsolidationResult> {
  const startMs = Date.now();

  const makeResult = (
    action: ConsolidationAction,
    reasoning: string,
    extra?: Partial<ConsolidationResult>,
  ): ConsolidationResult => ({
    action,
    reasoning,
    sourceChunkIds: [params.chunkId],
    area: params.area,
    model: params.model,
    durationMs: Date.now() - startMs,
    ...extra,
  });

  // Guard: engine disabled
  if (!deps.config.enabled) {
    return makeResult(ConsolidationAction.SKIP, "consolidation disabled");
  }

  // Guard: empty text
  if (!params.text || params.text.trim().length === 0) {
    return makeResult(ConsolidationAction.SKIP, "empty chunk text");
  }

  // Step 1: Find similar chunks
  const candidates = await findSimilarImpl(deps, {
    text: params.text,
    embedding: params.embedding,
    area: params.area,
    limit: deps.config.maxSimilarMemories,
    minScore: deps.config.similarityThreshold,
  });

  // No similar candidates -- skip LLM call, treat as KEEP_SEPARATE
  if (candidates.length === 0) {
    const result = makeResult(ConsolidationAction.KEEP_SEPARATE, "no similar candidates found");
    applyResult(deps, result);
    return result;
  }

  // Step 2: Validate candidate chunks still exist
  const validCandidates = candidates.filter((c) => {
    const row = deps.db.prepare(`SELECT 1 FROM chunks WHERE id = ?`).get(c.id) as
      | Record<string, unknown>
      | undefined;
    return row !== undefined;
  });

  if (validCandidates.length === 0) {
    const result = makeResult(ConsolidationAction.KEEP_SEPARATE, "all candidates stale");
    applyResult(deps, result);
    return result;
  }

  // Take top N for LLM context
  const llmCandidates = validCandidates.slice(0, deps.config.maxLlmContextMemories);

  // Step 3: LLM analyze
  const systemPrompt = buildConsolidationSystemPrompt();
  const userPrompt = buildConsolidationMessagePrompt({
    area: params.area,
    newMemory: params.text,
    similarMemories: llmCandidates,
  });

  let rawResponse: string;
  try {
    rawResponse = await deps.callLlm({
      systemPrompt,
      userPrompt,
      taskType: "consolidation",
      signal: AbortSignal.timeout(deps.config.processingTimeoutMs),
    });
  } catch (err) {
    const isTimeout =
      err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    const reasoning = isTimeout ? "timeout" : "llm_error";
    deps.log.warn(`consolidation LLM call failed: ${reasoning}`, {
      error: err instanceof Error ? err.message : String(err),
    });
    const result = makeResult(ConsolidationAction.SKIP, reasoning);
    applyResult(deps, result);
    return result;
  }

  // Step 4: Parse response and enforce safety gates
  const parsed = parseConsolidationResponse(rawResponse);

  // REPLACE safety gate: require similarity >= replaceSimilarityThreshold
  if (parsed.action === ConsolidationAction.REPLACE && parsed.targetId) {
    const target = validCandidates.find((c) => c.id === parsed.targetId);
    if (!target || target.score < deps.config.replaceSimilarityThreshold) {
      deps.log.info(
        `REPLACE safety gate: target similarity ${target?.score ?? 0} < ${deps.config.replaceSimilarityThreshold}, downgrading to KEEP_SEPARATE`,
      );
      parsed.action = ConsolidationAction.KEEP_SEPARATE;
      parsed.reasoning = `${parsed.reasoning} (downgraded: similarity below replace threshold)`;
    }
  }

  const result = makeResult(parsed.action, parsed.reasoning, {
    targetId: parsed.targetId,
    newMemoryContent: parsed.newMemoryContent,
    updatedContent: parsed.updatedContent,
    sourceChunkIds: [params.chunkId, ...llmCandidates.map((c) => c.id)],
    resultChunkId: parsed.targetId ?? params.chunkId,
  });

  applyResult(deps, result);
  return result;
}

// ---------------------------------------------------------------------------
// Internal: get consolidation log
// ---------------------------------------------------------------------------

function getConsolidationLogImpl(
  deps: ConsolidationEngineDeps,
  params: {
    limit?: number;
    area?: MemoryArea;
    action?: ConsolidationAction;
    since?: number;
  },
): ConsolidationLogEntry[] {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.area) {
    conditions.push("area = ?");
    values.push(params.area);
  }
  if (params.action) {
    conditions.push("action = ?");
    values.push(params.action);
  }
  if (params.since !== undefined) {
    conditions.push("timestamp >= ?");
    values.push(params.since);
  }

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
  const limit = params.limit ?? 100;
  values.push(limit);

  const rows = deps.db
    .prepare(
      `SELECT id, timestamp, action, source_ids, result_id, area, model, reasoning, created_at
         FROM consolidation_log${where}
        ORDER BY timestamp DESC
        LIMIT ?`,
    )
    .all(...values) as Array<{
    id: string;
    timestamp: number;
    action: string;
    source_ids: string;
    result_id: string | null;
    area: string;
    model: string;
    reasoning: string | null;
    created_at: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    action: row.action as ConsolidationAction,
    sourceIds: JSON.parse(row.source_ids) as string[],
    resultId: row.result_id,
    area: row.area as MemoryArea,
    model: row.model,
    reasoning: row.reasoning,
    createdAt: row.created_at,
  }));
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a consolidation engine instance.
 *
 * The engine captures dependencies in a closure and exposes the three public
 * methods: processNewChunk, findSimilar, getConsolidationLog.
 */
export function createConsolidationEngine(deps: ConsolidationEngineDeps): ConsolidationEngine {
  deps.log.info("consolidation engine initialized", {
    enabled: deps.config.enabled,
    similarityThreshold: deps.config.similarityThreshold,
    replaceSimilarityThreshold: deps.config.replaceSimilarityThreshold,
    timeoutMs: deps.config.processingTimeoutMs,
  });

  return {
    processNewChunk: (params) => processNewChunkImpl(deps, params),
    findSimilar: (params) => findSimilarImpl(deps, params),
    getConsolidationLog: (params) => getConsolidationLogImpl(deps, params),
  };
}
