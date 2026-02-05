# QMD Vector Memory Architecture Reference

**Analysis Date**: 2026-02-05
**Session**: phase03-session01-research-upstream-features
**Status**: Reference documentation for future consideration (out of scope for Phase 03)

---

## 1. Overview

QMD (Query Memory Database) is an external vector memory backend used by OpenClaw for semantic search across markdown documents. It provides an alternative to the built-in memory system with support for embeddings, collections, and session indexing.

**Note**: QMD implementation is NOT part of Phase 03. This document captures the architecture for future reference only.

---

## 2. Architecture Summary

### 2.1 Component Hierarchy

```
OpenClawConfig
    |
    +-- memory.backend: "qmd" | "builtin"
    |
    +-- memory.qmd: MemoryQmdConfig
            |
            +-- command: string (default: "qmd")
            +-- paths: MemoryQmdIndexPath[]
            +-- sessions: MemoryQmdSessionConfig
            +-- update: MemoryQmdUpdateConfig
            +-- limits: MemoryQmdLimitsConfig
            +-- scope: SessionSendPolicyConfig
```

### 2.2 Key Files

| File | Purpose |
|------|---------|
| `src/memory/qmd-manager.ts` | QMD memory manager implementation |
| `src/memory/backend-config.ts` | Configuration resolution for memory backends |
| `src/memory/types.ts` | Memory system type definitions |
| `src/config/types.memory.ts` | Memory configuration types |

---

## 3. Configuration Types

### 3.1 MemoryConfig (types.memory.ts)

```typescript
export type MemoryBackend = "builtin" | "qmd";
export type MemoryCitationsMode = "auto" | "on" | "off";

export type MemoryConfig = {
  backend?: MemoryBackend;
  citations?: MemoryCitationsMode;
  qmd?: MemoryQmdConfig;
};
```

### 3.2 MemoryQmdConfig

```typescript
export type MemoryQmdConfig = {
  command?: string;                    // CLI command (default: "qmd")
  includeDefaultMemory?: boolean;      // Include MEMORY.md, memory/
  paths?: MemoryQmdIndexPath[];        // Additional indexed paths
  sessions?: MemoryQmdSessionConfig;   // Session export settings
  update?: MemoryQmdUpdateConfig;      // Update timing
  limits?: MemoryQmdLimitsConfig;      // Search limits
  scope?: SessionSendPolicyConfig;     // Access control
};
```

### 3.3 Index Path Configuration

```typescript
export type MemoryQmdIndexPath = {
  path: string;      // Directory or file path
  name?: string;     // Collection name (auto-generated if omitted)
  pattern?: string;  // Glob pattern (default: "**/*.md")
};
```

### 3.4 Session Export Configuration

```typescript
export type MemoryQmdSessionConfig = {
  enabled?: boolean;      // Export sessions to markdown
  exportDir?: string;     // Export directory
  retentionDays?: number; // Session retention period
};
```

### 3.5 Update Configuration

```typescript
export type MemoryQmdUpdateConfig = {
  interval?: string;      // Update interval (default: "5m")
  debounceMs?: number;    // Debounce between updates (default: 15000)
  onBoot?: boolean;       // Update on startup (default: true)
  embedInterval?: string; // Embedding interval (default: "60m")
};
```

### 3.6 Limits Configuration

```typescript
export type MemoryQmdLimitsConfig = {
  maxResults?: number;       // Max search results (default: 6)
  maxSnippetChars?: number;  // Max snippet length (default: 700)
  maxInjectedChars?: number; // Max injected context (default: 4000)
  timeoutMs?: number;        // Query timeout (default: 4000)
};
```

---

## 4. QmdMemoryManager Implementation

### 4.1 Class Structure

```typescript
export class QmdMemoryManager implements MemorySearchManager {
  static async create(params): Promise<QmdMemoryManager | null>;

  // Core operations
  async search(query: string, opts?): Promise<MemorySearchResult[]>;
  async sync(params?): Promise<void>;
  async readFile(params): Promise<{ text: string; path: string }>;
  status(): MemoryProviderStatus;

  // Probes
  async probeEmbeddingAvailability(): Promise<MemoryEmbeddingProbeResult>;
  async probeVectorAvailability(): Promise<boolean>;

  // Lifecycle
  async close(): Promise<void>;
}
```

### 4.2 Directory Structure

QMD uses XDG base directories for its internal state:

```
$CROCBOT_STATE_DIR/agents/{agentId}/qmd/
    |
    +-- xdg-config/    # QMD configuration
    |
    +-- xdg-cache/
        |
        +-- qmd/
            |
            +-- index.sqlite    # Main index database
```

### 4.3 Collection Management

Collections are managed via the `qmd` CLI:

```bash
# List collections
qmd collection list --json

# Add collection
qmd collection add <path> --name <name> --mask <pattern>

# Update index
qmd update

# Generate embeddings
qmd embed

# Search
qmd query "<query>" --json -n <limit>
```

---

## 5. Data Flow

### 5.1 Initialization

```
QmdMemoryManager.create()
    |
    v
Create XDG directories
    |
    v
Bootstrap collections from config
    |
    v
Ensure collections exist in QMD (qmd collection add)
    |
    v
Run initial update if onBoot enabled
    |
    v
Start update interval timer
```

