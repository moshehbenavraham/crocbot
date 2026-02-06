# Session Specification

**Session ID**: `phase07-session01-e2e-test-audit-and-triage`
**Phase**: 07 - Test Suite Stabilization and CI Restoration
**Status**: Not Started
**Created**: 2026-02-06

---

## 1. Session Overview

This session performs a comprehensive audit and triage of all 18 pre-existing E2E test failures that have accumulated across Phases 00-06. The project's unit test suite is fully green (3946/3946 passing), but the E2E suite has 18 failures and 2 skipped tests that undermine regression confidence. Before any fixes can be made, the exact root cause, failing assertion, and fix strategy for each failure must be documented.

The audit will run the full E2E suite, capture baseline output, classify each failure into root cause categories (config redaction, node stub response changes, auth/connection drift, or newly discovered categories), map shared fixture dependencies between test files, and produce a prioritized remediation plan. This plan will assign failures to Session 02 (config redaction and stub response fixes -- the simpler, mechanical fixes) and Session 03 (auth drift and remaining complex failures).

This is a research/audit session only -- no production code or test code will be modified. The deliverables are documentation artifacts that drive the next two sessions. Attempting to fix tests without this triage would risk incomplete or misdirected fixes, especially given potential fixture coupling between test files.

---

## 2. Objectives

1. Run the full E2E test suite and capture a baseline failure report with exact error messages, stack traces, and assertion details for all failures
2. Classify all 18+ failures by root cause category (config redaction, node stub response, auth/connection drift, or other) with per-file documentation
3. Map shared fixture and test utility dependencies across all E2E test files to identify coupling risks
4. Produce a prioritized remediation plan that clearly scopes Session 02 (redaction/stub) and Session 03 (auth/remaining)

---

## 3. Prerequisites

### Required Sessions
- [x] `phase06-session04-security-validation` - Phase 06 complete; all security hardening in place, 3946 unit tests and 43 security integration tests passing

### Required Tools/Knowledge
- Vitest E2E test runner configuration (`vitest.e2e.config.ts`)
- Understanding of config redaction system (added Phase 00/01)
- Understanding of node stub response patterns (`{ ok: true, ignored: true }` vs `FEATURE_DISABLED_ERROR`)
- Gateway server architecture (`src/gateway/`)
- Auto-reply pipeline architecture (`src/auto-reply/`)

### Environment Requirements
- Node 22+ (`~/.nvm/versions/node/v22.22.0/bin/node`)
- pnpm (`~/.local/bin/pnpm`)
- PATH must include node bin dir for running test commands

---

## 4. Scope

### In Scope (MVP)
- Run full E2E test suite (`pnpm test:e2e`) and save raw output
- Classify each of the 18 known failures by root cause with specific assertion details
- Identify any additional failures beyond the known 18
- Evaluate the 2 skipped tests (determine: fix, remove, or keep skipped with justification)
- Map test file dependencies on shared fixtures and test utilities
- Verify Phase 06 security integration tests (43 tests) are unaffected by E2E fixture issues
- Create per-file audit entries documenting: test name, file path, error message, root cause category, and recommended fix strategy
- Create prioritized remediation plan assigning failures to Session 02 and Session 03
- Confirm unit test suite remains green (0 failures)

### Out of Scope (Deferred)
- Fixing any test failures - *Reason: Sessions 02-03 handle fixes; audit must complete first*
- Adding new E2E tests - *Reason: Not part of audit scope*
- Modifying production code - *Reason: This is a read-only audit session*
- CI pipeline restoration - *Reason: Session 04 handles CI; independent of E2E audit*
- Dependency vulnerability remediation - *Reason: Tracked separately in Phase 07 scope*

---

## 5. Technical Approach

### Architecture
The E2E tests exercise two primary subsystems:
1. **Gateway server** (`src/gateway/`): HTTP server tests covering config, auth, health, sessions, models, hooks, agents, channels, cron, and OpenAI/OpenResponses compatibility
2. **Auto-reply pipeline** (`src/auto-reply/`): Trigger handling and directive behavior tests covering message routing, model selection, elevated mode, and status reporting

Tests run under Vitest with the `forks` pool (max 4 local workers), using `test/setup.ts` as the setup file. E2E test files are located in both `src/gateway/*.e2e.test.ts` and `src/auto-reply/*.e2e.test.ts`.

### Design Patterns
- **Systematic classification**: Each failure gets a structured audit entry (file, test name, error, root cause, fix strategy) rather than ad-hoc notes
- **Dependency mapping**: Shared fixtures and test utilities are traced to identify cascade risks before fixes begin
- **Baseline capture**: Raw test output is saved as an immutable artifact for before/after comparison in Sessions 02-03

