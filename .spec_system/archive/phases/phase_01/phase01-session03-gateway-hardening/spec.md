# Session Specification

**Session ID**: `phase01-session03-gateway-hardening`
**Phase**: 01 - Production Hardening and Deployment
**Status**: Not Started
**Created**: 2026-01-30

---

## 1. Session Overview

This session hardens the Telegram gateway for production reliability. The gateway is the core communication bridge between Telegram and the crocbot agent system, and its stability directly impacts user experience. With Docker optimization completed in Session 02, we now focus on ensuring the gateway itself handles real-world conditions gracefully: network interruptions, rate limiting, memory pressure, and clean shutdown sequences.

The work involves auditing existing error handling and reconnection logic in the grammy-based Telegram integration, verifying that rate limiting via @grammyjs/transformer-throttler is properly configured, ensuring the HTTP health endpoint reports meaningful connection state, and validating graceful shutdown under SIGTERM/SIGINT. This session builds the reliability foundation required for CI/CD pipelines in Session 04.

Key areas of focus: verifying the existing `monitor.ts` reconnection loop handles all recoverable errors, ensuring `network-errors.ts` covers Telegram-specific failure modes, validating health endpoint reflects actual Telegram connection status, and confirming memory usage remains within production bounds.

---

## 2. Objectives

1. Audit and improve Telegram connection error handling to cover all production failure scenarios
2. Verify automatic reconnection logic handles network interruptions with appropriate backoff
3. Ensure rate limiting compliance with graceful handling of 429 responses from Telegram
4. Validate health endpoint reports meaningful gateway and Telegram connection status
5. Verify graceful shutdown completes cleanly under SIGTERM/SIGINT within timeout bounds

---

## 3. Prerequisites

### Required Sessions
- [x] `phase01-session01-clean-technical-debt` - Removed TTS stubs and dead code
- [x] `phase01-session02-docker-optimization` - Optimized Docker build for production

### Required Tools/Knowledge
- grammy Telegram bot framework (error handlers, middleware)
- @grammyjs/runner for long-polling with reconnection
- @grammyjs/transformer-throttler for rate limiting
- Node.js process signal handlers

### Environment Requirements
- Telegram bot token for testing (TELEGRAM_BOT_TOKEN or config)
- Docker environment for container testing (optional)
- Network simulation capability for disconnect testing (optional)

---

## 4. Scope

### In Scope (MVP)
- Audit `src/telegram/network-errors.ts` for comprehensive error coverage
- Audit `src/telegram/monitor.ts` reconnection loop and backoff policy
- Review `src/telegram/bot.ts` error handlers and bot.catch() usage
- Verify @grammyjs/transformer-throttler rate limiting configuration
- Audit health endpoint in `src/gateway/server-http.ts` and `src/gateway/server-methods/health.ts`
- Verify graceful shutdown in `src/cli/gateway-cli/run-loop.ts`
- Test gateway behavior under simulated network interruption
- Verify channel registry is Telegram-only (`src/channels/registry.ts`)
- Add/improve logging for production observability
- Memory usage verification (target: under 512MB typical)

### Out of Scope (Deferred)
- Docker container configuration changes - *Reason: Completed in Session 02*
- CI/CD pipeline changes - *Reason: Scheduled for Session 04*
- New features or capabilities - *Reason: Focus on hardening existing code*
- Multi-channel support - *Reason: Architecture decision; Telegram-only for VPS deployment*
- Webhook mode hardening - *Reason: Long-polling is primary mode; webhook is secondary*

---

## 5. Technical Approach

### Architecture
The gateway uses grammy with @grammyjs/runner for long-polling Telegram updates. The `monitorTelegramProvider` function in `monitor.ts` implements a restart loop with exponential backoff for recoverable errors. Rate limiting is handled by `apiThrottler()` middleware. The HTTP server provides a `/health` endpoint for container orchestration probes.

### Design Patterns
- **Exponential Backoff**: Used in `TELEGRAM_POLL_RESTART_POLICY` for reconnection (2s initial, 30s max, 1.8 factor)
- **Error Classification**: `isRecoverableTelegramNetworkError()` determines retry vs. fatal errors
- **Graceful Shutdown**: Signal handlers with 5-second timeout prevent orphaned connections
- **Health Caching**: `HEALTH_REFRESH_INTERVAL_MS` prevents probe storms while maintaining freshness

