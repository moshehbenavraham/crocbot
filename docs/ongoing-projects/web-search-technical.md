# Web Search Technical Reference

Complete technical reference for crocbot's web search subsystem. Designed to be exhaustive for maintainers and extensible for adding new providers.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Supported Providers](#supported-providers)
3. [Configuration Schema](#configuration-schema)
4. [Provider: Brave Search](#provider-brave-search)
5. [Provider: Perplexity Sonar](#provider-perplexity-sonar)
6. [Model Selection Logic](#model-selection-logic)
7. [API Key Resolution](#api-key-resolution)
8. [Caching Layer](#caching-layer)
9. [Tool Parameters](#tool-parameters)
10. [Response Formats](#response-formats)
11. [Error Handling](#error-handling)
12. [Adding a New Provider](#adding-a-new-provider)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         web_search Tool                             │
├─────────────────────────────────────────────────────────────────────┤
│  createWebSearchTool()                                              │
│  ├── resolveSearchConfig()      → Extract config from crocbotConfig │
│  ├── resolveSearchProvider()    → "brave" | "perplexity"            │
│  ├── resolveSearchApiKey()      → API key resolution chain          │
│  └── execute()                  → Dispatches to provider handler    │
├─────────────────────────────────────────────────────────────────────┤
│                         Provider Handlers                           │
├─────────────────┬───────────────────────────────────────────────────┤
│  Brave Search   │  Perplexity Sonar                                 │
│  ───────────────│───────────────────                                │
│  GET request    │  POST request (chat/completions)                  │
│  Structured     │  AI-synthesized answers                           │
│  results        │  with citations                                   │
├─────────────────┴───────────────────────────────────────────────────┤
│                         Caching Layer                               │
│  ├── normalizeCacheKey()        → Query normalization               │
│  ├── readCache()                → TTL-based cache read              │
│  └── writeCache()               → LRU eviction (100 entries max)    │
└─────────────────────────────────────────────────────────────────────┘
```

### Source Files

| File | Purpose |
|------|---------|
| `src/agents/tools/web-search.ts` | Main implementation |
| `src/agents/tools/web-shared.ts` | Caching, timeouts, utilities |
| `src/config/types.tools.ts` | TypeScript type definitions |
| `src/agents/tools/web-search.test.ts` | Unit tests |

---

## Supported Providers

```typescript
const SEARCH_PROVIDERS = ["brave", "perplexity"] as const;
```

| Provider | Type | Default | Best For |
|----------|------|---------|----------|
| **Brave** | Traditional search engine | Yes | Structured results, free tier, speed |
| **Perplexity** | AI-synthesized search | No | Complex questions, citations, deep research |

---

## Configuration Schema

Full TypeScript definition from `src/config/types.tools.ts`:

```typescript
type WebSearchConfig = {
  /** Enable web search tool (default: true when API key is present). */
  enabled?: boolean;

  /** Search provider ("brave" or "perplexity"). */
  provider?: "brave" | "perplexity";

  /** Brave Search API key (optional; defaults to BRAVE_API_KEY env var). */
  apiKey?: string;

  /** Default search results count (1-10). */
  maxResults?: number;

  /** Timeout in seconds for search requests. */
  timeoutSeconds?: number;

  /** Cache TTL in minutes for search results. */
  cacheTtlMinutes?: number;

  /** Perplexity-specific configuration (used when provider="perplexity"). */
  perplexity?: {
    /** API key for Perplexity or OpenRouter. */
    apiKey?: string;
    /** Base URL for API requests. */
    baseUrl?: string;
    /** Model to use. */
    model?: string;
  };
};
```

### JSON Config Example (Complete)

```json
{
  "tools": {
    "web": {
      "search": {
        "enabled": true,
        "provider": "perplexity",
        "apiKey": "BSAxxxxxxxxxxxxxxxx",
        "maxResults": 5,
        "timeoutSeconds": 30,
        "cacheTtlMinutes": 15,
        "perplexity": {
          "apiKey": "pplx-xxxxxxxxxxxxxxxx",
          "baseUrl": "https://api.perplexity.ai",
          "model": "perplexity/sonar-pro"
        }
      }
    }
  }
}
```

---

## Provider: Brave Search

### Endpoint

```
GET https://api.search.brave.com/res/v1/web/search
```

### Authentication

| Method | Value |
|--------|-------|
| Header | `X-Subscription-Token: {apiKey}` |
| Accept | `application/json` |

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `count` | number | No | Results count (1-10) |
| `country` | string | No | 2-letter country code (e.g., "DE", "US", "ALL") |
| `search_lang` | string | No | ISO language code for results (e.g., "de", "en") |
| `ui_lang` | string | No | ISO language code for UI elements |
| `freshness` | string | No | Time filter (see below) |

### Freshness Parameter

| Value | Meaning |
|-------|---------|
| `pd` | Past 24 hours (past day) |
| `pw` | Past week |
| `pm` | Past month |
| `py` | Past year |
| `YYYY-MM-DDtoYYYY-MM-DD` | Custom date range |

Validation regex: `/^(\d{4}-\d{2}-\d{2})to(\d{4}-\d{2}-\d{2})$/`

### Response Type

```typescript
type BraveSearchResponse = {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
      age?: string;  // Publication date
    }>;
  };
};
```

### API Key Sources

Resolution order:
1. `tools.web.search.apiKey` (config)
2. `BRAVE_API_KEY` (environment variable)

### Notes

- Use the **"Data for Search"** plan, NOT "Data for AI"
- Free tier available at https://brave.com/search/api/
- `freshness` parameter is Brave-exclusive (returns error for Perplexity)

---

## Provider: Perplexity Sonar

### Endpoints

| Source | Base URL |
|--------|----------|
| Perplexity Direct | `https://api.perplexity.ai` |
| OpenRouter Proxy | `https://openrouter.ai/api/v1` |

Full endpoint: `{baseUrl}/chat/completions`

### Authentication

```typescript
headers: {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${apiKey}`,
  "HTTP-Referer": "https://github.com/moshehbenavraham/crocbot",
  "X-Title": "crocbot Web Search"
}
```

### Request Body

```typescript
{
  model: string,  // e.g., "perplexity/sonar-pro"
  messages: [
    { role: "user", content: query }
  ]
}
```

### Response Type

```typescript
type PerplexitySearchResponse = {
  choices?: Array<{
    message?: {
      content?: string;  // AI-synthesized answer
    };
  }>;
  citations?: string[];  // Source URLs
};
```

### Available Models

| Model ID | Description | Use Case |
|----------|-------------|----------|
| `perplexity/sonar` | Fast Q&A with web search | Quick lookups, simple questions |
| `perplexity/sonar-pro` | Multi-step reasoning with web search | Complex questions (default) |
| `perplexity/sonar-reasoning-pro` | Chain-of-thought deep analysis | Research, in-depth investigation |

### API Key Sources

Resolution order (with source tracking):
1. `tools.web.search.perplexity.apiKey` (config) → source: `"config"`
2. `PERPLEXITY_API_KEY` (env) → source: `"perplexity_env"`
3. `OPENROUTER_API_KEY` (env) → source: `"openrouter_env"`

---

## Model Selection Logic

### Current Behavior

**The model is statically configured.** There is no automatic selection based on query complexity.

```typescript
function resolvePerplexityModel(perplexity?: PerplexityConfig): string {
  const fromConfig = perplexity?.model?.trim() ?? "";
  return fromConfig || DEFAULT_PERPLEXITY_MODEL;  // "perplexity/sonar-pro"
}
```

### What This Means

| Query Type | Expected Model | Actual Behavior |
|------------|----------------|-----------------|
| Simple lookup | `sonar` | Uses configured model (default: `sonar-pro`) |
| Complex question | `sonar-pro` | Uses configured model |
| Deep research | `sonar-reasoning-pro` | Uses configured model |

**The agent does NOT automatically escalate to `sonar-reasoning-pro` for complex queries.**

### Manual Override Options

Users who want deep research must either:

1. **Configure globally**: Set `tools.web.search.perplexity.model` to `"perplexity/sonar-reasoning-pro"`
2. **Create multiple agents**: Configure different agents with different models
3. **Future enhancement**: Implement query analysis to auto-select model (see [Adding a New Provider](#adding-a-new-provider))

### Recommended Configuration by Use Case

| Use Case | Model Config |
|----------|--------------|
| Telegram bot (general) | `perplexity/sonar-pro` (default) |
| Research assistant | `perplexity/sonar-reasoning-pro` |
| Quick lookups only | `perplexity/sonar` |
| Cost optimization | `perplexity/sonar` |

---

## API Key Resolution

### Brave

```typescript
function resolveSearchApiKey(search?: WebSearchConfig): string | undefined {
  const fromConfig = search?.apiKey?.trim() ?? "";
  const fromEnv = (process.env.BRAVE_API_KEY ?? "").trim();
  return fromConfig || fromEnv || undefined;
}
```

### Perplexity (with Base URL inference)

```typescript
// Key prefixes for automatic base URL detection
const PERPLEXITY_KEY_PREFIXES = ["pplx-"];
const OPENROUTER_KEY_PREFIXES = ["sk-or-"];

function inferPerplexityBaseUrlFromApiKey(apiKey?: string): "direct" | "openrouter" | undefined {
  if (!apiKey) return undefined;
  const normalized = apiKey.toLowerCase();
  if (PERPLEXITY_KEY_PREFIXES.some(p => normalized.startsWith(p))) return "direct";
  if (OPENROUTER_KEY_PREFIXES.some(p => normalized.startsWith(p))) return "openrouter";
  return undefined;
}
```

### Base URL Resolution Matrix

| API Key Source | Key Prefix | Inferred Base URL |
|----------------|------------|-------------------|
| `PERPLEXITY_API_KEY` env | any | `https://api.perplexity.ai` |
| `OPENROUTER_API_KEY` env | any | `https://openrouter.ai/api/v1` |
| Config | `pplx-*` | `https://api.perplexity.ai` |
| Config | `sk-or-*` | `https://openrouter.ai/api/v1` |
| Config | unknown | `https://openrouter.ai/api/v1` (safe fallback) |
| Explicit `baseUrl` | any | Uses explicit value |

---

## Caching Layer

### Constants

```typescript
const DEFAULT_CACHE_TTL_MINUTES = 15;
const DEFAULT_CACHE_MAX_ENTRIES = 100;
```

### Cache Key Format

```typescript
// Brave
`brave:${query}:${count}:${country || "default"}:${search_lang || "default"}:${ui_lang || "default"}:${freshness || "default"}`

// Perplexity
`perplexity:${query}:${count}:${country || "default"}:${search_lang || "default"}:${ui_lang || "default"}`
```

Keys are normalized: `normalizeCacheKey(key).trim().toLowerCase()`

### Cache Entry Structure

```typescript
type CacheEntry<T> = {
  value: T;
  expiresAt: number;    // Unix timestamp
  insertedAt: number;   // Unix timestamp
};
```

### Eviction Policy

- **TTL-based expiration**: Entries older than `cacheTtlMinutes` are removed on read
- **LRU eviction**: When cache reaches 100 entries, oldest entry is removed before insert

### Cache Response Flag

Cached responses include `cached: true` in the result payload.

---

## Tool Parameters

### Schema Definition

```typescript
const WebSearchSchema = Type.Object({
  query: Type.String({ description: "Search query string." }),
  count: Type.Optional(Type.Number({
    description: "Number of results to return (1-10).",
    minimum: 1,
    maximum: 10,
  })),
  country: Type.Optional(Type.String({
    description: "2-letter country code (e.g., 'DE', 'US', 'ALL').",
  })),
  search_lang: Type.Optional(Type.String({
    description: "ISO language code for search results (e.g., 'de', 'en').",
  })),
  ui_lang: Type.Optional(Type.String({
    description: "ISO language code for UI elements.",
  })),
  freshness: Type.Optional(Type.String({
    description: "Filter by discovery time (Brave only). Values: 'pd', 'pw', 'pm', 'py', or 'YYYY-MM-DDtoYYYY-MM-DD'.",
  })),
});
```

### Parameter Defaults

| Parameter | Default | Source |
|-----------|---------|--------|
| `count` | `5` | `DEFAULT_SEARCH_COUNT` |
| `country` | (none) | Provider default |
| `search_lang` | (none) | Provider default |
| `ui_lang` | (none) | Provider default |
| `freshness` | (none) | No filter |
| `timeoutSeconds` | `30` | `DEFAULT_TIMEOUT_SECONDS` |

---

## Response Formats

### Brave Response

```json
{
  "query": "example search",
  "provider": "brave",
  "count": 5,
  "tookMs": 342,
  "results": [
    {
      "title": "Example Title",
      "url": "https://example.com",
      "description": "Snippet text...",
      "published": "2 days ago",
      "siteName": "example.com"
    }
  ]
}
```

### Perplexity Response

```json
{
  "query": "example search",
  "provider": "perplexity",
  "model": "perplexity/sonar-pro",
  "tookMs": 1523,
  "content": "AI-synthesized answer based on web search...",
  "citations": [
    "https://source1.com",
    "https://source2.com"
  ]
}
```

### Cached Response

Any response can include `"cached": true` if served from cache.

---

## Error Handling

### Missing API Key

```json
{
  "error": "missing_brave_api_key",
  "message": "web_search needs a Brave Search API key. Run `crocbot configure --section web` to store it, or set BRAVE_API_KEY in the Gateway environment.",
  "docs": "https://docs.github.com/moshehbenavraham/crocbot/tools/web"
}
```

```json
{
  "error": "missing_perplexity_api_key",
  "message": "web_search (perplexity) needs an API key. Set PERPLEXITY_API_KEY or OPENROUTER_API_KEY in the Gateway environment, or configure tools.web.search.perplexity.apiKey.",
  "docs": "https://docs.github.com/moshehbenavraham/crocbot/tools/web"
}
```

### Invalid Freshness

```json
{
  "error": "invalid_freshness",
  "message": "freshness must be one of pd, pw, pm, py, or a range like YYYY-MM-DDtoYYYY-MM-DD.",
  "docs": "https://docs.github.com/moshehbenavraham/crocbot/tools/web"
}
```

### Unsupported Freshness (Perplexity)

```json
{
  "error": "unsupported_freshness",
  "message": "freshness is only supported by the Brave web_search provider.",
  "docs": "https://docs.github.com/moshehbenavraham/crocbot/tools/web"
}
```

### API Errors

```
Error: Brave Search API error (401): Unauthorized
Error: Perplexity API error (429): Rate limit exceeded
```

---

## Adding a New Provider

### Step 1: Update Provider List

In `src/agents/tools/web-search.ts`:

```typescript
const SEARCH_PROVIDERS = ["brave", "perplexity", "newprovider"] as const;
```

### Step 2: Add Config Types

In `src/config/types.tools.ts`:

```typescript
type WebSearchConfig = {
  // ... existing fields ...
  provider?: "brave" | "perplexity" | "newprovider";

  newprovider?: {
    apiKey?: string;
    baseUrl?: string;
    // provider-specific options
  };
};
```

### Step 3: Add API Key Resolution

```typescript
function resolveNewProviderApiKey(search?: WebSearchConfig): string | undefined {
  const fromConfig = search?.newprovider?.apiKey?.trim() ?? "";
  const fromEnv = (process.env.NEWPROVIDER_API_KEY ?? "").trim();
  return fromConfig || fromEnv || undefined;
}
```

### Step 4: Add Provider Handler

```typescript
async function runNewProviderSearch(params: {
  query: string;
  apiKey: string;
  // provider-specific params
}): Promise<{ /* response shape */ }> {
  const endpoint = "https://api.newprovider.com/search";

  const res = await fetch(endpoint, {
    method: "POST",  // or GET
    headers: {
      "Authorization": `Bearer ${params.apiKey}`,
      // provider-specific headers
    },
    body: JSON.stringify({
      query: params.query,
      // provider-specific body
    }),
    signal: withTimeout(undefined, params.timeoutSeconds * 1000),
  });

  if (!res.ok) {
    const detail = await readResponseText(res);
    throw new Error(`NewProvider API error (${res.status}): ${detail || res.statusText}`);
  }

  const data = await res.json();
  return {
    // normalize to standard response format
  };
}
```

### Step 5: Update Dispatcher

In `runWebSearch()`:

```typescript
if (params.provider === "newprovider") {
  const result = await runNewProviderSearch({
    query: params.query,
    apiKey: params.apiKey,
    // ...
  });

  const payload = {
    query: params.query,
    provider: params.provider,
    tookMs: Date.now() - start,
    // ... normalized fields
  };
  writeCache(SEARCH_CACHE, cacheKey, payload, params.cacheTtlMs);
  return payload;
}
```

### Step 6: Update Cache Key

```typescript
const cacheKey = normalizeCacheKey(
  params.provider === "newprovider"
    ? `newprovider:${params.query}:${params.count}:${/* provider-specific cache dimensions */}`
    : // existing providers
);
```

### Step 7: Add Missing Key Error

```typescript
function missingSearchKeyPayload(provider: typeof SEARCH_PROVIDERS[number]) {
  if (provider === "newprovider") {
    return {
      error: "missing_newprovider_api_key",
      message: "web_search (newprovider) needs an API key. Set NEWPROVIDER_API_KEY or configure tools.web.search.newprovider.apiKey.",
      docs: "https://docs.github.com/moshehbenavraham/crocbot/tools/web",
    };
  }
  // ... existing providers
}
```

### Step 8: Update Description

```typescript
const description =
  provider === "newprovider"
    ? "Search the web using NewProvider. [Description of what makes it unique.]"
    : provider === "perplexity"
    ? "Search the web using Perplexity Sonar..."
    : "Search the web using Brave Search API...";
```

### Step 9: Write Tests

In `src/agents/tools/web-search.test.ts`:

```typescript
describe("web_search newprovider", () => {
  it("resolves API key from config", () => { /* ... */ });
  it("resolves API key from environment", () => { /* ... */ });
  it("formats cache key correctly", () => { /* ... */ });
});
```

### Step 10: Update Documentation

1. Add `docs/tools/newprovider.md`
2. Update `docs/tools/web.md` with new provider option
3. Update this technical reference

---

## Quick Reference

### Environment Variables

| Variable | Provider | Purpose |
|----------|----------|---------|
| `BRAVE_API_KEY` | Brave | API authentication |
| `PERPLEXITY_API_KEY` | Perplexity | Direct API authentication |
| `OPENROUTER_API_KEY` | Perplexity (via OR) | OpenRouter proxy authentication |

### Defaults Summary

| Setting | Default Value |
|---------|---------------|
| Provider | `brave` |
| Max results | `5` |
| Max allowed results | `10` |
| Timeout | `30` seconds |
| Cache TTL | `15` minutes |
| Cache max entries | `100` |
| Perplexity model | `perplexity/sonar-pro` |
| Perplexity base URL | (inferred from key) |

### Config Paths

| Path | Type | Description |
|------|------|-------------|
| `tools.web.search.enabled` | boolean | Enable/disable tool |
| `tools.web.search.provider` | string | `"brave"` or `"perplexity"` |
| `tools.web.search.apiKey` | string | Brave API key |
| `tools.web.search.maxResults` | number | Default result count |
| `tools.web.search.timeoutSeconds` | number | Request timeout |
| `tools.web.search.cacheTtlMinutes` | number | Cache duration |
| `tools.web.search.perplexity.apiKey` | string | Perplexity/OpenRouter key |
| `tools.web.search.perplexity.baseUrl` | string | API endpoint |
| `tools.web.search.perplexity.model` | string | Model ID |

---

## TODO / Future Enhancements

- [ ] **Dynamic model selection**: Analyze query complexity to auto-select Perplexity model
- [ ] **Hybrid search**: Combine Brave structured results with Perplexity synthesis
- [ ] **Google Custom Search**: Add as alternative traditional search provider
- [ ] **Bing Search**: Add as alternative traditional search provider
- [ ] **SearXNG**: Add self-hosted meta-search option
- [ ] **Query rewriting**: Improve search quality with query expansion

---

*Last updated: 2026-02-01*