### Technology Stack
- Vitest (test framework, `vitest.e2e.config.ts`)
- Node 22+ (runtime)
- V8 coverage (if applicable to E2E runs)

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `.spec_system/specs/phase07-session01-e2e-test-audit-and-triage/audit.md` | Per-file failure classification with root cause, error details, and fix strategy | ~200 |
| `.spec_system/specs/phase07-session01-e2e-test-audit-and-triage/fixture-map.md` | Shared fixture and test utility dependency map across E2E files | ~80 |
| `.spec_system/specs/phase07-session01-e2e-test-audit-and-triage/remediation-plan.md` | Prioritized fix plan assigning failures to Session 02 and Session 03 | ~60 |
| `.spec_system/specs/phase07-session01-e2e-test-audit-and-triage/baseline-output.txt` | Raw E2E test run output (saved for comparison) | ~500 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `.spec_system/audit/known-issues.md` | Update with detailed per-file classification replacing the summary | ~40 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] Full E2E suite run completed with output captured
- [ ] All 18 known failures classified by root cause (config redaction, node stub, auth drift, or other)
- [ ] Any additional failures beyond the known 18 identified and classified
- [ ] 2 skipped tests evaluated with clear recommendation (fix, remove, or keep with justification)
- [ ] Per-file audit entry includes: file path, test name, exact error message, root cause category, and fix strategy
- [ ] Shared fixture dependency map covers all E2E test files
- [ ] Remediation plan clearly defines Session 02 scope (redaction/stub fixes) and Session 03 scope (auth/remaining)
- [ ] Unit test suite confirmed green (3946/3946 passing)
- [ ] Phase 06 security integration tests confirmed unaffected (43 passing)

### Testing Requirements
- [ ] E2E test suite run to completion (failures expected, not blocking)
- [ ] Unit test suite run to verify baseline is maintained

### Quality Gates
- [ ] All deliverable files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Audit entries follow consistent format across all failures
- [ ] No production code or test code modified (audit-only session)

---

## 8. Implementation Notes

### Key Considerations
- The E2E suite uses `pool: "forks"` with max 4 workers locally; some failures may be order-dependent or timing-sensitive
- Config redaction failures are likely the most mechanical to classify (tests asserting plaintext tokens now receiving `[REDACTED]`)
- Node stub response changes shifted from error rejection to graceful acceptance -- tests expecting errors will need assertion inversion
- Auth/connection drift failures may have deeper root causes requiring investigation of gateway server setup/teardown

### Potential Challenges
- **Unknown root causes**: Some failures may not fit the 3 known categories. Mitigation: The audit must discover and document any new patterns rather than forcing classification into known categories
- **Fixture coupling depth**: Test files may share fixtures through multiple layers of indirection. Mitigation: Trace imports recursively from each E2E test file, not just direct imports
- **Intermittent failures**: Some E2E tests may pass/fail non-deterministically. Mitigation: Run the suite at least once; note any inconsistencies with the known 18 count
- **Large output volume**: 235 E2E tests will produce substantial output. Mitigation: Filter and organize output by failure status

### Relevant Considerations
- [P00] **18 pre-existing E2E test failures**: Three root causes identified -- config redaction, node stub response changes, auth/connection drift. This session performs the comprehensive per-file classification that has been deferred since Phase 00.
- [P00] **Test coupling to fixtures**: Tests may have indirect dependencies on removed features through shared fixtures. The fixture dependency map will expose coupling that could cause cascade failures during fixes.
- [P06] **Layered security testing**: The 43 Phase 06 integration tests must remain unaffected. This audit verifies no E2E fixture issues bleed into the security test suite.
- [P00] **Incremental verification**: Running the full suite and capturing baseline output follows the proven pattern of verifying state before making changes.

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- Run full unit test suite (`pnpm test`) to confirm 3946/3946 still passing as the baseline

### Integration Tests
- Verify Phase 06 security integration tests (43 tests) are unaffected by E2E test infrastructure

### Manual Testing
- Run `pnpm test:e2e` and review the full output for all 18+ failures
- Cross-reference each failure against the known-issues.md summary
- Verify the 2 skipped tests by examining their skip annotations and determining if the skip reason is still valid

### Edge Cases
- Tests that pass locally but are documented as failing (stale known-issues entry)
- Tests that fail with different errors than expected (root cause may have shifted)
- Newly failing tests not in the known 18 (regressions from Phases 04-06)
- Tests with non-deterministic behavior (timing, ordering, resource contention)
- Skipped tests that would pass if unskipped (skip annotation is stale)

---

## 10. Dependencies

### External Libraries
- `vitest`: Test framework (existing, no version change)

### Other Sessions
- **Depends on**: `phase06-session04-security-validation` (Phase 06 complete, security hardening in place)
- **Depended by**: `phase07-session02-e2e-config-redaction-and-stub-fixes` (uses audit classification for redaction/stub fixes), `phase07-session03-e2e-auth-drift-and-remaining-failures` (uses audit classification for auth/remaining fixes)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
