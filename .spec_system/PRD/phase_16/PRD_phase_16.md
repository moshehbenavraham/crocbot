# PRD Phase 16: Critical Security Hardening II

**Status**: Complete
**Sessions**: 5
**Estimated Duration**: 10-20 days
**Completed**: 2026-02-23

**Progress**: 5/5 sessions (100%)

---

## Overview

Audit and port ~65 upstream security patches covering SSRF bypasses, path traversal, input sanitization, auth hardening, execution safety, data leak prevention, and ACP policy fixes. The upstream codebase was pulled on 2026-02-22 (4,642 commits since previous sync at `6b1f485ce`) and resides in `.001_ORIGINAL/`. This phase filters Section 1 of the filtered candidate list against crocbot's stripped-down architecture (Telegram-only, Linux-only, no web UI).

---

## Post-Triage Summary (Session 01 Results)

| Metric | Value |
|--------|-------|
| Total items triaged | 60 |
| Apply (direct port) | 18 (30.0%) |
| Adapt (port with mods) | 34 (56.7%) |
| Skip (N/A) | 8 (13.3%) |
| Applicable items | 52 (86.7%) |
| Dependency chains | 7 |
| New infrastructure modules needed | 8 |

## Progress Tracker

| Session | Name | Status | Items | Est. Tasks | Est. Hours | Validated |
|---------|------|--------|-------|------------|------------|-----------|
| 01 | Security Triage and Applicability Audit | Complete | 60 triaged | 20 | ~1 | 2026-02-23 |
| 02 | Network, SSRF, and Filesystem Hardening | Complete | 14 (5A+9Ad) | 20 | ~1 | 2026-02-23 |
| 03 | Input Sanitization and Auth Hardening | Complete | 16 (8A+8Ad) | 20 | ~1 | 2026-02-23 |
| 04 | Execution Hardening and Data Leak Prevention | Complete | 17 (5A+12Ad) | 22 | ~2 | 2026-02-23 |
| 05 | ACP Fixes and Security Validation | Complete | 5 (0A+5Ad) | 20 | ~1 | 2026-02-23 |

---

## Completed Sessions

### Session 01: Security Triage and Applicability Audit
- **Completed**: 2026-02-23
- **Duration**: ~53 minutes
- **Tasks**: 20/20
- **Result**: Triaged all 60 upstream security items. 18 Apply, 34 Adapt, 8 Skip. 7 dependency chains identified. Sessions 02-05 scoped to 52 applicable items.

---

### Session 02: Network, SSRF, and Filesystem Hardening
- **Completed**: 2026-02-23
- **Duration**: ~33 minutes
- **Tasks**: 20/20
- **Result**: Closed 14 security items (5 Apply + 9 Adapt). SSRF guard extended for full-form IPv6-mapped IPv4, link-understanding, gateway URLs, and outbound messages. Filesystem containment added to apply-patch, hook manifests, archive extraction, and output paths. 76 new tests added.

---

### Session 03: Input Sanitization and Auth Hardening
- **Completed**: 2026-02-23
- **Duration**: ~53 minutes
- **Tasks**: 20/20
- **Result**: Closed 16 security items (8 Apply + 8 Adapt). Input sanitization: chat.send injection prevention, transcript sanitization, Unicode homoglyph detection, base64 size validation, bounded HTTP body reading, rawCommand/argv consistency. Auth hardening: OAuth CSRF protection, timing-safe token comparison, auth rate-limiting with brute-force lockout, exec approval device binding, system.run param allowlisting, node.invoke bypass prevention. 4 new infrastructure modules created. 113 security-focused tests added.

---

### Session 04: Execution Hardening and Data Leak Prevention
- **Completed**: 2026-02-23
- **Duration**: ~2 hours
- **Tasks**: 22/22
- **Result**: Closed 17 security items (5 Apply + 12 Adapt). Execution hardening: shell expansion blocking in safeBins, CLI cleanup PID scoping, --ignore-scripts on npm installs, PATH segment validation, heredoc operator allowlisting. Data leak prevention: credential redaction across all 5 masking boundaries, error response sanitization, WebSocket log header scrubbing, web tool transcript security markers, config snapshot redaction, audit webhook/hook distinction. Fixed 2 pre-existing flaky tests (pi-embedded-runner.test.ts microtask persistence race, chutes-oauth.test.ts TOCTOU port race). 29 deliverable files, all tests passing (5984/5984).

---

### Session 05: ACP Fixes and Security Validation
- **Completed**: 2026-02-23
- **Duration**: ~1 hour
- **Tasks**: 20/20
- **Result**: Closed 5 ACP security items (all Adapt). Introduced `DEFAULT_GATEWAY_HTTP_TOOL_DENY` constant blocking exec, process, write, edit, apply_patch, browser, sessions_spawn, sessions_send, gateway from HTTP gateway auto-approval. Refactored ACP `requestPermission` handler to evaluate tool safety via `classifyToolSafety()` instead of blindly selecting `allow_once`. Added safe-kind inference (conservative boundary-matching classifier), non-read/search prompting denial, and audit warning when `gateway.tools.allow` re-enables denied tools. Added `GatewayToolsConfig` type to gateway config. 4 new files created, 5 files modified. Green baseline: build 0 errors, lint 0 warnings, 787 test files / 6035 tests passed (0 failures).

