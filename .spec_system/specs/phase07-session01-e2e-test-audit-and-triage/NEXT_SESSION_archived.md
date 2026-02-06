# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-02-06
**Project State**: Phase 07 - Test Suite Stabilization and CI Restoration
**Completed Sessions**: 33

---

## Recommended Next Session

**Session ID**: `phase07-session01-e2e-test-audit-and-triage`
**Session Name**: E2E Test Audit and Triage
**Estimated Duration**: 2-4 hours
**Estimated Tasks**: ~15

---

## Why This Session Next?

### Prerequisites Met
- [x] Phase 06 (Upstream Security Hardening Port) complete — all 4 sessions validated
- [x] Node 22+ available for running tests
- [x] Unit test suite green (3946/3946 passing as of Phase 06)

### Dependencies
- **Builds on**: Phase 06 Session 04 (Security Validation) — the last completed session, which confirmed 3946 unit tests passing and 43 security integration tests green
- **Enables**: Sessions 02-03 (E2E fixes) — the audit produces the classification and prioritized fix plan that drives the next two sessions

### Project Progression
This is the first session of Phase 07 and the natural entry point. The project has 18 pre-existing E2E test failures accumulated across Phases 00-06 that have been tracked as technical debt since Phase 00. These failures undermine regression confidence and must be triaged before they can be fixed. Session 01 is a research/audit session that classifies each failure by root cause (config redaction, node stub response changes, auth/connection drift) and creates the remediation plan that Sessions 02-03 will execute. Attempting to fix tests without this triage would risk incomplete or misdirected fixes.

---

## Session Overview

### Objective
Perform a comprehensive audit of all 18 failing E2E tests, classify each by root cause, and produce a prioritized remediation plan for Sessions 02-03.

### Key Deliverables
1. E2E failure audit document with per-file root cause classification
2. Shared fixture dependency map identifying coupling between test files
3. Prioritized remediation plan assigning failures to Session 02 (redaction/stub) and Session 03 (auth/remaining)
4. Baseline test run output saved for before/after comparison

### Scope Summary
- **In Scope (MVP)**: Run full E2E suite, classify all 18 failures, evaluate 2 skipped tests, create fix plan
- **Out of Scope**: Actually fixing tests (Sessions 02-03), adding new tests, modifying production code

---

## Technical Considerations

### Technologies/Patterns
- Vitest E2E test runner with V8 coverage
- E2E tests in `*.e2e.test.ts` files (primarily `src/gateway/` and `src/auto-reply/`)
- Config redaction system (added in Phase 00/01)
- Node stub response patterns

### Potential Challenges
- Some failures may have root causes beyond the 3 known categories — the audit must discover any additional patterns
- Test fixture coupling may be deeper than expected, requiring dependency mapping before fixes
- The 2 skipped tests may reveal additional architectural issues

### Relevant Considerations
- [P00] **18 pre-existing E2E test failures**: Three root causes identified — config redaction, node stub response changes, auth/connection drift. This session classifies all 18 and any new failures.
- [P00] **Test coupling to fixtures**: Tests may have indirect dependencies on removed features through shared fixtures. The fixture dependency map in this session will expose these.
- [P06] **Layered security testing**: 43 integration tests added in Phase 06 must remain green — audit should verify these are not affected by E2E fixture issues.

---

## Alternative Sessions

If this session is blocked:
1. **phase07-session04-ci-pipeline-restoration** — If the billing blocker is the highest priority, CI restoration can proceed independently (though E2E tests won't be green yet)
2. **phase07-session02-e2e-config-redaction-and-stub-fixes** — If the root causes are already well-understood from known-issues.md, fixes could start directly (higher risk of incomplete coverage)

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
