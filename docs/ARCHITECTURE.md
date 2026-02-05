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
      +------------+------------+
      |            |            |
      v            v            v
+-----+----+ +-----+----+ +-----+----+
|  Agents  | |  Sessions | |   Cron   |
| (Pi RT)  | | (Storage) | |  (Jobs)  |
+----------+ +----------+ +----------+
      |
      v
+-----+----+
|   LLM    |
| Providers|
| (Claude, |
| OpenAI)  |
+----------+
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

## Tech Stack Rationale

| Technology | Purpose | Why Chosen |
|------------|---------|------------|
| Node.js 22+ | Runtime | Modern ESM support, stable LTS |
| TypeScript | Language | Type safety, developer experience |
| pnpm | Package manager | Fast, disk-efficient |
| grammY | Telegram SDK | Modern, well-maintained, middleware support |
| Vitest | Testing | Fast, ESM-native, good DX |
| oxlint | Linting | Fast Rust-based linter |

## Data Flow

1. User sends message via Telegram
2. grammY bot receives message, routes to Gateway
3. Gateway creates/resumes session, invokes agent
4. Agent processes message with LLM provider
5. Response streamed back through Gateway to Telegram

## Key Architectural Decisions

See [Architecture Decision Records](adr/) for detailed history:
- [ADR-0001: Telegram-only Architecture](adr/0001-telegram-only-architecture)
- [ADR-0002: Multi-stage Docker Build](adr/0002-multi-stage-docker-build)

## Directory Structure

```
src/
  agents/        # Agent runtime and tools
  channels/      # Channel registry
  cli/           # CLI entry point
  commands/      # CLI commands
  config/        # Configuration loading
  gateway/       # Gateway control plane
  infra/         # Infrastructure utilities
  media/         # Media pipeline
  routing/       # Message routing
  telegram/      # Telegram bot integration
docs/            # Documentation (Mintlify)
ui/              # Control UI
test/            # Shared/e2e tests
scripts/         # Development scripts
```
