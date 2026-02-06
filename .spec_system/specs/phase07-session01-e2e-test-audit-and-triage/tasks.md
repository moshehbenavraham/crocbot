# Task Checklist

**Session ID**: `phase07-session01-e2e-test-audit-and-triage`
**Total Tasks**: 20
**Estimated Duration**: 6-8 hours
**Created**: 2026-02-06

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0701]` = Phase 07, Session 01 reference
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 3 | 3 | 0 |
| Foundation | 5 | 5 | 0 |
| Implementation | 9 | 9 | 0 |
| Testing | 3 | 3 | 0 |
| **Total** | **20** | **20** | **0** |

---

## Setup (3 tasks)

Initial configuration and environment preparation.

- [x] T001 [S0701] Verify prerequisites: Node 22+, pnpm, vitest E2E config, and confirm Phase 06 is complete (`vitest.e2e.config.ts`)
- [x] T002 [S0701] Create deliverable directory structure and empty output files (`audit.md`, `fixture-map.md`, `remediation-plan.md`, `baseline-output.txt`)
- [x] T003 [S0701] Run full unit test suite (`pnpm test`) and confirm 3946/3946 passing baseline

---

## Foundation (5 tasks)

Capture baseline data and map test infrastructure.

- [x] T004 [S0701] Run full E2E suite (`pnpm test:e2e`) and save raw output to `baseline-output.txt`
- [x] T005 [S0701] Parse baseline output: extract all failing test names, file paths, error messages, and stack traces into a working list
- [x] T006 [S0701] Cross-reference failures against `known-issues.md` -- identify any new failures beyond the known 18 or any previously-failing tests that now pass
- [x] T007 [S0701] Identify and document the 2 skipped tests: locate skip annotations, evaluate skip reasons, recommend fix/remove/keep
- [x] T008 [S0701] Map shared test fixtures and utilities: trace imports from each E2E test file through `test/setup.ts`, `test/helpers/`, `src/test-utils/`, and `src/gateway/test-helpers.*` (`fixture-map.md`)

---

## Implementation (9 tasks)

Classify failures and build remediation plan.

- [x] T009 [S0701] [P] Classify gateway config/auth failures: `server.config-patch.e2e.test.ts`, `server.auth.e2e.test.ts`, `server.roles-allowlist-update.e2e.test.ts` -- document exact assertion, root cause, fix strategy (`audit.md`)
- [x] T010 [S0701] [P] Classify gateway health/connection failures: `server.health.e2e.test.ts`, `server.reload.e2e.test.ts` -- document exact assertion, root cause, fix strategy (`audit.md`)
- [x] T011 [S0701] [P] Classify gateway agent/model failures: `server.agent.gateway-server-agent-a.e2e.test.ts`, `server.models-voicewake-misc.e2e.test.ts` -- document exact assertion, root cause, fix strategy (`audit.md`)
- [x] T012 [S0701] [P] Classify gateway session/chat failures: `server.sessions.*.e2e.test.ts`, `server.chat.*.e2e.test.ts`, `server.sessions-send.e2e.test.ts` -- document exact assertion, root cause, fix strategy (`audit.md`)
- [x] T013 [S0701] [P] Classify gateway remaining failures: `server.hooks.e2e.test.ts`, `server.cron.e2e.test.ts`, `server.channels.e2e.test.ts`, `server.ios-client-id.e2e.test.ts`, and any other gateway E2E failures (`audit.md`)
- [x] T014 [S0701] [P] Classify auto-reply pipeline failures: all `src/auto-reply/*.e2e.test.ts` failures -- document exact assertion, root cause, fix strategy (`audit.md`)
- [x] T015 [S0701] [P] Classify shared/top-level test failures: `test/gateway.multi.e2e.test.ts`, `test/media-understanding.auto.e2e.test.ts`, `test/provider-timeout.e2e.test.ts` and any other non-gateway/non-auto-reply failures (`audit.md`)
- [x] T016 [S0701] Verify Phase 06 security integration tests (43 tests) are unaffected by E2E fixture issues
- [x] T017 [S0701] Build prioritized remediation plan: assign each classified failure to Session 02 (config redaction + node stub -- mechanical fixes) or Session 03 (auth drift + complex failures) (`remediation-plan.md`)

---

## Testing (3 tasks)

Verification and quality assurance.

- [x] T018 [S0701] Validate all deliverable files: ASCII encoding, Unix LF line endings, consistent audit entry format across all failures
- [x] T019 [S0701] Update `known-issues.md` with detailed per-file classification replacing the current summary
- [x] T020 [S0701] Final review: confirm no production code or test code was modified, all success criteria met, all deliverables complete

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All deliverable files ASCII-encoded
- [x] Unix LF line endings on all files
- [x] Audit entries follow consistent format
- [x] No production code or test code modified
- [x] implementation-notes.md updated
- [x] Ready for `/validate`

---

## Notes

### Parallelization
Tasks T009-T015 are parallelizable -- each classifies an independent group of test files. These can be worked on simultaneously once the baseline data (T004-T006) is complete.

### Task Timing
Target ~20-25 minutes per task.

### Dependencies
- T003 must complete before T004 (confirm unit baseline first)
- T004 must complete before T005-T008 (need raw output to parse)
- T005-T008 must complete before T009-T015 (need parsed data to classify)
- T009-T015 must complete before T017 (need all classifications for remediation plan)
- T017 must complete before T018-T020 (need all deliverables for validation)

### Key Constraint
This is a **read-only audit session**. No production code or test code should be modified. All deliverables are documentation artifacts.

---

## Next Steps

Run `/implement` to begin AI-led implementation.
