# Session Specification

**Session ID**: `phase05-session03-typescript-config-unification`
**Phase**: 05 - Upstream Build Tooling Port
**Status**: Not Started
**Created**: 2026-02-05

---

## 1. Session Overview

This session adopts the TypeScript configuration delta identified in the Phase 05 Session 01 research, aligning the root `tsconfig.json` with upstream OpenClaw compiler options now that tsdown handles emit (Session 02). The key changes are upgrading the target from ES2022 to ES2023, adding `allowImportingTsExtensions`, `declaration`, `experimentalDecorators`, explicit `lib`, and `useDefineForClassFields: false`. The `ui/tsconfig.json` receives a parallel ES2023 target and lib upgrade.

Critically, the research document (Section 4) concluded that full unification -- merging `ui/` into the root tsconfig -- should be **rejected** in favor of keeping separate configs. The root tsconfig covers `src/` with NodeNext module resolution (Node.js server code), while `ui/tsconfig.json` uses Bundler module resolution with DOM types (Vite/Lit browser code). This session applies the upstream delta options to both configs independently, then verifies that type checking, tsdown build, and the full test suite remain clean.

This session is a prerequisite for Session 04 (Stricter Linting Rules) because type-aware lint rules require stable, aligned TypeScript configuration to function correctly.

---

## 2. Objectives

1. Adopt all upstream tsconfig delta options in root `tsconfig.json` (ES2023 target, `allowImportingTsExtensions`, `declaration`, `experimentalDecorators`, explicit `lib`, `useDefineForClassFields`)
2. Upgrade `ui/tsconfig.json` target and lib to ES2023, keeping separate config
3. Verify zero type errors across both `src/` and `ui/` directories after changes
4. Verify tsdown build output and full test suite remain unchanged

---

## 3. Prerequisites

### Required Sessions
- [x] `phase05-session01-research-build-tooling-delta` - Provides tsconfig delta analysis and migration plan
- [x] `phase05-session02-tsdown-migration` - tsdown handles emit; tsc is type-check-only with `noEmit: true`

### Required Tools/Knowledge
- TypeScript compiler configuration (`tsconfig.json` options)
- Difference between NodeNext and Bundler module resolution
- ES2023 feature set (Array.findLast, Hashbang grammar, WeakRef improvements)

### Environment Requirements
- Node 22+ (full ES2023 support)
- pnpm package manager
- tsdown installed (from Session 02)

---

## 4. Scope

### In Scope (MVP)
- Root `tsconfig.json`: upgrade `target` to `ES2023`
- Root `tsconfig.json`: add `allowImportingTsExtensions: true`
- Root `tsconfig.json`: add `declaration: true`
- Root `tsconfig.json`: add `experimentalDecorators: true`
- Root `tsconfig.json`: add explicit `lib: ["ES2023"]`
- Root `tsconfig.json`: add `useDefineForClassFields: false`
- Root `tsconfig.json`: add `noEmitOnError: true`
- `ui/tsconfig.json`: upgrade `target` to `ES2023`
- `ui/tsconfig.json`: upgrade `lib` to `["ES2023", "DOM", "DOM.Iterable"]`
- Verify `tsc --noEmit` passes with zero errors for root config
- Verify `tsc --noEmit -p ui/tsconfig.json` passes with zero errors
- Verify `pnpm build` produces correct output
- Verify `pnpm test` passes with no regressions
- Verify `pnpm check` passes cleanly

### Out of Scope (Deferred)
- Merging `ui/tsconfig.json` into root tsconfig - *Reason: Research rejected unification; separate configs are cleaner for Node vs browser code*
- Adding `experimentalDecorators` support to root if unused - *Reason: Low risk to add but no active usage in `src/`; included for upstream alignment*
- Linting rule changes - *Reason: Session 04 scope*
- CI pipeline updates - *Reason: Session 05 scope*
- `ui/**/*.test.ts` exclusion in root tsconfig - *Reason: UI tests are only in `ui/tsconfig.json` scope, not root*

---

## 5. Technical Approach

### Architecture

The TypeScript configuration serves two distinct purposes in the post-tsdown world:

1. **Type checking only** (`tsc --noEmit`): Validates types across `src/` using the root tsconfig. The `ui/` directory has its own tsconfig for separate type checking.
2. **Build**: tsdown handles all emit for `src/` (3 entry points). Vite handles `ui/` builds independently.

The root tsconfig changes are purely additive -- upgrading the target and adding options that were missing compared to upstream. No options are removed. The `include` path stays as `["src/**/*"]` (not adding `ui/**/*`).

### Design Patterns
- **Verbatim upstream port**: Match upstream tsconfig options exactly, then adapt only what the stripped-down architecture requires (separate ui config)
- **Incremental verification**: Apply changes in small steps, verifying type checking after each change
- **Conservative adoption**: Add options that align with upstream without changing existing behavior unnecessarily

