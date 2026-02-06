# Task Checklist

**Session ID**: `phase06-session04-security-validation`
**Total Tasks**: 20
**Estimated Duration**: 6-8 hours
**Created**: 2026-02-06

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0604]` = Session reference (Phase 06, Session 04)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 3 | 3 | 0 |
| Foundation | 4 | 4 | 0 |
| Implementation | 8 | 8 | 0 |
| Testing | 5 | 5 | 0 |
| **Total** | **20** | **20** | **0** |

---

## Setup (3 tasks)

Initial verification and environment preparation.

- [x] T001 [S0604] Verify prerequisites: run `pnpm build` and `pnpm test` to confirm Session 03 baseline (3903 tests, 0 failures) (`pnpm build && pnpm test`)
- [x] T002 [S0604] Verify Session 02-03 security test files exist and pass independently (`src/infra/net/ssrf.test.ts`, `src/infra/net/fetch-guard.test.ts`, `src/media/store.test.ts`, `src/telegram/download.test.ts`)
- [x] T003 [S0604] Review three guarded call sites to confirm they use `fetchWithSsrFGuard()` (`src/alerting/notifier-webhook.ts`, `src/agents/skills-install.ts`, `src/media/fetch.ts`)

---

## Foundation (4 tasks)

Integration test scaffolding and audit document setup.

- [x] T004 [S0604] [P] Create SSRF integration test file with describe structure and shared mocks (`src/infra/net/security-integration.test.ts`)
- [x] T005 [S0604] [P] Create media security integration test file with describe structure and shared mocks (`src/media/security-integration.test.ts`)
- [x] T006 [S0604] [P] Create security audit checklist document with bypass category headings (`.spec_system/specs/phase06-session04-security-validation/security-audit.md`)
- [x] T007 [S0604] Define DNS mock helpers and fetch mock utilities for SSRF integration tests (`src/infra/net/security-integration.test.ts`)

---

## Implementation (8 tasks)

Integration test implementation and audit completion.

- [x] T008 [S0604] Implement SSRF integration tests: private IP ranges (10.x, 172.16.x, 192.168.x, 127.x) via mocked DNS (`src/infra/net/security-integration.test.ts`)
- [x] T009 [S0604] Implement SSRF integration tests: localhost and link-local (169.254.x) blocking via mocked DNS (`src/infra/net/security-integration.test.ts`)
- [x] T010 [S0604] Implement SSRF integration tests: redirect chain validation (public -> public -> private IP) (`src/infra/net/security-integration.test.ts`)
- [x] T011 [S0604] Implement SSRF integration tests: IPv6-mapped IPv4 (::ffff:127.0.0.1) and protocol validation (`src/infra/net/security-integration.test.ts`)
- [x] T012 [S0604] Implement media integration tests: path traversal rejection (../, absolute paths, double-encoding %252e%252e) (`src/media/security-integration.test.ts`)
- [x] T013 [S0604] Implement media integration tests: null byte injection and Unicode normalization edge cases (`src/media/security-integration.test.ts`)
- [x] T014 [S0604] Implement media integration tests: download timeout AbortSignal verification (`src/media/security-integration.test.ts`)
- [x] T015 [S0604] Complete security bypass audit: document findings for all bypass categories (redirect chaining, DNS rebinding, double-encoding, null bytes, symlink traversal) (`security-audit.md`)

---

## Testing (5 tasks)

Full verification, documentation, and quality gates.

- [x] T016 [S0604] Run full test suite and verify baseline: 3903+ tests passing, 0 failures, <=2 skipped (`pnpm test`)
- [x] T017 [S0604] Run build and lint quality gates: `pnpm build` (zero errors), `pnpm lint` (zero warnings)
- [x] T018 [S0604] Verify Docker build succeeds with all security changes (`docker build -f Dockerfile .`)
- [x] T019 [S0604] Update CHANGELOG.md with Phase 06 security hardening summary under [Unreleased] (`CHANGELOG.md`)
- [x] T020 [S0604] Create implementation-notes.md and verify all files are ASCII-encoded with Unix LF line endings (`implementation-notes.md`)

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing (3946 tests, 657 files, 0 failures)
- [x] All files ASCII-encoded (0-127)
- [x] implementation-notes.md updated
- [x] security-audit.md complete with findings
- [x] CHANGELOG.md updated
- [x] Ready for `/validate`

---

## Notes

### Parallelization
Tasks T004, T005, T006 can be worked on simultaneously (independent file creation).

### Task Timing
Target ~20-25 minutes per task.

### Dependencies
- T001-T003 must complete before T004-T007 (verify baseline before writing integration tests)
- T007 must complete before T008-T011 (mock helpers needed for SSRF integration tests)
- T004-T005 must complete before T008-T014 (test file scaffolding before implementation)
- T008-T015 must complete before T016-T018 (all tests written before full suite validation)
- T016-T018 must complete before T019-T020 (validation before documentation)

### Key Test Baseline
- Session 03 baseline: 655 test files, 3903 tests passing, 2 skipped, 0 failures
- Integration tests must work in CI without real network access (mock DNS resolution layer)
- 18 pre-existing E2E failures are out of scope (documented in `.spec_system/audit/known-issues.md`)

### Scope Discipline
This is a validation-only session. No new production code -- only integration tests, audit documentation, and changelog updates.

---

## Next Steps

Run `/implement` to begin AI-led implementation.
