# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Security hardening (Phase 06)**: Ported three upstream security measures -- SSRF guards with DNS pinning on all outbound fetch sites (webhook alerts, skill downloads, media fetches), Telegram download timeouts with AbortSignal enforcement (30s metadata, 60s downloads), and path traversal validation via assertMediaPath on all media storage operations. Integration test suite validates private IP blocking (RFC 1918, link-local, loopback, IPv6-mapped), redirect chain SSRF prevention, protocol validation, null byte safety, and Unicode path edge cases. Security bypass audit completed with no critical findings.

- **Upstream port — 17 infrastructure files (Phase 2)**: Ported foundational utilities from upstream: structured home-dir resolution (`CROCBOT_HOME`, tilde expansion), centralized Node.js warning filter, format-time module (datetime, duration, relative), heartbeat active-hours checking, consolidated fetch-timeout, secret input normalization, smart tool-result truncation (30% context window cap), workspace directory resolution, formatted time injection for heartbeat prompts, cron session reaper (24h retention, 5min sweep), QMD search query parser, memory backend config resolver, eager QMD memory init on gateway startup, SHA-256 identifier redaction, and shell argument splitting.

- **Upstream port — security hardening (Phase 3)**: Gateway auth enforcement on `/api/channels/` plugin routes. Credential redaction on `config.set`/`config.patch`/`config.apply` responses with false-positive whitelist (`maxTokens`, `tokenBudget`, etc.). Default-deny for WebSocket connections missing connect scopes. Subagent context forwarding (`threadId`/`to`/`accountId`). Skill/plugin code safety scanner (shell execution, eval, crypto-mining, data exfiltration, obfuscated code, env harvesting detection). Twilio stream auth token via TwiML `<Parameter>` element. Audit-extra module split into sync (7 collectors) and async (4 collectors) for tree-shakeable imports.

- **Upstream port — owner-only tools (3.5)**: `OWNER_ONLY_TOOL_NAMES` infrastructure with `applyOwnerOnlyToolPolicy()` filtering, `senderIsOwner` field threaded through 17 files in the embedded runner pipeline, `ownerAllowFrom` config field with channel-prefix support, and separated owner vs command authorization in `command-auth.ts`.

- **Upstream port — webhook agentId routing (6C.3)**: `agentId` field on hook mappings for routing webhooks to specific agents, `allowedAgentIds` security allowlist with wildcard (`*`) support, agent policy validation guards in both `/hooks/agent` endpoint and mapped-hook dispatch paths.

- **Upstream port — Claude Opus 4.6 support (6A.1-2)**: Forward-compat model resolution handling dash/dot variants (`claude-opus-4-6`, `claude-opus-4.6`), suffixed versions (e.g. `-20260206`), and template cloning from pi-ai registry. Thinking sanitization bypass for google-antigravity provider with `resolveAntigravityOpus46ForwardCompatModel()`.

- **Upstream port — model catalog updates (6A.3)**: GitHub Copilot `gpt-5.2-codex`, `gpt-5.2`, and OpenAI Codex `gpt-5.3-codex` added to xhigh model list. Refactored `normalizeThinkLevel()` with collapsed-string matching for aliases (`extra-high`, `x high`, `x_high`, etc.).

- **Upstream port — Telegram features**: Native `<blockquote>` rendering (6B.1). `<tg-spoiler>` tag support (6B.3). Video note support with `asVideoNote` flag (6B.2). Per-group and per-topic `groupPolicy` overrides (5D.8). `parentPeer` binding inheritance for forum topics (5D.12). Weekday prefix in envelope timestamps (6D.5). `--localTime` option for logs command (6D.3).

- **Upstream port — runtime features**: WebSocket thinking event streaming (6C.1). Cron-style current time injection into heartbeat prompts (6C.4). `accountId` config for multi-agent heartbeat routing (6C.5). Post-compaction amnesia fix for injected messages using `SessionManager.appendMessage` (6D.1). Voice call webhook body reading with 30s timeout and exactly-once callback (6E.1).

