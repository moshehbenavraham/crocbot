# PRD Phase 01: Production Hardening and Deployment

**Status**: In Progress
**Sessions**: 5
**Estimated Duration**: 2-3 days

**Progress**: 2/5 sessions (40%)

---

## Overview

With the crocbot codebase stripped to a minimal footprint (CLI + Telegram only), Phase 01 focuses on production hardening and deployment optimization. This phase cleans up remaining technical debt, verifies Docker deployment, hardens the gateway for reliability, and ensures the codebase is production-ready for VPS/Coolify/Ubuntu hosting.

---

## Progress Tracker

| Session | Name | Status | Est. Tasks | Validated |
|---------|------|--------|------------|-----------|
| 01 | Clean Technical Debt | Complete | 20 | 2026-01-30 |
| 02 | Docker Optimization | Complete | 20 | 2026-01-30 |
| 03 | Gateway Hardening | Not Started | ~15-20 | - |
| 04 | CI/CD Finalization | Not Started | ~12-18 | - |
| 05 | Internal Docs Cleanup | Not Started | ~12-18 | - |

---

## Completed Sessions

### Session 01: Clean Technical Debt (2026-01-30)

- Deleted 7 stub/dead files (TTS, pairing-messages, WhatsApp types, TTS tool, TTS commands, obsolete test)
- Modified 13 files to remove TTS/pairing imports
- Kept 3 stub files for compatibility (device-pairing, pairing-store, telegram pairing-store)
- Achieved clean build/lint/test with 3582 tests passing

### Session 02: Docker Optimization (2026-01-30)

- Implemented 3-stage multi-stage build (builder -> pruner -> runtime)
- Reduced image size from 2.61GB to 688MB (73% reduction)
- Switched to node:22-slim base for runtime stage
- Removed Bun from runtime (build-only)
- Pruned dev dependencies and unused optional deps (node-llama-cpp: 700MB+)
- Achieved 2.2s startup time (target: <10s)
- Verified graceful SIGTERM shutdown (662ms, exit code 0)
- Created environment variables documentation

---

## Upcoming Sessions

- Session 03: Gateway Hardening

---

## Objectives

1. Remove remaining stub files and orphaned code from Phase 00
2. Optimize Docker image for production deployment
3. Harden gateway for reliability and error recovery
4. Finalize CI/CD pipelines for lean Telegram-only codebase
5. Clean up internal documentation with stale references

---

## Prerequisites

- Phase 00 completed (codebase stripped to minimal footprint)
- All Phase 00 tests passing
- Docker environment available for testing
- VPS/Coolify target environment defined

---

## Technical Considerations

### Architecture
- Gateway runs as standalone Node.js process in Docker
- CLI provides configuration and management interface
- Telegram bot via grammy handles all messaging
- Health endpoint at `/health` for container orchestration

### Technologies
- Node.js 22+ (runtime)
- TypeScript ESM (strict typing)
- grammy / @grammyjs/runner / @grammyjs/transformer-throttler (Telegram)
- Docker (deployment container)
- Fly.io / Coolify (orchestration targets)

### Risks
- **Stub removal breaking imports**: Some stubs may have hidden consumers. Mitigation: Thorough grep before removal, incremental verification.
- **Docker optimization breaking runtime**: Image size reduction may remove needed dependencies. Mitigation: Full integration testing after each change.
- **Gateway hardening introducing bugs**: Error handling changes may alter behavior. Mitigation: Comprehensive test coverage, staged rollout.

### Relevant Considerations
<!-- From CONSIDERATIONS.md -->
- [P00] **Stub files for disabled features**: API-compatible stubs remain for TTS, pairing, Bonjour. Session 01 will assess full removal.
- [P00] **WhatsApp types retained**: `src/config/types.whatsapp.ts` kept for web provider. Session 01 will verify if still needed.
- [P00] **BlueBubbles provider status**: May be unused after channel removals. Session 01 will verify.
- [P00] **Internal docs reference removed features**: 123+ files with stale references. Session 05 will address.
- [P00] **Telegram-only channel registry**: Verify registry is properly constrained in Session 03.
- [P00] **Plugin system intact**: Ensure plugin loader doesn't load removed extensions in Session 01.

---

## Success Criteria

Phase complete when:
- [x] Session 01 - Clean Technical Debt completed
- [x] Session 02 - Docker Optimization completed
- [ ] Session 03 - Gateway Hardening completed
- [ ] Session 04 - CI/CD Finalization completed
- [ ] Session 05 - Internal Docs Cleanup completed
- [ ] No stub files remaining for removed features
- [ ] No orphaned code referencing removed channels
- [x] Docker image optimized and tested
- [ ] Gateway handles disconnects and errors gracefully
- [ ] CI/CD pipelines verified for production use
- [ ] Internal docs cleaned of stale references
- [ ] All tests passing with coverage thresholds met
- [ ] `crocbot doctor` validates clean installation

---

## Dependencies

### Depends On
- Phase 00: Strip Moltbot to minimal footprint (Complete)

### Enables
- Future feature phases (if additional functionality needed)
- Production deployment to VPS/Coolify/Ubuntu
