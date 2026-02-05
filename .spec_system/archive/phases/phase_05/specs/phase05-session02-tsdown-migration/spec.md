# Session Specification

**Session ID**: `phase05-session02-tsdown-migration`
**Phase**: 05 - Upstream Build Tooling Port
**Status**: Not Started
**Created**: 2026-02-05

---

## 1. Session Overview

This session replaces `tsc` (TypeScript compiler) with `tsdown` as the production build tool for crocbot. The current build pipeline uses `tsc -p tsconfig.json` to compile TypeScript source files into JavaScript in `dist/`. tsdown, built on the Rolldown bundler engine, achieves significantly faster build times while producing functionally equivalent ESM output. This is the critical-path foundation for all remaining Phase 05 sessions.

The migration scope is deliberately narrow: install tsdown, create a configuration file with crocbot's 3 entry points (index, entry, plugin-sdk), swap the build command, and verify that the output is identical in behavior. All existing post-build steps (canvas asset copy, hook metadata, build info) are preserved unchanged. The tsconfig.json changes required for the new workflow (primarily `noEmit: true`) are included here since they are mechanically required for tsdown to own emission, but broader tsconfig modernization is deferred to Session 03.

This session enables Sessions 03-05: Session 03 needs tsdown handling emit so tsconfig can switch to type-checking-only mode; Session 04 needs the unified tsconfig from Session 03 for type-aware linting; Session 05 validates the entire new build pipeline end-to-end. Completing this migration unblocks the entire Phase 05 dependency chain.

---

## 2. Objectives

1. Replace `tsc -p tsconfig.json` with `tsdown` in the `pnpm build` script so that tsdown produces all JavaScript output in `dist/`
2. Create `tsdown.config.ts` with 3 entry points mapping crocbot's build architecture (src/index.ts, src/entry.ts, src/plugin-sdk/index.ts)
3. Add a `pnpm check` convenience script that runs `tsc --noEmit` for type checking separately from the build
4. Verify zero regressions: all tests pass, dist/ output is functionally equivalent, and the gateway starts correctly

---

## 3. Prerequisites

### Required Sessions
- [x] `phase05-session01-research-build-tooling-delta` - Entry point mapping, dependency analysis, tsdown config template, and migration plan

### Required Tools/Knowledge
- tsdown bundler configuration (Rolldown-based, esbuild-compatible API)
- ESM module output with Node.js platform targeting
- pnpm workspace dependency management

### Environment Requirements
- Node 22+ runtime
- pnpm package manager
- Access to upstream OpenClaw reference (`.001_ORIGINAL/`)

---

## 4. Scope

### In Scope (MVP)
- Install `tsdown@^0.20.1` as devDependency
- Update `rolldown` from `1.0.0-rc.1` to `1.0.0-rc.2` (tsdown peer dependency)
- Create `tsdown.config.ts` with 3 entry points (index, entry, plugin-sdk with dts)
- Update `package.json` build script: replace `tsc -p tsconfig.json` with `tsdown`
- Add `noEmit: true` to `tsconfig.json` (tsc no longer emits; tsdown does)
- Add `check` script to `package.json`: `tsc --noEmit && pnpm lint && pnpm format`
- Configure `NODE_ENV: "production"` environment injection for dead-code elimination
- Preserve all post-build steps (canvas-a2ui-copy, copy-hook-metadata, write-build-info)
- Verify dist/ output structure matches current tsc output
- Verify all existing tests pass (`pnpm test`)
- Measure and document build time comparison (tsc vs tsdown)

### Out of Scope (Deferred)
- Broader tsconfig modernization (target, lib, allowImportingTsExtensions, etc.) - *Reason: Session 03 scope*
- Linting rule changes (perf/suspicious categories, no-explicit-any) - *Reason: Session 04 scope*
- CI pipeline workflow updates - *Reason: Session 05 scope*
- Docker build verification in CI - *Reason: Session 05 scope*
- `write-cli-compat.ts` post-build step - *Reason: upstream-only, not needed for crocbot's single-binary deployment*
- oxlint/oxfmt version updates - *Reason: Session 04 scope*

---

## 5. Technical Approach

### Architecture

The migration replaces a single step in the existing 5-step build pipeline:

```
BEFORE:  a2ui:bundle -> tsc -p tsconfig.json -> canvas-copy -> hook-metadata -> build-info
AFTER:   a2ui:bundle -> tsdown               -> canvas-copy -> hook-metadata -> build-info
```

tsdown reads `tsdown.config.ts` which defines 3 build entries as an array of configurations. Each entry specifies its source file, output settings, and platform target. The plugin-sdk entry additionally generates `.d.ts` type declarations via `dts: true`.

With tsdown owning JavaScript emission, `tsconfig.json` adds `noEmit: true` so that `tsc` becomes a type-checker only, invoked separately via the new `pnpm check` script.