### Technology Stack
- TypeScript ^5.9.3 (already installed)
- tsdown (already installed from Session 02)
- Vite 7.3.1 (ui build, unchanged)
- Node 22+ runtime (ES2023 support)

---

## 6. Deliverables

### Files to Modify
| File | Changes | Est. Lines Changed |
|------|---------|-------------------|
| `tsconfig.json` | Add 6 options, upgrade target from ES2022 to ES2023 | ~10 |
| `ui/tsconfig.json` | Upgrade target and lib to ES2023 | ~4 |

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| None | No new files required | - |

---

## 7. Success Criteria

### Functional Requirements
- [ ] Root `tsconfig.json` target is `ES2023`
- [ ] Root `tsconfig.json` has `allowImportingTsExtensions: true`
- [ ] Root `tsconfig.json` has `declaration: true`
- [ ] Root `tsconfig.json` has `experimentalDecorators: true`
- [ ] Root `tsconfig.json` has `lib: ["ES2023"]`
- [ ] Root `tsconfig.json` has `useDefineForClassFields: false`
- [ ] Root `tsconfig.json` has `noEmitOnError: true`
- [ ] `ui/tsconfig.json` target is `ES2023`
- [ ] `ui/tsconfig.json` lib includes `ES2023`
- [ ] `tsc --noEmit` passes with zero errors (root)
- [ ] Type checking passes for `ui/` directory
- [ ] `pnpm build` produces correct output (tsdown)
- [ ] `pnpm test` passes with no regressions
- [ ] `pnpm check` passes cleanly (tsc + lint + format)

### Testing Requirements
- [ ] Full test suite run (`pnpm test`)
- [ ] UI tests run (`pnpm test:ui` or `pnpm --dir ui test`)
- [ ] Build output verified (`pnpm build`)
- [ ] Type checking verified (`tsc --noEmit`)

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions (CONVENTIONS.md)
- [ ] JSON files are valid and properly formatted

---

## 8. Implementation Notes

### Key Considerations
- `noEmit: true` is already set (from Session 02), so `declaration: true` will not cause tsc to emit `.d.ts` files -- tsdown's `dts: true` handles that for the plugin-sdk entry point
- `allowImportingTsExtensions` requires `noEmit: true` (already set) -- TypeScript requires this because `.ts` imports cannot be emitted as-is to JavaScript
- `experimentalDecorators` is harmless to enable even if `src/` does not use decorators; it aligns with upstream and prevents errors if decorator usage is ever ported
- The `ui/tsconfig.json` already has `experimentalDecorators: true` (used by Lit decorators) and `useDefineForClassFields: false` -- these do not need to change

### Potential Challenges
- **`allowImportingTsExtensions` interaction with `.js` imports**: The codebase convention (CONVENTIONS.md) is to use `.js` extensions in imports. `allowImportingTsExtensions` enables `.ts` imports but does not break `.js` imports. No conflict expected.
- **ES2023 target exposing new type errors**: ES2023 adds `Array.findLast`, `Array.findLastIndex`, `Hashbang` grammar, and `WeakRef` improvements. These are additive -- no existing code should break from a target upgrade.
- **`useDefineForClassFields: false` changing class behavior**: This uses legacy TypeScript class field semantics (assignment in constructor body). If any `src/` classes rely on the TC39 define semantics (the default), behavior could change. Risk is low since upstream already uses this setting.

### Relevant Considerations
- [P00] **TypeScript as refactoring guide**: Strict typing identifies necessary updates after changing config. Let compiler errors guide the process -- run `tsc --noEmit` after each option change.
- [P04] **Verbatim upstream port pattern**: Match upstream tsconfig approach first, then adapt only what the stripped-down architecture requires (keeping separate ui config).
- [P00] **Incremental verification**: Running build/lint/test after each major change catches issues early.

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- No new unit tests required -- this session modifies configuration, not application code
- Existing tests must continue to pass (`pnpm test`)

### Integration Tests
- `pnpm build` must succeed and produce the same dist/ structure
- `pnpm check` must pass (tsc --noEmit + lint + format)
- UI build must still work (`pnpm ui:build`)

### Manual Testing
- Compare `dist/` output before and after changes (file list, sizes)
- Verify `node dist/entry.js --help` still works
- Verify `node dist/index.js` exports are accessible

### Edge Cases
- Verify `.js` extension imports still resolve correctly with `allowImportingTsExtensions` enabled
- Verify classes in `src/` behave correctly with `useDefineForClassFields: false`
- Verify no new type errors surface from ES2023 lib types

---

## 10. Dependencies

### External Libraries
- TypeScript: ^5.9.3 (already installed, no version change)
- tsdown: already installed (from Session 02)

### Other Sessions
- **Depends on**: `phase05-session02-tsdown-migration` (tsdown handles emit, `noEmit: true` set)
- **Depended by**: `phase05-session04-stricter-linting-rules` (type-aware linting needs stable tsconfig)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
