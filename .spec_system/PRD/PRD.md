# crocbot - Product Requirements Document

## Overview

crocbot is a CLI and gateway for AI chat across messaging platforms. This PRD defines the work to strip moltbot down to a minimal footprint suitable for VPS/Coolify/Ubuntu deployment, retaining only the CLI and Telegram channel.

The current codebase supports multiple channels (Discord, Slack, Signal, iMessage, WhatsApp, Line), native apps (macOS, iOS, Android), and 28+ extensions. This creates unnecessary complexity and bloat for a focused Telegram-only deployment.

**Target state**: A lean, containerized AI chat gateway with CLI interface and Telegram integration only.

## Goals

1. Strip codebase to minimal footprint for VPS/Coolify/Ubuntu deployment
2. Retain only CLI command-line interface and Telegram channel
3. Remove all native apps (macOS, iOS, Android)
4. Remove all non-Telegram channels (Discord, Slack, Signal, iMessage, WhatsApp, Line)
5. Remove unnecessary extensions and dependencies
6. Achieve ~60-70% source code reduction
7. Produce a Docker image under 300MB

## Non-Goals

- Adding new features or functionality
- Supporting multiple channels (only Telegram)
- Supporting native apps (macOS, iOS, Android)
- Supporting mobile device pairing or Bonjour discovery
- Supporting WhatsApp Web or QR code login flows
- Supporting text-to-speech (TTS) functionality
- Maintaining backwards compatibility with removed features
- Supporting extensions beyond core functionality

## Users and Use Cases

### Primary Users

- **Self-hosters**: Users deploying crocbot on their own VPS/Coolify/Ubuntu infrastructure
- **Telegram users**: End users interacting with the AI via Telegram bot

### Key Use Cases

1. Deploy crocbot gateway on a VPS with minimal resource usage
2. Configure and manage the gateway via CLI commands
3. Interact with AI assistant through Telegram messages
4. Run gateway as a Docker container in Coolify or similar platforms

## Requirements

### MVP Requirements

- CLI interface fully functional (`crocbot config`, `crocbot gateway`, `crocbot channels`)
- Telegram channel connects, receives messages, and responds
- Gateway runs in Docker container with minimal footprint
- Configuration stored in `~/.clawdbot/` as expected
- `crocbot doctor` validates installation
- `crocbot channels status` shows only Telegram

### Deferred Requirements

- Re-adding channels on demand (post-MVP if needed)
- Plugin/extension system (stripped for MVP)
- Canvas/artifact rendering (stripped for MVP)

## Non-Functional Requirements

- **Performance**: Gateway starts in under 10 seconds; message response latency under 2 seconds (excluding AI inference)
- **Security**: No credentials stored in Docker image; all secrets via environment variables
- **Reliability**: Gateway handles graceful shutdown; reconnects to Telegram on disconnect
- **Resource usage**: Docker image under 300MB; runtime memory under 512MB typical

## Constraints and Dependencies

- Node.js 22+ required
- Must retain grammy, @grammyjs/runner, @grammyjs/transformer-throttler for Telegram
- Must work with pnpm (production) and bun (development)
- Existing `~/.clawdbot/` configuration structure must be preserved
- Must pass existing Telegram-related tests after stripping

## Phases

This system delivers the product via phases. Each phase is implemented via multiple 2-4 hour sessions (12-25 tasks each).

| Phase | Name | Sessions | Status |
|-------|------|----------|--------|
| 00 | Strip Moltbot to minimal footprint | 8 | Not Started |

## Phase 00: Strip Moltbot to minimal footprint

### Objectives

1. Remove all native apps (macOS, iOS, Android) - lowest risk, biggest win
2. Remove all extensions except potentially telegram-related
3. Remove all non-Telegram channels (Discord, Slack, Signal, iMessage, WhatsApp, Line)
4. Simplify build and CI pipelines
5. Remove unused dependencies
6. Refactor code to remove dead channel references
7. Remove mobile-specific code (pairing, Bonjour, TTS)
8. Update documentation to reflect stripped-down state

### Sessions (To Be Defined)

Sessions are defined via `/phasebuild` as `session_NN_name.md` stubs under `.spec_system/PRD/phase_00/`.

**Note**: This command does NOT create phase directories or session stubs. Run `/phasebuild` after creating the PRD.

