# Session Specification

**Session ID**: `phase06-session04-security-validation`
**Phase**: 06 - Upstream Security Hardening Port
**Status**: Not Started
**Created**: 2026-02-06

---

## 1. Session Overview

This is the final session of Phase 06 and the concluding session of the entire Upstream Sync PRD. Sessions 01-03 researched and implemented three security hardening measures ported from upstream OpenClaw: SSRF guards with DNS pinning (Session 02), Telegram download timeouts with AbortSignal enforcement (Session 03), and path traversal validation with assertMediaPath guards (Session 03). This validation session verifies that all measures work correctly end-to-end, do not introduce regressions, and leave no bypass vectors.

The session performs integration testing across all three security surfaces, runs the full test suite to confirm zero regressions, verifies Docker and CI compatibility, audits for bypass vectors (redirect chaining, DNS rebinding, double-encoding, symlink traversal), and updates project documentation. Upon completion, Phase 06 closes and the Upstream Sync PRD is fully delivered.

---

## 2. Objectives

1. Verify all Phase 06 security measures work correctly in integration (SSRF guards, download timeouts, path traversal validation)
2. Confirm zero test regressions against the Session 03 baseline (3903 tests passing, 0 failures)
3. Validate Docker build and CI workflow compatibility with all security changes
4. Complete security bypass audit and document findings

---

## 3. Prerequisites

### Required Sessions
- [x] `phase06-session01-research-security-hardening-delta` - Identified three security deltas to port
- [x] `phase06-session02-ssrf-guards` - SSRF protection with DNS pinning, fetch guards on 3 call sites (38 tests added)
- [x] `phase06-session03-download-timeouts-and-path-traversal` - Download timeouts on Telegram operations, assertMediaPath guard, agent tool audit (14 tests added)

### Required Tools/Knowledge
- Vitest test framework
- Docker multi-stage build process
- SSRF attack vectors and mitigation patterns
- Path traversal attack patterns

### Environment Requirements
- Node 22+ with pnpm
- Docker for build verification
- All dependencies installed (`pnpm install`)

---

## 4. Scope

### In Scope (MVP)
- Integration testing of SSRF guards (private IP blocking, localhost blocking, DNS rebinding defense, redirect validation)
- Integration testing of download timeouts (AbortSignal.timeout on getTelegramFile and downloadTelegramFile)
- Integration testing of path traversal validation (assertMediaPath rejection of ../traversal, absolute paths, symlink-like paths)
- Full test suite regression check (`pnpm test` -- all 3903+ tests)
- Build validation (`pnpm build`, `pnpm lint`)
- Docker build verification (`docker build`)
- CI workflow dry-run review
- Security bypass audit checklist (redirect chaining, DNS rebinding, double-encoding, null bytes, symlink traversal)
- CHANGELOG.md update with Phase 06 security summary
- Phase 06 documentation finalization

### Out of Scope (Deferred)
- Performance benchmarking - *Reason: Not a security validation concern*
- Load testing - *Reason: Separate operational concern*
- Penetration testing beyond unit/integration tests - *Reason: Requires dedicated security engagement*
- Production deployment - *Reason: Operational step outside spec system*
- Content-type and file-size validation - *Reason: Separate concern deferred from Session 03*
- Timeout configuration via environment variables - *Reason: Enhancement deferred from Session 03*

---

## 5. Technical Approach

### Architecture
This is a validation-only session with no new production code. Work consists of writing integration tests that exercise the security guards under realistic conditions, running the full quality pipeline, and performing a manual security audit. All new files are test files.

### Design Patterns
- **Integration test pattern**: Tests exercise multiple layers (DNS resolution -> fetch guard -> caller) to verify end-to-end behavior
- **Network mocking**: Use Vitest mocks for DNS resolution and fetch to simulate SSRF scenarios without requiring real network access in CI
- **Boundary testing**: Path traversal tests exercise edge cases (double-encoding, null bytes, Unicode normalization)

