---
title: Knowledge Import
description: Import documents and URLs into the project-scoped vector knowledge base
---

# Knowledge Import

Import external documents and URLs into the project-scoped vector knowledge base. The pipeline fetches content, parses it into structured text, chunks it with semantic boundary detection, embeds chunks via the configured embedding provider, deduplicates against existing content, and stores into sqlite-vec with category metadata.

## Quick Start

```bash
# Import a URL
crocbot knowledge import https://example.com/docs/getting-started

# Import a local file
crocbot knowledge import ./docs/architecture.md

# Import into a specific project
crocbot knowledge import ./api-reference.md --project my-project

# List imported sources
crocbot knowledge list

# Remove an imported source
crocbot knowledge remove https://example.com/docs/getting-started
```

## Supported Formats

| Format | Extensions / Patterns | Parser |
|--------|----------------------|--------|
| URL/HTML | `https://...` | Fetches with SSRF guard, extracts main content via cheerio, converts to markdown |
| Markdown | `.md`, `.mdx` | Extracts YAML frontmatter, preserves heading structure |
| PDF | `.pdf` | Extracts text per page using pdfjs-dist |
| Plain Text | Any other file | Universal fallback, treats content as-is |

The parser is selected automatically based on the source type and file extension. URL sources always use the HTML parser. File sources are matched by extension in priority order: PDF, Markdown, then Text fallback.

## Commands

### `crocbot knowledge import`

Import a document into the knowledge base.

```bash
crocbot knowledge import <source> [options]
```

**Arguments**:
- `source` - URL or local file path to import

**Options**:
| Flag | Description | Default |
|------|-------------|---------|
| `--project <name>` | Target project scope | Default project |
| `--category <cat>` | Knowledge category: `docs`, `references`, `solutions` | `docs` |
| `--dry-run` | Preview without importing | `false` |
| `--force` | Force re-import even if unchanged | `false` |
| `--batch <file>` | Import multiple sources from a file (one URL/path per line) | - |

**Batch file format**:
```
# Lines starting with # are comments
https://example.com/docs/page-1
https://example.com/docs/page-2
./local-docs/architecture.md
```

### `crocbot knowledge list`

List all imported knowledge sources with their status.

```bash
crocbot knowledge list [options]
```

**Options**:
| Flag | Description |
|------|-------------|
| `--project <name>` | Target project scope |
| `--json` | Output as JSON |

### `crocbot knowledge remove`

Remove an imported source and all its chunks from the knowledge base.

```bash
crocbot knowledge remove <source> [options]
```

**Options**:
| Flag | Description |
|------|-------------|
| `--project <name>` | Target project scope |

## How It Works

### Pipeline Stages

1. **Parse** - The document is fetched (URLs) or read (files) and parsed into normalized markdown content
2. **Chunk** - Content is split into overlapping chunks respecting heading boundaries (~400 tokens per chunk, ~80 token overlap)
3. **Embed** - Each chunk is embedded into a vector using the configured embedding provider
4. **Dedup** - Hash-exact and similarity-based deduplication removes redundant chunks
5. **Store** - Unique chunks and their embeddings are stored in the project-scoped sqlite-vec database

### Incremental Updates

The pipeline tracks imported sources via a state file (`knowledge-state.json`). On re-import:

- **Unchanged** content is skipped (no work done)
- **Changed** content triggers removal of old chunks followed by fresh import
- **New** sources are imported directly
- **Removed** sources (via `knowledge remove`) have all chunks deleted

Use `--force` to re-import even when content has not changed.

### Deduplication

Two-phase deduplication prevents redundant content:

1. **Hash dedup** (fast) - Chunks with identical text hashes are skipped
2. **Similarity dedup** (fuzzy) - Chunks with cosine similarity above 0.95 against existing or in-batch embeddings are skipped

This handles both exact duplicates and near-duplicate content across overlapping documents.

### Project Isolation

Knowledge is stored per-project using the [project workspace](/features/projects) isolation from Phase 14:

- Each project has its own `knowledge.db` and `knowledge-state.json`
- Chunks imported into one project are not visible from another
- Use `--project` to target a specific project scope

### Security

URL imports are protected by the SSRF guard:

- Private and internal IP addresses (127.0.0.0/8, 10.0.0.0/8, 169.254.0.0/16, etc.) are blocked
- DNS resolution is pinned to prevent TOCTOU attacks
- Redirect chains are validated at each hop
- Response body size is limited to 10 MB
- Fetch timeout is 30 seconds

## Categories

Imported knowledge can be categorized for better organization:

| Category | Use Case |
|----------|----------|
| `docs` | Documentation, guides, tutorials (default) |
| `references` | API references, specifications |
| `solutions` | Known solutions, troubleshooting guides |

## Configuration

The knowledge import pipeline uses the project's configured embedding provider. No additional configuration is required beyond the standard embedding setup.

### Chunking Defaults

| Parameter | Default | Description |
|-----------|---------|-------------|
| Chunk size | 400 tokens | Maximum tokens per chunk (~1600 chars) |
| Overlap | 80 tokens | Overlap between adjacent chunks (~320 chars) |
| Heading-aware | `true` | Split on heading boundaries when possible |

### Dedup Defaults

| Parameter | Default | Description |
|-----------|---------|-------------|
| Hash dedup | `true` | Skip chunks with identical text hash |
| Similarity dedup | `true` | Skip chunks above similarity threshold |
| Similarity threshold | 0.95 | Cosine similarity threshold for near-duplicates |
