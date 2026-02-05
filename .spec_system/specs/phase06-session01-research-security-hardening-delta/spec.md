# Session Specification

**Session ID**: `phase06-session01-research-security-hardening-delta`
**Phase**: 06 - Upstream Security Hardening Port
**Status**: Not Started
**Created**: 2026-02-05

---

## 1. Session Overview

This session performs a comprehensive delta analysis between upstream OpenClaw's security hardening infrastructure and crocbot's current security posture. The primary output is a research document that inventories every outbound HTTP call site in crocbot, analyzes the upstream SSRF guard, download timeout, and path traversal implementations, and produces a prioritized file-by-file implementation plan for Sessions 02-04.

This is the mandatory first session of Phase 06 and follows the proven research-first pattern established in Phase 03 (upstream features research) and Phase 05 (build tooling delta research). Both of those sessions successfully de-risked their respective phases by identifying adaptation points before any code was written. Without this research, Sessions 02-04 would lack the call site inventory needed for comprehensive SSRF coverage, the Grammy AbortSignal compatibility analysis needed for safe timeout integration, and the file mapping needed for path traversal fixes.

The session is entirely analytical -- no code changes, no dependency installations, no configuration modifications. It produces a single structured research document with inventories, delta tables, risk assessments, and a session-by-session implementation plan that serves as the source of truth for the remainder of Phase 06.

---

## 2. Objectives

1. Inventory all outbound `fetch()` and HTTP client call sites in crocbot `src/`, categorized by security boundary (core, plugins, Telegram, agents)
2. Produce a file-by-file delta analysis comparing upstream SSRF/timeout/path-traversal implementations against crocbot's current state, with adopt/reject/adapt decisions for each difference
3. Document Grammy SDK AbortSignal.timeout compatibility and identify any version-specific constraints for download timeout integration
4. Deliver a prioritized implementation plan mapping each security change to Sessions 02-04 with clear dependency ordering and risk assessment

---

## 3. Prerequisites

### Required Sessions
- [x] `phase05-session01-research-build-tooling-delta` - Build tooling research completed
- [x] `phase05-session02-tsdown-migration` - tsdown bundler in place
- [x] `phase05-session03-typescript-config-unification` - TypeScript ES2023 config aligned
- [x] `phase05-session04-stricter-linting-rules` - Stricter oxlint rules active
- [x] `phase05-session05-build-validation-ci-integration` - Build validation and CI integrated

### Required Tools/Knowledge
- Access to upstream OpenClaw codebase in `.001_ORIGINAL/`
- Understanding of SSRF attack vectors (IP range blocking, DNS rebinding, redirect chains)
- Familiarity with Node.js `net` module for IP address validation
- Knowledge of AbortSignal.timeout API (Node 22+ native)
- Understanding of path traversal attack patterns (CWE-22, CWE-59)

### Environment Requirements
- Node 22+ runtime available
- pnpm package manager installed
- Git repository with clean working tree (for accurate grep/search)
- `.001_ORIGINAL/` directory populated with upstream reference code

---

## 4. Scope

### In Scope (MVP)
- Inventory all outbound `fetch()`, `http.get()`, and HTTP client call sites in `src/`
- Analyze upstream `src/infra/net/ssrf.ts` (IP range blocking, hostname blocking, DNS pinning)
- Analyze upstream `src/infra/net/fetch-guard.ts` (SSRF-guarded fetch wrapper, redirect validation, timeout)
- Analyze upstream Telegram download timeout implementation
- Analyze upstream `src/agents/sandbox-paths.ts` path traversal prevention (realpath + symlink checks)
- Analyze upstream `src/agents/tools/message-tool.ts` sandbox path integration
- Compare crocbot's existing `src/infra/net/ssrf.ts` against upstream version
- Compare crocbot's existing `src/agents/sandbox-paths.ts` against upstream version
- Map upstream changes to crocbot file structure (file-by-file delta)
- Document Grammy AbortSignal.timeout compatibility for download operations
- Identify plugin/extension fetch call sites that need SSRF coverage
- Produce risk assessment for each security change
- Produce prioritized implementation plan for Sessions 02-04

### Out of Scope (Deferred)
- Actual implementation of SSRF guards - *Reason: Session 02*
- Actual implementation of download timeouts - *Reason: Session 03*
- Actual implementation of path traversal fixes - *Reason: Session 03*
- TLS 1.3 minimum enforcement - *Reason: Descoped (Coolify handles TLS termination)*
- Exec allowlist hardening - *Reason: Already implemented in crocbot*
- Security audit tooling (`src/security/audit.ts`) - *Reason: Not in Phase 06 scope*
- Windows ACL security fixes - *Reason: Linux-only deployment*

---

## 5. Technical Approach

### Architecture

This is a pure research session. The approach is systematic comparison across three security layers:

1. **Network layer (SSRF)**: Extract all outbound HTTP call sites from crocbot `src/`. Compare crocbot's `ssrf.ts` against upstream. Identify the missing `fetch-guard.ts` wrapper and analyze its integration requirements. Map which call sites need SSRF protection and which are already safe (e.g., calls to localhost APIs).

2. **Telegram layer (Timeouts)**: Analyze upstream download timeout patterns. Research Grammy SDK's support for AbortSignal in `getFile`/`downloadFile` operations. Document Node 22+ AbortSignal.timeout availability and any Grammy version constraints.

3. **Filesystem layer (Path Traversal)**: Compare crocbot's `sandbox-paths.ts` against upstream. Analyze the `assertSandboxPath` integration in `message-tool.ts`. Identify all file operation call sites that need sandbox validation.

