# Session Specification

**Session ID**: `phase06-session02-ssrf-guards`
**Phase**: 06 - Upstream Security Hardening Port
**Status**: Not Started
**Created**: 2026-02-05

---

## 1. Session Overview

This session closes the SSRF (Server-Side Request Forgery) protection gap between crocbot and upstream OpenClaw. Crocbot already has the core IP-range and hostname-blocking primitives in `src/infra/net/ssrf.ts`, but it is missing the policy-based validation layer (`SsrFPolicy`, `resolvePinnedHostnameWithPolicy`) and the guarded fetch wrapper (`fetch-guard.ts`) that coordinates DNS pinning, redirect chain validation, and timeout enforcement into a single security boundary.

Without the guarded fetch wrapper, three outbound fetch call sites accept user-provided URLs with zero SSRF protection: the webhook alerting notifier (`src/alerting/notifier-webhook.ts`), the skills installer (`src/agents/skills-install.ts`), and the media fetcher (`src/media/fetch.ts`). An attacker who can influence these URLs could reach internal services, cloud metadata endpoints (169.254.169.254), or private network resources.

This session ports the missing ssrf.ts delta (policy types + `resolvePinnedHostnameWithPolicy` + `normalizeHostnameSet` helper), creates `fetch-guard.ts` verbatim from upstream, integrates the guarded wrapper into the three unprotected call sites, and writes comprehensive tests. The result is a complete SSRF defense layer that Sessions 03 and 04 build upon.

---

## 2. Objectives

1. Reach parity with upstream `ssrf.ts` by adding `SsrFPolicy`, `LookupFn` export, `normalizeHostnameSet()`, and `resolvePinnedHostnameWithPolicy()`
2. Port `src/infra/net/fetch-guard.ts` from upstream (guarded fetch with DNS pinning, redirect validation, timeout composition)
3. Integrate `fetchWithSsrFGuard` into the three unprotected fetch call sites (webhook notifier, skills installer, media fetch)
4. Achieve comprehensive unit test coverage for all SSRF validation paths and the guarded fetch wrapper

---

## 3. Prerequisites

### Required Sessions
- [x] `phase06-session01-research-security-hardening-delta` - Provides fetch call site inventory (70 sites, 5 needing guards, 3 unprotected), upstream delta analysis, file-by-file mapping

### Required Tools/Knowledge
- Upstream reference files: `.001_ORIGINAL/src/infra/net/ssrf.ts` (309 lines), `.001_ORIGINAL/src/infra/net/fetch-guard.ts` (172 lines)
- Research document: `.spec_system/PRD/phase_06/research/security-hardening-delta.md`
- Understanding of DNS pinning, TOCTOU attacks, and redirect-based SSRF bypass techniques

### Environment Requirements
- Node 22+ (for `AbortSignal.timeout()` support)
- undici (already a dependency - provides `Agent` and `Dispatcher` for pinned DNS)
- Vitest test framework

---

## 4. Scope

### In Scope (MVP)
- Add `SsrFPolicy` type, `LookupFn` export, `normalizeHostnameSet()`, and `resolvePinnedHostnameWithPolicy()` to `src/infra/net/ssrf.ts`
- Refactor existing `resolvePinnedHostname()` to delegate to `resolvePinnedHostnameWithPolicy()` (matching upstream)
- Create `src/infra/net/fetch-guard.ts` with `fetchWithSsrFGuard()`, redirect validation, timeout composition
- Integrate guarded fetch into `src/alerting/notifier-webhook.ts` (user-configurable webhook URL)
- Integrate guarded fetch into `src/agents/skills-install.ts` `downloadFile()` (user-provided archive URL)
- Integrate guarded fetch into `src/media/fetch.ts` `fetchRemoteMedia()` (user-provided media URL)
- Unit tests for `SsrFPolicy` / `resolvePinnedHostnameWithPolicy()` (allowed hostnames, allow private network)
- Unit tests for `fetchWithSsrFGuard()` (redirect validation, timeout, loop detection, protocol enforcement)
- Verify existing protected sites (`web-fetch.ts`, `input-files.ts`) still work correctly
- Build passes with zero errors, lint clean, existing tests pass

### Out of Scope (Deferred)
- Telegram download timeouts - *Reason: Session 03 scope*
- Path traversal fixes (message-tool.ts sandbox restoration) - *Reason: Session 03 scope*
- Rate limiting / request throttling - *Reason: Not in Phase 06 scope*
- Content-type validation - *Reason: Not in Phase 06 scope*
- Modifying already-protected call sites (web-fetch.ts, input-files.ts use pinned dispatchers) - *Reason: Already guarded*

