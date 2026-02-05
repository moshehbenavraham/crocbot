# Session Specification

**Session ID**: `phase05-session05-build-validation-ci-integration`
**Phase**: 05 - Upstream Build Tooling Port
**Status**: Not Started
**Created**: 2026-02-05

---

## 1. Session Overview

This is the capstone validation session for Phase 05 (Upstream Build Tooling Port). Sessions 01-04 introduced tsdown bundling, unified TypeScript configuration, and stricter oxlint rules. Session 05 validates that all these changes work together end-to-end across every production surface: Docker builds, gateway startup with health endpoint, CLI binary execution, plugin-sdk export resolution, and the full test suite.

The `pnpm check` convenience script was already added during earlier sessions (`tsc --noEmit && pnpm lint && pnpm format`), so this session focuses on verifying its behavior rather than creating it. The primary deliverables are CI workflow compatibility verification, Docker build validation with tsdown output, build time benchmarking, and a CHANGELOG.md entry documenting the entire Phase 05 build tooling migration.

Completing this session closes Phase 05 and unblocks Phase 06 (Upstream Security Hardening Port). It serves as a quality gate ensuring the migration introduced zero regressions before moving forward.

---

## 2. Objectives

1. Validate that `pnpm build` (tsdown) produces correct production output across all three entry points (index, CLI entry, plugin-sdk)
2. Verify Docker multi-stage build completes successfully with tsdown output and the runtime container starts cleanly
3. Confirm CI workflows are compatible with the new build commands and produce green runs
4. Document the build tooling migration in CHANGELOG.md and measure build time improvement

---

## 3. Prerequisites

### Required Sessions
- [x] `phase05-session01-research-build-tooling-delta` - Research and delta analysis
- [x] `phase05-session02-tsdown-migration` - tsdown bundler integration
- [x] `phase05-session03-typescript-config-unification` - Unified tsconfig with ES2023
- [x] `phase05-session04-stricter-linting-rules` - oxlint rule tightening and `any` remediation

### Required Tools/Knowledge
- Docker (for build verification)
- pnpm 10.x
- Node 22+
- Familiarity with GitHub Actions workflow syntax

### Environment Requirements
- Docker daemon running (for Docker build verification)
- Access to project root with `.env` configured
- Network access for `pnpm install --frozen-lockfile` in Docker build

---

## 4. Scope

### In Scope (MVP)
- Verify `pnpm check` script runs successfully (type check + lint + format)
- Verify `pnpm build` produces all expected dist/ outputs
- Verify Docker build completes with tsdown output
- Verify gateway startup and `/health` endpoint with built output
- Verify CLI entry point (`crocbot` binary) with built output
- Verify plugin-sdk exports resolve correctly from dist/
- Run full test suite and confirm coverage thresholds maintained
- Review CI workflows for compatibility with new build commands
- Update CI workflows if any commands reference old tsc-based build
- Measure build time (tsdown vs. previous tsc) and document
- Add CHANGELOG.md entry for the Phase 05 build tooling migration

### Out of Scope (Deferred)
- Further code refactoring - *Reason: Migration is complete; refactoring is separate work*
- Security hardening - *Reason: Phase 06 scope*
- New feature development - *Reason: Validation session only*
- Bun runtime testing beyond CI matrix - *Reason: CI already covers Bun*

---

## 5. Technical Approach

### Architecture
This is a validation-focused session, not a feature build. The approach is systematic end-to-end verification of every production surface that the tsdown migration touches. Each validation step is independent and can be verified in isolation, then combined into a final confirmation.

The tsdown build config defines three entry points:
1. `src/index.ts` -> `dist/index.js` (main library)
2. `src/entry.ts` -> `dist/entry.js` (CLI entry / gateway)
3. `src/plugin-sdk/index.ts` -> `dist/plugin-sdk/` (with .d.ts declarations)

### Design Patterns
- **Incremental verification**: Validate one surface at a time (build, Docker, gateway, CLI, plugin-sdk, tests, CI) to isolate failures
- **Fail-fast gating**: If `pnpm build` fails, stop and fix before proceeding to downstream validations

