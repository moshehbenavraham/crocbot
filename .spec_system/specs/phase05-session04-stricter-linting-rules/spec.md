# Session Specification

**Session ID**: `phase05-session04-stricter-linting-rules`
**Phase**: 05 - Upstream Build Tooling Port
**Status**: Not Started
**Created**: 2026-02-05

---

## 1. Session Overview

This session enables stricter oxlint rule categories and specific rules identified during the Session 01 research delta analysis to catch more issues at lint time. The current `.oxlintrc.json` only enforces the `correctness` category; upstream OpenClaw also enforces `perf` and `suspicious` categories alongside 12 explicit rule overrides, broader ignore patterns, and `typescript/no-explicit-any` at error level.

The work builds directly on Session 03's unified TypeScript configuration (type-aware linting depends on a coherent tsconfig) and on Session 01's `any` type inventory (26 active-code occurrences, 44 in tests). By fixing active-code `any` usages and enabling the stricter rules, the codebase gains lint-time detection of performance anti-patterns, suspicious code constructs, and untyped escape hatches -- catching issues at development time rather than runtime.

This is the penultimate session in Phase 05. Session 05 (Build Validation & CI Integration) depends on linting being finalized here so it can integrate `pnpm check` into the CI pipeline with confidence.

---

## 2. Objectives

1. Enable `perf` and `suspicious` oxlint categories as error, aligned with upstream
2. Enable `typescript/no-explicit-any` as error and remediate all active-code violations (26 occurrences)
3. Add upstream-aligned rule overrides and ignore patterns to `.oxlintrc.json`
4. Achieve a clean `pnpm lint` pass with zero errors and no test regressions

---

## 3. Prerequisites

### Required Sessions
- [x] `phase05-session01-research-build-tooling-delta` - Provides oxlint delta analysis, `any` type inventory, and recommended `.oxlintrc.json`
- [x] `phase05-session02-tsdown-migration` - Build tooling in place (tsdown, `pnpm check`)
- [x] `phase05-session03-typescript-config-unification` - Unified tsconfig enables type-aware lint rules

### Required Tools/Knowledge
- oxlint rule configuration and category semantics
- TypeScript type narrowing patterns (`unknown` + type guards, `as unknown as T`)
- Inline lint suppression comment syntax (`// oxlint-disable-next-line`)

### Environment Requirements
- Node 22+ runtime
- pnpm package manager
- Current build passing (`pnpm build` clean)
- Current tests passing (`pnpm test`)

---

## 4. Scope

### In Scope (MVP)
- Update `.oxlintrc.json`: add `perf` and `suspicious` categories as error
- Add `curly` rule as error
- Add 11 upstream-aligned rule overrides (disabled rules for intentional patterns)
- Enable `typescript/no-explicit-any` as error
- Add `no-unnecessary-template-expression` rule (evaluate if upstream enables it or if it is covered by categories)
- Expand ignore patterns: `assets/`, `dist/`, `node_modules/`, `pnpm-lock.yaml/`, `skills/`
- Fix all 26 active-code `any` occurrences across `src/` (non-test files)
- Add inline suppression comments only where fixing is genuinely impractical
- Update oxlint version from `^1.41.0` to `^1.43.0`
- Update oxfmt version from `0.26.0` to `0.28.0`
- Fix any new violations surfaced by `perf` and `suspicious` categories
- Verify all existing tests pass after changes
- Verify `pnpm build` and `pnpm check` pass clean

### Out of Scope (Deferred)
- Refactoring legacy code solely to satisfy lint rules - *Reason: scope discipline; only fix violations, not rewrite modules*
- Fixing `any` in test files (44 occurrences) - *Reason: `typescript/no-unsafe-type-assertion` is `off` upstream; test mocks commonly use `as any`*
- Build tooling changes - *Reason: completed in Sessions 02-03*
- CI pipeline updates - *Reason: Session 05 scope*
- `oxlint-tsgolint` plugin installation - *Reason: deferred; only needed for tsgo type checker integration*

---

## 5. Technical Approach

### Architecture

This session modifies only the linting configuration and source code annotations/types. No runtime behavior changes. The `.oxlintrc.json` file is the single configuration entry point for oxlint. Source file changes are limited to:
1. Replacing `any` with proper types (`unknown`, specific types, or `as unknown as T` casts)
2. Fixing violations flagged by newly enabled `perf` and `suspicious` categories
3. Adding targeted inline suppression comments where fixes are impractical