---

## 5. Technical Approach

### Architecture

The SSRF defense is a two-layer system:

**Layer 1 - Validation (`ssrf.ts`)**: Pure functions for IP range checking, hostname blocking, and DNS pinning. The policy variant (`resolvePinnedHostnameWithPolicy`) adds opt-in allowlists for controlled exceptions (e.g., allowing specific hostnames or private networks when explicitly configured).

**Layer 2 - Orchestration (`fetch-guard.ts`)**: A guarded fetch wrapper that coordinates Layer 1 with HTTP semantics: resolve-then-pin DNS to prevent TOCTOU, intercept redirects and re-validate each hop, compose timeouts with external AbortSignals, and provide a `release()` callback for dispatcher cleanup.

Integration points replace bare `fetch()` calls with `fetchWithSsrFGuard()`, gaining SSRF protection, redirect validation, and timeout enforcement in a single change.

### Design Patterns
- **Verbatim upstream port**: Match upstream implementation exactly, then adapt only where crocbot architecture requires. Minimizes divergence per [P04] lesson.
- **Dependency injection**: `fetchImpl`, `lookupFn` parameters allow testing without real DNS/network.
- **Resource cleanup via release()**: Callers receive a `release()` function to close the pinned dispatcher, preventing resource leaks.

### Technology Stack
- TypeScript (strict mode, ESM, `.js` imports)
- Node.js `dns/promises` for DNS resolution
- `undici` `Agent`/`Dispatcher` for pinned HTTP connections
- `AbortController`/`AbortSignal` for timeout composition
- Vitest for testing

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/infra/net/fetch-guard.ts` | Guarded fetch wrapper with SSRF validation, redirect handling, timeout | ~172 |
| `src/infra/net/fetch-guard.test.ts` | Unit tests for guarded fetch (redirects, timeouts, loops, protocols) | ~200 |
| `src/infra/net/ssrf.test.ts` | Unit tests for policy-based resolution and new exports | ~150 |

### Files to Modify
| File | Changes | Est. Delta |
|------|---------|------------|
| `src/infra/net/ssrf.ts` | Export `LookupFn`, add `SsrFPolicy` type, `normalizeHostnameSet()`, `resolvePinnedHostnameWithPolicy()`, refactor `resolvePinnedHostname()` to delegate | ~+40 lines |
| `src/alerting/notifier-webhook.ts` | Replace bare `fetch()` with `fetchWithSsrFGuard()`, handle release() | ~+15 lines |
| `src/agents/skills-install.ts` | Replace bare `fetch()` in `downloadFile()` with `fetchWithSsrFGuard()` | ~+15 lines |
| `src/media/fetch.ts` | Replace bare `fetcher()` in `fetchRemoteMedia()` with `fetchWithSsrFGuard()` | ~+20 lines |

---

## 7. Success Criteria

### Functional Requirements
- [ ] Private IP ranges blocked: 10.x, 172.16-31.x, 192.168.x, 127.x, 0.x, 100.64-127.x
- [ ] IPv6 private ranges blocked: ::1, ::, fe80::/10, fec0::/10, fc00::/7
- [ ] IPv4-mapped IPv6 (::ffff:) detected and inner address validated
- [ ] Cloud metadata IP 169.254.169.254 blocked (direct and DNS-resolved)
- [ ] Internal hostnames blocked: localhost, *.localhost, *.local, *.internal, metadata.google.internal
- [ ] DNS pinning prevents resolution-time TOCTOU bypass
- [ ] Redirect chains re-validated at each hop (max 3 redirects default)
- [ ] Redirect loops detected and rejected
- [ ] Only http: and https: protocols allowed
- [ ] SsrFPolicy allowPrivateNetwork and allowedHostnames overrides work correctly
- [ ] All three unprotected call sites use guarded fetch
- [ ] Existing protected sites (web-fetch.ts, input-files.ts) unaffected

### Testing Requirements
- [ ] Unit tests for `resolvePinnedHostnameWithPolicy()` covering all policy combinations
- [ ] Unit tests for `fetchWithSsrFGuard()` covering redirect, timeout, loop, protocol scenarios
- [ ] Existing `ssrf.pinning.test.ts` passes unchanged
- [ ] All pre-existing tests pass with no regressions

### Quality Gates
- [ ] `pnpm build` succeeds with zero errors
- [ ] `pnpm lint` passes clean
- [ ] `pnpm test` passes (no new failures)
- [ ] All files ASCII-encoded, Unix LF line endings
- [ ] Code follows project conventions (CONVENTIONS.md)

---

## 8. Implementation Notes

### Key Considerations
- The upstream `ssrf.ts` diff is small: export `LookupFn` (change from `type` to `export type`), add `SsrFPolicy` type, add `normalizeHostnameSet()` helper, add `resolvePinnedHostnameWithPolicy()`, and refactor `resolvePinnedHostname()` to delegate to WithPolicy variant
- `fetch-guard.ts` can be ported verbatim from upstream -- it imports only from `./ssrf.js` and `undici`
- The three integration sites each have different timeout/abort patterns that must be preserved or composed with the guarded fetch's own timeout
- `WebhookNotifier` already manages its own `AbortController` -- this should be replaced by the guarded fetch's `timeoutMs` parameter
- `skills-install.ts` `downloadFile()` already has a timeout controller -- compose it via `signal` parameter
- `media/fetch.ts` `fetchRemoteMedia()` takes a `fetchImpl` parameter -- the integration replaces the internal fetch call, not the external API

### Potential Challenges
- **Redirect handling in media fetch**: `fetchRemoteMedia()` currently follows redirects via the default fetch behavior and reads `res.url` for the final URL. The guarded fetch uses `redirect: "manual"` so the integration must use `finalUrl` from the result instead of `res.url`.
- **Stream piping in skills-install**: `downloadFile()` pipes the response body to a file. The guarded fetch returns a response that must be consumed before `release()` is called.
- **Error type propagation**: Call sites catch errors and wrap them in domain-specific types (e.g., `MediaFetchError`). `SsrFBlockedError` must be caught and re-wrapped or allowed to propagate as appropriate.

### Relevant Considerations
- [P04] **Verbatim upstream port pattern**: Match upstream SSRF implementation closely first, then adapt only what crocbot's architecture requires. Minimizes divergence and simplifies future merges.
- [P00] **Reference tracing before deletion**: When integrating guarded fetch, verify the Session 01 call site inventory is still accurate by grepping for bare `fetch(` calls.
- [P00] **Incremental verification**: Run build/lint/test after each major integration point (ssrf.ts changes, fetch-guard.ts creation, each call site integration).

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests

**ssrf.test.ts** (new):
- `resolvePinnedHostnameWithPolicy()` with default policy (blocks private IPs, blocks hostnames)
- `resolvePinnedHostnameWithPolicy()` with `allowPrivateNetwork: true` (allows private IPs)
- `resolvePinnedHostnameWithPolicy()` with `allowedHostnames` containing a normally-blocked hostname
- `normalizeHostnameSet()` normalizes and deduplicates
- `LookupFn` export is accessible

**fetch-guard.test.ts** (new):
- Successful fetch through public hostname
- Blocks private IP in initial URL
- Blocks private IP after DNS resolution
- Redirect to private IP blocked at hop
- Redirect loop detection (URL visited twice)
- Max redirect limit enforcement
- Timeout fires and aborts request
- External AbortSignal composes with timeout
- Invalid protocol (ftp:, file:) rejected
- `release()` cleans up dispatcher
- `finalUrl` tracks through redirects

### Integration Tests
- Existing `ssrf.pinning.test.ts` passes unchanged (regression check)
- Build + lint + test full suite passes

### Manual Testing
- `pnpm build` produces clean output
- `pnpm lint` reports no new warnings
- `pnpm test` shows no new failures

### Edge Cases
- IPv4-mapped IPv6 addresses (e.g., `::ffff:127.0.0.1`) detected as private
- Bracket-wrapped IPv6 in URLs (e.g., `http://[::1]/`)
- Hostnames with trailing dots (e.g., `localhost.`)
- Empty/missing Location header on redirect response
- Redirect from https to http (protocol downgrade)
- DNS resolution returning zero results
- Concurrent abort from both timeout and external signal

---

## 10. Dependencies

### External Libraries
- `undici`: Already installed (provides `Agent`, `Dispatcher`)
- No new dependencies required

### Other Sessions
- **Depends on**: `phase06-session01-research-security-hardening-delta` (call site inventory, delta analysis)
- **Depended by**: `phase06-session03-download-timeouts-and-path-traversal` (builds on guarded fetch for timeout integration), `phase06-session04-security-validation` (validates all security measures)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