### Design Patterns
- **Verbatim upstream port**: Match the upstream `tsdown.config.ts` structure first, then adapt only what crocbot requires (3 entries instead of 4)
- **Incremental verification**: Build/test after each configuration change to catch issues early
- **Pipeline preservation**: Keep all post-build steps unchanged; only swap the compilation step

### Technology Stack
- `tsdown` ^0.20.1 (TypeScript bundler built on Rolldown)
- `rolldown` 1.0.0-rc.2 (bundler engine, peer dependency of tsdown)
- TypeScript ^5.9.3 (type checking only, no emission)
- Node 22+ (runtime target)

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `tsdown.config.ts` | tsdown bundler configuration with 3 entry points | ~25 |

### Files to Modify
| File | Changes | Est. Lines Changed |
|------|---------|------------|
| `package.json` | Update `build` script (tsc -> tsdown), add `check` script, add tsdown devDep, update rolldown version | ~5 |
| `tsconfig.json` | Add `noEmit: true` | ~1 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] `pnpm build` completes successfully using tsdown (exit code 0)
- [ ] `dist/index.js` exists and is valid ESM with shebang preserved
- [ ] `dist/entry.js` exists and is valid ESM with shebang preserved
- [ ] `dist/plugin-sdk/index.js` exists with corresponding `.d.ts` declarations
- [ ] All existing post-build artifacts generated (canvas assets, hook metadata, build info)
- [ ] `pnpm test` passes with zero new failures (baseline: 4051 pass, 2 skip, 0 fail)
- [ ] `pnpm check` runs type checking, linting, and formatting successfully
- [ ] Build time measurably improved over tsc baseline

### Testing Requirements
- [ ] Full test suite passes against tsdown-built output
- [ ] Manual verification of dist/ directory structure
- [ ] Manual verification that `node dist/entry.js --help` works

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions (CONVENTIONS.md)
- [ ] No new lint warnings or errors introduced
- [ ] Zero `any` types introduced

---

## 8. Implementation Notes

### Key Considerations
- tsdown uses `fixedExtension: false` to let the bundler choose output extensions (`.js` for ESM), matching the current tsc output
- `NODE_ENV: "production"` injection enables dead-code elimination for conditional blocks checking `process.env.NODE_ENV`
- The plugin-sdk entry is the only one with `dts: true` since it is the only public API surface that needs type declarations
- Shebangs in `src/index.ts` and `src/entry.ts` must be preserved in bundled output

### Potential Challenges
- **dist/ structure parity**: tsdown may produce different internal import paths than tsc; runtime testing is essential to verify module resolution
- **Shebang preservation**: Verify tsdown preserves `#!/usr/bin/env node` lines at the top of entry.js and index.js
- **Dynamic imports**: Any `import()` expressions in the codebase need correct handling by tsdown (should work with `platform: "node"`)
- **Plugin SDK .d.ts quality**: tsdown's declaration generation may differ from tsc; compare generated types to ensure plugin consumers still compile
- **rolldown peer dependency**: Ensure rolldown 1.0.0-rc.2 is compatible with tsdown ^0.20.1

### Relevant Considerations
- [P00] **TypeScript as refactoring guide**: Let compiler errors guide the migration - if tsdown output breaks type resolution, the type checker will identify it
- [P04] **Verbatim upstream port pattern**: Match the upstream tsdown.config.ts approach first, then adapt only what crocbot's architecture requires (3 entries, no extensionAPI.ts)
- [P00] **Incremental verification**: Run build/lint/test after each configuration change to catch issues early

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- No new unit tests required; this is a build tooling change
- Existing 4051 tests serve as the regression suite

### Integration Tests
- Verify `pnpm build` produces valid dist/ output
- Verify `pnpm check` (tsc --noEmit) passes cleanly
- Verify `pnpm test` passes against tsdown-built artifacts

### Manual Testing
- Run `node dist/entry.js --help` to verify CLI entry point works
- Run `node dist/entry.js --version` to verify build info is populated
- Compare dist/ directory listing before/after migration for structural equivalence
- Time `pnpm build` with tsc (before) and tsdown (after) for performance comparison

### Edge Cases
- Shebang lines preserved in bundled output files
- `process.env.NODE_ENV` checks correctly eliminated/retained in production build
- Plugin SDK `.d.ts` files correctly generated with all type exports
- Dynamic `import()` expressions resolve correctly at runtime
- Canvas host bundle (esbuild step) unaffected by tsdown migration

---

## 10. Dependencies

### External Libraries
- `tsdown`: ^0.20.1 (new devDependency)
- `rolldown`: 1.0.0-rc.2 (update from 1.0.0-rc.1)

### Other Sessions
- **Depends on**: `phase05-session01-research-build-tooling-delta` (entry point mapping, migration plan)
- **Depended by**: `phase05-session03-typescript-config-unification` (needs tsdown handling emit before tsconfig adds noEmit), `phase05-session04-stricter-linting-rules` (needs unified tsconfig from S03), `phase05-session05-build-validation-ci-integration` (validates full pipeline)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
