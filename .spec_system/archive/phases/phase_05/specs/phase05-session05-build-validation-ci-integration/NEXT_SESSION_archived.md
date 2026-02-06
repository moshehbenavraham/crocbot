# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-02-05
**Project State**: Phase 05 - Upstream Build Tooling Port
**Completed Sessions**: 28 (4 of 5 in current phase)

---

## Recommended Next Session

**Session ID**: `phase05-session05-build-validation-ci-integration`
**Session Name**: Build Validation and CI Integration
**Estimated Duration**: 2-4 hours
**Estimated Tasks**: ~15

---

## Why This Session Next?

### Prerequisites Met
- [x] Session 02 tsdown migration complete
- [x] Session 03 tsconfig unification complete
- [x] Session 04 stricter linting rules complete

### Dependencies
- **Builds on**: All Phase 05 sessions (01-04) — research, tsdown migration, tsconfig unification, stricter linting
- **Enables**: Phase 06 (Upstream Security Hardening Port) and Phase 05 completion

### Project Progression
This is the final session of Phase 05 and serves as the capstone validation session for the entire build tooling migration. Sessions 01-04 introduced tsdown bundling, unified TypeScript configuration, and stricter linting rules. Session 05 validates that all these changes work together end-to-end: Docker builds, gateway startup, CLI binary, plugin-sdk exports, test suite, and CI workflows. It also adds the `pnpm check` convenience script and documents the migration in CHANGELOG.md. Completing this session closes Phase 05 and unblocks Phase 06 (Security Hardening).

---

## Session Overview

### Objective
Perform end-to-end validation of the new build tooling, add the `pnpm check` convenience script, update CI workflows, and confirm production readiness.

### Key Deliverables
1. `pnpm check` convenience script combining type checking + linting + formatting
2. Updated CI workflows (if needed) to use new build commands
3. Verified Docker build with tsdown output
4. Verified gateway startup and health endpoint
5. Build time comparison report documenting improvement
6. CHANGELOG.md entry for the build tooling migration

### Scope Summary
- **In Scope (MVP)**: `pnpm check` script, CI workflow updates, Docker build verification, gateway/CLI/plugin-sdk validation, test suite confirmation, build time benchmarking, CHANGELOG documentation
- **Out of Scope**: Further code refactoring, security hardening (Phase 06), new feature development

---

## Technical Considerations

### Technologies/Patterns
- tsdown bundler (production build output validation)
- Docker multi-stage build verification
- CI/CD workflow configuration (GitHub Actions)
- pnpm script composition

### Potential Challenges
- Docker build may need adjustments for tsdown output structure vs. previous tsc output
- Plugin-sdk export paths may need verification against tsdown's module resolution
- CI workflows may reference old build commands that need updating

### Relevant Considerations
- [P00] **Incremental verification**: Run build/lint/test after each validation step to catch issues early (proven pattern from Phase 00)
- [P00] **TypeScript as refactoring guide**: Let compiler errors surface any remaining issues from the migration

---

## Alternative Sessions

If this session is blocked:
1. **Phase 06 Session Planning** — Begin defining sessions for the Upstream Security Hardening Port while Phase 05 blockers are resolved
2. **CONSIDERATIONS.md carryforward** — Run /carryforward to capture Phase 05 lessons before starting Phase 06

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
