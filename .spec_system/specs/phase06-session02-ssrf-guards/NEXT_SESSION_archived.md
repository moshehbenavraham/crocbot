# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-02-05
**Project State**: Phase 06 - Upstream Security Hardening Port
**Completed Sessions**: 30

---

## Recommended Next Session

**Session ID**: `phase06-session02-ssrf-guards`
**Session Name**: SSRF Guards
**Estimated Duration**: 3-4 hours
**Estimated Tasks**: ~20

---

## Why This Session Next?

### Prerequisites Met
- [x] Session 01 research completed (fetch call site inventory, upstream delta analysis)
- [x] Phase 05 build tooling port completed (tsdown, stricter linting, unified tsconfig)

### Dependencies
- **Builds on**: `phase06-session01-research-security-hardening-delta` (provides fetch call site inventory, upstream SSRF implementation analysis, and file-by-file delta mapping)
- **Enables**: `phase06-session03-download-timeouts-and-path-traversal` (Session 03 requires SSRF guards to be in place before adding timeout and path traversal protections)

### Project Progression
This is the natural next step in the Phase 06 security hardening sequence. The research session (01) inventoried all outbound fetch call sites and analyzed the upstream SSRF implementation. Session 02 takes that research and implements the actual SSRF protection layer — the foundational security primitive that Sessions 03 and 04 build upon. SSRF guards must exist before download timeouts (Session 03) can be layered on top, since the guarded fetch wrapper is the integration point for both protections.

---

## Session Overview

### Objective
Implement comprehensive SSRF protection for all outbound HTTP fetches in crocbot, preventing server-side request forgery attacks that could access internal services, cloud metadata endpoints, or private network resources.

### Key Deliverables
1. `src/infra/net/ssrf.ts` — IP address validation (block private/reserved/loopback/link-local ranges)
2. `src/infra/net/fetch-guard.ts` — Guarded fetch wrapper with DNS pinning and redirect validation
3. Integration into all identified fetch call sites (media fetch, plugin/extension URL fetches)
4. Unit test suite covering all blocked ranges and bypass attempts

### Scope Summary
- **In Scope (MVP)**: SSRF IP validation, hostname blocking (localhost, .local, .internal, cloud metadata), DNS pinning to prevent TOCTOU bypass, redirect chain validation, guarded fetch wrapper, integration into media and plugin fetch paths, unit tests
- **Out of Scope**: Telegram download timeouts (Session 03), path traversal fixes (Session 03), rate limiting, content-type validation

---

## Technical Considerations

### Technologies/Patterns
- Node.js `dns.lookup()` for DNS pinning (resolve hostname once, connect to resolved IP)
- `net.isIP()` / IP range matching for private range detection
- Fetch API `AbortController` integration for the guarded wrapper
- Upstream reference: `.001_ORIGINAL/src/infra/net/ssrf.ts` and `fetch-guard.ts`

### Potential Challenges
- DNS pinning must handle both IPv4 and IPv6 addresses correctly
- Redirect validation needs to intercept each hop without breaking streaming responses
- Plugin fetch paths may use different HTTP clients — need to identify all call sites from research
- Cloud metadata IP (169.254.169.254) detection must handle both direct IP and DNS-resolved forms

### Relevant Considerations
- [P04] **Verbatim upstream port pattern**: Match the upstream SSRF implementation closely first, then adapt only what crocbot's architecture requires. Minimizes divergence.
- [P00] **Reference tracing before deletion**: When integrating guarded fetch, grep for all existing fetch call sites to ensure complete coverage. The research document from Session 01 provides the initial inventory.
- [P00] **Incremental verification**: Run build/lint/test after each major integration point to catch issues early.

---

## Alternative Sessions

If this session is blocked:
1. **phase06-session03-download-timeouts-and-path-traversal** — Could implement path traversal fixes independently (they don't depend on SSRF), but download timeouts do depend on the guarded fetch wrapper. Would require splitting Session 03.
2. **phase06-session04-security-validation** — Cannot proceed without implementation sessions (02 and 03) completed first.

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