### Implementation Order (from source doc)

1. Phase 1: Remove native apps (lowest risk, biggest win)
2. Phase 3: Remove extensions (isolated, low risk)
3. Phase 2: Remove channels (medium risk, requires testing)
4. Phase 5: Simplify build (depends on 1-3)
5. Phase 7: Remove dependencies (after code removal)
6. Phase 8: Code refactoring (highest risk, do last)
7. Phase 4: Remove mobile-specific code (after 8)
8. Phase 6: Update docs (ongoing)

## Technical Stack

- Node.js 22+ - runtime baseline
- TypeScript (ESM) - strict typing
- Bun - development and testing
- pnpm - package management
- Vitest - testing framework
- oxlint/oxfmt - linting and formatting
- Docker - deployment container
- grammy - Telegram bot framework

## Success Criteria

- [ ] `pnpm install` completes without errors
- [ ] `pnpm build` completes without errors
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (after removing tests for deleted code)
- [ ] `crocbot doctor` runs successfully
- [ ] `crocbot gateway run` starts without errors
- [ ] `crocbot channels status` shows only Telegram
- [ ] Telegram bot connects and responds
- [ ] Gateway handles Telegram messages correctly
- [ ] Docker image size under 300MB
- [ ] No macOS/iOS/Android code in production build
- [ ] No Discord/Slack/Signal/iMessage/WhatsApp/Line code in production build

## Risks

- **Breaking shared channel code**: Telegram may share utilities with removed channels. Mitigation: Test Telegram thoroughly after each removal phase.
- **Missing dependencies**: Removing deps may break unexpected code paths. Mitigation: Run full test suite after each dependency removal.
- **Documentation drift**: Docs may reference removed features. Mitigation: Update docs as part of each removal phase.
- **Configuration breaks**: Config loading may expect removed channel settings. Mitigation: Test config loading with minimal config.

## Assumptions

- Telegram channel code is self-contained enough to work after removing other channels
- Core gateway functionality does not depend on native app code
- Test coverage is sufficient to catch regressions in Telegram functionality
- No active users depend on the features being removed (this is a fresh deployment target)

## Open Questions

1. Should any extensions be retained (e.g., auth providers for Anthropic API)?
2. Should canvas-host/A2UI be retained for artifact display in Telegram?
3. What is the minimum set of CLI commands needed for VPS operation?
4. Should the TUI (terminal UI) be retained for interactive CLI use?

## Appendix: Files to Remove

### Directories

| Directory | Files | Action |
|-----------|-------|--------|
| `apps/android/` | 80+ Kotlin | REMOVE |
| `apps/ios/` | 100+ Swift | REMOVE |
| `apps/macos/` | 150+ Swift | REMOVE |
| `apps/shared/` | shared app code | REMOVE |
| `src/discord/` | 60 | REMOVE |
| `src/slack/` | 65 | REMOVE |
| `src/signal/` | 24 | REMOVE |
| `src/imessage/` | 16 | REMOVE |
| `src/web/` | 77 (WhatsApp) | REMOVE |
| `src/line/` | 34 | REMOVE |
| `src/macos/` | macOS helpers | REMOVE |
| `src/pairing/` | device pairing | REMOVE |
| `src/tts/` | text-to-speech | REMOVE |
| `extensions/*` | ~200+ | MOSTLY REMOVE |

### Dependencies to Remove

```
@buape/carbon (Discord)
@slack/bolt (Slack)
@slack/web-api (Slack)
@whiskeysockets/baileys (WhatsApp)
@line/bot-sdk (Line)
discord-api-types (Discord)
@homebridge/ciao (Bonjour/mDNS)
node-edge-tts (TTS)
qrcode-terminal (WhatsApp QR)
```

### Dependencies to Keep

```
grammy (Telegram)
@grammyjs/runner (Telegram)
@grammyjs/transformer-throttler (Telegram)
```

## Appendix: Estimated Savings

| Metric | Before | After (Est.) |
|--------|--------|--------------|
| Source files | ~2000+ | ~600-800 |
| Dependencies | ~50 | ~25-30 |
| Docker image size | ~500MB+ | ~200-300MB |
| Build time | ~2-3 min | ~30-60 sec |
| Test time | ~2-3 min | ~30-60 sec |
