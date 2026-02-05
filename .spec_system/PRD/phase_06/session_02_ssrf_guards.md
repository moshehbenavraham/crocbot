# Session 02: SSRF Guards

**Session ID**: `phase06-session02-ssrf-guards`
**Status**: Not Started
**Estimated Tasks**: ~20
**Estimated Duration**: 3-4 hours

---

## Objective

Implement comprehensive SSRF protection for all outbound HTTP fetches in crocbot, preventing server-side request forgery attacks that could access internal services, cloud metadata endpoints, or private network resources.

---

## Scope

### In Scope (MVP)
- Create `src/infra/net/ssrf.ts` — IP address validation (block private/reserved/loopback/link-local ranges)
- Create `src/infra/net/fetch-guard.ts` — Guarded fetch wrapper with DNS pinning and redirect validation
- Integrate SSRF guards into media fetch operations (`src/media/fetch.ts`)
- Integrate SSRF guards into plugin/extension URL fetches
- Block internal hostnames (localhost, .local, .internal, cloud metadata IPs)
- DNS pinning to prevent TOCTOU (time-of-check-time-of-use) bypass
- Redirect chain validation (each hop re-validated against SSRF rules)
- Unit tests for SSRF guard functions
- Unit tests for guarded fetch wrapper

### Out of Scope
- Telegram download timeouts (Session 03)
- Path traversal fixes (Session 03)
- Rate limiting or request throttling
- Content-type validation

---

## Prerequisites

- [ ] Session 01 research completed (fetch call site inventory, upstream delta analysis)

---

## Deliverables

1. `src/infra/net/ssrf.ts` — SSRF validation functions
2. `src/infra/net/fetch-guard.ts` — Guarded fetch wrapper
3. Integration into all identified fetch call sites
4. Unit test suite for SSRF protection
5. Build passes with zero errors/warnings

---

## Success Criteria

- [ ] Private IP ranges blocked (10.x, 172.16-31.x, 192.168.x, 127.x, ::1, fe80::)
- [ ] Cloud metadata IPs blocked (169.254.169.254)
- [ ] Internal hostnames blocked (localhost, *.local, *.internal)
- [ ] DNS pinning prevents resolution-time bypass
- [ ] Redirect chains re-validated at each hop
- [ ] All identified fetch call sites use guarded fetch
- [ ] Unit tests cover all blocked ranges and bypass attempts
- [ ] Existing tests pass with no regressions
