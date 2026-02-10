# Architecture

## System Overview

Crocbot is a personal AI assistant with a Gateway control plane and Telegram integration. It follows a lean, single-user deployment model optimized for VPS/Docker hosting.

## Dependency Graph

```
          +------------------+
          |     Telegram     |
          |   (grammY bot)   |
          +--------+---------+
                   |
                   v
          +--------+---------+
          |     Gateway      |
          | (WebSocket + HTTP)|
          +--------+---------+
                   |
      +------+-----+------+---------+
      |      |            |         |
      v      v            v         v
  Agents  Sessions     Cron    MCP Server
  (Pi RT) (Storage)   (Jobs)  (SSE + HTTP)
      |                              ^
      +---> LLM Providers            |
      |   (Claude, OpenAI, ...)  External AI
      |                           Systems
      +---> MCP Client
           (stdio, SSE, HTTP)
```

## Components

### Gateway
- **Purpose**: Central control plane for sessions, Telegram, tools, and events
- **Tech**: Node.js, WebSocket, Express
- **Location**: `src/gateway/`

### CLI
- **Purpose**: Command-line interface for gateway management and agent invocation
- **Tech**: Node.js, commander
- **Location**: `src/cli/`, `src/commands/`

### Telegram Channel
- **Purpose**: Full bot integration via grammY with groups, DMs, media, and inline model selection
- **Tech**: grammY, @grammyjs/runner
- **Location**: `src/telegram/`, `src/channels/`
- **Key modules**: `bot-handlers.ts` (callbacks), `model-buttons.ts` (inline keyboards), `network-errors.ts` (Grammy timeout recovery), `monitor.ts` (scoped rejection handler)

### Agent Runtime
- **Purpose**: Pi embedded runtime with tool streaming and block streaming
- **Tech**: TypeScript, RPC mode
- **Location**: `src/agents/`
- **Key modules**: `session-transcript-repair.ts` (JSONL repair, tool call sanitization), `session-file-repair.ts` (crash-resilient file recovery)

### Media Pipeline
- **Purpose**: Image/audio/video processing, transcription, size caps
- **Tech**: Node.js streams, temp file lifecycle
- **Location**: `src/media/`

### Security Layer
- **Purpose**: SSRF protection, path traversal validation, exec allowlisting
- **Tech**: DNS pinning, IP range blocking, AbortSignal timeouts
- **Location**: `src/infra/net/` (ssrf.ts, fetch-guard.ts), `src/infra/exec-approvals.ts`
- **Key modules**: `ssrf.ts` (private IP/hostname blocking, redirect validation), `fetch-guard.ts` (guarded fetch wrapper), `exec-approvals.ts` (shell token blocking, allowlist enforcement)

### Secrets Masking (`src/infra/secrets/`)
- **Purpose**: Prevent credential leakage across all output boundaries
- **Tech**: Custom Aho-Corasick masker, SecretsRegistry singleton, value-based + pattern-based defense-in-depth
- **Key modules**: `registry.ts` (singleton, auto-discovery from env/config), `masker.ts` (Aho-Corasick for 10+ patterns, sequential fallback), `stream-masker.ts` (cross-chunk boundary detection), `logging-transport.ts` (tslog masking transport), `llm-masking.ts` (context wrapper), `tool-result-masking.ts` (agent tool output), `error-masking.ts` (error messages)
- **Boundaries**: (1) Logging, (2) Config snapshots, (3) LLM context, (4) Streaming output, (5) Tool results, (6) Telegram send, (7) Error formatting

### Logging & Observability
- **Purpose**: Structured logging, metrics, error alerting
- **Tech**: tslog (with secrets masking transport), OpenTelemetry-compatible metrics
- **Location**: `src/logging/`, `src/metrics/`, `src/alerting/`

### Plugin System
- **Purpose**: Extensible plugin runtime with SDK
- **Tech**: TypeScript plugin loader
- **Location**: `src/plugins/`, `src/plugin-sdk/`

### Cron Scheduler
- **Purpose**: Scheduled jobs and wakeups
- **Tech**: Node.js timers, JSONL persistence
- **Location**: `src/cron/`

