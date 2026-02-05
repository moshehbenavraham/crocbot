# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-02-05
**Project State**: Phase 06 - Upstream Security Hardening Port
**Completed Sessions**: 29

---

## Recommended Next Session

**Session ID**: `phase06-session01-research-security-hardening-delta`
**Session Name**: Research Security Hardening Delta
**Estimated Duration**: 2-3 hours
**Estimated Tasks**: ~15

---

## Why This Session Next?

### Prerequisites Met
- [x] Phase 05 completed (all 5 sessions validated and completed)
- [x] Upstream reference codebase available in `.001_ORIGINAL/`

### Dependencies
- **Builds on**: Phase 05 (build tooling now modernized with tsdown, stricter linting)
- **Enables**: Sessions 02-04 (SSRF guards, download timeouts, path traversal, validation)

### Project Progression
This is the natural first session of Phase 06 — a research session that inventories all outbound fetch call sites, analyzes upstream SSRF/timeout/path-traversal implementations, and produces a prioritized implementation plan for the remaining security sessions. This follows the proven "research first, then implement" pattern used successfully in Phase 03 (session 01) and Phase 05 (session 01). Without this research, Sessions 02-04 would lack the file-by-file delta analysis and call site inventory needed for comprehensive security hardening.

---

## Session Overview

### Objective
Perform comprehensive delta analysis between upstream OpenClaw security hardening and crocbot's current security posture to produce an actionable implementation plan for Sessions 02-04.

### Key Deliverables
1. Research document: `.spec_system/PRD/phase_06/research/security-hardening-delta.md`
2. Inventory of all outbound `fetch()` and HTTP call sites in crocbot `src/`
3. File-by-file delta analysis (upstream SSRF/timeout/traversal vs crocbot)
4. Prioritized implementation plan for Sessions 02-04
5. Risk assessment for each security change

### Scope Summary
- **In Scope (MVP)**: Inventory all outbound HTTP call sites, analyze upstream SSRF guard implementation, analyze upstream Telegram download timeout implementation, analyze upstream path traversal fix, map upstream changes to crocbot file structure, document Grammy AbortSignal.timeout compatibility
- **Out of Scope**: Actual implementation of SSRF guards (Session 02), timeouts (Session 03), path traversal fixes (Session 03), TLS 1.3 (descoped), exec allowlist (already implemented)

---

## Technical Considerations

### Technologies/Patterns
- SSRF validation: IP range blocking, hostname blocking, DNS pinning, redirect chain validation
- AbortSignal.timeout for download operations (Node 22+ native)
- Path traversal prevention via `realpath` + prefix checking
- Upstream reference files in `.001_ORIGINAL/src/infra/net/`, `.001_ORIGINAL/src/telegram/`, `.001_ORIGINAL/src/agents/tools/`

### Potential Challenges
- Upstream SSRF implementation may assume infrastructure crocbot removed during strip-down
- Grammy SDK version differences may affect AbortSignal compatibility
- Some fetch call sites may be in plugin/extension code with different security boundaries

### Relevant Considerations
- [P00] **Plugin system intact**: Plugin URL fetches need SSRF coverage — research must inventory these call sites
- [P04] **Verbatim upstream port pattern**: Apply this lesson — analyze upstream approach first, then identify adaptation points
- [P00] **Telegram-only channel registry**: Simplifies scope — only need to analyze Telegram download paths, not multi-channel

---

## Alternative Sessions

If this session is blocked:
1. **phase06-session02-ssrf-guards** - Could proceed if the fetch call site inventory is done inline, but risks missing call sites without dedicated research
2. **phase06-session03-download-timeouts-and-path-traversal** - Independent from SSRF but requires Session 01 research on Grammy AbortSignal compatibility

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