### Design Patterns
- **Research-first**: Proven pattern from Phases 03 and 05 -- understand before acting
- **Structured comparison tables**: Each delta presented in tabular format for quick reference
- **Decision documentation**: Every difference gets an adopt/reject/adapt decision with rationale
- **Risk-based prioritization**: Implementation plan ordered by security impact and complexity

### Technology Stack
- ripgrep/grep for codebase analysis and call site discovery
- diff tooling for file-level comparison
- Markdown for research document output

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `.spec_system/PRD/phase_06/research/security-hardening-delta.md` | Primary research document with inventories, delta analysis, risk assessment, and implementation plan | ~400 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| None | This is a research-only session | 0 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] All outbound fetch/HTTP call sites in `src/` inventoried with file, line, and purpose
- [ ] Upstream `ssrf.ts` fully analyzed with function-by-function comparison to crocbot version
- [ ] Upstream `fetch-guard.ts` fully analyzed (this file is missing from crocbot)
- [ ] Upstream download timeout pattern documented with Grammy API integration points
- [ ] Upstream `sandbox-paths.ts` compared to crocbot version with delta table
- [ ] Upstream `message-tool.ts` sandbox integration analyzed
- [ ] Grammy AbortSignal.timeout compatibility documented with version requirements
- [ ] Plugin/extension fetch call sites identified and categorized
- [ ] Risk assessment produced for each security change (impact, complexity, regression risk)
- [ ] Implementation plan maps every change to Session 02, 03, or 04

### Testing Requirements
- [ ] Research document reviewed for completeness (all sections populated)
- [ ] Call site inventory verified against actual codebase (spot-check 5+ entries)
- [ ] File delta claims verified against actual file contents
- [ ] No placeholder or TBD entries in final document

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Research document uses consistent table formatting
- [ ] Every delta item has a decision (adopt/reject/adapt) with rationale
- [ ] Implementation plan has clear session assignment for every change

---

## 8. Implementation Notes

### Key Considerations
- crocbot already has `src/infra/net/ssrf.ts` with IP range blocking, hostname blocking, and DNS pinning -- but upstream may have added new ranges, new blocked hostnames, or new validation logic since the fork
- The critical missing piece is `src/infra/net/fetch-guard.ts` -- the high-level wrapper that coordinates SSRF validation with redirect handling and timeout enforcement. This file does not exist in crocbot and must be ported in Session 02
- crocbot already has `src/agents/sandbox-paths.ts` with `assertSandboxPath` and symlink checking -- research must determine if upstream added new validations or changed existing behavior
- Grammy's `bot.api.getFile` returns a File object; the actual download uses a URL. The timeout must wrap the download HTTP request, not the Grammy API call itself

### Potential Challenges
- **Upstream code may reference removed infrastructure**: Upstream SSRF implementation may assume multi-channel architecture or services crocbot removed during strip-down. Mitigation: Document each dependency and identify adaptation points.
- **Grammy version differences**: crocbot's Grammy version may differ from upstream. Mitigation: Check both `package.json` files and document version-specific API differences.
- **Hidden fetch call sites**: Some HTTP calls may be buried in utility functions or third-party wrappers. Mitigation: Search for multiple patterns (`fetch(`, `http.get(`, `http.request(`, `https.get(`, `axios`, `got`, `undici`).
- **Plugin security boundary**: Plugin fetch calls have a different trust model than core code. Mitigation: Document the security boundary distinction clearly.

### Relevant Considerations
- [P00] **Plugin system intact**: Plugin URL fetches need SSRF coverage. Research must inventory plugin-related call sites in `src/plugins/` and `src/plugin-sdk/` to ensure Session 02's SSRF guards cover the plugin execution boundary.
- [P04] **Verbatim upstream port pattern**: Apply this lesson -- analyze upstream approach exactly as-is first, document it faithfully, then identify only the minimum adaptation points required by crocbot's stripped-down architecture. Do not pre-optimize or redesign.
- [P00] **Telegram-only channel registry**: Simplifies scope -- only Telegram download paths need timeout analysis, not multi-channel download infrastructure. This reduces the call site inventory surface area significantly.
- [P00] **Incremental verification**: The research-first approach follows the proven pattern of understanding before acting. This entire session is the "understand" step for Phase 06.

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- N/A -- this is a research session producing documentation only

### Integration Tests
- N/A -- no code changes

### Manual Testing
- Verify outbound fetch call site inventory by re-running documented grep/ripgrep commands and confirming counts match
- Spot-check 5+ call site entries against actual source files (file exists, line number correct, purpose accurate)
- Verify upstream file references exist in `.001_ORIGINAL/` and match quoted content
- Confirm crocbot file references exist and match described current state
- Verify Grammy version in `package.json` matches version documented in research

### Edge Cases
- Fetch calls inside dynamically-loaded plugin code may not appear in static grep analysis -- document this limitation
- Some call sites may use `globalThis.fetch` or destructured `fetch` -- search patterns must account for aliasing
- Upstream `ssrf.ts` may contain IPv6 ranges that crocbot's network environment never encounters -- document but still port for defense-in-depth

---

## 10. Dependencies

### External Libraries
- None -- research session only, no new dependencies

### Other Sessions
- **Depends on**: Phase 05 completion (all 5 sessions validated)
- **Depended by**: `phase06-session02-ssrf-guards` (consumes call site inventory, SSRF delta analysis, fetch-guard.ts analysis), `phase06-session03-download-timeouts-and-path-traversal` (consumes timeout analysis, Grammy compatibility research, path traversal delta), `phase06-session04-security-validation` (consumes full implementation plan for validation checklist)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
