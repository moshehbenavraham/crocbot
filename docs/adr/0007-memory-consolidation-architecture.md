# 7. Memory Consolidation Architecture

**Status:** Accepted
**Date:** 2026-02-16

## Context

Phase 12 adds LLM-driven memory consolidation to crocbot. When the agent stores memories, duplicates and near-duplicates accumulate over time -- the same fact restated across multiple conversations, partial fragments that could be merged, solutions recorded separately from the problems they solve. Without consolidation, vector search quality degrades as the memory store grows.

Agent Zero's Python implementation (797 lines, FAISS+chromadb) provides the reference design: after each memory save, query for similar existing memories, ask the LLM whether to merge/replace/keep/update/skip, and execute the result. The key question is how to adapt this pattern to crocbot's TypeScript architecture with SQLite+sqlite-vec, the Phase 11 utility model router, and the Phase 9 secrets masking pipeline.

## Decision

### 1. Consolidation-on-save (not batch-only)

Consolidation triggers after each memory indexing operation, following Agent Zero's pattern. Each new memory is compared against existing similar memories immediately after insertion. This prevents memory bloat from accumulating between periodic batch runs and matches the existing memory-flush pattern in `agent-runner-memory.ts`, where `runMemoryFlushIfNeeded()` already fires at pre-compaction time. Batch consolidation may be added later as a secondary mechanism but is not the primary path.

### 2. Five-action model

Adopt Agent Zero's 5-action classification directly:

- **MERGE**: Combine two memories into a single richer entry. Both originals are soft-deleted; a new merged entry is inserted. Maps to INSERT + UPDATE (set deleted flag) in SQLite.
- **REPLACE**: New memory supersedes old. Old entry is soft-deleted. Maps to UPDATE on the old row.
- **KEEP_SEPARATE**: Memories are related but distinct. No mutation. Both entries remain.
- **UPDATE**: Enrich existing memory with new information without creating a new entry. Maps to UPDATE on the existing row (content + re-embed).
- **SKIP**: No action. Universal fallback for any LLM response that fails to parse, times out, or returns an unrecognized action.

SKIP as the default fallback ensures that consolidation failures never corrupt or lose memory data.

### 3. Dual-threshold similarity strategy

Two similarity thresholds gate which actions are permitted:

- **0.7 (discovery threshold)**: Memories with cosine similarity >= 0.7 are candidates for consolidation. Below this, no LLM call is made.
- **0.9 (destructive threshold)**: REPLACE and MERGE (destructive actions) require cosine similarity >= 0.9. The LLM may recommend MERGE at 0.75 similarity, but the engine downgrades to KEEP_SEPARATE.

Improvement over Agent Zero: crocbot's sqlite-vec returns actual cosine similarity scores, unlike FAISS ranking estimates. This makes the 0.9 safety gate on destructive operations genuinely operative rather than approximate.

### 4. Utility model routing

All consolidation LLM calls route through the Phase 11 utility model role via `createModelRouter()`. A new TaskType `consolidation` in `task-classifier.ts` maps to the `utility` role. Consolidation is a mechanical classification task -- it does not require reasoning-tier models.

Rate-limit-aware behavior: if the utility model budget is exhausted (per ADR 0005 rate limiting), consolidation is silently skipped for that memory save. The memory is stored unconsolidated and will be picked up by the next successful consolidation cycle. This ensures consolidation never blocks the primary memory-save path.

### 5. Schema extension strategy

Extend the existing `chunks` table with 3 new columns via `ALTER TABLE ADD COLUMN` (non-destructive in SQLite -- no table rebuild, no data migration):

- `area` (TEXT DEFAULT 'main'): Categorization area (see Decision 8)
- `importance` (REAL DEFAULT 0.5): LLM-assigned importance score, 0.0-1.0
- `consolidated_from` (TEXT, nullable): JSON array of chunk IDs that were merged into this entry

New table `consolidation_log` for audit trail: stores every consolidation decision (action taken, source/target chunk IDs, similarity score, LLM reasoning, timestamp). Uses the existing `ensureColumn()` helper in `memory-schema.ts` for safe idempotent migration.

### 6. Secrets masking integration

Consolidation prompts include memory content that may contain credentials, API keys, or tokens. All consolidation prompts and LLM responses pass through the Phase 9 secrets masking pipeline (ADR 0004). Masking applies before sending content to the utility model. Unmasking applies only if the consolidated result is written back to the memory store, preserving the original secret values in stored memories.

### 7. Auto-memorize hook placement

New `runAutoMemorizeIfNeeded()` function in `agent-runner-memory.ts`, following the exact pattern of the existing `runMemoryFlushIfNeeded()`. Both functions fire at pre-compaction time in the agent runner loop. The auto-memorize hook runs after memory flush completes (flush produces the memories that consolidation then processes). The function is async, has a 60-second timeout, and catches all errors to prevent consolidation failures from disrupting the agent loop.

### 8. Four-area categorization

Adopt Agent Zero's 4 memory areas as metadata on the `chunks` table `area` column:

- **main**: General knowledge, facts, preferences, context
- **fragments**: Partial information, incomplete thoughts, raw observations
- **solutions**: Verified working solutions to specific problems
- **instruments**: Tools, commands, workflows, procedures

Areas are metadata, not separate tables or namespaces. Area-aware search uses an FTS5 filter predicate on the `area` column, allowing queries like "search solutions only" without separate vector indices. The LLM assigns area during consolidation; new memories default to `main`.

## Consequences

### Enables
- Automatic deduplication on every memory save -- no manual cleanup needed
- Structured categorization of memories into searchable areas
- Solution recall: proven fixes are tagged and retrievable by area
- Full audit trail of every consolidation decision via `consolidation_log`

### Prevents
- Memory bloat from duplicate and near-duplicate entries accumulating over time
- Expensive reasoning model usage on mechanical consolidation tasks

### Trade-offs
- Latency on save: 2-3 additional utility model LLM calls per memory item (mitigated by async execution, 60s timeout, silent skip if utility model unavailable)
- LLM may incorrectly merge distinct memories (mitigated by 0.9 threshold for destructive operations, SKIP as universal fallback, consolidation_log for post-hoc audit and reversal)
- Schema migration adds nullable columns to existing table (safe in SQLite but irreversible without table rebuild)
- Consolidation quality depends on utility model capability -- lower-tier models may produce worse merge decisions (mitigated by conservative thresholds and SKIP fallback)

### Dependencies
- Phase 11 (ADR 0006): Utility model routing via `createModelRouter()`
- Phase 10 (ADR 0005): Per-provider rate limiting for utility model budget checks
- Phase 9 (ADR 0004): Secrets masking pipeline for memory content in LLM prompts
