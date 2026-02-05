# PRD Phase 06: Upstream Security Hardening Port

**Status**: In Progress
**Sessions**: 4 (initial estimate)
**Estimated Duration**: 2-3 days

**Progress**: 2/4 sessions (50%)

---

## Overview

Port upstream OpenClaw security hardening improvements to crocbot. This phase adds SSRF protection for all remote URL fetches, enforces download timeouts for Telegram file operations, and validates file paths against traversal attacks. These are critical hardening measures that close known attack surface gaps in crocbot's external interaction layer.

The exec allowlist hardening and TLS 1.3 minimum have been descoped — exec security is already comprehensive in crocbot, and TLS termination is handled by the Coolify reverse proxy.

---

## Progress Tracker

| Session | Name | Status | Est. Tasks | Validated |
|---------|------|--------|------------|-----------|
| 01 | Research Security Hardening Delta | Complete | 18 | 2026-02-05 |
| 02 | SSRF Guards | Complete | 20 | 2026-02-06 |
| 03 | Download Timeouts and Path Traversal | Not Started | ~18 | - |
| 04 | Security Validation | Not Started | ~15 | - |

---

## Completed Sessions

### Session 01: Research Security Hardening Delta
- **Completed**: 2026-02-05
- **Tasks**: 18/18
- **Deliverable**: `.spec_system/PRD/phase_06/research/security-hardening-delta.md` (539 lines)
- **Key findings**: 70 fetch call sites inventoried, 5 need SSRF guards, fetch-guard.ts entirely missing, message-tool.ts sandbox regression identified, Grammy v1.39.3 supports AbortSignal natively

### Session 02: SSRF Guards
- **Completed**: 2026-02-06
- **Tasks**: 20/20
- **Deliverables**: `src/infra/net/fetch-guard.ts` (171 lines), `src/infra/net/fetch-guard.test.ts` (269 lines), `src/infra/net/ssrf.test.ts` (196 lines), plus modifications to `ssrf.ts`, `notifier-webhook.ts`, `skills-install.ts`, `media/fetch.ts`
- **Key outcomes**: Complete SSRF defense layer with DNS pinning, redirect validation, and guarded fetch wrapper integrated into all 3 unprotected call sites. 38 new tests added.

---

## Upcoming Sessions

- Session 03: Download Timeouts and Path Traversal

---

## Objectives

1. Block SSRF attacks on all remote URL fetches (IP/hostname blocking, DNS pinning, redirect validation)
2. Prevent DoS from slow or malicious file downloads via enforced timeouts
3. Block path traversal attempts in file operations with sandbox root validation

---

## Prerequisites

- Phase 05 completed (Upstream Build Tooling Port)
- Upstream reference codebase available in `.001_ORIGINAL/`
- Node 22+ runtime
- pnpm package manager

---

## Technical Considerations

### Architecture

The security hardening targets three distinct layers of crocbot's external interaction surface:

1. **Network layer (SSRF)**: All outbound HTTP fetches (media downloads, URL previews, plugin fetches) must validate the resolved IP address is not in private/reserved ranges and the hostname is not internal. This requires a guard layer that wraps `fetch()` calls.

2. **Telegram layer (Timeouts)**: Grammy's `getFile` and `downloadFile` operations currently have no timeout enforcement. Long-running downloads from Telegram servers can block the event loop. AbortSignal.timeout integration is needed.

3. **Filesystem layer (Path Traversal)**: Agent tool operations that write or read files must validate paths stay within the sandbox root. Upstream adds `realpath` + prefix validation.

### Technologies

- **Node.js `net` module** — IP address parsing and validation for SSRF checks
- **AbortSignal.timeout** — Native timeout enforcement (Node 22+)
- **Grammy API** — File download operations (`bot.api.getFile`, download helpers)
- **Vitest** — Unit tests for security guard functions

### Risks

- **False positives in SSRF**: Overly aggressive IP blocking may block legitimate private-network services (e.g., Docker-internal APIs). Mitigation: Session 01 research maps all outbound fetch call sites to identify which need guards.
- **Timeout tuning**: Too-short timeouts may fail on large legitimate Telegram file downloads. Mitigation: Use upstream's tested timeout values as baseline; make configurable.
- **Incomplete coverage**: Missing a fetch call site leaves a gap. Mitigation: Session 01 comprehensively inventories all outbound fetch operations.
- **Grammy API compatibility**: Timeout integration may interact with Grammy's internal retry logic. Mitigation: Research Grammy's AbortSignal support in Session 01.

### Relevant Considerations

- [P00] **Incremental verification**: Running build/lint/test after each security change catches regressions early.
- [P04] **Verbatim upstream port pattern**: Match upstream approach exactly first, then adapt for crocbot's architecture.
- [P00] **Reference tracing before deletion**: Grep for all fetch call sites before adding guards to ensure complete coverage.

---

## Success Criteria

Phase complete when:
- [ ] All 4 sessions completed
- [ ] SSRF guards block private IP ranges and internal hostnames on all outbound fetches
- [ ] DNS pinning prevents TOCTOU attacks on hostname resolution
- [ ] Redirect chains validated against SSRF bypass
- [ ] Telegram file downloads have enforced timeouts (AbortSignal.timeout)
- [ ] File path operations validate against sandbox root traversal
- [ ] All existing tests pass with no regressions
- [ ] New unit tests cover SSRF, timeout, and path traversal scenarios

---

## Dependencies

### Depends On
- Phase 05: Upstream Build Tooling Port (complete)

### Enables
- Future phases: Enhanced plugin security, content filtering, rate limiting
