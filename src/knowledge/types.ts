// Core type definitions for the Knowledge Base Import Pipeline (Phase 15).

// -- Source types --

/** Discriminator for import source origin. */
export type ImportSourceType = "url" | "file";

/** A single source to import into the knowledge base. */
export interface ImportSource {
  readonly type: ImportSourceType;
  /** URL string or absolute file path. */
  readonly value: string;
  /** Optional human-readable label (defaults to hostname or filename). */
  readonly label?: string;
  /** Optional key-value metadata propagated to all chunks from this source. */
  readonly metadata?: Record<string, string>;
}

// -- Parsed document types --

/** Content type detected by the parser. */
export type DocumentContentType = "html" | "pdf" | "markdown" | "text";

/** Output of a parser: content normalized to markdown with metadata. */
export interface ParsedDocument {
  readonly title: string;
  /** Content normalized to markdown format. */
  readonly content: string;
  readonly source: ImportSource;
  /** SHA-256 hex digest of normalized content for change detection. */
  readonly contentHash: string;
  readonly contentType: DocumentContentType;
  /** Byte length of raw source content before parsing. */
  readonly rawByteLength: number;
  /** ISO-8601 timestamp of when the content was fetched/read. */
  readonly fetchedAt: string;
  /** Parser-specific metadata (page count, extraction warnings, etc.). */
  readonly parserMeta?: Record<string, unknown>;
}

// -- Chunk types (consumed by session 03) --

/** A single chunk of a parsed document, ready for embedding and storage. */
export interface DocumentChunk {
  /** SHA-256 of (sourceValue + chunkIndex + text + embeddingModel). */
  readonly id: string;
  readonly text: string;
  /** SHA-256 hash of chunk text. */
  readonly hash: string;
  /** Zero-based chunk index within the parent document. */
  readonly index: number;
  /** Total chunks in the parent document. */
  readonly total: number;
  /** 1-based start line in the parsed content. */
  readonly startLine: number;
  /** 1-based end line in the parsed content. */
  readonly endLine: number;
  /** Reference back to ImportSource.value. */
  readonly sourceValue: string;
  /** Nearest parent heading text for semantic retrieval context. */
  readonly headingContext?: string;
}

// -- Import state types (consumed by session 04) --

/** State machine status for incremental re-imports. */
export type ImportStateStatus = "new" | "original" | "changed" | "removed";

/** Persisted state for a single import source. */
export interface ImportState {
  readonly sourceValue: string;
  readonly sourceType: ImportSourceType;
  contentHash: string;
  status: ImportStateStatus;
  /** ISO-8601 timestamp of last successful import. */
  lastImportedAt: string;
  chunkCount: number;
  /** Chunk IDs from last import (for cleanup on re-import). */
  chunkIds: string[];
  label?: string;
  metadata?: Record<string, string>;
}

/** Persistence interface for import state records. */
export interface ImportStateStore {
  get(sourceValue: string): ImportState | null;
  list(filter?: { status?: ImportStateStatus }): ImportState[];
  upsert(state: ImportState): void;
  markRemoved(sourceValue: string): void;
  delete(sourceValue: string): void;
}

// -- Pipeline types (consumed by session 03-04) --

/** Stage labels for progress reporting. */
export type ImportStage = "fetch" | "parse" | "chunk" | "embed" | "dedup" | "store";

/** Progress update emitted during pipeline execution. */
export interface ImportProgressUpdate {
  readonly stage: ImportStage;
  readonly completed: number;
  readonly total: number;
  readonly label?: string;
}

/** Options for a single document import. */
export interface ImportPipelineOptions {
  readonly source: ImportSource;
  readonly agentId: string;
  readonly projectId?: string | null;
  /** Force re-import even if content hash is unchanged. */
  readonly force?: boolean;
  /** Parse and chunk without storing (preview mode). */
  readonly dryRun?: boolean;
  readonly signal?: AbortSignal;
  readonly onProgress?: (update: ImportProgressUpdate) => void;
}

/** Result of a single document import. */
export interface ImportResult {
  readonly source: ImportSource;
  readonly status: "imported" | "unchanged" | "failed" | "dry-run";
  readonly chunksStored: number;
  readonly chunksSkipped: number;
  readonly contentHash: string;
  readonly durationMs: number;
  readonly error?: string;
}

/** Chunking configuration for the pipeline. */
export interface ChunkingOptions {
  /** Maximum tokens per chunk. */
  readonly tokens: number;
  /** Overlap tokens between adjacent chunks. */
  readonly overlap: number;
  /** Enable heading-aware splitting (default: true for markdown). */
  readonly headingAware?: boolean;
}