### 5.2 Search Flow

```
search(query)
    |
    v
Wait for pending updates
    |
    v
Run: qmd query "<query>" --json -n <limit>
    |
    v
Parse JSON results
    |
    v
Resolve document locations
    |
    v
Extract snippets with line numbers
    |
    v
Filter by minScore
    |
    v
Clamp by maxInjectedChars
    |
    v
Return MemorySearchResult[]
```

### 5.3 Update Flow

```
runUpdate()
    |
    v
Export sessions (if enabled)
    |
    v
Run: qmd update
    |
    v
Check embed interval
    |
    v
Run: qmd embed (if needed)
    |
    v
Clear document path cache
```

---

## 6. Collection Types

### 6.1 Default Collections (if includeDefaultMemory: true)

| Name | Path | Pattern |
|------|------|---------|
| memory-root | workspaceDir | MEMORY.md |
| memory-alt | workspaceDir | memory.md |
| memory-dir | workspaceDir/memory | **/*.md |

### 6.2 Custom Collections

Configured via `paths` array. Each path gets a unique collection name.

### 6.3 Session Collections

If `sessions.enabled`, a `sessions` collection is automatically added:

```typescript
{
  name: "sessions",
  path: sessions.exportDir,
  pattern: "**/*.md",
  kind: "sessions"
}
```

---

## 7. Session Export

### 7.1 Export Process

1. List session files for agent
2. Filter by retention period
3. Convert each session to markdown
4. Write to export directory
5. Clean up old exports not in keep set

### 7.2 Markdown Format

```markdown
# Session {session-name}

{session content}
```

---

## 8. Scope / Access Control

### 8.1 Default Policy

```typescript
const DEFAULT_QMD_SCOPE: SessionSendPolicyConfig = {
  default: "deny",
  rules: [
    {
      action: "allow",
      match: { chatType: "direct" }
    }
  ]
};
```

This allows memory search in DMs only by default.

### 8.2 Rule Matching

Rules are evaluated in order. First matching rule determines action.

Match conditions:
- `channel`: "telegram", "cli", etc.
- `chatType`: "direct", "group", "channel"
- `keyPrefix`: Session key prefix

---

## 9. Search Result Structure

```typescript
type MemorySearchResult = {
  path: string;       // Relative path to document
  startLine: number;  // Snippet start line
  endLine: number;    // Snippet end line
  score: number;      // Relevance score
  snippet: string;    // Matched text
  source: MemorySource; // "memory" | "sessions"
};
```

---

## 10. Dependencies

### 10.1 External

- `qmd` CLI binary (must be installed separately)
- SQLite (Node 22+ native module)

### 10.2 Internal

| Module | Purpose |
|--------|---------|
| `agents/agent-scope.js` | Workspace directory resolution |
| `config/paths.js` | State directory resolution |
| `logging/subsystem.js` | Subsystem logging |
| `sessions/session-key-utils.js` | Session key parsing |

---

## 11. Error Handling

### 11.1 Initialization Errors

- Missing QMD binary: Returns null from create()
- Invalid collection path: Skipped silently
- Duplicate collection name: Auto-suffixed

### 11.2 Runtime Errors

- Query timeout: Throws error with timeout info
- Invalid JSON response: Throws with parse error
- Collection add failures: Logged as warning, continues

---

## 12. Comparison with Builtin Memory

| Feature | Builtin | QMD |
|---------|---------|-----|
| Vector search | No (keyword only) | Yes (embeddings) |
| External binary | No | Yes (qmd CLI) |
| Collection management | Automatic | Manual (via CLI) |
| Session indexing | No | Yes |
| Scope control | No | Yes |
| Update scheduling | N/A | Configurable |

---

## 13. Considerations for Future Implementation

### 13.1 Pre-requisites

1. QMD binary installation and path configuration
2. SQLite native module (Node 22+)
3. Storage for index database
4. Memory for embedding operations

### 13.2 Integration Points

1. Config schema additions for `memory.qmd`
2. Memory manager factory to create QMD vs builtin
3. Agent runtime to use memory manager interface
4. Search tool to query memory

### 13.3 Testing Requirements

1. Unit tests for QmdMemoryManager
2. Integration tests with mock QMD binary
3. E2E tests with real QMD installation

---

## 14. Files to Port (Future Reference)

| File | Priority | Size |
|------|----------|------|
| `src/memory/qmd-manager.ts` | High | 810 LOC |
| `src/memory/backend-config.ts` | High | 273 LOC |
| `src/config/types.memory.ts` | High | 47 LOC |
| `src/memory/qmd-manager.test.ts` | Medium | ~200 LOC |
| `src/memory/backend-config.test.ts` | Medium | ~100 LOC |

---

## 15. Summary

QMD provides a sophisticated vector memory backend with semantic search capabilities. While powerful, it requires external binary installation and adds operational complexity. For crocbot's current use case (personal Telegram assistant), the builtin memory system may be sufficient. QMD should be considered when:

- Semantic search across large document collections is needed
- Session history indexing is valuable
- Fine-grained access control per chat type is required

This document serves as a reference for future consideration. No QMD implementation is planned for Phase 03.
