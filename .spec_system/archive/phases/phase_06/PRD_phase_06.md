# PRD Phase 06: Upstream Security Hardening Port

**Status**: Complete
**Sessions**: 4
**Completed**: 2026-02-06

**Progress**: 4/4 sessions (100%)

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
| 03 | Download Timeouts and Path Traversal | Complete | 20 | 2026-02-06 |
| 04 | Security Validation | Complete | 20 | 2026-02-06 |

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

### Session 03: Download Timeouts and Path Traversal
- **Completed**: 2026-02-06
- **Tasks**: 20/20
- **Deliverables**: `assertMediaPath()` guard in `src/media/store.ts`, `AbortSignal.timeout()` on both Telegram download functions, `downloadToFile` timeout via `setTimeout`+`req.destroy()`, path traversal validation on `saveMediaBuffer`/`saveMediaSource`, 14 new tests across `download.test.ts` and `store.test.ts`
- **Key outcomes**: All Telegram download operations now abort on timeout (30s metadata, 60s content). Media store rejects path traversal attempts. All 5 agent tool files audited and confirmed already guarded. `originalFilename` pass-through for upstream parity.

### Session 04: Security Validation
- **Completed**: 2026-02-06
- **Tasks**: 20/20
- **Deliverables**: `src/infra/net/security-integration.test.ts` (309 lines), `src/media/security-integration.test.ts` (202 lines), `security-audit.md` (129 lines), plus CHANGELOG.md update
- **Key outcomes**: 43 integration tests (29 SSRF + 14 media security) validating all Phase 06 security measures end-to-end. Security bypass audit completed with no critical findings. Full test suite passes (3946 tests, 0 failures). Build, lint, and Docker all clean.

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
- [x] All 4 sessions completed
- [x] SSRF guards block private IP ranges and internal hostnames on all outbound fetches
- [x] DNS pinning prevents TOCTOU attacks on hostname resolution
- [x] Redirect chains validated against SSRF bypass
- [x] Telegram file downloads have enforced timeouts (AbortSignal.timeout)
- [x] File path operations validate against sandbox root traversal
- [x] All existing tests pass with no regressions
- [x] New unit tests cover SSRF, timeout, and path traversal scenarios

---

## Dependencies

### Depends On
- Phase 05: Upstream Build Tooling Port (complete)

### Enables
- Future phases: Enhanced plugin security, content filtering, rate limiting
