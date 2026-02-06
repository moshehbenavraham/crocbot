# Session 02: tsdown Migration

**Session ID**: `phase05-session02-tsdown-migration`
**Status**: Not Started
**Estimated Tasks**: ~20
**Estimated Duration**: 2-4 hours

---

## Objective

Replace `tsc` with `tsdown` as the production build tool, achieving faster build times while preserving identical runtime behavior.

---

## Scope

### In Scope (MVP)
- Install tsdown as a dev dependency
- Create `tsdown.config.ts` with crocbot-specific entry points
- Update `pnpm build` script to use tsdown instead of tsc
- Configure NODE_ENV production detection
- Preserve canvas-host/a2ui bundling step (esbuild, unchanged)
- Preserve post-build copy steps (canvas assets, hook metadata, build info)
- Verify dist/ output structure matches tsc output
- Verify all existing tests pass with tsdown-built output
- Measure and document build time improvement

### Out of Scope
- tsconfig changes (Session 03)
- Linting rule changes (Session 04)
- CI pipeline updates (Session 05)

---

## Prerequisites

- [ ] Session 01 research complete with entry point mapping
- [ ] tsdown version compatibility confirmed

---

## Deliverables

1. `tsdown.config.ts` configuration file
2. Updated `package.json` build script
3. Verified dist/ output
4. Build time comparison (tsc vs tsdown)

---

## Success Criteria

- [ ] `pnpm build` completes successfully using tsdown
- [ ] dist/ output structure is functionally equivalent to tsc output
- [ ] All existing tests pass (`pnpm test`)
- [ ] Gateway starts and responds to health check
- [ ] Build time measurably improved over tsc baseline
