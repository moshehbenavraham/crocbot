import type {
  ImportStateStore,
  IncrementalAction,
  IncrementalResult,
  KnowledgeStorageAdapter,
  ParsedDocument,
} from "./types.js";

/**
 * Classify a parsed document against the state store to determine the
 * incremental action: "new", "unchanged", or "changed".
 */
export function classifySource(
  doc: ParsedDocument,
  stateStore: ImportStateStore,
): IncrementalResult {
  const sourceValue = doc.source.value;
  const incomingHash = doc.contentHash;
  const existing = stateStore.get(sourceValue);

  if (!existing) {
    return {
      action: "new",
      sourceValue,
      incomingHash,
      storedHash: null,
      previousChunkCount: 0,
    };
  }

  if (existing.contentHash === incomingHash) {
    return {
      action: "unchanged",
      sourceValue,
      incomingHash,
      storedHash: existing.contentHash,
      previousChunkCount: existing.chunkCount,
    };
  }

  return {
    action: "changed",
    sourceValue,
    incomingHash,
    storedHash: existing.contentHash,
    previousChunkCount: existing.chunkCount,
  };
}

/**
 * Apply the incremental action before importing a document.
 *
 * - "new": no-op, proceed with import
 * - "unchanged": return false (caller should skip)
 * - "changed": remove old chunks from storage, then proceed with import
 *
 * Returns true if the caller should proceed with the import pipeline,
 * false if the source should be skipped (unchanged).
 */
export function applyIncremental(
  result: IncrementalResult,
  storage: KnowledgeStorageAdapter,
): boolean {
  if (result.action === "unchanged") {
    return false;
  }

  if (result.action === "changed") {
    storage.deleteBySource(result.sourceValue);
  }

  // "new" or "changed" -- proceed with import
  return true;
}

/**
 * Determine the display label for an incremental action.
 */
export function actionLabel(action: IncrementalAction): string {
  switch (action) {
    case "new":
      return "new source";
    case "unchanged":
      return "unchanged (skipping)";
    case "changed":
      return "changed (re-importing)";
  }
}
