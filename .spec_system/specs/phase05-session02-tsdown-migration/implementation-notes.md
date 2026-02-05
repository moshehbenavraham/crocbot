# Implementation Notes

**Session ID**: `phase05-session02-tsdown-migration`
**Started**: 2026-02-05 13:04
**Last Updated**: 2026-02-05 13:20

---

## Session Progress

| Metric | Value |
|--------|-------|
| Tasks Completed | 18 / 18 |
| Blockers | 0 |

---

## Baselines

### tsc Build Baseline (T001)

| Metric | Value |
|--------|-------|
| Build time (real) | 10.349s |
| Build time (user) | 17.648s |
| dist/ directories | 111 |
| dist/ files | 1400 |
| dist/ total size | 11M |
| dist/index.js | 2613 bytes |
| dist/entry.js | 4625 bytes |
| dist/plugin-sdk/index.js | 4469 bytes |

Both index.js and entry.js have `#!/usr/bin/env node` shebang lines.

---

## Build Time Comparison

| Metric | tsc | tsdown | Improvement |
|--------|-----|--------|-------------|
| Build time (real) | 10.349s | 4.743s | **54% faster** |
| Build time (user) | 17.648s | 10.052s | **43% faster** |
| tsdown step only | ~8s | ~3.8s | **52% faster** |

### tsdown Build Output

| Metric | Value |
|--------|-------|
| dist/ files (tsdown step) | ~268 (code-split chunks) |
| dist/index.js | 232,568 bytes (bundled with chunk imports) |
| dist/entry.js | 41,041 bytes (bundled with chunk imports) |
| dist/plugin-sdk/index.js | 211,547 bytes |
| dist/plugin-sdk/index.d.ts | 211,351 bytes |

**Key difference**: tsc produces 1400 individual files mirroring src/ directory structure. tsdown produces ~268 code-split chunk files with content-hashed filenames. Both approaches produce functionally equivalent ESM output.

---

## Design Decisions

### Decision 1: skipNodeModulesBundle

**Context**: tsdown tried to bundle native `.node` files from `@napi-rs/canvas` (optionalDep) and `@reflink` (transitive dep), causing build failures.
**Options Considered**:
1. `external: [/\.node$/]` - Only exclude .node files
2. `skipNodeModulesBundle: true` - Skip bundling all node_modules
3. Move optionalDeps to dependencies - Change package.json structure

**Chosen**: Option 2 (`skipNodeModulesBundle: true`)
**Rationale**: This is a Node.js CLI app, not a library for browsers. We want tsdown to transpile source code only, matching tsc's behavior. The upstream doesn't have `@napi-rs/canvas` so doesn't hit this issue. `skipNodeModulesBundle` is the cleanest solution and correct semantically.

### Decision 2: rolldown version 1.0.0-rc.3 (not rc.2)

**Context**: The spec called for rolldown 1.0.0-rc.2, but tsdown 0.20.3 depends on rolldown 1.0.0-rc.3. Using rc.2 caused a `ctx.inner is not a function` error in the DTS plugin.
**Chosen**: Updated to rolldown 1.0.0-rc.3 to match tsdown's peer dependency.
**Rationale**: tsdown and rolldown must use matching versions. The spec was written when tsdown 0.20.1 was latest; 0.20.3 bumped the rolldown peer dep.

### Decision 3: Shared config object

**Context**: The upstream tsdown.config.ts repeats `env`, `fixedExtension`, and `platform` in each entry.
**Chosen**: Extracted shared options into a `shared` const to reduce duplication, then spread into each entry.
**Rationale**: Reduces repetition while keeping the same effective config. Added `skipNodeModulesBundle` to shared since it applies to all entries.

---

## Task Log

### [2026-02-05] - Session Start

**Environment verified**:
- [x] Prerequisites confirmed (jq, git available)
- [x] Tools available (Node 22, pnpm, tsc)
- [x] Directory structure ready

---

### Task T001 - Record tsc build baseline

**Started**: 2026-02-05 13:04
**Completed**: 2026-02-05 13:06

**Notes**:
- Clean build (rm -rf dist/) timed at 10.349s real time
- dist/ contains 111 directories, 1400 files, 11MB total
- Shebangs present on index.js and entry.js
- tsc produces individual .js files mirroring src/ structure

**Files Changed**:
- None (baseline capture only)

---

### Tasks T002-T003 - Install tsdown and update rolldown

**Started**: 2026-02-05 13:06
**Completed**: 2026-02-05 13:07

**Notes**:
- Installed tsdown@^0.20.3 (latest matching ^0.20.1) as devDep
- Updated rolldown from 1.0.0-rc.1 to 1.0.0-rc.3 (matching tsdown peer dep)
- Both packages verified with `pnpm ls`

**Files Changed**:
- `package.json` - Added tsdown devDep, updated rolldown version

---

### Task T004 - Create tsdown.config.ts

**Started**: 2026-02-05 13:07
**Completed**: 2026-02-05 13:08