### Technology Stack
- tsdown (bundler, replacing tsc for production builds)
- Docker multi-stage (node:22-bookworm builder, node:22-slim runtime)
- GitHub Actions CI (ci.yml, security.yml, integration.yml)
- oxlint + oxfmt (linting and formatting)
- Vitest (test runner with V8 coverage)

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| *(none - this is a validation session)* | | |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `CHANGELOG.md` | Add Phase 05 build tooling migration entry under [Unreleased] | ~15 |
| `.github/workflows/ci.yml` | Update if any steps reference old tsc build commands | ~5 |
| `package.json` | Minor script adjustments if validation reveals issues | ~3 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] `pnpm check` exits 0 (tsc --noEmit, oxlint, oxfmt all pass)
- [ ] `pnpm build` exits 0 and produces `dist/index.js`, `dist/entry.js`, `dist/plugin-sdk/index.js`, `dist/plugin-sdk/index.d.ts`
- [ ] `docker build .` completes without errors
- [ ] Docker container starts and `/health` returns `{"status":"ok",...}`
- [ ] `node dist/entry.js --help` (or equivalent CLI invocation) produces expected output
- [ ] `import { ... } from './dist/plugin-sdk/index.js'` resolves exported types
- [ ] `pnpm test` passes with coverage above 70% threshold
- [ ] CI workflows reference correct build commands (no stale tsc references)

### Testing Requirements
- [ ] Full test suite run and passing
- [ ] Coverage thresholds maintained (70% V8 coverage)
- [ ] Docker health check probe passes

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions (CONVENTIONS.md)
- [ ] Zero `any` types introduced
- [ ] CHANGELOG.md follows Keep a Changelog format

---

## 8. Implementation Notes

### Key Considerations
- `pnpm check` already exists in package.json as `tsc --noEmit && pnpm lint && pnpm format` - verify it works rather than creating it
- The tsdown config has 3 entry points with different settings (plugin-sdk has `dts: true`); verify each independently
- Docker build uses `pnpm build && pnpm ui:install && pnpm ui:build` in the builder stage; ensure tsdown output is compatible with the pruner and runtime stages
- CI matrix runs on Node, Bun, Windows, and macOS; focus verification on the Node path as primary

### Potential Challenges
- **Docker layer caching**: tsdown output structure may differ from tsc (flat dist/ vs. mirrored src/ tree), which could break COPY instructions in Dockerfile
- **Plugin-sdk .d.ts resolution**: tsdown generates declarations differently than tsc; consumers may need adjusted import paths
- **CI workflow staleness**: Workflows may reference `tsc` or old build patterns that need updating for tsdown

### Relevant Considerations
- [P00] **Incremental verification**: Run build/lint/test after each validation step to catch issues early (proven pattern from Phase 00)
- [P00] **TypeScript as refactoring guide**: Let compiler errors surface any remaining issues from the migration
- [P00] **Scope discipline**: This is a validation session - defer any discovered issues that are not regressions to future sessions

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- Run existing test suite with `pnpm test` - no new unit tests expected
- Confirm Vitest resolves all imports against tsdown-built output correctly

### Integration Tests
- Docker build and container startup with health check
- CLI entry point invocation from built output
- Plugin-sdk import resolution from dist/

### Manual Testing
- Run `pnpm check` and verify all three stages pass
- Run `pnpm build` and inspect dist/ directory structure
- Build Docker image and run container locally
- Hit `/health` endpoint on running container
- Execute CLI help command from built entry point

### Edge Cases
- Plugin-sdk TypeScript declarations (.d.ts) resolve correctly for external consumers
- Build works with `--frozen-lockfile` (CI mode)
- Coverage thresholds are not degraded by the build tooling change

---

## 10. Dependencies

### External Libraries
- tsdown: (current version in package.json)
- oxlint: (current version in package.json)
- oxfmt: (current version in package.json)
- vitest: (current version in package.json)

### Other Sessions
- **Depends on**: `phase05-session02-tsdown-migration`, `phase05-session03-typescript-config-unification`, `phase05-session04-stricter-linting-rules`
- **Depended by**: Phase 06 sessions (Upstream Security Hardening Port)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
