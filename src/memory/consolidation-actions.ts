/**
 * Types, interfaces, and configuration for the memory consolidation engine.
 *
 * Defines the five-action model (MERGE, REPLACE, KEEP_SEPARATE, UPDATE, SKIP),
 * the four memory areas, and all supporting types for the consolidation pipeline.
 *
 * @see docs/adr/0007-memory-consolidation-architecture.md
 */

import type { DatabaseSync } from "node:sqlite";

import type { SubsystemLogger } from "../logging/subsystem.js";
import type { TaskType } from "../agents/task-classifier.js";

// ---------------------------------------------------------------------------
// Consolidation actions
// ---------------------------------------------------------------------------

/** The five consolidation actions the engine can take on a new memory chunk. */
export const ConsolidationAction = {
  MERGE: "MERGE",
  REPLACE: "REPLACE",
  KEEP_SEPARATE: "KEEP_SEPARATE",
  UPDATE: "UPDATE",
  SKIP: "SKIP",
} as const;

export type ConsolidationAction = (typeof ConsolidationAction)[keyof typeof ConsolidationAction];

// ---------------------------------------------------------------------------
// Memory areas
// ---------------------------------------------------------------------------

/** Four memory areas for categorization. */
export const MemoryArea = {
  MAIN: "main",
  FRAGMENTS: "fragments",
  SOLUTIONS: "solutions",
  INSTRUMENTS: "instruments",
} as const;

export type MemoryArea = (typeof MemoryArea)[keyof typeof MemoryArea];

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Configuration for the consolidation engine. */
export interface ConsolidationConfig {
  /** Minimum similarity score for a chunk to be considered a candidate (default: 0.7). */
  similarityThreshold: number;
  /** Maximum similar chunks retrieved from search (default: 10). */
  maxSimilarMemories: number;
  /** Maximum similar chunks sent to LLM for analysis (default: 5). */
  maxLlmContextMemories: number;
  /** Minimum similarity required for destructive REPLACE (default: 0.9). */
  replaceSimilarityThreshold: number;
  /** Hard timeout for the entire consolidation pipeline in ms (default: 60000). */
  processingTimeoutMs: number;
  /** Enable or disable the consolidation engine (default: true). */
  enabled: boolean;
}

/** Create a ConsolidationConfig with defaults, optionally overridden. */
export function createDefaultConsolidationConfig(
  overrides?: Partial<ConsolidationConfig>,
): ConsolidationConfig {
  return {
    similarityThreshold: overrides?.similarityThreshold ?? 0.7,
    maxSimilarMemories: overrides?.maxSimilarMemories ?? 10,
    maxLlmContextMemories: overrides?.maxLlmContextMemories ?? 5,
    replaceSimilarityThreshold: overrides?.replaceSimilarityThreshold ?? 0.9,
    processingTimeoutMs: overrides?.processingTimeoutMs ?? 60_000,
    enabled: overrides?.enabled ?? true,
  };
}

// ---------------------------------------------------------------------------
// Similar chunk candidate
// ---------------------------------------------------------------------------

/** A candidate chunk returned by the similarity search step. */
export interface SimilarChunk {
  id: string;
  text: string;
  score: number;
  path: string;
  area: MemoryArea;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** Result returned by the consolidation pipeline for a single new chunk. */
export interface ConsolidationResult {
  action: ConsolidationAction;
  reasoning: string;
  newMemoryContent?: string;
  updatedContent?: string;
  targetId?: string;
  sourceChunkIds: string[];
  resultChunkId?: string;
  area: MemoryArea;
  model: string;
  durationMs: number;
}

/** A row from the consolidation_log table. */
export interface ConsolidationLogEntry {
  id: string;
  timestamp: number;
  action: ConsolidationAction;
  sourceIds: string[];
  resultId: string | null;
  area: MemoryArea;
  model: string;
  reasoning: string | null;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Dependency injection
// ---------------------------------------------------------------------------

/** Dependencies injected into the consolidation engine factory. */
export interface ConsolidationEngineDeps {
  db: DatabaseSync;
  embedText: (text: string) => Promise<number[]>;
  callLlm: (params: {
    systemPrompt: string;
    userPrompt: string;
    taskType: TaskType;
    signal?: AbortSignal;
  }) => Promise<string>;
  config: ConsolidationConfig;
  log: SubsystemLogger;
  /** Provider/model string for the vector table (e.g. "openai/text-embedding-3-small"). */
  providerModel: string;
  /** Name of the sqlite-vec virtual table. */
  vectorTable: string;
}

// ---------------------------------------------------------------------------
// Engine interface
// ---------------------------------------------------------------------------

/** The consolidation engine public API. */
export interface ConsolidationEngine {
  /** Process a new chunk through the consolidation pipeline. */
  processNewChunk(params: {
    chunkId: string;
    text: string;
    embedding: number[];
    area: MemoryArea;
    path: string;
    model: string;
  }): Promise<ConsolidationResult>;

  /** Find similar chunks using vector search. */
  findSimilar(params: {
    text: string;
    embedding: number[];
    area: MemoryArea;
    limit: number;
    minScore: number;
  }): Promise<SimilarChunk[]>;

  /** Query the consolidation log for audit/debugging. */
  getConsolidationLog(params: {
    limit?: number;
    area?: MemoryArea;
    action?: ConsolidationAction;
    since?: number;
  }): ConsolidationLogEntry[];
}
