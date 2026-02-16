import { cosineSimilarity } from "../memory/internal.js";
import type {
  DedupCheckResult,
  DedupOptions,
  DedupResult,
  DocumentChunk,
  KnowledgeStorageAdapter,
} from "./types.js";

// -- Constants --

/** Default dedup configuration. */
export const DEFAULT_DEDUP: DedupOptions = {
  similarityThreshold: 0.95,
  hashDedup: true,
  similarityDedup: true,
};

/** Maximum existing vectors to compare against per chunk for similarity dedup. */
const SIMILARITY_SEARCH_LIMIT = 20;

// -- Hash deduplication --

/**
 * Check if a chunk's text hash already exists in the store.
 * Returns a dedup result indicating whether it is a hash-exact duplicate.
 */
export function checkHashDuplicate(
  chunk: DocumentChunk,
  storage: KnowledgeStorageAdapter,
): DedupCheckResult {
  const isDuplicate = storage.hasHash(chunk.hash);
  return isDuplicate ? { isDuplicate: true, reason: "hash" } : { isDuplicate: false };
}

// -- Similarity deduplication --

/**
 * Check if a chunk's embedding is a near-duplicate of any existing vector.
 * Queries the store for the closest vectors and checks against the threshold.
 */
export function checkSimilarityDuplicate(
  embedding: number[],
  storage: KnowledgeStorageAdapter,
  threshold: number,
): DedupCheckResult {
  const results = storage.findSimilar(embedding, SIMILARITY_SEARCH_LIMIT);

  for (const result of results) {
    if (result.similarity >= threshold) {
      return {
        isDuplicate: true,
        reason: "similarity",
        similarityScore: result.similarity,
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Check if an embedding is similar to any in a set of new embeddings (in-batch dedup).
 * Used when the store doesn't yet have vectors but we need to dedup within the current batch.
 */
export function checkBatchSimilarity(
  embedding: number[],
  existingEmbeddings: number[][],
  threshold: number,
): DedupCheckResult {
  for (const existing of existingEmbeddings) {
    const score = cosineSimilarity(embedding, existing);
    if (score >= threshold) {
      return {
        isDuplicate: true,
        reason: "similarity",
        similarityScore: score,
      };
    }
  }
  return { isDuplicate: false };
}

// -- Dedup orchestration --

/**
 * Run deduplication on a set of chunks with their embeddings.
 * Applies hash dedup first (fast, exact), then similarity dedup (slower, fuzzy).
 *
 * The strategy is sequential: hash dedup eliminates exact matches cheaply,
 * then similarity dedup catches near-duplicates among hash-unique chunks.
 */
export function deduplicateChunks(
  chunks: DocumentChunk[],
  embeddings: number[][],
  storage: KnowledgeStorageAdapter,
  options?: Partial<DedupOptions>,
): DedupResult {
  const opts: DedupOptions = {
    similarityThreshold: options?.similarityThreshold ?? DEFAULT_DEDUP.similarityThreshold,
    hashDedup: options?.hashDedup ?? DEFAULT_DEDUP.hashDedup,
    similarityDedup: options?.similarityDedup ?? DEFAULT_DEDUP.similarityDedup,
  };

  let hashDuplicates = 0;
  let similarityDuplicates = 0;

  // Phase 1: Hash dedup
  const hashPassedChunks: DocumentChunk[] = [];
  const hashPassedEmbeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const embedding = embeddings[i];
    if (!chunk || !embedding) {
      continue;
    }

    if (opts.hashDedup) {
      const result = checkHashDuplicate(chunk, storage);
      if (result.isDuplicate) {
        hashDuplicates += 1;
        continue;
      }
    }

    hashPassedChunks.push(chunk);
    hashPassedEmbeddings.push(embedding);
  }

  // Phase 2: Similarity dedup
  if (!opts.similarityDedup) {
    return { unique: hashPassedChunks, hashDuplicates, similarityDuplicates };
  }

  const unique: DocumentChunk[] = [];
  const uniqueEmbeddings: number[][] = [];

  for (let i = 0; i < hashPassedChunks.length; i += 1) {
    const chunk = hashPassedChunks[i];
    const embedding = hashPassedEmbeddings[i];
    if (!chunk || !embedding) {
      continue;
    }

    // Check against existing store vectors
    const storeCheck = checkSimilarityDuplicate(embedding, storage, opts.similarityThreshold);
    if (storeCheck.isDuplicate) {
      similarityDuplicates += 1;
      continue;
    }

    // Check against already-accepted vectors in this batch
    const batchCheck = checkBatchSimilarity(embedding, uniqueEmbeddings, opts.similarityThreshold);
    if (batchCheck.isDuplicate) {
      similarityDuplicates += 1;
      continue;
    }

    unique.push(chunk);
    uniqueEmbeddings.push(embedding);
  }

  return { unique, hashDuplicates, similarityDuplicates };
}
