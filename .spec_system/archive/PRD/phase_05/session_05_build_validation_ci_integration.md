# Session 05: Build Validation and CI Integration

**Session ID**: `phase05-session05-build-validation-ci-integration`
**Status**: Not Started
**Estimated Tasks**: ~15
**Estimated Duration**: 2-4 hours

---

## Objective

Perform end-to-end validation of the new build tooling, add the `pnpm check` convenience script, update CI workflows, and confirm production readiness.

---

## Scope

### In Scope (MVP)
- Add `pnpm check` script combining type checking + linting + formatting
- Update CI workflows to use new build commands if needed
- Verify Docker build completes with tsdown
- Verify gateway startup and health endpoint with tsdown-built output
- Run full test suite and confirm coverage thresholds maintained
- Measure final build time and document improvement
- Verify plugin-sdk export works correctly with tsdown output
- Test CLI entry point (`crocbot` binary) with tsdown output
- Document migration in CHANGELOG.md

### Out of Scope
- Further code refactoring
- Security hardening (Phase 06)
- New feature development

---

## Prerequisites

- [ ] Session 02 tsdown migration complete
- [ ] Session 03 tsconfig unification complete
- [ ] Session 04 stricter linting complete

---

## Deliverables

1. `pnpm check` convenience script in package.json
2. Updated CI workflows (if needed)
3. Verified Docker build
4. Build time comparison report
5. CHANGELOG.md entry

---

## Success Criteria

- [ ] `pnpm check` runs type checking, linting, and formatting successfully
- [ ] `pnpm build` produces working production output
- [ ] Docker build completes successfully
- [ ] Gateway starts and passes health check
- [ ] CLI binary functional
- [ ] Plugin-sdk exports resolve correctly
- [ ] All tests pass with maintained coverage
- [ ] CI workflows green (or confirmed compatible)
- [ ] CHANGELOG.md updated with build tooling migration
