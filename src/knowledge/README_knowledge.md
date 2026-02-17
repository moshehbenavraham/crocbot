# Knowledge Import Pipeline

Import external documents and URLs into the project-scoped vector knowledge base.

## Usage

```bash
# Import a URL
crocbot knowledge import https://example.com/docs/guide

# Import a local file
crocbot knowledge import ./reference.pdf --category docs

# Import with project scope
crocbot knowledge import ./notes.md --project myproject

# Dry run (no storage)
crocbot knowledge import https://example.com --dry-run

# Batch import from file
crocbot knowledge import --batch sources.txt

# List imported sources
crocbot knowledge list --project myproject

# Remove imported source
crocbot knowledge remove https://example.com/docs/guide
```

## Run Commands

| Command | Purpose |
|---------|---------|
| `crocbot knowledge import <source>` | Import URL, file, or text |
| `crocbot knowledge list` | List all imported sources |
| `crocbot knowledge remove <source>` | Remove source and its chunks |

## Architecture

6-stage pipeline: **FETCH** -> **PARSE** -> **CHUNK** -> **EMBED** -> **DEDUP** -> **STORE**

### Parsers (`parsers/`)

Strategy pattern with `ParserRegistry` for priority-ordered dispatch:

- `url-parser.ts` -- HTML via cheerio + node-html-markdown, SSRF-guarded fetch
- `pdf-parser.ts` -- pdfjs-dist (lazy-loaded), page-by-page extraction
- `markdown-parser.ts` -- frontmatter extraction, heading detection
- `text-parser.ts` -- universal fallback

### Core Modules

- `pipeline.ts` -- orchestrates the 6-stage flow with progress callbacks
- `chunker.ts` -- heading-aware splitting with configurable overlap
- `dedup.ts` -- hash-first (O(1)) then vector similarity dedup
- `storage.ts` -- sqlite-vec backed (knowledge_chunks + knowledge_vectors tables)
- `state.ts` -- JSON file state store for incremental re-import
- `incremental.ts` -- new/unchanged/changed classification via content-hash
- `types.ts` -- shared type definitions

## Key Dependencies

- `cheerio` -- HTML parsing and content extraction
- `node-html-markdown` -- HTML-to-markdown conversion
- `pdfjs-dist` -- PDF text extraction (already installed, lazy-loaded)
- `sqlite-vec` -- vector storage and similarity search (shared with memory system)
