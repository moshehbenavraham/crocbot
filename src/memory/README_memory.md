# src/memory/

Vector embeddings, semantic search, conversation memory management, and AI-powered memory consolidation.

## Key Files

| File | Purpose |
| --- | --- |
| `manager.ts` | Memory index manager, search orchestration, area-filtered recall |
| `manager-search.ts` | Vector and keyword search with area/importance propagation |
| `hybrid.ts` | Hybrid search (keyword + semantic) with weighted merge |
| `embeddings.ts` | Vector embedding generation (OpenAI, Gemini, local) |
| `memory-schema.ts` | Schema creation, version tracking, FTS5 rebuild |
| `consolidation.ts` | Consolidation engine (MERGE/REPLACE/KEEP_SEPARATE/UPDATE/SKIP) |
| `consolidation-actions.ts` | Types, enums, DI interfaces, config factory |
| `consolidation-prompts.ts` | System/message prompts for LLM consolidation decisions |
| `consolidation-schema.ts` | Schema migration for consolidation_log and area/importance columns |
| `auto-memorize.ts` | Post-conversation extraction (solutions, fragments, instruments) |
| `auto-memorize-prompts.ts` | Extraction prompt templates and registry |
| `index.ts` | Public API re-exports |
| `cache.ts` | Embedding cache layer |
| `internal.ts` | Markdown chunking, file-hash change detection |

## How It Works

- Stores conversation fragments and facts as vector embeddings
- Uses SQLite with sqlite-vec for local vector search
- Supports multiple embedding providers (OpenAI, Google Gemini, local node-llama-cpp)
- Hybrid search combines BM25 keyword matching with cosine vector similarity
- Memory files persist in `CROCBOT_STATE_DIR/memory/`

### Memory Consolidation (Phase 12)

On every memory save, the consolidation engine:
1. Finds similar existing chunks via vector search
2. Sends new + similar chunks to the utility model for analysis
3. LLM decides: MERGE, REPLACE, KEEP_SEPARATE, UPDATE, or SKIP
4. Applies the decision atomically (transaction-wrapped)
5. Logs the decision to `consolidation_log` for audit

Safety gates: REPLACE requires >= 0.9 similarity. Empty merge content downgrades to KEEP_SEPARATE.

### 4-Area Categorization

Memories are categorized into four areas:
- `main` -- general conversation memory
- `fragments` -- key facts and preferences
- `solutions` -- reusable problem/solution pairs
- `instruments` -- tools, techniques, and workflows

Area metadata stored on each chunk. Error-like queries automatically surface `solutions` area results.

### Auto-Memorize Hooks

At session end, three extraction types run independently:
- **Solutions**: problem/solution pairs from the conversation
- **Fragments**: key facts, preferences, decisions
- **Instruments**: tools, commands, techniques used

Each extraction checks the rate limiter budget before calling the utility model. Extracted items are stored with area metadata, triggering consolidation for dedup.

## Related

- Consolidation architecture: `docs/adr/0007-memory-consolidation-architecture.md`
- Model routing (utility model): `src/agents/model-router.ts`
- Session end hook: `src/agents/pi-embedded-runner/runs.ts`
- Config type: `AutoMemorizeConfig` in `src/config/types.agent-defaults.ts`
- State directory: configured via `CROCBOT_STATE_DIR`