### Technology Stack
- Vitest (test framework)
- vi.mock / vi.fn (mocking)
- Docker (build verification)
- oxlint / oxfmt (quality gates)

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/infra/net/security-integration.test.ts` | Integration tests: SSRF + fetch guard end-to-end scenarios | ~150 |
| `src/media/security-integration.test.ts` | Integration tests: path traversal + download timeout scenarios | ~120 |
| `.spec_system/specs/phase06-session04-security-validation/security-audit.md` | Security bypass audit checklist and findings | ~80 |

### Files to Modify
| File | Changes | Est. Lines Changed |
|------|---------|------------|
| `CHANGELOG.md` | Add Phase 06 security hardening entry under [Unreleased] | ~10 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] SSRF guards block all RFC 1918 private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- [ ] SSRF guards block localhost (127.0.0.0/8, ::1)
- [ ] SSRF guards block link-local (169.254.0.0/16)
- [ ] Fetch guard validates redirect targets against SSRF policy
- [ ] Download timeouts fire AbortSignal after configured duration
- [ ] assertMediaPath rejects ../ path traversal attempts
- [ ] assertMediaPath rejects absolute paths outside media root
- [ ] All three protected call sites (webhook, skills-install, media-fetch) use guarded fetch

### Testing Requirements
- [ ] Integration tests written and passing for SSRF scenarios
- [ ] Integration tests written and passing for path traversal scenarios
- [ ] Full test suite passes: 3903+ tests, 0 failures (matching Session 03 baseline)
- [ ] No increase in skipped tests beyond baseline (2 skipped)

### Quality Gates
- [ ] `pnpm build` succeeds with zero errors
- [ ] `pnpm lint` passes with zero warnings
- [ ] `docker build -f Dockerfile .` succeeds
- [ ] All files ASCII-encoded (0-127)
- [ ] Unix LF line endings
- [ ] Code follows project conventions (CONVENTIONS.md)

---

## 8. Implementation Notes

### Key Considerations
- Integration tests must work in CI without real network access -- mock DNS resolution layer, not the entire fetch
- The 18 pre-existing E2E test failures (documented in `.spec_system/audit/known-issues.md`) are out of scope; verify count does not increase
- Session 03 baseline: 655 test files, 3903 tests passing, 2 skipped, 0 failures
- Docker build must continue to work with `@napi-rs/canvas` and `@reflink/reflink` externals in tsdown config

### Potential Challenges
- **DNS mocking in integration tests**: Need to mock at the `dns.resolve4`/`dns.resolve6` level to simulate private IP resolution without hitting the network
- **Grammy mock complexity**: Telegram download timeout tests need careful AbortSignal simulation; rely on existing unit tests from Session 03 rather than duplicating
- **CI runner availability**: Blacksmith runners may queue; verify workflow files are compatible but do not require actual CI run

### Relevant Considerations
- [P04] **Verbatim upstream port pattern**: Security implementations match upstream patterns; validation verifies this alignment holds
- [P00] **Incremental verification**: Run build/lint/test after each validation step to catch issues early
- [P00] **Scope discipline**: This is validation only -- resist adding new security features or refactoring existing implementations

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- Existing unit tests from Sessions 02-03 (52 tests total) serve as the unit test layer
- No new unit tests needed -- integration tests are the focus

### Integration Tests
- SSRF end-to-end: Mock DNS to return private IPs, verify fetchWithSsrFGuard rejects
- SSRF redirect: Verify redirect to private IP is blocked even when initial target is public
- Path traversal end-to-end: Call saveMediaBuffer/saveMediaSource with traversal paths, verify rejection
- Download timeout: Verify AbortSignal.timeout is passed through getTelegramFile/downloadTelegramFile

### Manual Testing
- Docker build: `docker build -f Dockerfile .` completes successfully
- CI workflow review: Inspect `.github/workflows/ci.yml` and `security.yml` for compatibility

### Edge Cases
- Double-encoded path traversal (`%252e%252e%252f`)
- Null byte injection in file paths (`file%00.txt`)
- IPv6-mapped IPv4 addresses (`::ffff:127.0.0.1`)
- Redirect chains (public -> public -> private)
- Unicode normalization attacks in paths

---

## 10. Dependencies

### External Libraries
- `vitest`: test framework (existing)
- `docker`: build verification (existing)

### Other Sessions
- **Depends on**: `phase06-session02-ssrf-guards`, `phase06-session03-download-timeouts-and-path-traversal`
- **Depended by**: None (final session)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