### Memory
- **Purpose**: Conversation memory and context management
- **Tech**: File-based storage
- **Location**: `src/memory/`

### MCP Client
- **Purpose**: In-process client connecting to external MCP tool servers
- **Tech**: @modelcontextprotocol/sdk, stdio/SSE/HTTP transports
- **Location**: `src/mcp/` (client.ts, client-transport.ts, transport-*.ts)
- **Key modules**: `client.ts` (lifecycle manager with reconnect), `tool-bridge.ts` (MCP-to-agent tool conversion), `transport-ssrf.ts` (SSRF-guarded fetch for remote transports)

### MCP Server
- **Purpose**: Exposes crocbot as MCP infrastructure for external AI systems
- **Tech**: @modelcontextprotocol/sdk, SSE + streamable HTTP transports
- **Location**: `src/mcp/` (server.ts, server-auth.ts, server-tools.ts, server-mount.ts)
- **Key modules**: `server-auth.ts` (Bearer token with timing-safe comparison), `server-tools.ts` (send_message, finish_chat, query_memory, list_capabilities), `server-mount.ts` (HTTP route mounting)

## Tech Stack Rationale

| Technology | Purpose | Why Chosen |
|------------|---------|------------|
| Node.js 22+ | Runtime | Modern ESM support, stable LTS |
| TypeScript (ES2023) | Language | Type safety, strict mode, NodeNext modules |
| tsdown (rolldown) | Bundler | ~5s builds, replaces tsc emit |
| pnpm | Package manager | Fast, disk-efficient |
| grammY | Telegram SDK | Modern, well-maintained, middleware support |
| Vitest | Testing | Fast, ESM-native, good DX |
| @modelcontextprotocol/sdk | MCP Client + Server | Official TypeScript SDK for Model Context Protocol |
| oxlint + oxfmt | Lint + Format | Fast Rust-based toolchain, 134 type-aware rules |

## Data Flow

1. User sends message via Telegram (or external AI calls MCP server endpoint)
2. grammY bot receives message, routes to Gateway
3. Gateway creates/resumes session, invokes agent
4. Agent builds context: system prompt + memory recall + conversation history
5. SecretsRegistry masks any credentials in LLM context before provider call
6. Agent processes message with LLM provider, invoking MCP client tools as needed
7. StreamMasker masks secrets in streaming response chunks (cross-boundary detection)
8. Tool results masked before persistence and display
9. Response streamed back through Gateway to Telegram (masked) and persisted to session transcript (masked)

## Key Architectural Decisions

See [Architecture Decision Records](adr/) for detailed history:
- [ADR-0001: Telegram-only Architecture](adr/0001-telegram-only-architecture)
- [ADR-0002: Multi-stage Docker Build](adr/0002-multi-stage-docker-build)
- [ADR-0003: Native MCP Integration](adr/0003-native-mcp-integration)
- [ADR-0004: Secrets Masking Pipeline](adr/0004-secrets-masking-pipeline)

## Directory Structure

```
src/
  agents/           # Agent runtime, tools, session repair
  alerting/         # Error reporting and alerting
  auto-reply/       # Message dispatch and routing
  browser/          # Browser control (CDP)
  channels/         # Channel registry
  cli/              # CLI entry point
  commands/         # CLI commands
  config/           # Configuration loading
  cron/             # Scheduled jobs
  daemon/           # Daemon process management
  gateway/          # Gateway control plane
  hooks/            # Hook system
  infra/            # Infrastructure (exec, net/SSRF, secrets masking, utilities)
  logging/          # Structured logging (tslog)
  media/            # Media pipeline
  media-understanding/  # Media analysis
  mcp/              # MCP client, server, transports, tool bridge
  memory/           # Memory management
  metrics/          # Metrics and monitoring
  plugins/          # Plugin runtime
  plugin-sdk/       # Plugin SDK
  providers/        # LLM provider integrations
  routing/          # Message routing
  telegram/         # Telegram bot (grammY)
docs/               # Documentation (Mintlify)
ui/                 # Control UI
test/               # Shared/e2e tests
scripts/            # Development scripts
```