---

## Phase 16 Completion Summary

| Metric | Value |
|--------|-------|
| Sessions completed | 5/5 |
| Total items triaged | 60 |
| Items closed | 52 (86.7%) |
| Items skipped (N/A) | 8 (13.3%) |
| Total tasks completed | 102 |
| Total new tests added | ~220+ |
| Final test count | 6035 passed, 0 failed |
| Build status | Clean (0 errors) |
| Lint status | Clean (0 warnings) |

---

## Objectives

1. Audit all ~65 upstream security patches against crocbot's stripped-down codebase to determine applicability
2. Close SSRF bypass vectors not covered by Phase 06 (IPv6-mapped addresses, gateway URL overrides, tool overrides)
3. Block all path traversal and filesystem escape variants (apply_patch, symlink, archive extraction, media roots)
4. Harden input sanitization (Unicode homoglyphs, oversized base64, ReDoS-vulnerable regex, webhook bounds)
5. Close auth gaps (OAuth CSRF, rate-limiting, token validation, approval device binding)
6. Block shell expansion in safe binary paths and harden npm install/exec safety
7. Complete credential redaction and prevent info leakage in error responses, logs, and config snapshots
8. Close ACP permission bypass via HTTP tools and tighten safe kind inference

---

## Prerequisites

- Phase 15 completed (Knowledge Base Import Pipeline -- Arc 2 final phase)
- Upstream reference codebase in `.001_ORIGINAL/` (2026-02-22 pull)
- Filtered candidate list available at `docs/ongoing-projects/filtered-final-list.md`
- Phase 06 SSRF guards in `src/infra/net/ssrf.ts` provide foundation
- Phase 09 secrets masking pipeline in `src/infra/secrets/` provides foundation

---

## Technical Considerations

### Architecture

- Phase 06 established SSRF protection at 5 user-facing fetch sites plus 1 knowledge import (P15). This phase closes bypass variants (IPv6-mapped, gateway URL override, tool URL override).
- Phase 09 established 5-boundary secrets masking (logging, config, LLM context, tool results, error output). This phase completes credential redaction gaps.
- Many upstream security patches assume multi-channel, sandbox containers, or web UI -- session 01 triage filtered 8 N/A items (13.3% exclusion rate; lower than estimated because the filtered list already pre-excluded most irrelevant components).

### Technologies

- TypeScript (strict mode, ESM)
- Node.js 22+ (AbortSignal.timeout pattern for timeouts)
- undici Dispatcher for DNS pinning (existing SSRF infrastructure)
- Vitest for security-focused test cases

### Risks

- **Architectural Mismatch**: Many upstream security fixes target removed components (Discord, web UI, sandbox containers, native apps). Mitigation: Session 01 triage audits applicability before implementation.
- **Security Patch Interactions**: Patches may interact with existing Phase 06 SSRF guards and Phase 09 secrets masking. Mitigation: Test each patch in isolation before combining; verify no double-guarding or performance regression.
- **Placeholder SHAs**: Some SHAs in filtered list use approximate suffixes (e.g., `cb995c4X`). Mitigation: Search by commit message and file context rather than exact SHA.
- **Scope Inflation After Triage**: Triage may reveal dependencies requiring additional infrastructure ports. Mitigation: Defer infrastructure that exceeds session budget to subsequent sessions.

### Relevant Considerations

- [P06] **SSRF guard coverage is call-site-based**: 70 fetch call sites inventoried; 5 user-facing guarded + 1 knowledge import. New bypass vectors target these same sites.
- [P06] **Plugin fetch calls not SSRF-guarded**: Dynamically-loaded plugin code may contain unguarded fetch calls. If plugins fetch user-provided URLs, they need coverage.
- [P09] **Secrets masking pipeline architecture**: Five-boundary defense. Value-based masking runs first, pattern-based provides defense-in-depth. This phase completes gaps in that pipeline.
- [P06] **Research-first security pattern**: Comprehensive call-site inventory before implementing guards ensures no gaps. Apply same methodology for this phase.

---

## Success Criteria

Phase complete when:
- [x] All 5 sessions completed
- [x] All applicable SSRF bypass vectors closed (IPv6-mapped, gateway URL, tool overrides)
- [x] Path traversal variants blocked (apply_patch, symlink, archive extraction, media roots)
- [x] Input sanitization hardened (Unicode homoglyphs, base64 limits, regex safety, webhook bounds)
- [x] Auth gaps closed (OAuth CSRF, rate-limiting, token validation, approval binding)
- [x] Credential redaction complete; no secrets in error responses, logs, or config snapshots
- [x] ACP permission bypasses closed
- [x] Full test suite passes (`pnpm test` -- 0 failures)
- [x] Build clean (`pnpm build` -- 0 errors)
- [x] Lint clean (`pnpm lint` -- 0 errors)

---

## Dependencies

### Depends On
- Phase 15: Knowledge Base Import Pipeline (completed)
- Phase 06: SSRF guards foundation
- Phase 09: Secrets masking foundation

### Enables
- Phase 17: Core Runtime Stability
- Phase 18: Telegram and Messaging Pipeline
- Phase 19: Cron, Memory, and Config
- Phase 20: Plugins, Media, CLI, and Infrastructure
- Phase 21: Performance, Refactors, and Build