- **Upstream port — embedding token limits (5E.3)**: Per-provider token limit enforcement with UTF-8 byte estimation, binary-search text splitting, and known-limits maps for OpenAI and Gemini providers. Three new files: `embedding-input-limits.ts`, `embedding-model-limits.ts`, `embedding-chunk-limits.ts`.

### Changed

- **Build tooling migration (Phase 05)**: Replaced tsc production builds with tsdown bundler powered by rolldown. Three entry points (index, CLI entry, plugin-sdk) now produce optimized flat output in dist/ with ~5s total build time. Unified tsconfig.json targets ES2023 with NodeNext module resolution and noEmit-only type checking. Stricter oxlint rules enabled (134 rules, type-aware) with oxfmt replacing Prettier for formatting. Zero `any` types remain in source. CI workflows, Docker multi-stage builds, and plugin-sdk .d.ts generation validated end-to-end.

- **Upstream port — dependency upgrades (Phase 1)**: Upgraded pi-* packages 0.51.1→0.52.9, grammy 1.39.3→1.40.0, oxlint 1.43.0→1.46.0, oxfmt 0.28.0→0.31.0, rolldown rc.3→rc.4, @typescript/native-preview 20260124→20260211, undici 7.19.0→7.21.0. Removed hono dependency (upstream removed it).

- **Upstream port — refactoring (Phase 7)**: Replaced `JSON5.parse` with `JSON.parse` for sessions.json (~35x faster). Consolidated `throwIfAborted` into shared `src/infra/outbound/abort.ts`. Consolidated `fetchWithTimeout` — removed 3 inline duplicates in favor of shared `src/utils/fetch-timeout.ts`.

### Fixed

- **Upstream port — gateway stability (5A, 5 fixes)**: Drain active turns before restart with 30s timeout (5A.1). Prevent undefined token in gateway auth config (5A.2). Handle async EPIPE/EIO on stdout/stderr during shutdown (5A.3). Suppress EPIPE in launchd restart (5A.5). Use LAN IP for WebSocket/probe URLs when `bind=lan` (5A.6).

- **Upstream port — agent runtime (5B, 19 fixes)**: Narrowed billing error 402 regex to avoid false positives on issue IDs. Fixed cache token context-size inflation from accumulated cacheRead across retries. Prevented FD leaks in child process cleanup. Prevented double compaction from cache-TTL entry bypassing guard. Scoped process/exec tools to `sessionKey`. Re-run tool_use pairing repair after history truncation. Excluded rate limit errors from context overflow classification. Report subagent timeout as 'timed out' not 'completed'. Skip tool extraction for aborted/errored messages. Honor `/think off` for reasoning-capable models. Recover from context overflow caused by oversized tool results (400K cap + truncation fallback). Prevent false positive context overflow detection. Handle 400 status in failover for model fallback. Allow up to 3 compaction retries on overflow. Strip `[Historical context: ...]` from streaming. Strip reasoning tags from message tool text. Unified context overflow detection checking both promptError and assistantError with UsageAccumulator. Handle Cloudflare 521 and transient 5xx with retry. Subagent announce race condition fix with retry polling (300ms/15s), deferred announce, and 120s timeout.

- **Upstream port — cron scheduler (5C, 15 fixes)**: Prevent jobs from skipping when nextRunAtMs advances during maintenance. Prevent one-shot `at` jobs from re-firing after skip/error. Use requested agentId for isolated job auth. Pass agentId to runHeartbeatOnce. Isolate schedule errors per-job with auto-disable after 3 failures. Re-arm timer when firing during active execution. Prevent duplicate fires via second-boundary floor. Recover flat params when LLM omits job wrapper. Handle legacy atMs field. Re-arm timer in finally block. Prevent recomputeNextRuns from skipping due jobs. Fix scheduling and reminder delivery (removed timer .unref, added delivery inference). Remove orphaned tool_results during compaction. Comprehensive scheduler reliability overhaul confirmed fully covered by individual fixes.

