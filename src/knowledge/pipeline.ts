import type { crocbotConfig } from "../config/config.js";
import { resolveAgentDir } from "../agents/agent-scope.js";
import { isDefaultProject, resolveProjectPaths } from "../agents/project-scope.js";
import { createEmbeddingProvider, type EmbeddingProviderOptions } from "../memory/embeddings.js";
import { chunkDocument, DEFAULT_CHUNKING } from "./chunker.js";
import { deduplicateChunks, DEFAULT_DEDUP } from "./dedup.js";
import { openKnowledgeStorageWithVec, resolveKnowledgeDbPath } from "./storage.js";
import type {
  ChunkingOptions,
  DedupOptions,
  DocumentChunk,
  ImportPipelineOptions,
  ImportResult,
  ImportStage,
  KnowledgeCategory,
  ParsedDocument,
  PipelineDeps,
} from "./types.js";

// -- Constants --

/** Default number of texts per embedding batch call. */
const DEFAULT_EMBEDDING_BATCH_SIZE = 50;

// -- Batch embedding --

/**
 * Embed chunks in batches, respecting the configured batch size.
 * Returns a parallel array of embeddings matching the input chunks.
 */
export async function embedChunksInBatches(
  chunks: DocumentChunk[],
  embedBatch: (texts: string[]) => Promise<number[][]>,
  batchSize: number,
  signal?: AbortSignal,
  onBatchComplete?: (completed: number, total: number) => void,
): Promise<number[][]> {
  const allEmbeddings: number[][] = [];
  const total = chunks.length;

  for (let offset = 0; offset < total; offset += batchSize) {
    if (signal?.aborted) {
      throw new Error("Import aborted");
    }

    const batch = chunks.slice(offset, offset + batchSize);
    const texts = batch.map((c) => c.text);
    const embeddings = await embedBatch(texts);

    allEmbeddings.push(...embeddings);

    if (onBatchComplete) {
      onBatchComplete(Math.min(offset + batchSize, total), total);
    }
  }

  return allEmbeddings;
}

// -- Pipeline orchestrator --

/**
 * Import a single parsed document through the full pipeline:
 * chunk -> embed -> dedup -> store.
 *
 * The document must already be parsed (use the parser registry for that).
 * Each stage fires progress callbacks and checks the abort signal.
 */
export async function importDocument(
  doc: ParsedDocument,
  options: ImportPipelineOptions,
  deps: PipelineDeps,
): Promise<ImportResult> {
  const startTime = Date.now();
  const { signal, onProgress, dryRun } = options;

  const fireProgress = (stage: ImportStage, completed: number, total: number): void => {
    if (onProgress) {
      onProgress({ stage, completed, total, label: doc.title });
    }
  };

  try {
    // Stage 1: Chunk
    if (signal?.aborted) {
      throw new Error("Import aborted");
    }
    fireProgress("chunk", 0, 1);

    const chunks = chunkDocument(doc, deps.chunking);
    fireProgress("chunk", 1, 1);

    if (chunks.length === 0) {
      return {
        source: options.source,
        status: dryRun ? "dry-run" : "imported",
        chunksStored: 0,
        chunksSkipped: 0,
        contentHash: doc.contentHash,
        durationMs: Date.now() - startTime,
      };
    }

    // Stage 2: Embed
    if (signal?.aborted) {
      throw new Error("Import aborted");
    }
    fireProgress("embed", 0, chunks.length);

    let embeddings: number[][];
    if (dryRun) {
      // Skip embedding in dry-run mode
      embeddings = chunks.map(() => []);
    } else {
      embeddings = await embedChunksInBatches(
        chunks,
        deps.embedBatch,
        deps.embeddingBatchSize,
        signal,
        (completed, total) => fireProgress("embed", completed, total),
      );
    }

    // Stage 3: Dedup
    if (signal?.aborted) {
      throw new Error("Import aborted");
    }
    fireProgress("dedup", 0, chunks.length);

    let uniqueChunks: DocumentChunk[];
    let uniqueEmbeddings: number[][];
    let hashDuplicates = 0;
    let similarityDuplicates = 0;

    if (dryRun) {
      uniqueChunks = chunks;
      uniqueEmbeddings = embeddings;
    } else {
      const dedupResult = deduplicateChunks(chunks, embeddings, deps.storage, deps.dedup);
      uniqueChunks = dedupResult.unique;
      hashDuplicates = dedupResult.hashDuplicates;
      similarityDuplicates = dedupResult.similarityDuplicates;

      // Rebuild the embeddings array to match unique chunks
      const uniqueIds = new Set(uniqueChunks.map((c) => c.id));
      uniqueEmbeddings = [];
      for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i];
        const embedding = embeddings[i];
        if (chunk && embedding && uniqueIds.has(chunk.id)) {
          uniqueEmbeddings.push(embedding);
        }
      }
    }

    fireProgress("dedup", chunks.length, chunks.length);

    // Stage 4: Store
    if (signal?.aborted) {
      throw new Error("Import aborted");
    }
    fireProgress("store", 0, uniqueChunks.length);

    if (!dryRun) {
      for (let i = 0; i < uniqueChunks.length; i += 1) {
        const chunk = uniqueChunks[i];
        const embedding = uniqueEmbeddings[i];
        if (!chunk || !embedding) {
          continue;
        }

        deps.storage.insertChunk(chunk, embedding, deps.category);

        if ((i + 1) % 10 === 0 || i === uniqueChunks.length - 1) {
          fireProgress("store", i + 1, uniqueChunks.length);
        }
      }
    }

    fireProgress("store", uniqueChunks.length, uniqueChunks.length);

    const skipped = hashDuplicates + similarityDuplicates;

    return {
      source: options.source,
      status: dryRun ? "dry-run" : "imported",
      chunksStored: dryRun ? 0 : uniqueChunks.length,
      chunksSkipped: skipped,
      contentHash: doc.contentHash,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      source: options.source,
      status: "failed",
      chunksStored: 0,
      chunksSkipped: 0,
      contentHash: doc.contentHash,
      durationMs: Date.now() - startTime,
      error: message,
    };
  }
}

