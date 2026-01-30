# PRD Phase 00: Strip Moltbot to Minimal Footprint

**Status**: In Progress
**Sessions**: 8 (initial estimate)
**Estimated Duration**: 16-32 hours

**Progress**: 4/8 sessions (50%)

---

## Overview

Transform the crocbot codebase from a multi-platform application with macOS app, iOS/Android apps, and extensive channel integrations into a lean, deployable gateway suitable for VPS hosting on Coolify/Ubuntu. Target: CLI + Telegram only, Docker image under 300MB.

---

## Progress Tracker

| Session | Name | Status | Est. Tasks | Validated |
|---------|------|--------|------------|-----------|
| 01 | Remove Native Apps | Complete | 20 | 2026-01-30 |
| 02 | Remove Extensions | Complete | 15 | 2026-01-30 |
| 03 | Remove Non-Telegram Channels | Complete | 20 | 2026-01-30 |
| 04 | Simplify Build and CI | Complete | 20 | 2026-01-30 |
| 05 | Remove Unused Dependencies | Not Started | ~12-18 | - |
| 06 | Refactor Dead Channel Code | Not Started | ~18-25 | - |
| 07 | Remove Mobile-Specific Code | Not Started | ~12-18 | - |
| 08 | Update Documentation | Not Started | ~12-15 | - |

---

## Completed Sessions

- **Session 01: Remove Native Apps** (2026-01-30) - Removed ~548 files (apps/, src/macos/)
- **Session 02: Remove Extensions** (2026-01-30) - Removed 30 packages, 547 files (extensions/)
- **Session 03: Remove Non-Telegram Channels** (2026-01-30) - Removed 279 files across 7 channel directories, 40+ tests updated
- **Session 04: Simplify Build and CI** (2026-01-30) - Removed 21 scripts, 3 config artifacts, updated labeler.yml and package.json

---

## Upcoming Sessions

- Session 05: Remove Unused Dependencies

---

## Objectives

1. Remove all native apps (macOS, iOS, Android) - lowest risk, biggest win
2. Remove all extensions except core functionality
3. Remove all non-Telegram channels (Discord, Slack, Signal, iMessage, WhatsApp, Line)
4. Simplify build and CI pipelines for lean deployment
5. Remove unused dependencies to reduce image size
6. Refactor code to remove dead channel references
7. Remove mobile-specific code (pairing, Bonjour, TTS)
8. Update documentation to reflect stripped-down state

---

## Prerequisites

- Fresh clone of crocbot repository
- Node.js 22+ installed
- pnpm and bun available
- Docker available for final image testing

---

## Technical Considerations

### Architecture
- Gateway runs as standalone Node.js process
- CLI provides configuration and management interface
- Telegram bot via grammy library handles all messaging
- Configuration stored in `~/.clawdbot/` directory

### Technologies
- Node.js 22+ (runtime)
- TypeScript ESM (strict typing)
- grammy / @grammyjs/runner / @grammyjs/transformer-throttler (Telegram)
- Vitest (testing)
- Docker (deployment)

### Risks
- **Breaking shared channel code**: Telegram may share utilities with removed channels. Mitigation: Test Telegram thoroughly after each removal phase.
- **Missing dependencies**: Removing deps may break unexpected code paths. Mitigation: Run full test suite after each dependency removal.
- **Documentation drift**: Docs may reference removed features. Mitigation: Update docs as part of each removal phase.
- **Configuration breaks**: Config loading may expect removed channel settings. Mitigation: Test config loading with minimal config.

### Relevant Considerations
<!-- From CONSIDERATIONS.md - none currently apply -->
*No active concerns from previous phases.*

---

## Success Criteria

Phase complete when:
- [ ] All 8 sessions completed
- [ ] `pnpm install` completes without errors
- [ ] `pnpm build` completes without errors
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (Telegram-related tests)
- [ ] `crocbot doctor` runs successfully
- [ ] `crocbot gateway run` starts without errors
- [ ] `crocbot channels status` shows only Telegram
- [ ] Telegram bot connects and responds
- [ ] Docker image size under 300MB
- [ ] No macOS/iOS/Android code in production build
- [ ] No Discord/Slack/Signal/iMessage/WhatsApp/Line code in production build

---

## Dependencies

### Depends On
- None (this is the first phase)

### Enables
- Future phases if additional functionality is needed