- **Upstream port — Telegram (5D, 12 fixes)**: Health probe retry with exponential backoff (3 attempts). REACTION_INVALID surfaced as non-fatal warning. Handle no-text in model picker editMessageText. Truncate commands to 100 to avoid BOT_COMMANDS_TOO_MUCH. Preserve inbound quote context with external_reply support. Match DM allowFrom against sender user ID. Preserve DM topic threadId in delivery context. Prevent false-positive billing error detection. Fix topic auto-threading with parseTelegramTarget. Auto-inject forum topic threadId in message tool. Pass parentPeer for forum topic binding inheritance.

- **Upstream port — config & path resolution (Phase 4, 6 fixes)**: Structured home dir resolution via home-dir.ts. Respect CROCBOT_HOME for all internal path resolution. Use STATE_DIR with existsSync check instead of hardcoded path. Ignore meta field changes in config watcher. Clamp maxTokens to contextWindow. Exclude maxTokens from redaction and honor deleteAfterRun on skipped cron jobs.

- **Upstream port — memory & media (5E+5F, 4 fixes)**: Default batch embeddings to off. Enforce embedding model token limits. Strip MEDIA: lines containing local paths instead of leaking as text. Guard local media reads with expanded path type acceptance (Windows drive, UNC, bare filename).

- **Upstream port — miscellaneous stability (5G, 9 fixes)**: Use configured base URL for Ollama model discovery (strip /v1 suffix). Ollama streaming config and OLLAMA_API_KEY env var support. Cap sessions_history payloads to 80KB. Exit with non-zero code on wizard cancel. Avoid NODE_OPTIONS for --disable-warning (use execArgv instead). Coerce bare string exec-approval allowlist entries to objects. Suggest /clear in context overflow messages. Make routing bindings dynamic via loadConfig() per-message.

## [2026.1.63] - 2026-02-05

### Fixed

- **Grammy timeout recovery**: Added `.error` property traversal in `collectErrorCandidates()` for Grammy HttpError, "timed out" message pattern to recoverable snippets, and scoped unhandled rejection handler in Telegram monitor. Prevents bot crashes from network timeouts.
- **Session transcript repair**: Ported JSONL file repair, tool call sanitization (missing input fields), and guarded append for crash-resilient session files. Prevents API rejections from malformed transcripts.

## [2026.1.57] - 2026-02-05

### Added

- **Telegram model buttons**: Interactive inline keyboard for browsing AI providers and selecting models via `/model` and `/models` commands. Supports pagination, provider grouping, and works in DM, group, and forum topic contexts.

## [2026.1.56] - 2026-02-04

### Changed

- Restart awareness for SIGTERM handling
- Version bump and documentation fixes

## [2026.1.55] - 2026-02-04

### Added

- Config redaction for sensitive values
- Self-repair skill for automatic recovery
- Restart awareness improvements

### Fixed

- Miscellaneous bug fixes

## [2026.1.46] - 2026-02-04

### Added

- Operational runbooks for incident response, backup/restore, and troubleshooting
- Health check documentation
- Log analysis guides

## [2026.1.45] - 2026-02-03

### Added

- Structured logging with tslog
- Metrics and monitoring infrastructure
- Error reporting and alerting system

## [2026.1.40] - 2026-02-02

### Changed

- Docker optimization with multi-stage builds
- Gateway hardening improvements
- CI/CD finalization

## [2026.1.30] - 2026-02-01

### Changed

- Technical debt cleanup
- Internal documentation updates

## [2026.1.20] - 2026-01-30

### Changed

- Simplified build process
- Removed unused dependencies
- Refactored dead code

## [2026.1.10] - 2026-01-28

### Removed

- Native app support (macOS, Windows, Linux desktop)
- Additional channel providers (Discord, Slack, etc.)
- Mobile code and extensions

### Changed

- Telegram-only architecture (see ADR-0001)
