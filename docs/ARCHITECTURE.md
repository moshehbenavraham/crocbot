# Architecture

## System Overview

crocbot is a lean CLI + Gateway for AI chat on Telegram. It provides a single control plane for sessions, tools, and events with full Telegram bot integration via grammY.

```
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|  Telegram Bot    |<--->|     Gateway      |<--->|   Pi Agent       |
|  (grammY)        |     |  (WebSocket +    |     |  (AI Runtime)    |
|                  |     |   HTTP Server)   |     |                  |
+------------------+     +------------------+     +------------------+
                               |
                               v
                    +------------------+
                    |                  |
                    |   Tools Layer    |
                    |  (Browser, Cron, |
                    |   Skills, etc.)  |
                    |                  |
                    +------------------+
```

## Components

### Gateway (`src/gateway/`)

- **Purpose**: Central control plane for sessions, presence, config, and events
- **Tech**: Node.js HTTP + WebSocket server
- **Key files**:
  - `server-http.ts` - HTTP endpoints including /health
  - `message-handler.ts` - Inbound message processing
  - `run-loop.ts` - Main gateway lifecycle

### Telegram Channel (`src/telegram/`)

- **Purpose**: Full Telegram bot integration with groups, DMs, and media
- **Tech**: grammY framework with grammy-runner and throttler
- **Key files**:
  - `bot.ts` - Bot setup and error handling
  - `monitor.ts` - Connection monitoring and reconnection
  - `network-errors.ts` - Recoverable error detection

### Pi Agent Runtime (`src/agents/`)

- **Purpose**: AI agent execution with tool streaming and block streaming
- **Tech**: RPC-based runtime with model providers
- **Key files**:
  - `pi-embedded-runner/` - Embedded agent runner
  - `crocbot-tools.ts` - Available tools for agents

### CLI (`src/cli/`)

- **Purpose**: Command-line interface for all operations
- **Key commands**: `onboard`, `gateway`, `agent`, `config`, `channels`

### Auto-Reply (`src/auto-reply/`)

- **Purpose**: Message dispatch and response formatting
- **Key files**:
  - `dispatch-from-config.ts` - Message routing logic
  - `reply/commands-core.ts` - Command handlers

## Data Flow

1. **Inbound Message**: Telegram -> grammY bot -> Gateway message handler
2. **Agent Processing**: Message -> Pi agent runtime -> Tool execution -> Response
3. **Outbound Reply**: Response -> Auto-reply dispatch -> Telegram channel

## Tech Stack

| Technology | Purpose | Rationale |
|------------|---------|-----------|
| Node.js 22+ | Runtime | LTS with ESM support |
| TypeScript | Language | Type safety, maintainability |
| grammY | Telegram SDK | Modern, well-maintained, type-safe |
| Vitest | Testing | Fast, ESM-native |
| pnpm | Package manager | Fast, disk-efficient |
| Docker | Deployment | Container isolation, easy deployment |

## Configuration

Configuration stored in `~/.clawdbot/`:
- `config.toml` - Main configuration
- `credentials/` - Provider credentials
- `sessions/` - Agent session data
- `agents/` - Per-agent configuration

## Key Directories

```
src/
  agents/       # Pi agent runtime
  auto-reply/   # Message dispatch
  cli/          # CLI commands
  config/       # Configuration types and loading
  gateway/      # Gateway server
  telegram/     # Telegram channel
  infra/        # Infrastructure utilities
  media/        # Media processing pipeline
```

## Key Decisions

See implementation notes in `.spec_system/specs/` for detailed decision history from each development session.

### Phase 01 Decisions

1. **3-Stage Docker Build**: Builder -> Pruner -> Runtime for optimal image size
2. **HTTP Status Code Detection**: Check multiple error properties for robust Telegram reconnection
3. **60s Stability Threshold**: Reset reconnection counter after connection stable for 60s