### Strategy: Fix First, Then Enable

To avoid a broken intermediate state:
1. **Phase A**: Update ignore patterns and rule overrides (no new violations)
2. **Phase B**: Fix all `any` occurrences in active code (26 files)
3. **Phase C**: Run lint with proposed config to identify `perf`/`suspicious` violations
4. **Phase D**: Fix or suppress `perf`/`suspicious` violations
5. **Phase E**: Commit final `.oxlintrc.json` with all categories enabled
6. **Phase F**: Update dependency versions (oxlint, oxfmt)
7. **Phase G**: Full validation (`pnpm build`, `pnpm lint`, `pnpm test`)

### Design Patterns
- **Type narrowing over casting**: Prefer `unknown` + type guards over `as unknown as T` where feasible
- **Inline suppression for third-party boundaries**: Where Grammy or plugin SDK types genuinely require `any`, use `// oxlint-disable-next-line typescript/no-explicit-any` with a comment explaining why
- **Incremental verification**: Run `pnpm lint` after each batch of fixes to catch cascading issues early

### Technology Stack
- oxlint `^1.43.0` (linter)
- oxfmt `0.28.0` (formatter)
- TypeScript `^5.9.3` (type system)
- Vitest (test framework, unchanged)

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| None | No new files required | - |

### Files to Modify
| File | Changes | Est. Lines Changed |
|------|---------|------------|
| `.oxlintrc.json` | Add categories, rules, ignore patterns per upstream delta | ~30 |
| `package.json` | Update oxlint `^1.43.0`, oxfmt `0.28.0` | ~2 |
| `src/gateway/*.ts` (2 files) | Replace 5 `as any` casts with proper types | ~10 |
| `src/agents/*.ts` (7 files) | Replace 10 `AgentTool<any>` and `as any` with proper generics/types | ~20 |
| `src/telegram/*.ts` (1 file) | Replace 2 `as any` Grammy type casts | ~4 |
| `src/plugins/*.ts` (1 file) | Replace 2 `as any` on hook handler/promise | ~4 |
| `src/auto-reply/reply/*.ts` (3 files) | Replace 4 `as any` on channel/result types | ~8 |
| `src/security/*.ts` (1 file) | Replace 1 `as any` config property access | ~2 |
| `src/hooks/*.ts` (1 file) | Replace 1 `as any` on message content | ~2 |
| `src/commands/*.ts` (1 file) | Replace 1 `catch (error: any)` with `catch (error: unknown)` | ~2 |
| Various `src/**/*.ts` | Fix `perf`/`suspicious` violations (count TBD after enabling) | ~20 (est.) |

---

## 7. Success Criteria

### Functional Requirements
- [ ] `perf` and `suspicious` categories enabled as error in `.oxlintrc.json`
- [ ] `typescript/no-explicit-any` rule active as error
- [ ] `curly` rule active as error
- [ ] All 12 upstream-aligned rule overrides present
- [ ] Ignore patterns match upstream (minus crocbot-absent directories)
- [ ] Zero `any` types in active code (non-test `src/**/*.ts`)
- [ ] `pnpm lint` passes with zero errors
- [ ] No new runtime regressions introduced by type fixes

### Testing Requirements
- [ ] All existing tests pass (`pnpm test`)
- [ ] `pnpm build` completes successfully
- [ ] `pnpm check` (typecheck + lint + format) passes clean

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions (CONVENTIONS.md)
- [ ] Inline suppression comments include justification
- [ ] No unnecessary `any` -> `unknown` churn in test files

---

## 8. Implementation Notes

### Key Considerations
- The research document (Session 01, Section 5-6) provides the exact recommended `.oxlintrc.json` and the full `any` inventory by file/directory
- `AgentTool<any>` generics in `src/agents/` are the largest remediation cluster (10 occurrences) -- may need a shared tool parameter type or `unknown` default
- Grammy API type boundaries (`src/telegram/`) may require `as unknown as T` casts since Grammy types are external
- The `catch (error: any)` in `src/commands/` should become `catch (error: unknown)` per CONVENTIONS.md

