# PRD Phase 12: AI-Powered Memory Consolidation

**Status**: In Progress
**Sessions**: 5
**Estimated Duration**: 5-10 days

**Progress**: 4/5 sessions (80%) -- Sessions 01-04 complete

---

## Overview

Eliminate memory bloat with LLM-driven deduplication on every save, auto-extract reusable solutions and key facts from conversations, and categorize memories for structured recall. The consolidation engine layers on top of the existing `MemoryIndexManager` (`src/memory/manager.ts`, ~2,340 lines) by hooking into the memory save/sync path. Similarity analysis uses the existing sqlite-vec hybrid search (cosine + BM25) and embedding cache. All consolidation LLM calls route through the utility model (Phase 11) to minimize cost.

---

## Progress Tracker

| Session | Name | Status | Est. Tasks | Validated |
|---------|------|--------|------------|-----------|
| 01 | Research and Architecture Design | Complete | ~20 | 2026-02-16 |
| 02 | Consolidation Engine Core | Complete | 20 | 2026-02-16 |
| 03 | Memory Categorization and Schema Extensions | Complete | 20 | 2026-02-16 |
| 04 | Auto-Memorize Hooks | Complete | 20 | 2026-02-16 |
| 05 | Integration Testing and Validation | Not Started | ~18 | - |

---

## Completed Sessions

- Session 01: Research and Architecture Design (2026-02-16)
- Session 02: Consolidation Engine Core (2026-02-16)
- Session 03: Memory Categorization and Schema Extensions (2026-02-16)
- Session 04: Auto-Memorize Hooks (2026-02-16)

---

## Upcoming Sessions

- Session 05: Integration Testing and Validation

---

## Objectives

1. Eliminate memory bloat with LLM-driven deduplication on every memory save
2. Auto-extract reusable solutions and key facts from conversations without user prompting
3. Categorize memories into 4 areas (main, fragments, solutions, instruments) for structured recall
4. Surface previously extracted solutions when similar problems are encountered

---

## Prerequisites

- Phase 11 completed (utility model routing for consolidation LLM calls)
- Phase 10 completed (rate limiter tracks consolidation calls per role)
- Phase 09 completed (secrets masking covers consolidation LLM boundaries)

---

## Technical Considerations

### Architecture

The consolidation system adds three layers on top of existing memory infrastructure:

1. **Consolidation Engine** (`src/memory/consolidation.ts`) -- On memory save/sync, query sqlite-vec for similar existing chunks (cosine similarity >= 0.7). For each candidate pair, call the utility model with a consolidation prompt to decide: MERGE, REPLACE, KEEP_SEPARATE, UPDATE, or SKIP. Apply the decision atomically. Safety threshold: 0.9 similarity required for destructive REPLACE. 60s timeout on consolidation LLM calls.

2. **Memory Categorization** -- Add `area` metadata field to chunks table: `main` (general), `fragments` (key facts), `solutions` (reusable fixes), `instruments` (tools/techniques). Category-aware recall queries the appropriate area when context suggests a specific need (e.g., error messages trigger `solutions` area search).

3. **Auto-Memorize Hooks** -- Post-conversation hooks in the session lifecycle (`pi-embedded-runner` end-of-conversation path). Use the utility model to extract: (a) solutions -- reusable fixes with problem/solution structure, (b) fragments -- key facts worth remembering. No user prompting required. Hooks fire at session end / pre-compaction.

### Current Memory Architecture (What Exists)

- `MemoryIndexManager` with SQLite + sqlite-vec for vector search
- Hybrid search: BM25 keyword + vector cosine similarity (0.7/0.3 weight)
- Markdown chunking with configurable overlap (400 tokens, 80 overlap)
- Embedding cache (provider, model, hash composite key)
- File-hash change detection for incremental reindex
- Memory flush already routes to utility model (Phase 11)
- Chunks table: `id, path, source, start_line, end_line, hash, model, text, embedding, updated_at`

### Schema Extensions Needed

