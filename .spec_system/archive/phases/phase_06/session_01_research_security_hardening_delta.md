# Session 01: Research Security Hardening Delta

**Session ID**: `phase06-session01-research-security-hardening-delta`
**Status**: Not Started
**Estimated Tasks**: ~15
**Estimated Duration**: 2-3 hours

---

## Objective

Perform comprehensive delta analysis between upstream OpenClaw security hardening and crocbot's current security posture. Identify all fetch call sites, map upstream SSRF/timeout/path-traversal implementations, and produce a prioritized implementation plan for Sessions 02-04.

---

## Scope

### In Scope (MVP)
- Inventory all outbound `fetch()` and HTTP call sites in crocbot `src/`
- Analyze upstream SSRF guard implementation (`src/infra/net/ssrf.ts`, `src/infra/net/fetch-guard.ts`)
- Analyze upstream Telegram download timeout implementation (`src/telegram/download.ts`)
- Analyze upstream path traversal fix (`src/agents/tools/message-tool.ts`)
- Map upstream changes to crocbot file structure (file-by-file delta)
- Identify architectural differences that require adaptation
- Document Grammy AbortSignal.timeout compatibility
- Produce research document with implementation plan

### Out of Scope
- Actual implementation of SSRF guards (Session 02)
- Actual implementation of timeouts (Session 03)
- Actual implementation of path traversal fixes (Session 03)
- TLS 1.3 minimum (descoped — Coolify handles TLS)
- Exec allowlist hardening (already implemented in crocbot)

---

## Prerequisites

- [ ] Phase 05 completed
- [ ] Upstream reference codebase available in `.001_ORIGINAL/`

---

## Deliverables

1. Research document: `.spec_system/PRD/phase_06/research/security-hardening-delta.md`
2. Inventory of all outbound fetch call sites in crocbot
3. File-by-file delta analysis (upstream vs crocbot)
4. Prioritized implementation plan for Sessions 02-04
5. Risk assessment for each security change

---

## Success Criteria

- [ ] All outbound fetch/HTTP call sites inventoried
- [ ] Upstream SSRF implementation fully analyzed
- [ ] Upstream timeout implementation fully analyzed
- [ ] Upstream path traversal fix fully analyzed
- [ ] Implementation plan produced with clear file mapping
- [ ] Risks and adaptation needs documented
