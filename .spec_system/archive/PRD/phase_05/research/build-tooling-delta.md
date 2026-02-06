# Build Tooling Delta: crocbot vs Upstream OpenClaw

**Session**: `phase05-session01-research-build-tooling-delta`
**Date**: 2026-02-05
**Upstream Reference**: `.001_ORIGINAL/` at commit `2b1da4f5d86f` (2026-02-04)

---

## Table of Contents

1. [Entry Point Mapping](#1-entry-point-mapping)
2. [extensionAPI.ts Absence Impact](#2-extensionapits-absence-impact)
3. [tsconfig.json Delta Analysis](#3-tsconfigjson-delta-analysis)
4. [ui/tsconfig.json Delta Analysis](#4-uitsconfigjson-delta-analysis)
5. [oxlint Delta Analysis](#5-oxlint-delta-analysis)
6. [any Type Inventory](#6-any-type-inventory)
7. [Build Script Pipeline Comparison](#7-build-script-pipeline-comparison)
8. [Prioritized Migration Plan](#8-prioritized-migration-plan)

---

## 1. Entry Point Mapping

### Entry Point Comparison Table

| Entry Point | crocbot | Upstream | tsdown Config Required |
|-------------|---------|----------|------------------------|
| `src/index.ts` | Exists (CLI + library) | Exists (CLI + library) | `{ entry: "src/index.ts", env, fixedExtension: false, platform: "node" }` |
| `src/entry.ts` | Exists (process bootstrap) | Exists (process bootstrap) | `{ entry: "src/entry.ts", env, fixedExtension: false, platform: "node" }` |
| `src/plugin-sdk/index.ts` | Exists (plugin SDK) | Exists (plugin SDK) | `{ dts: true, entry: "src/plugin-sdk/index.ts", outDir: "dist/plugin-sdk", env, fixedExtension: false, platform: "node" }` |
| `src/extensionAPI.ts` | Does NOT exist | Exists (agent extension API) | Omit from crocbot config |

### Entry Point Details

**src/index.ts** -- Main CLI executable and library export:
- Shebang: `#!/usr/bin/env node`
- Loads environment, normalizes env vars, sets up error handlers
- Builds CLI program via `buildProgram()` and calls `program.parseAsync()`
- Exports 19 named utility functions (crocbot) / 22 (upstream)
- Package.json: `"main": "dist/index.js"`, exports as `"."`

**src/entry.ts** -- Process bootstrap wrapper:
- Shebang: `#!/usr/bin/env node`
- Sets `process.title`; handles `--no-color` flags
- Respawns with updated `NODE_OPTIONS` to suppress ExperimentalWarning
- Windows argv normalization
- Lazy-imports `./cli/run-main.js` to call `runCli()`
- Package.json: `"bin": { "crocbot": "dist/entry.js" }`, exports as `"./cli-entry"`
- No symbol exports (side-effects only)

**src/plugin-sdk/index.ts** -- Plugin developer SDK:
- Pure re-exports, no runtime code
- crocbot exports ~85+ items (Telegram-only channel adapters, types, utilities)
- Upstream exports ~392+ items (all channel adapters: Discord, Slack, WhatsApp, Signal, iMessage, GoogleChat, MSTeams, LINE, Feishu, etc.)
- This is the ONLY entry point that generates `.d.ts` type declarations (`dts: true`)
- Package.json: exports as `"./plugin-sdk"` and `"./plugin-sdk/*"`

### tsdown Common Settings

All upstream entry points share:
- `env: { NODE_ENV: "production" }` -- enables dead-code elimination for `process.env.NODE_ENV` checks
- `fixedExtension: false` -- lets bundler choose output extension (`.js` for ESM)
- `platform: "node"` -- targets Node.js (excludes browser polyfills)

### Crocbot tsdown.config.ts (Proposed)

```ts
import { defineConfig } from "tsdown";

const env = {
  NODE_ENV: "production",
};

export default defineConfig([
  {
    entry: "src/index.ts",
    env,
    fixedExtension: false,
    platform: "node",
  },
  {
    entry: "src/entry.ts",
    env,
    fixedExtension: false,
    platform: "node",
  },
  {
    dts: true,
    entry: "src/plugin-sdk/index.ts",
    outDir: "dist/plugin-sdk",
    env,
    fixedExtension: false,
    platform: "node",
  },
]);
```

---

## 2. extensionAPI.ts Absence Impact

### Background

Upstream OpenClaw has `src/extensionAPI.ts` which exports agent-level extension utilities:
- `resolveAgentDir`, `resolveAgentWorkspaceDir`
- `DEFAULT_MODEL`, `DEFAULT_PROVIDER`
- `resolveAgentIdentity`, `resolveThinkingDefault`
- `runEmbeddedPiAgent`, `resolveAgentTimeoutMs`
- `ensureAgentWorkspace`
- `resolveStorePath`, `loadSessionStore`, `saveSessionStore`, `resolveSessionFilePath`

### Impact Assessment

| Impact Area | Risk | Details |
|-------------|------|---------|
| tsdown config | None | Simply omit the 4th entry from `defineConfig()` array |
| Package exports | None | crocbot's `package.json` does not export an `./extensionAPI` path |
| Plugin SDK | None | Plugin SDK re-exports cover all needed plugin-facing APIs |
| Internal code | None | Internal imports reference source modules directly, not `extensionAPI.ts` |
| Downstream consumers | None | No known consumers of an extensionAPI bundle from crocbot |

### Decision: SAFE TO OMIT

The `src/extensionAPI.ts` entry point was introduced upstream for native app integrations (macOS, iOS, Android) that need agent workspace access. crocbot removed all native apps during Phase 00. The functionality it exposes (agent workspace, session store) is available through direct internal imports for the CLI and gateway, and through the plugin-sdk for plugins.

No code changes needed. The crocbot `tsdown.config.ts` will have 3 entries instead of upstream's 4.

---

## 3. tsconfig.json Delta Analysis

### Line-by-Line Comparison

| Option | crocbot | Upstream | Decision | Rationale |
|--------|---------|----------|----------|-----------|
| `target` | `ES2022` | `es2023` | **ADOPT** | Node 22+ supports all ES2023 features (Array.findLast, hashbang, etc.). Safe upgrade. |
| `module` | `NodeNext` | `NodeNext` | Match | Already aligned |
| `moduleResolution` | `NodeNext` | `NodeNext` | Match | Already aligned |
| `outDir` | `dist` | `dist` | Match | Already aligned |
| `rootDir` | `src` | `src` | Match | Already aligned |
| `strict` | `true` | `true` | Match | Already aligned |
| `esModuleInterop` | `true` | `true` | Match | Already aligned |
| `forceConsistentCasingInFileNames` | `true` | `true` | Match | Already aligned |
| `skipLibCheck` | `true` | `true` | Match | Already aligned |
| `resolveJsonModule` | `true` | `true` | Match | Already aligned |
| `noEmitOnError` | `true` | `true` | Match | Already aligned |
| `allowSyntheticDefaultImports` | `true` | `true` | Match | Already aligned |
| `allowImportingTsExtensions` | Not set | `true` | **ADOPT** | Enables `.ts` imports in source files (tsdown handles resolution). Required for tsdown workflow since tsdown bundles from .ts sources directly. |
| `declaration` | Not set | `true` | **ADOPT** | Enables `.d.ts` generation. With tsdown, this is handled by tsdown's `dts: true` flag per entry point, but having it in tsconfig supports `tsc --noEmit` type checking. |
| `experimentalDecorators` | Not set | `true` | **ADOPT** | Upstream uses experimental decorators. Needed if any code uses decorators. Low risk to enable. |
| `lib` | Not set (defaults) | `["DOM", "DOM.Iterable", "ES2023", "ScriptHost"]` | **ADAPT** | crocbot is Node-only CLI/gateway. DOM libs are only needed for `ui/` code. Upstream includes `ui/**/*` in root tsconfig. If crocbot keeps separate `ui/tsconfig.json`, use `["ES2023"]` only. If unifying, match upstream. |
| `noEmit` | Not set | `true` | **ADOPT** | With tsdown handling compilation, tsc should only type-check. `noEmit: true` prevents tsc from outputting files. This replaces the current `tsc -p tsconfig.json` build step with `tsc --noEmit` for type checking + `tsdown` for bundling. |
| `useDefineForClassFields` | Not set | `false` | **ADOPT** | Controls class field initialization semantics. `false` uses legacy TypeScript behavior (assign in constructor). Matches upstream. |
| `include` | `["src/**/*"]` | `["src/**/*", "ui/**/*"]` | **REJECT** | crocbot keeps `ui/` in separate tsconfig. Keep `["src/**/*"]` only. |
| `exclude` | Standard | Standard | Match | Already aligned (node_modules, dist, test files) |

### Summary of Changes for Session 03

| Change | Category | Risk |
|--------|----------|------|
| `target`: `ES2022` -> `es2023` | Adopt | Low -- Node 22 fully supports ES2023 |
| Add `allowImportingTsExtensions: true` | Adopt | Low -- required for tsdown |
| Add `declaration: true` | Adopt | Low -- supports type checking |
| Add `experimentalDecorators: true` | Adopt | Low -- no breaking effect if unused |
| Add `lib: ["ES2023"]` | Adapt | Low -- explicit is better |
| Add `noEmit: true` | Adopt | Medium -- changes build model (tsc no longer emits; tsdown does) |
| Add `useDefineForClassFields: false` | Adopt | Low -- matches upstream behavior |
| Keep `include: ["src/**/*"]` | Reject upstream | None -- crocbot has separate ui config |

---

## 4. ui/tsconfig.json Delta Analysis

### Current State

| Aspect | crocbot | Upstream |
|--------|---------|----------|
| File exists | Yes (`ui/tsconfig.json`) | No (ui included in root tsconfig) |
| target | ES2022 | (root) es2023 |
| module | ESNext | (root) NodeNext |
| moduleResolution | Bundler | (root) NodeNext |
| lib | `["ES2022", "DOM", "DOM.Iterable"]` | (root) `["DOM", "DOM.Iterable", "ES2023", "ScriptHost"]` |
| strict | true | (root) true |
| experimentalDecorators | true | (root) true |
| skipLibCheck | true | (root) true |
| types | `["vite/client"]` | Not set |
| useDefineForClassFields | false | (root) false |

### Analysis

Upstream unifies UI into the root tsconfig by adding `"ui/**/*"` to the `include` array and using `lib: ["DOM", "DOM.Iterable", ...]` at the root level. This means the root tsconfig must include DOM types even though `src/` code is Node-only.

crocbot separates UI into its own tsconfig, which is cleaner: `src/` gets Node-appropriate settings and `ui/` gets browser-appropriate settings (Bundler moduleResolution, DOM libs, Vite client types).

### Decision: REJECT UNIFICATION

Keep `ui/tsconfig.json` separate from root tsconfig:

1. **Separation of concerns**: Node code (`src/`) should not have DOM types in scope
2. **moduleResolution**: UI uses `Bundler` (for Vite), src uses `NodeNext` (for Node)
3. **types**: UI needs `vite/client` type augmentations not relevant to src
4. **Build tooling**: UI uses esbuild via Vite (unchanged in upstream); src uses tsdown. Different build tools, different configs.

Recommended `ui/tsconfig.json` update for Session 03:
- `target`: `ES2022` -> `ES2023` (align with root)
- `lib`: `["ES2022", "DOM", "DOM.Iterable"]` -> `["ES2023", "DOM", "DOM.Iterable"]` (align target year)

---

## 5. oxlint Delta Analysis

### Plugin Comparison

| Plugin | crocbot | Upstream | Decision |
|--------|---------|----------|----------|
| `unicorn` | Enabled | Enabled | Match |
| `typescript` | Enabled | Enabled | Match |
| `oxc` | Enabled | Enabled | Match |

Plugins are already aligned. No changes needed.

### Category Comparison

| Category | crocbot | Upstream | Decision | Rationale |
|----------|---------|----------|----------|-----------|
| `correctness` | `error` | `error` | Match | Already aligned |
| `perf` | Not set | `error` | **ADOPT** | Catches performance anti-patterns (unnecessary spread, accumulating arrays). Low false-positive rate. |
| `suspicious` | Not set | `error` | **ADOPT** | Catches suspicious patterns (duplicate keys, unreachable code, assignment in conditions). High value, low noise. |

### Rules Comparison

| Rule | crocbot | Upstream | Decision | Rationale |
|------|---------|----------|----------|-----------|
| `curly` | Not set | `error` | **ADOPT** | Enforces braces on all control statements. Prevents bugs from missing braces. |
| `eslint-plugin-unicorn/prefer-array-find` | Not set | `off` | **ADOPT** | Upstream disabled it -- likely too noisy or conflicts with codebase patterns. |
| `eslint/no-await-in-loop` | Not set | `off` | **ADOPT** | Upstream disabled it -- sequential awaits are intentional in many places (CONVENTIONS.md allows `for...of` with `await`). |
| `eslint/no-new` | Not set | `off` | **ADOPT** | Upstream disabled it -- constructors with side effects are used (e.g., `new Error()`). |
| `oxc/no-accumulating-spread` | Not set | `off` | **ADOPT** | Disabled despite `perf` category. Pattern exists in codebase intentionally. |
| `oxc/no-async-endpoint-handlers` | Not set | `off` | **ADOPT** | Not applicable -- crocbot uses Hono, not Express-style handlers. |
| `oxc/no-map-spread` | Not set | `off` | **ADOPT** | Disabled despite `perf` category. Map spread used intentionally. |
| `typescript/no-explicit-any` | Not set | `error` | **ADOPT** | Aligns with CONVENTIONS.md ("avoid `any` - use `unknown`"). Enforces at lint time. See Section 6 for remediation scope. |
| `typescript/no-extraneous-class` | Not set | `off` | **ADOPT** | Upstream disabled it -- some classes are used as namespaces. |
| `typescript/no-unsafe-type-assertion` | Not set | `off` | **ADOPT** | Disabled upstream -- `as` casts are common for test mocks. |
| `unicorn/consistent-function-scoping` | Not set | `off` | **ADOPT** | Upstream disabled it -- nested helper functions are common. |
| `unicorn/require-post-message-target-origin` | Not set | `off` | **ADOPT** | Not applicable to Node-only code. |

### Ignore Patterns Comparison

| Pattern | crocbot | Upstream | Decision | Rationale |
|---------|---------|----------|----------|-----------|
| `src/canvas-host/a2ui/a2ui.bundle.js` | Present | Present | Match | Already aligned |
| `assets/` | Not set | Present | **ADOPT** | Excludes non-code asset directory |
| `dist/` | Not set | Present | **ADOPT** | Excludes build output |
| `docs/_layouts/` | Not set | Present | **REJECT** | crocbot uses Mintlify, not custom layouts |
| `node_modules/` | Not set | Present | **ADOPT** | Explicit exclusion (may be redundant with default) |
| `patches/` | Not set | Present | **REJECT** | crocbot has no patches directory |
| `pnpm-lock.yaml/` | Not set | Present | **ADOPT** | Excludes lock file from scanning |
| `skills/` | Not set | Present | **ADOPT** | Excludes skills directory (contains markdown/templates) |
| `Swabble/` | Not set | Present | **REJECT** | Upstream-only directory, does not exist in crocbot |
| `vendor/` | Not set | Present | **REJECT** | crocbot has no vendor directory |

### Version Delta

| Tool | crocbot | Upstream | Decision |
|------|---------|----------|----------|
| `oxlint` | `^1.41.0` | `^1.43.0` | **ADOPT** | Update to `^1.43.0` for latest rules |
| `oxfmt` | `0.26.0` | `0.28.0` | **ADOPT** | Update for latest formatting |
| `oxlint-tsgolint` | Not installed | `^0.11.4` | **DEFER** | Only needed if adopting tsgo type checker (evaluate in S03/S04) |

### Recommended .oxlintrc.json for Session 04

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

---

## 6. any Type Inventory

### Methodology

Search pattern: `: any\b|: any[;),\]]|<any>|<any,|as any\b|\bany\[`
Tool: ripgrep 14.1.0
Scope: `src/` directory, excluding `node_modules/`, `dist/`, `.001_ORIGINAL/`

### Reproducible Commands

```bash
# Total count
rg -c '(: any\b|: any[;),\]]|<any>|<any,|as any\b|\bany\[)' --glob '*.ts' src/

# Active code only (no test files)
rg -c '(: any\b|: any[;),\]]|<any>|<any,|as any\b|\bany\[)' --glob '*.ts' src/ | grep -v '\.test\.'

# Test files only
rg -c '(: any\b|: any[;),\]]|<any>|<any,|as any\b|\bany\[)' --glob '*.test.ts' src/
```

### Summary

| Category | Files | Occurrences |
|----------|-------|-------------|
| Active code | 18 | 26 |
| Test files | 12 | 44 |
| **Total** | **30** | **70** |
| Stub files (tts/, pairing/, device-pairing.ts) | 0 | 0 |

### Active Code Breakdown by Directory

| Directory | Files | Occurrences | Primary Pattern |
|-----------|-------|-------------|-----------------|
| `src/gateway/` | 2 | 5 | `as any` casts on tool metadata |
| `src/agents/` | 7 | 10 | Generic tool types `AgentTool<any>`, `as any` on parameters |
| `src/telegram/` | 1 | 2 | `as any` on Grammy API types |
| `src/plugins/` | 1 | 2 | `as any` on hook handler, promise check |
| `src/auto-reply/reply/` | 3 | 4 | `as any` on channel/result types |
| `src/security/` | 1 | 1 | `as any` on config property access |
| `src/hooks/` | 1 | 1 | `as any` on message content |
| `src/commands/` | 1 | 1 | `catch (error: any)` |

### Test File Breakdown by Directory

| Directory | Files | Occurrences | Primary Pattern |
|-----------|-------|-------------|-----------------|
| `src/tui/` | 2 | 13 | `as any` for mock objects |
| `src/gateway/` | 2 | 12 | `as any` for mock objects |
| `src/agents/` | 2 | 8 | `as any` for mock inputs |
| `src/telegram/bot/` | 1 | 4 | `as any` for mock objects |
| `src/browser/` | 2 | 4 | `as any` for mock contexts |
| Other | 3 | 3 | `as any` for mock objects |

### Remediation Effort Assessment

**Active code (26 occurrences)**:
- ~10 are `AgentTool<any>` generic types -- these need proper tool parameter types
- ~12 are `as any` escape hatches on third-party types (Grammy, plugin hooks) -- these may need `as unknown as TargetType` or proper type narrowing
- ~4 are parameter types -- need `unknown` with type guards

**Test files (44 occurrences)**:
- Nearly all are `as any` on mock objects -- these can remain as `as any` since `typescript/no-unsafe-type-assertion` is set to `off` upstream, OR they can be converted to proper mock types
- Test file `any` is lower priority than active code `any`

**Estimated effort**: Session 04 should plan for ~26 active code fixes. Most are straightforward `as any` -> `as unknown as Type` or adding proper generics.

---

## 7. Build Script Pipeline Comparison

### Current crocbot Build Pipeline

```
pnpm build
  1. pnpm canvas:a2ui:bundle          # bash scripts/build/bundle-a2ui.sh
  2. tsc -p tsconfig.json              # TypeScript compilation (emits to dist/)
  3. node --import tsx scripts/build/canvas-a2ui-copy.ts   # copy a2ui bundle
  4. node --import tsx scripts/copy-hook-metadata.ts       # copy hook metadata
  5. node --import tsx scripts/build/write-build-info.ts   # write build info
```

### Upstream Build Pipeline

```
pnpm build
  1. pnpm canvas:a2ui:bundle          # bash scripts/bundle-a2ui.sh
  2. tsdown                           # tsdown bundler (emits to dist/)
  3. node --import tsx scripts/canvas-a2ui-copy.ts         # copy a2ui bundle
  4. node --import tsx scripts/copy-hook-metadata.ts       # copy hook metadata
  5. node --import tsx scripts/write-build-info.ts         # write build info
  6. node --import tsx scripts/write-cli-compat.ts         # write CLI compat shims
```

### Type Checking Comparison

| Aspect | crocbot (current) | Upstream |
|--------|-------------------|----------|
| Type checking | `tsc -p tsconfig.json` (during build) | `pnpm tsgo` (separate `check` script) |
| Build output | `tsc` emits `.js` to `dist/` | `tsdown` bundles to `dist/` |
| Lint check | `pnpm lint` (separate) | `pnpm check` runs `tsgo && lint && format` |
| `noEmit` | Not set (tsc emits) | `true` (tsc/tsgo only type-checks) |

### Key Differences

| Step | crocbot | Upstream | Migration Action |
|------|---------|----------|-----------------|
| Compilation | `tsc -p tsconfig.json` | `tsdown` | Replace tsc with tsdown in build script |
| Type checking | Combined with build (tsc emits) | Separate (`pnpm tsgo` or `tsc --noEmit`) | Add separate type-check step; add `noEmit: true` to tsconfig |
| CLI compat | Not present | `write-cli-compat.ts` | Evaluate need (likely unnecessary for crocbot's single-binary deployment) |
| Quality check | `pnpm lint` + `pnpm format` | `pnpm check` (tsgo + lint + format) | Create `pnpm check` convenience script |

### tsdown Dependency Requirements

| Dependency | Version | Purpose | Install Command |
|------------|---------|---------|-----------------|
| `tsdown` | `^0.20.1` | TypeScript bundler (built on rolldown) | `pnpm add -D tsdown@^0.20.1` |
| `rolldown` | `1.0.0-rc.2` | Bundler engine (peer dep of tsdown) | Already present: `1.0.0-rc.1` -> update to `1.0.0-rc.2` |

**pnpm.patchedDependencies**: Neither crocbot nor upstream has patched dependencies. No conflicts.

**pnpm overrides to check**:
- crocbot has `hono: 4.11.4`; upstream has `hono: 4.11.7` -- update recommended
- crocbot has `tar: 7.5.4`; upstream has `tar: 7.5.7` -- update recommended
- Upstream adds overrides for `fast-xml-parser`, `form-data`, `@hono/node-server>hono`, `qs` -- evaluate relevance

### Proposed crocbot Build Script (Post-Migration)

```json
{
  "build": "pnpm canvas:a2ui:bundle && tsdown && node --import tsx scripts/build/canvas-a2ui-copy.ts && node --import tsx scripts/copy-hook-metadata.ts && node --import tsx scripts/build/write-build-info.ts",
  "check": "tsc --noEmit && pnpm lint && pnpm format"
}
```

Changes from current:
1. Replace `tsc -p tsconfig.json` with `tsdown`
2. Add `check` script for type checking + linting + formatting
3. Drop `write-cli-compat.ts` step (not needed for crocbot)

---

## 8. Prioritized Migration Plan

### Session Dependency Ordering

```
S01 (this) --> S02 (tsdown) --> S03 (tsconfig) --> S04 (oxlint) --> S05 (CI/validation)
  |               |                |                   |                |
  |               |                |                   |                +-- CI workflow updates
  |               |                |                   +-- Enable perf/suspicious categories
  |               |                +-- Adopt tsconfig delta options
  |               +-- Install tsdown, replace tsc in build
  +-- Research document (this file)
```

### Session 02: tsdown Migration

**Priority**: Highest (foundational -- all subsequent sessions depend on tsdown being in place)

**Scope**:
1. Install `tsdown@^0.20.1` as devDependency
2. Update `rolldown` from `1.0.0-rc.1` to `1.0.0-rc.2`
3. Create `tsdown.config.ts` with 3 entry points (index, entry, plugin-sdk)
4. Update `package.json` build script: replace `tsc -p tsconfig.json` with `tsdown`
5. Add `noEmit: true` to `tsconfig.json` (tsc no longer emits)
6. Add `check` script: `tsc --noEmit && pnpm lint && pnpm format`
7. Verify `dist/` output matches current structure (index.js, entry.js, plugin-sdk/)
8. Run full test suite to confirm no regressions

**Crocbot-Specific Adaptations**:
- 3 entry points instead of upstream's 4 (no extensionAPI.ts)
- No `write-cli-compat.ts` post-build step
- Verify Docker build still works (`node dist/entry.js` entry point unchanged)

**Risks**:
- tsdown output may differ from tsc output in module resolution or import rewriting
- Plugin SDK `.d.ts` generation via tsdown may differ from tsc-generated declarations
- Build-time environment variable injection (`NODE_ENV: "production"`) may affect dead-code paths

### Session 03: TypeScript Config Unification

**Priority**: High (adopts tsconfig delta once tsdown is in place)

**Scope**:
1. Update root `tsconfig.json` with adopted options:
   - `target`: `ES2022` -> `es2023`
   - Add `allowImportingTsExtensions: true`
   - Add `declaration: true`
   - Add `experimentalDecorators: true`
   - Add `lib: ["ES2023"]`
   - Confirm `noEmit: true` (added in S02)
   - Add `useDefineForClassFields: false`
2. Update `ui/tsconfig.json`:
   - `target`: `ES2022` -> `ES2023`
   - `lib`: Update to `["ES2023", "DOM", "DOM.Iterable"]`
3. Keep `ui/tsconfig.json` separate (reject unification with root)
4. Run type-check (`tsc --noEmit`) to verify zero new errors
5. Run full test suite

**Crocbot-Specific Adaptations**:
- Keep separate `ui/tsconfig.json` (upstream unifies into root)
- Do NOT add DOM libs to root tsconfig (crocbot src/ is Node-only)
- Keep `include: ["src/**/*"]` (not `["src/**/*", "ui/**/*"]`)

**Risks**:
- `allowImportingTsExtensions: true` may interact with existing `.js` extension imports
- `es2023` target may expose new type errors if code assumes ES2022 semantics
- `useDefineForClassFields: false` may change class initialization behavior

### Session 04: Stricter Linting Rules

**Priority**: Medium (code quality improvement, no build dependency)

**Scope**:
1. Update `oxlint` from `^1.41.0` to `^1.43.0`
2. Update `oxfmt` from `0.26.0` to `0.28.0`
3. Add `perf` and `suspicious` categories to `.oxlintrc.json`
4. Add all upstream rule overrides (12 rules)
5. Add additional ignore patterns (assets/, dist/, node_modules/, etc.)
6. Enable `typescript/no-explicit-any: error`
7. Fix 26 active-code `any` occurrences (see Section 6)
8. Run `pnpm lint` to verify clean output
9. Run full test suite

**Crocbot-Specific Adaptations**:
- Ignore patterns exclude crocbot-absent directories (no Swabble/, patches/, vendor/)
- `any` remediation scope is 26 active code + optionally 44 test occurrences
- Evaluate `oxlint-tsgolint` plugin (deferred -- only needed for tsgo integration)

**Risks**:
- New `perf` and `suspicious` categories may flag existing code
- `typescript/no-explicit-any: error` will block CI until all 26 active code `any` are fixed
- Approach: fix all `any` first, THEN enable the rule, to avoid broken builds

### Session 05: Build Validation & CI Integration

**Priority**: Lower (finalization and CI updates)

**Scope**:
1. Update CI workflows to use new build/check commands
2. Add `pnpm check` to CI pipeline (replaces separate tsc step)
3. Verify Docker build with tsdown output
4. Run full E2E test suite against tsdown-built artifacts
5. Update CONVENTIONS.md with new build tooling details
6. Verify deployment works (Coolify/Docker)

**Crocbot-Specific Adaptations**:
- CI workflow is `.github/workflows/ci.yml`
- Docker healthcheck endpoint must still work
- `node dist/entry.js` must still be valid Docker entry point

**Risks**:
- CI environment may need updated Node version or tool versions
- Docker layer caching may need adjustment for new build output

### Risk Summary

| Risk | Severity | Mitigation |
|------|----------|------------|
| tsdown output differs from tsc | High | Compare dist/ output before/after; run full test suite |
| Plugin SDK .d.ts changes | Medium | Compare generated types; verify plugin consumers still compile |
| New lint rules flag existing code | Medium | Fix violations before enabling rules |
| `allowImportingTsExtensions` conflicts | Low | Test with existing .js imports |
| Docker build regression | Medium | Test Docker build in CI before merge |
| Node 22 ES2023 compatibility | Low | Already verified in upstream production |

---

## Appendix: Version Reference

| Tool | crocbot (current) | Upstream | Action |
|------|-------------------|----------|--------|
| TypeScript | ^5.9.3 | ^5.9.3 | Match |
| oxlint | ^1.41.0 | ^1.43.0 | Update |
| oxfmt | 0.26.0 | 0.28.0 | Update |
| tsdown | Not installed | ^0.20.1 | Install |
| rolldown | 1.0.0-rc.1 | 1.0.0-rc.2 | Update |
| oxlint-tsgolint | Not installed | ^0.11.4 | Defer |
| Node.js | 22+ | 22+ | Match |
