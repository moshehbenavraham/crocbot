# Session 01: E2E Test Audit and Triage

**Session ID**: `phase07-session01-e2e-test-audit-and-triage`
**Status**: Not Started
**Estimated Tasks**: ~15
**Estimated Duration**: 2-4 hours

---

## Objective

Perform a comprehensive audit of all 18 failing E2E tests, classify each failure by root cause, document the fix strategy per file, and establish a prioritized remediation plan for Sessions 02-03.

---

## Scope

### In Scope (MVP)
- Run full E2E test suite and capture current failure output
- Classify each of the 18 failures into root cause categories (config redaction, node stub response, auth drift, other)
- Document the specific assertion or expectation that fails in each test
- Identify any additional failures beyond the known 18
- Map test file dependencies and shared fixtures
- Create a prioritized fix plan assigning failures to Session 02 (redaction/stub) and Session 03 (auth/remaining)
- Identify the 2 skipped tests and determine if they should be unskipped or removed

### Out of Scope
- Actually fixing any tests (that's Sessions 02-03)
- Adding new E2E tests
- Modifying production code

---

## Prerequisites

- [ ] Phase 06 complete (all security hardening in place)
- [ ] Node 22+ available for running tests
- [ ] All unit tests still passing (baseline check)

---

## Deliverables

1. E2E failure audit document with per-file classification
2. Shared fixture dependency map
3. Prioritized remediation plan for Sessions 02-03
4. Baseline test run output (saved for comparison)

---

## Success Criteria

- [ ] All 18+ failing E2E tests classified by root cause
- [ ] Fix strategy documented for each failure
- [ ] Session 02 and 03 scope clearly defined based on audit findings
- [ ] Unit test suite confirmed still green (0 failures)
- [ ] 2 skipped tests evaluated with recommendation (fix, remove, or keep skipped with justification)