**Notes**:
- Created config with 3 entries matching upstream structure (dropped extensionAPI.ts)
- Used shared config object to reduce duplication
- Added `skipNodeModulesBundle: true` for native dep compatibility

**Files Changed**:
- `tsdown.config.ts` - New file (27 lines)

---

### Task T005 - Update tsconfig.json

**Started**: 2026-02-05 13:08
**Completed**: 2026-02-05 13:08

**Notes**:
- Replaced `noEmitOnError: true` with `noEmit: true`
- tsc now functions as type-checker only; tsdown handles emission

**Files Changed**:
- `tsconfig.json` - Swapped noEmitOnError for noEmit

---

### Task T006 - Verify tsdown config loads

**Started**: 2026-02-05 13:08
**Completed**: 2026-02-05 13:11

**Notes**:
- Initial dry run failed: `process.getBuiltinModule is not a function` (Node 22.0.0)
- Switched to Node 22.22.0 via nvm; resolved
- Second dry run failed: DTS plugin error with rolldown rc.2; updated to rc.3
- Third dry run failed: native .node files from @napi-rs/canvas; added skipNodeModulesBundle
- Fourth dry run succeeded: all 3 entries built, shebangs preserved

**Files Changed**:
- `tsdown.config.ts` - Added skipNodeModulesBundle
- `package.json` - Updated rolldown to rc.3

---

### Tasks T007-T008 - Update build script and add check script

**Started**: 2026-02-05 13:11
**Completed**: 2026-02-05 13:12

**Notes**:
- Replaced `tsc -p tsconfig.json` with `tsdown` in build script
- All post-build steps preserved unchanged
- Added `check` script: `tsc --noEmit && pnpm lint && pnpm format`

**Files Changed**:
- `package.json` - Updated build script, added check script

---

### Task T009 - Full pnpm build verification

**Started**: 2026-02-05 13:12
**Completed**: 2026-02-05 13:13

**Notes**:
- Clean build (rm -rf dist/) completed in 4.743s (real)
- All pipeline steps executed: a2ui bundle, tsdown, canvas copy, hook metadata, build info
- Exit code 0

---

### Tasks T010-T012 - Verify dist output files

**Completed**: 2026-02-05 13:13

**Notes**:
- dist/index.js: shebang preserved, valid ESM, 232KB
- dist/entry.js: shebang preserved, valid ESM, 41KB
- dist/plugin-sdk/index.js: valid ESM, 212KB
- dist/plugin-sdk/index.d.ts: type declarations, 211KB

---

### Task T013 - Full test suite regression

**Completed**: 2026-02-05 13:16

**Notes**:
- All tests pass: 4051 passed, 2 skipped, 0 failed
- Matches baseline exactly
- Zero regressions from tsdown migration

---

### Task T014 - pnpm check verification

**Completed**: 2026-02-05 13:17

**Notes**:
- `tsc --noEmit`: passed cleanly
- `pnpm lint`: 0 warnings, 0 errors (104 rules, 2164 files)
- `pnpm format`: all files correctly formatted (2172 files)

---

### Tasks T015-T017 - Post-build artifacts, CLI test, quality gates

**Completed**: 2026-02-05 13:18

**Notes**:
- build-info.json: present, correct version and commit
- Hook metadata: 4 HOOK.md files copied (boot-md, command-logger, session-memory, soul-evil)
- Canvas assets: present in dist/canvas-host/
- CLI --help: works correctly, shows version 2026.1.65
- CLI --version: outputs 2026.1.65
- All modified files: ASCII-encoded, Unix LF, no `any` types

---

### Task T018 - Build time comparison documentation

**Completed**: 2026-02-05 13:20

**Notes**:
- Full pipeline: 10.349s (tsc) -> 4.743s (tsdown) = 54% faster
- tsdown step alone: ~3.8s (vs ~8s for tsc)
- Documented in this file above

---

## Blockers & Solutions

### Blocker 1: Node 22.0.0 incompatibility

**Description**: tsdown 0.20.3 uses `process.getBuiltinModule` (Node 22.3.0+), but environment had Node 22.0.0.
**Impact**: T006 (config verification)
**Resolution**: Switched to Node 22.22.0 via nvm (already installed).
**Time Lost**: Minimal (diagnostic only)

### Blocker 2: rolldown version mismatch

**Description**: tsdown 0.20.3 bundles rolldown 1.0.0-rc.3 internally but our devDep was rc.2, causing DTS plugin `ctx.inner is not a function` error.
**Impact**: T006 (config verification)
**Resolution**: Updated rolldown devDep to 1.0.0-rc.3.
**Time Lost**: Minimal (diagnostic only)

### Blocker 3: Native .node file bundling

**Description**: tsdown tried to bundle native `.node` binary files from `@napi-rs/canvas` (optionalDep) and `@reflink` (transitive dep).
**Impact**: T006 (config verification)
**Resolution**: Added `skipNodeModulesBundle: true` to tsdown config.
**Time Lost**: Minimal (research + fix)