### Potential Challenges
- **High violation count from new categories**: `perf` and `suspicious` may flag more patterns than anticipated. Mitigation: run lint with proposed config first to get exact counts before committing to fixes
- **AgentTool generic types**: Properly typing `AgentTool<any>` may require tracing the tool parameter type through the agent framework. Mitigation: if proper typing is too invasive, use `AgentTool<unknown>` with type guards at usage sites
- **Grammy type boundaries**: Grammy's API types may not expose the specific types needed for narrowing. Mitigation: use `as unknown as SpecificType` with an inline comment referencing the Grammy issue
- **oxlint version compatibility**: New oxlint version may introduce additional rules in `perf`/`suspicious` categories. Mitigation: verify violation count after version bump before and after enabling categories

### Relevant Considerations
- [P00] **TypeScript as refactoring guide**: Stricter linting extends this principle -- the linter now guides code quality improvements incrementally, catching `any` escapes and suspicious patterns at development time
- [P00] **Scope discipline**: Fix violations in active code only; suppress legacy violations rather than refactoring entire modules. Test file `any` (44 occurrences) is explicitly out of scope
- [P00] **Incremental verification**: Run build/lint/test after each batch of fixes to catch issues early. Do not batch all changes into a single commit

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- Run full `pnpm test` suite before and after changes to confirm zero regressions
- No new unit tests required (this session changes types and lint config, not behavior)

### Integration Tests
- `pnpm build` must complete successfully (confirms type changes don't break compilation)
- `pnpm check` must pass clean (typecheck + lint + format)

### Manual Testing
- Run `pnpm lint` with proposed `.oxlintrc.json` before fixing violations to get baseline violation count
- After all fixes, run `pnpm lint` and confirm zero errors
- Spot-check that `as unknown as T` casts are correct by reviewing the surrounding type context

### Edge Cases
- Files that import Grammy types may need special handling at type boundaries
- Plugin hook handlers that accept callbacks with `any` parameters may need function overloads or `unknown`
- `AgentTool` generic parameter may propagate through multiple call sites -- trace the full chain before changing

---

## 10. Dependencies

### External Libraries
- `oxlint`: `^1.41.0` -> `^1.43.0`
- `oxfmt`: `0.26.0` -> `0.28.0`

### Other Sessions
- **Depends on**: `phase05-session01` (research), `phase05-session02` (tsdown), `phase05-session03` (tsconfig)
- **Depended by**: `phase05-session05` (Build Validation & CI Integration)

---

## Reference: Recommended .oxlintrc.json

From Session 01 research (Section 5):

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["unicorn", "typescript", "oxc"],
  "categories": {
    "correctness": "error",
    "perf": "error",
    "suspicious": "error"
  },
  "rules": {
    "curly": "error",
    "eslint-plugin-unicorn/prefer-array-find": "off",
    "eslint/no-await-in-loop": "off",
    "eslint/no-new": "off",
    "oxc/no-accumulating-spread": "off",
    "oxc/no-async-endpoint-handlers": "off",
    "oxc/no-map-spread": "off",
    "typescript/no-explicit-any": "error",
    "typescript/no-extraneous-class": "off",
    "typescript/no-unsafe-type-assertion": "off",
    "unicorn/consistent-function-scoping": "off",
    "unicorn/require-post-message-target-origin": "off"
  },
  "ignorePatterns": [
    "assets/",
    "dist/",
    "node_modules/",
    "pnpm-lock.yaml/",
    "skills/",
    "src/canvas-host/a2ui/a2ui.bundle.js"
  ]
}
```

## Reference: any Type Inventory by File

From Session 01 research (Section 6):

| Directory | Files | Occurrences | Primary Pattern |
|-----------|-------|-------------|-----------------|
| `src/agents/` | 7 | 10 | `AgentTool<any>`, `as any` on parameters |
| `src/gateway/` | 2 | 5 | `as any` casts on tool metadata |
| `src/auto-reply/reply/` | 3 | 4 | `as any` on channel/result types |
| `src/telegram/` | 1 | 2 | `as any` on Grammy API types |
| `src/plugins/` | 1 | 2 | `as any` on hook handler, promise check |
| `src/security/` | 1 | 1 | `as any` on config property access |
| `src/hooks/` | 1 | 1 | `as any` on message content |
| `src/commands/` | 1 | 1 | `catch (error: any)` |
| **Total** | **18** | **26** | |

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
