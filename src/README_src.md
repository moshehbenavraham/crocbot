# src/

Core TypeScript source code for crocbot. All modules are ESM (use `.js` extensions in imports).

## Directory Map

### Core Runtime

| Directory   | Description                                     |
| ----------- | ----------------------------------------------- |
| `gateway/`  | Gateway control plane (WebSocket + HTTP server) |
| `agents/`   | Pi agent runtime, tools, session repair         |
| `sessions/` | Session management, transcript events           |
| `config/`   | Configuration loading and validation            |
| `daemon/`   | System service integration (systemd/launchd)    |

### Communication

| Directory     | Description                                  |
| ------------- | -------------------------------------------- |
| `telegram/`   | Telegram bot (grammY) — primary chat channel |
| `channels/`   | Channel registry and abstraction layer       |
| `auto-reply/` | Message dispatch, command routing, chunking  |
| `routing/`    | Message routing and session binding          |

### CLI

| Directory   | Description                                              |
| ----------- | -------------------------------------------------------- |
| `cli/`      | CLI entry point and argument parsing                     |
| `commands/` | High-level CLI commands (agent, status, configure, etc.) |
| `wizard/`   | Interactive onboarding wizard                            |
| `terminal/` | ANSI colors, progress bars, tables                       |
| `tui/`      | Terminal UI (ink-based interactive interface)            |

### Agent Capabilities

| Directory              | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| `browser/`             | Browser automation via CDP (Chrome DevTools Protocol) |
| `cron/`                | Scheduled jobs and wakeups                            |
| `memory/`              | Vector embeddings, semantic search, caching           |
| `media/`               | Media pipeline (audio/image/video handling)           |
| `media-understanding/` | AI-powered media analysis (vision, transcription)     |
| `link-understanding/`  | URL detection and content extraction                  |
| `tts/`                 | Text-to-speech integration                            |

### Infrastructure

| Directory   | Description                                                    |
| ----------- | -------------------------------------------------------------- |
| `infra/`    | Infrastructure utilities (SSRF protection, exec, TLS, updates) |
| `security/` | Security validation and auditing                               |
| `logging/`  | Structured logging (tslog) with redaction                      |
| `metrics/`  | Prometheus-compatible metrics                                  |
| `alerting/` | Error reporting and notification dispatch                      |
| `process/`  | Child process management                                       |

### Extensibility

| Directory     | Description                                                |
| ------------- | ---------------------------------------------------------- |
| `plugins/`    | Plugin loader, runtime, and registry                       |
| `plugin-sdk/` | Public SDK for plugin development                          |
| `hooks/`      | Hook system (bundled hooks: boot-md, session-memory, etc.) |
| `acp/`        | Agent Client Protocol (inter-process communication)        |
| `providers/`  | External auth providers (GitHub Copilot, Google, Qwen)     |

### Shared

| Directory   | Description                         |
| ----------- | ----------------------------------- |
| `types/`    | Ambient TypeScript type definitions |
| `utils/`    | Common utility functions            |
| `shared/`   | Shared text utilities               |
| `markdown/` | Markdown parsing and rendering      |

## Build

- `pnpm build` — compiles via tsdown to `dist/`
- `pnpm crocbot` — runs TypeScript directly via tsx (dev mode)
- `pnpm lint` — oxlint with type-aware rules
- `pnpm test` — vitest (parallel)
