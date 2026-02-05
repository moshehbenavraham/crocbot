# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-02-05
**Project State**: Phase 05 - Upstream Build Tooling Port
**Completed Sessions**: 25

---

## Recommended Next Session

**Session ID**: `phase05-session02-tsdown-migration`
**Session Name**: tsdown Migration
**Estimated Duration**: 2-4 hours
**Estimated Tasks**: ~20

---

## Why This Session Next?

### Prerequisites Met
- [x] Phase 04 completed (all 3 sessions validated)
- [x] Session 01 research complete with entry point mapping
- [x] tsdown version compatibility confirmed (via research delta)

### Dependencies
- **Builds on**: `phase05-session01-research-build-tooling-delta` (entry point mapping, dependency analysis, migration plan)
- **Enables**: `phase05-session03-typescript-config-unification` (tsdown must handle emit before tsc can switch to noEmit mode)

### Project Progression
Session 02 is the critical-path foundation for all remaining Phase 05 sessions. The tsdown bundler replaces `tsc` for production builds, and Sessions 03-05 all depend on this migration being complete:
- Session 03 needs tsdown handling emit so tsconfig can add `noEmit: true`
- Session 04 needs unified tsconfig from Session 03 for type-aware linting
- Session 05 validates the entire new build pipeline end-to-end

This is the only candidate with all prerequisites met. Starting here follows the strict dependency chain established in the Phase 05 PRD.

---

## Session Overview

### Objective
Replace `tsc` with `tsdown` as the production build tool, achieving faster build times while preserving identical runtime behavior.

### Key Deliverables
1. `tsdown.config.ts` configuration file with crocbot-specific entry points
2. Updated `package.json` build script to use tsdown instead of tsc
3. Verified dist/ output structure is functionally equivalent to tsc output
4. Build time comparison (tsc vs tsdown) documented

### Scope Summary
- **In Scope (MVP)**: Install tsdown, create config, update build script, configure NODE_ENV production detection, preserve canvas-host/a2ui bundling step, preserve post-build copy steps, verify dist/ output and test suite, measure build time improvement
- **Out of Scope**: tsconfig changes (Session 03), linting rule changes (Session 04), CI pipeline updates (Session 05)

---

## Technical Considerations

### Technologies/Patterns
- `tsdown` bundler (Rolldown-based, esbuild-compatible config)
- ESM output with `.js` extensions
- NODE_ENV-based production detection
- Existing esbuild canvas-host/a2ui bundling preserved alongside

### Potential Challenges
- **Entry point mapping**: Must correctly identify all entry points (src/index.ts, src/entry.ts, src/plugin-sdk/index.ts, src/extensionAPI.ts) - research from Session 01 provides this mapping
- **dist/ structure parity**: tsdown output structure may differ from tsc; need to verify import paths resolve correctly at runtime
- **Post-build steps**: Canvas asset copy, hook metadata, build info generation must be preserved in build pipeline
- **Dynamic imports**: Any `import()` expressions need correct handling by tsdown bundler

### Relevant Considerations
- [P00] **TypeScript as refactoring guide**: Let compiler errors guide the migration - if tsdown output breaks type resolution, the type checker will identify it
- [P04] **Verbatim upstream port pattern**: Match the upstream tsdown.config.ts approach first, then adapt only what crocbot's architecture requires
- [P00] **Incremental verification**: Run build/lint/test after each configuration change to catch issues early

---

## Alternative Sessions

If this session is blocked:
1. **phase05-session04-stricter-linting-rules** - Could partially proceed (enable perf/suspicious categories) without tsdown, but `no-explicit-any` needs unified tsconfig. Not recommended.
2. **Phase 06 sessions** - Security hardening (SSRF guards, download timeouts, path traversal) is independent of build tooling. Could be started if tsdown proves problematic, though Phase 05 should complete first per PRD ordering.

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
