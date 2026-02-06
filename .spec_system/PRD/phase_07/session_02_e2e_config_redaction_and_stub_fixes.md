# Session 02: E2E Config Redaction and Stub Response Fixes

**Session ID**: `phase07-session02-e2e-config-redaction-and-stub-fixes`
**Status**: Not Started
**Estimated Tasks**: ~20
**Estimated Duration**: 2-4 hours

---

## Objective

Fix all E2E test failures caused by config redaction changes and node stub response changes, the two most common root causes identified in Session 01.

---

## Scope

### In Scope (MVP)
- Update tests that assert on plaintext token values to expect `[REDACTED]` or use non-sensitive config fields
- Update tests that expect `FEATURE_DISABLED_ERROR` rejection to expect `{ ok: true, ignored: true }` response
- Fix any shared test fixtures or helpers that reference pre-redaction behavior
- Ensure each fixed test passes individually and as part of the full suite
- Maintain test intent -- tests should still validate the same behavior, just with updated expectations

### Out of Scope
- Auth drift failures (Session 03)
- Adding new test coverage
- Modifying production code to accommodate tests

---

## Prerequisites

- [ ] Session 01 audit complete with per-file classification
- [ ] Root cause categories confirmed: config redaction and node stub response changes

---

## Deliverables

1. All config-redaction-related E2E test failures fixed
2. All node-stub-response-related E2E test failures fixed
3. Updated shared fixtures/helpers if applicable
4. Test run output showing reduced failure count

---

## Success Criteria

- [ ] All config-redaction E2E failures resolved (0 remaining in this category)
- [ ] All node-stub-response E2E failures resolved (0 remaining in this category)
- [ ] No new test failures introduced
- [ ] Unit test suite still green
- [ ] Each fix preserves the original test intent
