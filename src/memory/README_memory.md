# src/memory/

Vector embeddings, semantic search, and conversation memory management.

## Key Files

| File | Purpose |
|------|---------|
| `index.ts` | Memory indexing and storage |
| `search.ts` | Semantic search over stored memories |
| `embeddings.ts` | Vector embedding generation |
| `cache.ts` | Embedding cache layer |
| `hybrid.ts` | Hybrid search (keyword + semantic) |

## How It Works

- Stores conversation fragments and facts as vector embeddings
- Uses SQLite with sqlite-vec for local vector search
- Supports multiple embedding providers (OpenAI, Google Gemini)
- Hybrid search combines keyword matching with semantic similarity
- Memory files persist in `CROCBOT_STATE_DIR/memory/`

## Related

- Session hooks for memory: `src/hooks/bundled/session-memory/`
- State directory: configured via `CROCBOT_STATE_DIR`
