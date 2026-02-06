# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-02-06
**Project State**: Phase 06 - Upstream Security Hardening Port
**Completed Sessions**: 32

---

## Recommended Next Session

**Session ID**: `phase06-session04-security-validation`
**Session Name**: Security Validation
**Estimated Duration**: 2-3 hours
**Estimated Tasks**: ~15

---

## Why This Session Next?

### Prerequisites Met
- [x] Session 01: Research Security Hardening Delta (completed 2026-02-05)
- [x] Session 02: SSRF Guards (completed 2026-02-06)
- [x] Session 03: Download Timeouts and Path Traversal (completed 2026-02-06)

### Dependencies
- **Builds on**: All three prior Phase 06 implementation sessions (01-03)
- **Enables**: Phase 06 completion; closes out the entire Upstream Sync PRD

### Project Progression
This is the **final session** of Phase 06 and the **final session** of the entire Upstream Sync PRD. Sessions 01-03 implemented the security measures (SSRF guards, download timeouts, path traversal validation). This validation session verifies everything works end-to-end, checks for regressions, audits for bypass vectors, and updates documentation. It is the only remaining candidate session and the natural conclusion of the project.

---

## Session Overview

### Objective
End-to-end validation of all Phase 06 security hardening measures. Verify SSRF guards, download timeouts, and path traversal protection work correctly in integration, do not break existing functionality, and are properly tested.

### Key Deliverables
1. Integration test results for all security measures (SSRF, timeouts, path traversal)
2. Full test suite passing with no regressions
3. Docker build verified
4. CI compatibility confirmed
5. Security audit checklist completed (no bypass vectors)
6. CHANGELOG.md updated with Phase 06 summary

### Scope Summary
- **In Scope (MVP)**: Integration testing of SSRF guards, download timeouts, and path traversal validation; full regression check; Docker build verification; CI workflow compatibility; security bypass audit; documentation updates
- **Out of Scope**: Performance benchmarking, load testing, penetration testing beyond unit/integration tests, production deployment

---

## Technical Considerations

### Technologies/Patterns
- Vitest integration tests for SSRF guard scenarios (private IP ranges, localhost, DNS rebinding)
- Grammy mock operations for download timeout verification
- Path traversal boundary tests for agent tool file operations
- Docker multi-stage build verification
- CI workflow dry-run validation

### Potential Challenges
- Integration tests may need network mocking for SSRF scenarios (cannot hit real private IPs in CI)
- Grammy timeout tests require careful mocking of AbortSignal behavior
- Known 18 pre-existing E2E test failures (see `.spec_system/audit/known-issues.md`) must not increase

### Relevant Considerations
- [P04] **Verbatim upstream port pattern**: Security implementations should match upstream patterns closely; validation should verify this alignment
- [P00] **Incremental verification**: Run build/lint/test after each validation step to catch issues early

---

## Alternative Sessions

No alternative sessions available - this is the only remaining session in Phase 06 and the entire PRD. If blocked:
1. **Skip to /carryforward** - Close out Phase 06 with documented exceptions
2. **Create ad-hoc fix session** - If a specific blocker requires implementation work before validation can proceed

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
