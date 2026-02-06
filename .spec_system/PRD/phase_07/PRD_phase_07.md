# PRD Phase 07: Test Suite Stabilization and CI Restoration

**Status**: Not Started
**Sessions**: 5 (initial estimate)
**Estimated Duration**: 3-5 days

**Progress**: 0/5 sessions (0%)

---

## Overview

Phase 07 stabilizes the test suite and restores continuous integration. The 18 pre-existing E2E test failures (accumulated across Phases 00-06) undermine confidence in regression detection, while the GitHub Actions billing blocker prevents any automated quality gates from running. This phase fixes all E2E failures, adds missing integration test coverage for recent security work, resolves CI pipeline blockers, and addresses transitive dependency vulnerabilities -- establishing a fully green, fully automated quality baseline for future development.

---

## Progress Tracker

| Session | Name | Status | Est. Tasks | Validated |
|---------|------|--------|------------|-----------|
| 01 | E2E Test Audit and Triage | Not Started | ~15 | - |
| 02 | E2E Config Redaction and Stub Response Fixes | Not Started | ~20 | - |
| 03 | E2E Auth Drift and Remaining Failures | Not Started | ~18 | - |
| 04 | CI Pipeline Restoration | Not Started | ~15 | - |
| 05 | Test Suite Validation and Green Baseline | Not Started | ~15 | - |

---

## Completed Sessions

[None yet]

---

## Upcoming Sessions

- Session 01: E2E Test Audit and Triage

---

## Objectives

1. Achieve 100% E2E test pass rate (0 failures, 0 skips without justification)
2. Restore all GitHub Actions CI pipelines to operational status
3. Resolve or mitigate transitive dependency vulnerabilities
4. Establish a green baseline that gates all future work

---

## Prerequisites

- Phase 06 completed (security hardening in place)
- Access to GitHub billing settings for CI restoration (Session 04)

---

## Technical Considerations

### Architecture
- E2E tests exercise the full gateway server stack (`src/gateway/`) and auto-reply pipeline (`src/auto-reply/`)
- Tests use Vitest with V8 coverage; E2E tests are in `*.e2e.test.ts` files
- Config redaction was added in Phase 00/01, changing `config.get` return values for sensitive fields
- Node stub responses changed from `FEATURE_DISABLED_ERROR` rejection to `{ ok: true, ignored: true }` acceptance

### Technologies
- Vitest (test framework)
- GitHub Actions (CI platform)
- CodeQL v4 (security scanning)
- pnpm audit (dependency vulnerability scanning)

### Risks
- **GitHub billing resolution**: CI restoration requires account billing fix, which is external to codebase work. Mitigation: Session 04 documents the steps; if billing cannot be fixed, session focuses on local CI validation scripts as a stopgap.
- **Test fixture coupling**: Some E2E tests may have deeper coupling to removed features than the 3 known root causes suggest. Mitigation: Session 01 performs comprehensive triage before any fixes.
- **Transitive dependency vulnerabilities**: Fixes may require pnpm overrides or waiting for upstream patches. Mitigation: Document each vulnerability with status and timeline.

### Relevant Considerations
- [P00] **18 pre-existing E2E test failures**: Three root causes identified -- config redaction, node stub response changes, auth/connection drift. This phase resolves all 18.
- [P05] **GitHub Actions billing blocker**: All workflows fail. This phase addresses CI restoration.
- [P06] **npm audit vulnerabilities**: 7 transitive dep vulnerabilities. This phase triages and mitigates where possible.
- [P06] **Layered security testing**: Phase 06 added 43 integration tests. This phase ensures the full E2E suite also validates security behavior end-to-end.

---

## Success Criteria

Phase complete when:
- [ ] All 5 sessions completed
- [ ] E2E test suite: 0 failures (all 18 pre-existing failures resolved)
- [ ] Unit test suite: 0 failures (maintained from current green state)
- [ ] CI pipelines: All 5 bundles (Quality, Build&Test, Security, Integration, Operations) pass or have documented exceptions
- [ ] Dependency audit: All high-severity vulnerabilities resolved or documented with mitigation plan
- [ ] CodeQL: Enabled and passing (or documented blocker)

---

## Dependencies

### Depends On
- Phase 06: Upstream Security Hardening Port (complete)

### Enables
- Future feature development with confidence in regression detection
- Plugin security hardening (reliable tests to validate changes)
- Any future upstream sync phases
