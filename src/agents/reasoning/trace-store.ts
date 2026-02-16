/**
 * SQLite-backed storage for reasoning traces.
 *
 * Persists reasoning traces at end-of-turn and supports querying by
 * session, model, time range, and retention-based cleanup.
 */

import type { DatabaseSync } from "node:sqlite";

import { onAgentEvent } from "../../infra/agent-events.js";
import type { AgentEventPayload } from "../../infra/agent-events.js";
import { ensureReasoningSchema } from "./reasoning-schema.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReasoningTrace {
  id: number;
  sessionKey: string;
  runId: string;
  model: string;
  provider: string;
  reasoningText: string;
  reasoningTokens: number;
  totalTokens: number;
  durationMs: number;
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface InsertTraceParams {
  sessionKey: string;
  runId: string;
  model: string;
  provider: string;
  reasoningText: string;
  reasoningTokens: number;
  totalTokens: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export interface TraceQueryOptions {
  sessionKey?: string;
  model?: string;
  since?: number;
  until?: number;
  limit?: number;
}

export interface TraceStoreConfig {
  /** Days to retain traces before cleanup (default: 7). */
  retentionDays: number;
  /** Enable trace persistence (default: true). */
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Provider-specific usage parsing
// ---------------------------------------------------------------------------

/**
 * Extract reasoning token count from a provider completion response's
 * `usage` object. Each provider stores reasoning tokens in a different
 * location.
 *
 * - OpenAI: `usage.completion_tokens_details.reasoning_tokens`
 * - Anthropic: `usage.cache_creation_input_tokens` (extended thinking)
 * - Fallback: 0
 */
export function parseReasoningTokens(provider: string, usage: unknown): number {
  if (!usage || typeof usage !== "object") {
    return 0;
  }
  const u = usage as Record<string, unknown>;

  if (provider === "openai" || provider === "openrouter") {
    const details = u.completion_tokens_details;
    if (details && typeof details === "object") {
      const d = details as Record<string, unknown>;
      const tokens = d.reasoning_tokens;
      if (typeof tokens === "number" && tokens > 0) {
        return tokens;
      }
    }
  }

  if (provider === "anthropic") {
    const tokens = u.cache_creation_input_tokens;
    if (typeof tokens === "number" && tokens > 0) {
      return tokens;
    }
  }

  // Generic fallback: check for a top-level reasoning_tokens field.
  const generic = u.reasoning_tokens;
  if (typeof generic === "number" && generic > 0) {
    return generic;
  }

  return 0;
}

// ---------------------------------------------------------------------------
// ReasoningTraceStore
// ---------------------------------------------------------------------------

/**
 * SQLite-backed reasoning trace store. Handles insert, query, and
 * retention cleanup.
 */
export class ReasoningTraceStore {
  private readonly db: DatabaseSync;
  private readonly config: TraceStoreConfig;

  constructor(db: DatabaseSync, config?: Partial<TraceStoreConfig>) {
    this.db = db;
    this.config = {
      retentionDays: config?.retentionDays ?? 7,
      enabled: config?.enabled ?? true,
    };
    ensureReasoningSchema({ db });
  }

  /** Whether trace persistence is enabled. */
  get enabled(): boolean {
    return this.config.enabled;
  }

  /** Insert a reasoning trace. Returns the inserted row ID. */
  insert(params: InsertTraceParams): number {
    const result = this.db
      .prepare(
        `INSERT INTO reasoning_traces
         (session_key, run_id, model, provider, reasoning_text, reasoning_tokens,
          total_tokens, duration_ms, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        params.sessionKey,
        params.runId,
        params.model,
        params.provider,
        params.reasoningText,
        params.reasoningTokens,
        params.totalTokens,
        params.durationMs,
        JSON.stringify(params.metadata ?? {}),
        Date.now(),
      );
    return Number(result.lastInsertRowid);
  }

  /** Query traces by session key. */
  queryBySession(sessionKey: string, limit = 100): ReasoningTrace[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM reasoning_traces
         WHERE session_key = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(sessionKey, limit) as RawTraceRow[];
    return rows.map(toReasoningTrace);
  }

  /** Query traces by model name. */
  queryByModel(model: string, limit = 100): ReasoningTrace[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM reasoning_traces
         WHERE model = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(model, limit) as RawTraceRow[];
    return rows.map(toReasoningTrace);
  }

  /** Query traces within a time range (epoch ms). */
  queryByTimeRange(since: number, until?: number, limit = 100): ReasoningTrace[] {
    if (until !== undefined) {
      const rows = this.db
        .prepare(
          `SELECT * FROM reasoning_traces
           WHERE created_at >= ? AND created_at <= ?
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .all(since, until, limit) as RawTraceRow[];
      return rows.map(toReasoningTrace);
    }
    const rows = this.db
      .prepare(
        `SELECT * FROM reasoning_traces
         WHERE created_at >= ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(since, limit) as RawTraceRow[];
    return rows.map(toReasoningTrace);
  }

  /**
   * Query traces with flexible filtering. Combines session, model, and
   * time range filters.
   */
  query(options: TraceQueryOptions = {}): ReasoningTrace[] {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (options.sessionKey) {
      conditions.push("session_key = ?");
      params.push(options.sessionKey);
    }
    if (options.model) {
      conditions.push("model = ?");
      params.push(options.model);
    }
    if (options.since !== undefined) {
      conditions.push("created_at >= ?");
      params.push(options.since);
    }
    if (options.until !== undefined) {
      conditions.push("created_at <= ?");
      params.push(options.until);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = options.limit ?? 100;
    params.push(limit);

    const rows = this.db
      .prepare(`SELECT * FROM reasoning_traces ${where} ORDER BY created_at DESC LIMIT ?`)
      .all(...params) as RawTraceRow[];
    return rows.map(toReasoningTrace);
  }

  /**
   * Delete traces older than the configured retention period.
   * Returns the number of deleted rows.
   */
  deleteExpired(): number {
    const cutoff = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;
    const result = this.db.prepare(`DELETE FROM reasoning_traces WHERE created_at < ?`).run(cutoff);
    return Number(result.changes);
  }

  /** Delete all traces (for testing). */
  deleteAll(): number {
    const result = this.db.prepare(`DELETE FROM reasoning_traces`).run();
    return Number(result.changes);
  }

  /** Count total traces. */
  count(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as cnt FROM reasoning_traces`).get() as {
      cnt: number;
    };
    return row.cnt;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type RawTraceRow = {
  id: number;
  session_key: string;
  run_id: string;
  model: string;
  provider: string;
  reasoning_text: string;
  reasoning_tokens: number;
  total_tokens: number;
  duration_ms: number;
  metadata: string;
  created_at: number;
};

// ---------------------------------------------------------------------------
// Event listener integration
// ---------------------------------------------------------------------------

/**
 * Subscribe the trace store to `"thinking"` stream events via the agent
 * event bus. Returns an unsubscribe function.
 *
 * Event payload shape (emitted by the message handler at message_end):
 * ```
 * { stream: "thinking", data: { sessionKey, runId, model, provider,
 *   reasoningText, reasoningTokens, totalTokens, durationMs, metadata } }
 * ```
 */
export function initTraceStoreListener(store: ReasoningTraceStore): () => void {
  return onAgentEvent((evt: AgentEventPayload) => {
    if (evt.stream !== "thinking") {
      return;
    }
    if (!store.enabled) {
      return;
    }

    const d = evt.data;
    const sessionKey = typeof d.sessionKey === "string" ? d.sessionKey : (evt.sessionKey ?? "");
    const runId = typeof d.runId === "string" ? d.runId : evt.runId;
    const model = typeof d.model === "string" ? d.model : "";
    const provider = typeof d.provider === "string" ? d.provider : "";
    const reasoningText = typeof d.reasoningText === "string" ? d.reasoningText : "";
    const reasoningTokens = typeof d.reasoningTokens === "number" ? d.reasoningTokens : 0;
    const totalTokens = typeof d.totalTokens === "number" ? d.totalTokens : 0;
    const durationMs = typeof d.durationMs === "number" ? d.durationMs : 0;
    const metadata =
      d.metadata && typeof d.metadata === "object" ? (d.metadata as Record<string, unknown>) : {};

    store.insert({
      sessionKey,
      runId,
      model,
      provider,
      reasoningText,
      reasoningTokens,
      totalTokens,
      durationMs,
      metadata,
    });
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toReasoningTrace(row: RawTraceRow): ReasoningTrace {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(row.metadata) as Record<string, unknown>;
  } catch {
    // Keep empty object on parse failure.
  }
  return {
    id: row.id,
    sessionKey: row.session_key,
    runId: row.run_id,
    model: row.model,
    provider: row.provider,
    reasoningText: row.reasoning_text,
    reasoningTokens: row.reasoning_tokens,
    totalTokens: row.total_tokens,
    durationMs: row.duration_ms,
    metadata,
    createdAt: row.created_at,
  };
}
