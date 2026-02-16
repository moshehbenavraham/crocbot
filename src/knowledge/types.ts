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

// -- Incremental re-import types (consumed by session 04) --

/** Action to take for an incremental re-import. */
export type IncrementalAction = "new" | "unchanged" | "changed";

/** Result of classifying a source for incremental re-import. */
export interface IncrementalResult {
  readonly action: IncrementalAction;
  readonly sourceValue: string;
  /** Content hash of the incoming document. */
  readonly incomingHash: string;
  /** Content hash stored from the previous import (null for new sources). */
  readonly storedHash: string | null;
  /** Number of chunks from the previous import (0 for new sources). */
  readonly previousChunkCount: number;
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

// -- Knowledge category types --

/** Category for imported knowledge chunks. */
export type KnowledgeCategory = "docs" | "references" | "solutions";

// -- Deduplication types (consumed by session 03) --

/** Result of deduplication for a single chunk. */
export interface DedupCheckResult {
  /** Whether the chunk is a duplicate. */
  readonly isDuplicate: boolean;
  /** Reason for dedup: "hash" for exact match, "similarity" for near-duplicate. */
  readonly reason?: "hash" | "similarity";
  /** Cosine similarity score when deduped by similarity. */
  readonly similarityScore?: number;
}

/** Result summary of dedup stage for a batch of chunks. */
export interface DedupResult {
  /** Chunks that passed dedup (not duplicates). */
  readonly unique: DocumentChunk[];
  /** Number of chunks removed by hash dedup. */
  readonly hashDuplicates: number;
  /** Number of chunks removed by similarity dedup. */
  readonly similarityDuplicates: number;
}

/** Configuration for deduplication behavior. */
export interface DedupOptions {
  /** Cosine similarity threshold for near-duplicate detection (0-1). */
  readonly similarityThreshold: number;
  /** Enable hash-based exact dedup (default: true). */
  readonly hashDedup?: boolean;
  /** Enable embedding similarity dedup (default: true). */
  readonly similarityDedup?: boolean;
}

// -- Storage adapter types (consumed by session 03) --

/** A stored chunk record retrieved from the knowledge store. */
export interface StoredChunk {
  readonly id: string;
  readonly text: string;
  readonly hash: string;
  readonly sourceValue: string;
  readonly headingContext?: string;
  readonly category: KnowledgeCategory;
  readonly createdAt: number;
}

/** A vector search result with similarity score. */
export interface VectorSearchResult {
  readonly chunkId: string;
  readonly distance: number;
  readonly similarity: number;
}

/** Storage adapter interface for knowledge chunks and embeddings. */
export interface KnowledgeStorageAdapter {
  /** Ensure tables exist (idempotent). */
  ensureSchema(dimensions: number): void;
  /** Insert a chunk with its embedding vector. */
  insertChunk(chunk: DocumentChunk, embedding: number[], category: KnowledgeCategory): void;
  /** Check if a chunk hash already exists in the store. */
  hasHash(hash: string): boolean;
  /** Get all chunk hashes for a given source. */
  getHashesForSource(sourceValue: string): string[];
  /** Find similar vectors by cosine distance. */
  findSimilar(embedding: number[], limit: number): VectorSearchResult[];
  /** Delete all chunks from a given source. */
  deleteBySource(sourceValue: string): number;
  /** Get chunk count for a given source. */
  countBySource(sourceValue: string): number;
  /** Close the database connection. */
  close(): void;
}

// -- Pipeline dependency injection types (consumed by session 03) --

/** Injected dependencies for the import pipeline. */
export interface PipelineDeps {
  /** Embed a batch of text strings into vectors. */
  readonly embedBatch: (texts: string[]) => Promise<number[][]>;
  /** Embedding model identifier for chunk ID generation. */
  readonly embeddingModel: string;
  /** Storage adapter for persisting chunks and vectors. */
  readonly storage: KnowledgeStorageAdapter;
  /** Chunking configuration. */
  readonly chunking: ChunkingOptions;
  /** Deduplication configuration. */
  readonly dedup: DedupOptions;
  /** Maximum texts per embedding batch call. */
  readonly embeddingBatchSize: number;
  /** Knowledge category for imported chunks. */
  readonly category: KnowledgeCategory;
}