### Technology Stack
- grammy ^1.x (Telegram Bot API framework)
- @grammyjs/runner ^2.x (concurrent update processing)
- @grammyjs/transformer-throttler ^1.x (rate limiting)
- Node.js 22+ (runtime)
- Vitest (testing framework)

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/telegram/network-errors.test.ts` | Unit tests for error classification (if insufficient coverage) | ~80 |
| `src/telegram/monitor.test.ts` | Unit tests for reconnection logic (if insufficient coverage) | ~100 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `src/telegram/network-errors.ts` | Add any missing recoverable error codes (Telegram-specific) | ~15 |
| `src/telegram/monitor.ts` | Improve logging, verify backoff configuration | ~20 |
| `src/telegram/bot.ts` | Audit error handlers, remove duplicate bot.catch() | ~10 |
| `src/gateway/server-http.ts` | Enhance /health endpoint with connection status | ~15 |
| `src/gateway/server-methods/health.ts` | Add Telegram connection state to health response | ~25 |
| `src/cli/gateway-cli/run-loop.ts` | Verify shutdown timeout, improve logging | ~10 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] Gateway reconnects automatically after network interruption (tested manually or via simulation)
- [ ] Rate limiting errors (429) are handled gracefully without crashing
- [ ] Transient network failures are retried with exponential backoff
- [ ] Health endpoint returns Telegram connection status
- [ ] Graceful shutdown completes within 5-second timeout
- [ ] No duplicate bot.catch() handlers in bot.ts

### Testing Requirements
- [ ] Unit tests for `network-errors.ts` error classification pass
- [ ] Unit tests for `monitor.ts` reconnection logic pass
- [ ] Existing Telegram-related tests (`pnpm test -- telegram`) pass
- [ ] Manual testing: gateway survives brief network disconnection

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] `pnpm lint` passes
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes with coverage thresholds
- [ ] Memory usage under 512MB typical (verified via `process.memoryUsage()` logging)

---

## 8. Implementation Notes

### Key Considerations
- The existing reconnection logic in `monitor.ts` appears robust; focus on verification and edge cases
- Rate limiting via `apiThrottler()` is already configured in `bot.ts`; verify it handles 429 correctly
- Health endpoint currently returns basic status; enhance with Telegram connection state
- Duplicate `bot.catch()` handlers in `bot.ts` (lines 144-146 and 149-152) should be consolidated

### Potential Challenges
- **Network simulation**: Testing reconnection behavior requires simulating network failures. May need to rely on code review + manual testing if network simulation tools unavailable
- **Rate limit testing**: Cannot easily trigger real Telegram rate limits without spamming. Focus on code review of throttler configuration
- **Health endpoint state**: Need to track Telegram connection state and expose it without adding complexity

### Relevant Considerations
- [P00] **Telegram-only channel registry**: Registry is already constrained to Telegram-only. Verify no references to other channels remain in gateway code
- [P00] **Stub files for disabled features**: TTS/pairing stubs should not affect gateway. Verify no interference in startup/shutdown paths
- [P00] **Incremental verification**: Run build/lint/test after each modification to catch issues early

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- `network-errors.ts`: Test all RECOVERABLE_ERROR_CODES and RECOVERABLE_ERROR_NAMES are correctly classified
- `network-errors.ts`: Test nested error cause/reason traversal
- `monitor.ts`: Test backoff calculation produces expected delays
- `monitor.ts`: Test `isGetUpdatesConflict` detection

### Integration Tests
- Gateway startup/shutdown cycle completes cleanly
- Health endpoint returns valid JSON with expected fields

### Manual Testing
- Start gateway, verify Telegram connection established
- Simulate network interruption (e.g., disable network briefly), verify reconnection
- Send SIGTERM, verify shutdown completes within timeout
- Monitor memory usage over extended run (target: <512MB)

### Edge Cases
- Multiple rapid SIGTERM signals during shutdown
- Network interruption during message processing
- Rate limiting during high message volume
- getUpdates conflict (409) from parallel bot instances

---

## 10. Dependencies

### External Libraries
- grammy: ^1.x (pinned by existing package.json)
- @grammyjs/runner: ^2.x
- @grammyjs/transformer-throttler: ^1.x

### Other Sessions
- **Depends on**: `phase01-session02-docker-optimization` (Docker environment ready)
- **Depended by**: `phase01-session04-cicd-finalization` (needs hardened gateway for CI testing)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