- Add `area` column to `chunks` table (TEXT, default 'main')
- Add `importance` column to `chunks` table (REAL, default 0.5)
- Create `consolidation_log` table for audit trail (timestamp, action, source_ids, result_id, model, reasoning)
- Add `consolidated_from` column to `chunks` table (JSON array of original chunk IDs, nullable)
- Update FTS index to include `area` for category-filtered search

### Key Integration Points

- **Memory sync path** (`MemoryIndexManager.indexFile()` line ~2238) -- post-index consolidation pass
- **Memory flush** (`src/auto-reply/reply/memory-flush.ts`) -- already routed to utility model
- **Session end** (`src/agents/pi-embedded-runner/`) -- auto-memorize hook insertion point
- **Memory search** (`MemoryIndexManager.search()` line ~272) -- category-aware filtering
- **Model router** (`src/agents/model-router.ts`) -- consolidation tasks classified as utility

### Technologies
- TypeScript (existing codebase conventions)
- sqlite-vec for similarity search (existing)
- Utility model via ModelRouter (Phase 11)
- Vitest for unit and integration tests
- Agent Zero reference: `.002_AGENT_ZERO/python/helpers/memory_consolidation.py` (796 lines)

### Risks
- **Consolidation quality**: LLM may incorrectly merge distinct memories. Mitigation: 0.9 similarity threshold for destructive REPLACE; KEEP_SEPARATE as default fallback; consolidation_log for audit/rollback.
- **Latency on save**: Consolidation adds LLM round-trip to every memory save. Mitigation: async consolidation (don't block the save); 60s timeout; skip if utility model unavailable.
- **Schema migration**: Adding columns to existing chunks table. Mitigation: SQLite ALTER TABLE ADD COLUMN is safe and non-destructive; migration versioned in memory-schema.ts.
- **Auto-memorize noise**: Extracting low-value facts/solutions. Mitigation: importance scoring with minimum threshold; utility model prompted to be selective.
- **Embedding drift**: Consolidation may produce merged text with different embedding characteristics. Mitigation: re-embed consolidated chunks; embedding cache handles dedup.

### Relevant Considerations
- [P10] **Rate limiter composition pattern**: Consolidation LLM calls use the utility role budget. Per-role tracking already in place from Phase 11. Consolidation should be rate-limit-aware and skip if budget exhausted.
- [P09] **Secrets masking pipeline**: Consolidation prompts and responses pass through all masking boundaries. Memory content may contain secrets -- masking applies before sending to utility model.
- [P00] **Plugin system intact**: Plugin-generated memories should also be consolidated. The consolidation engine hooks into the shared MemoryIndexManager, not specific callers.

---

## Success Criteria

Phase complete when:
- [ ] All 5 sessions completed
- [ ] Memory saves trigger consolidation pass -- duplicates merged automatically
- [ ] Consolidation decisions (MERGE/REPLACE/KEEP_SEPARATE/UPDATE/SKIP) correct for test scenarios
- [ ] Memory chunks categorized into 4 areas (main, fragments, solutions, instruments)
- [ ] Post-conversation hooks extract solutions and facts without user prompting
- [ ] Solution recall surfaces previously extracted solutions for similar problems
- [ ] Consolidation uses utility model (not reasoning model) for cost efficiency
- [ ] Consolidation log provides audit trail for all decisions
- [ ] No quality regression on existing memory recall
- [ ] Full test suite passes (`pnpm build && pnpm lint && pnpm test`)

---

## Dependencies

### Depends On
- Phase 11: 4-Model-Role Architecture (utility model for consolidation LLM calls)
- Phase 10: Per-Provider Rate Limiting (per-role budget for consolidation)
- Phase 09: Secrets Masking Pipeline (memory content masking in consolidation prompts)

### Enables
- Phase 14: Projects and Isolated Workspaces (project-scoped consolidation)
- Phase 15: Knowledge Base Import Pipeline (imported documents benefit from deduplication)
