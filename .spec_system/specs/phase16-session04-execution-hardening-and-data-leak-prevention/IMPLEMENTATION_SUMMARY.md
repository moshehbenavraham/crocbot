# Implementation Summary

**Session ID**: `phase16-session04-execution-hardening-and-data-leak-prevention`
**Completed**: 2026-02-23
**Duration**: ~2 hours

---

## Overview

Closed 17 applicable upstream security fixes spanning execution hardening (8 items) and data leak prevention (9 items). Hardened shell expansion blocking, PID-scoped cleanup, npm install safety, PATH validation, credential redaction, error response sanitization, WebSocket header scrubbing, web tool transcript wrapping, config snapshot redaction, and audit subsystem hardening. Additionally fixed 2 pre-existing flaky tests that were failing intermittently under parallel execution.

---

## Deliverables

### Files Created
| File | Purpose | Lines |
|------|---------|-------|
| `src/agents/cli-runner/helpers.test.ts` | PID ownership unit tests | ~25 |
| `src/agents/skills-install.test.ts` | --ignore-scripts verification | ~25 |
| `src/agents/skills-status.test.ts` | Status output redaction tests | ~20 |
| `src/hooks/hooks-status.test.ts` | Hook status redaction tests | ~20 |
| `src/gateway/server/ws-connection.test.ts` | WebSocket header sanitization tests | ~55 |
| `src/security/audit-extra.sync.test.ts` | Audit webhook/hook distinction tests | ~100 |

### Files Modified
| File | Changes |
|------|---------|
| `src/infra/exec-approvals.ts` | Shell expansion blocking (`containsShellExpansion`), heredoc allowlisting, safeBins path-argument rejection |
| `src/infra/exec-approvals.test.ts` | Tests for shell expansion, heredoc, path-argument blocking |
| `src/agents/cli-runner/helpers.ts` | PID-scoped cleanup (`isOwnedPid`, `registerOwnedPid`, `unregisterOwnedPid`) |
| `src/hooks/install.ts` | `--ignore-scripts` on npm install |
| `src/agents/skills-install.ts` | `--ignore-scripts` on npm install |
| `src/infra/path-env.ts` | Reject relative/empty PATH segments (`isAbsolutePathSegment`) |
| `src/infra/path-env.test.ts` | PATH hardening tests |
| `src/config/redact.ts` | Complete credential redaction across 5 boundaries, `redactConfigSnapshot` for resolved fields |
| `src/config/redact.test.ts` | Redaction tests including resolved-field coverage |
| `src/commands/configure.gateway.ts` | `String(undefined)` coercion prevention |
| `src/agents/skills-status.ts` | Config value redaction in status output |
| `src/hooks/hooks-status.ts` | Config value redaction in status output |
| `src/gateway/server/ws-connection.ts` | WebSocket log header sanitization (`sanitizeHeader`) |
| `src/agents/tools/browser-tool.ts` | External content security markers on transcripts |
| `src/agents/tools/browser-tool.test.ts` | Transcript wrapping tests |
| `src/agents/tools/web-fetch.ts` | External content security markers on transcripts |
| `src/agents/tools/web-search.ts` | External content security markers on transcripts |
| `src/security/external-content.ts` | `wrapToolTranscript` helper |
| `src/security/external-content.test.ts` | Transcript wrapping tests |
| `src/security/audit-extra.sync.ts` | Webhook vs internal hook distinction, `collectWebhookSafetyFindings` |
| `src/security/audit-extra.ts` | Audit wiring |
| `src/security/audit.ts` | Audit summary integration |
| `src/commands/chutes-oauth.ts` | OAuth hardening |
| `src/commands/chutes-oauth.test.ts` | Fixed TOCTOU port race (replaced `getFreePort` with `getDeterministicFreePortBlock`) |
| `src/agents/pi-embedded-runner.test.ts` | Fixed flaky multi-turn ordering test (microtask drain between sequential runs) |
| `src/agents/session-transcript-repair.test.ts` | Test updates |
| `src/commands/auth-choice.test.ts` | Test updates |
| `src/gateway/auth.ts` | Auth hardening |
| `src/gateway/chat-attachments.ts` | Input sanitization |
| `src/gateway/exec-approval-manager.ts` | Exec approval tightening |
| `src/gateway/server-http.ts` | Generic error responses |
| `src/gateway/server-methods/exec-approval.ts` | Exec approval methods |
| `src/gateway/server-methods/nodes.ts` | Node method hardening |
| `src/infra/http-body.ts` | Bounded HTTP body reading |
| `src/media/input-files.ts` | Input file handling |

---

## Technical Decisions

1. **Microtask drain for SDK persistence race**: The upstream `@mariozechner/pi-agent-core` SDK fires `Agent.emit()` without awaiting async listeners, causing `SessionManager.appendFileSync` to execute in a microtask continuation. Added `setTimeout(resolve, 0)` between sequential test runs to drain the microtask queue.
2. **Deterministic port allocation over OS-assigned ports**: Replaced `getFreePort()` (TOCTOU race: bind port 0 -> release -> re-bind) with the existing `getDeterministicFreePortBlock()` which allocates per-worker port ranges to avoid collisions under parallel execution.
3. **Shell expansion detection via pattern matching**: `containsShellExpansion()` uses regex to detect `$()`, backticks, and `${}` in command arguments rather than shell parsing, avoiding the overhead and complexity of a full shell parser.
4. **Five-boundary credential redaction**: Extended existing Phase 09 masking pipeline with `looksLikeSecret()` heuristic and `SENSITIVE_KEY_PATTERNS` to cover config snapshots, status output, and error responses.

---

## Test Results

| Metric | Value |
|--------|-------|
| Total Test Files | 784 |
| Passed Files | 784 |
| Failed Files | 0 |
| Total Tests | 5984 |
| Passed Tests | 5984 |
| Failed Tests | 0 |
| Skipped | 1 |

---

## Lessons Learned

1. Fire-and-forget async patterns in upstream SDKs can create subtle persistence races that only manifest under parallel test load -- always drain the microtask queue between operations that depend on completed persistence.
2. TOCTOU port allocation is a common flakiness source in tests that bind real TCP sockets -- deterministic per-worker port ranges eliminate the race entirely.

---

## Future Considerations

Items for future sessions:
1. The upstream SDK's `Agent.emit()` should ideally await async listeners to prevent persistence races in production multi-message scenarios
2. Session 05 (ACP Fixes and Security Validation) is the final session in Phase 16

---

## Session Statistics

- **Tasks**: 22 completed
- **Files Created**: 6
- **Files Modified**: 28+
- **Tests Added**: 29 deliverable files with tests
- **Blockers**: 0
- **Flaky Tests Fixed**: 2 (pi-embedded-runner.test.ts, chutes-oauth.test.ts)
