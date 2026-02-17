# 10. Knowledge Import Pipeline

**Status:** Accepted
**Date:** 2026-02-16

## Context

Crocbot's memory system provides conversation-based knowledge through sqlite-vec hybrid search. However, agents could not ingest external documents (PDFs, web pages, markdown files) into their project-scoped knowledge base. Users needed a way to import reference material for richer context during conversations.

Agent Zero provides a `knowledge_import.py` reference with LangChain document loaders and an incremental state machine. Crocbot needed a TypeScript-native equivalent using existing infrastructure (sqlite-vec, SSRF guards, embedding providers).

## Decision

Build a 6-stage import pipeline (fetch, parse, chunk, embed, dedup, store) with:

1. **Parser Registry** (strategy pattern) with priority-ordered dispatch for text, markdown, PDF, and URL/HTML formats
2. **Heading-aware chunking** that respects document structure (sections, headings) rather than naive character splitting
3. **Two-layer dedup**: content-hash first (O(1)), then vector similarity for near-duplicates
4. **SQLite storage** with `knowledge_chunks`, `knowledge_vectors` (vec0), and `knowledge_meta` tables
5. **Incremental re-import** via content-hash state machine (new/unchanged/changed classification)
6. **Project scoping** via separate storage directories per project
7. **CLI interface**: `crocbot knowledge import|list|remove`

Key library choices:
- `cheerio` + `node-html-markdown` for HTML parsing (not Readability -- more control over content extraction)
- `pdfjs-dist` for PDF (already installed, lazy-loaded to avoid startup overhead)
- Existing `fetchWithSsrFGuard` for SSRF-protected URL fetching

## Consequences

- External documents become searchable alongside conversation memories
- Incremental re-import prevents redundant processing on unchanged sources
- Parser registry is extensible for future formats (DOCX, EPUB, etc.)
- Separate knowledge storage tables avoid polluting existing memory indexes
- PDF parser uses dynamic import, adding no startup cost when unused
- Batch import (`--batch`) enables scripted bulk ingestion