// -- Default dependency factory --

/** Options for creating default pipeline dependencies. */
export interface CreateDefaultDepsOptions {
  readonly config: crocbotConfig;
  readonly agentId: string;
  readonly projectId?: string | null;
  readonly chunking?: Partial<ChunkingOptions>;
  readonly dedup?: Partial<DedupOptions>;
  readonly embeddingBatchSize?: number;
  readonly category?: KnowledgeCategory;
  readonly embeddingProvider?: EmbeddingProviderOptions;
}

/**
 * Create the default PipelineDeps by wiring real embedding provider,
 * storage adapter, and dedup checker with config-driven defaults.
 */
export async function createDefaultDeps(options: CreateDefaultDepsOptions): Promise<PipelineDeps> {
  const { config, agentId, projectId } = options;

  // Resolve storage path
  const agentDir = resolveAgentDir(config, agentId);
  const projectPaths =
    projectId && !isDefaultProject(projectId)
      ? resolveProjectPaths(config, agentId, projectId)
      : null;
  const dbPath = resolveKnowledgeDbPath(agentDir, projectPaths);

  // Open storage with sqlite-vec
  const storage = await openKnowledgeStorageWithVec(dbPath);

  // Create embedding provider
  const embeddingOpts: EmbeddingProviderOptions = options.embeddingProvider ?? {
    config,
    agentDir,
    provider: "auto",
    model: "text-embedding-3-small",
    fallback: "local",
  };
  const embeddingResult = await createEmbeddingProvider(embeddingOpts);
  const { provider } = embeddingResult;

  // Wire chunking options
  const chunking: ChunkingOptions = {
    tokens: options.chunking?.tokens ?? DEFAULT_CHUNKING.tokens,
    overlap: options.chunking?.overlap ?? DEFAULT_CHUNKING.overlap,
    headingAware: options.chunking?.headingAware ?? DEFAULT_CHUNKING.headingAware,
  };

  // Wire dedup options
  const dedup: DedupOptions = {
    similarityThreshold: options.dedup?.similarityThreshold ?? DEFAULT_DEDUP.similarityThreshold,
    hashDedup: options.dedup?.hashDedup ?? DEFAULT_DEDUP.hashDedup,
    similarityDedup: options.dedup?.similarityDedup ?? DEFAULT_DEDUP.similarityDedup,
  };

  return {
    embedBatch: (texts) => provider.embedBatch(texts),
    embeddingModel: provider.model,
    storage,
    chunking,
    dedup,
    embeddingBatchSize: options.embeddingBatchSize ?? DEFAULT_EMBEDDING_BATCH_SIZE,
    category: options.category ?? "docs",
  };
}
