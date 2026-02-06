# Session 03: E2E Auth Drift and Remaining Failures

**Session ID**: `phase07-session03-e2e-auth-drift-and-remaining-failures`
**Status**: Not Started
**Estimated Tasks**: ~18
**Estimated Duration**: 2-4 hours

---

## Objective

Fix all remaining E2E test failures (auth/connection drift and any edge cases not covered in Session 02), resolve the 2 skipped tests, and achieve a fully green E2E test suite.

---

## Scope

### In Scope (MVP)
- Fix E2E tests with stale auth token expectations
- Fix E2E tests with outdated connection/handshake patterns
- Resolve any failures uncovered during Session 01 triage beyond the original 18
- Address the 2 skipped tests (unskip and fix, or remove with documented justification)
- Run the complete E2E suite and confirm 0 failures
- Document any tests that required significant behavioral changes vs. simple expectation updates

### Out of Scope
- Config redaction and stub response fixes (completed in Session 02)
- New E2E test coverage (deferred to Session 05 if needed)
- Production code changes

---

## Prerequisites

- [ ] Session 02 complete (config redaction and stub response failures fixed)
- [ ] Remaining failure list refined from Session 01 audit

---

## Deliverables

1. All auth-drift E2E test failures fixed
2. All remaining/edge-case E2E failures fixed
3. 2 skipped tests resolved (fixed or removed with justification)
4. Complete green E2E test run output

---

## Success Criteria

- [ ] E2E test suite: 0 failures, 0 unjustified skips
- [ ] Unit test suite still green
- [ ] Full test run (`pnpm test` + `pnpm test:e2e`) completes successfully
- [ ] No production code modified to accommodate test fixes
