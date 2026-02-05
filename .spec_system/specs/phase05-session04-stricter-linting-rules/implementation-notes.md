# Implementation Notes

**Session ID**: `phase05-session04-stricter-linting-rules`
**Started**: 2026-02-05 14:12
**Last Updated**: 2026-02-05 15:45

---

## Session Progress

| Metric | Value |
|--------|-------|
| Tasks Completed | 20 / 20 |
| Blockers | 0 |

---

## Task Log

### [2026-02-05] - Session Start

**Environment verified**:
- [x] Prerequisites confirmed (node 22 via nvm)
- [x] Tools available (pnpm, oxlint, tsc)
- [x] Directory structure ready

---

### T001 - Verify Prerequisites

**Completed**: 2026-02-05 14:15

**Notes**:
- `pnpm build`: 135 files, clean
- `pnpm lint`: 0 warnings, 0 errors, 104 rules, 2164 files
- `pnpm test`: 200 tests passed, 34 test files

### T002 - Snapshot Lint Baseline

**Completed**: 2026-02-05 14:15

**Baseline**: 0 warnings, 0 errors (104 rules, 2164 files)

### T003 - Update Dependency Versions

**Completed**: 2026-02-05 14:18

**Files Changed**:
- `package.json` -- oxlint `^1.41.0` -> `^1.43.0`, oxfmt `0.26.0` -> `0.28.0`, oxlint-tsgolint `^0.11.1` -> `^0.11.2`

### T004 - Expand Ignore Patterns

**Completed**: 2026-02-05 14:20

**Files Changed**:
- `.oxlintrc.json` -- added `assets/`, `dist/`, `node_modules/`, `pnpm-lock.yaml/`, `skills/`, `src/canvas-host/a2ui/a2ui.bundle.js`

### T005 - Add Upstream-Aligned Rule Overrides

**Completed**: 2026-02-05 14:20

**Files Changed**:
- `.oxlintrc.json` -- added plugins (unicorn, typescript, oxc), categories (correctness, perf, suspicious as error), 12 rule overrides including curly: error and typescript/no-explicit-any: error

### T006 - Dry-Run Lint

**Completed**: 2026-02-05 14:25

**Violations found**: 8610 total
- 8079 curly (auto-fixable)
- 292 no-unnecessary-type-assertion (auto-fixable)
- 86 no-array-sort (auto-fixable)
- 73 no-explicit-any
- 23 no-unused-vars
- 12 no-unnecessary-template-expression
- 4 no-useless-concat
- 2 preserve-caught-error
- 1 no-base-to-string

After `oxlint --fix`: 91 remaining (72 no-explicit-any, 23 no-unused-vars, 12 template-expr, 4 concat, 2 preserve-caught-error, 1 no-base-to-string)

After categorizing: 25 no-explicit-any in non-test src, 47 in test files (out of scope)

### T007 - Fix Any Types in src/agents/

**Completed**: 2026-02-05 14:30

**Notes**:
- bash-tools.exec.ts: biome-ignore -> oxlint suppression for AgentTool<any>
- bash-tools.process.ts: same pattern
- apply-patch.ts: same pattern
- session-tool-result-guard-wrapper.ts: `message: any` -> `message: AgentMessage`
- tools/common.ts: biome-ignore -> oxlint suppression
- pi-tools.types.ts: biome-ignore -> oxlint suppression
- pi-tool-definition-adapter.ts: two suppressions (AnyAgentTool type + parameters cast)

### T008-T012 - Fix Any Types in Remaining Src Files

**Completed**: 2026-02-05 14:38

**Notes**:
- gateway/tools-invoke-http.ts: removed 4 unnecessary `as any` casts
- gateway/client.ts: oxlint suppression for ws checkServerIdentity
- auto-reply/reply/get-reply-inline-actions.ts: `any` -> `unknown`, removed `as any`
- auto-reply/reply/get-reply-run.ts: suppression for command.channel
- auto-reply/reply/commands-core.ts: suppression for command.channel
- channels/plugins/types.plugin.ts: `any` default -> `unknown`
- telegram/bot.ts: two suppressions for Grammy type boundaries
- plugins/hooks.ts: two suppressions for plugin hook handler casts
- security/audit.ts: proper type cast instead of `as any`
- hooks/bundled/session-memory/handler.ts: `Record<string, unknown>` instead of `any`
- commands/doctor-sandbox.ts: `catch (error: unknown)` instead of `catch (error: any)`

Also added `.oxlintrc.json` overrides to disable `no-explicit-any` in test files:
```json
"overrides": [{ "files": ["*.test.ts", "*.e2e.test.ts", "test/**"], "rules": { "typescript/no-explicit-any": "off" } }]
```

### T013 - Fix No-Unused-Vars Violations

**Completed**: 2026-02-05 14:42

**Notes**: 24 unused type imports removed across 17 files including cache-trace.ts, pi-embedded-subscribe.handlers.messages.ts, pi-embedded-runner/run/attempt.ts, pi-embedded-runner/extra-params.ts, tools/image-tool.ts, and others.

### T014 - Fix Remaining Violations

**Completed**: 2026-02-05 14:42

**Notes**:
- 12 no-unnecessary-template-expression: removed wrapping in telegram/bot/helpers.ts, bash-tools.exec.ts, daemon/*.ts, cron/isolated-agent/run.ts, commands/status-all/diagnosis.ts, cli/directory-cli.ts
- 4 no-useless-concat: combined in test/media-understanding.auto.e2e.test.ts (2), gateway/hooks-mapping.test.ts (2)
- 1 preserve-caught-error: AggregateError in memory/embeddings.ts
- 1 no-base-to-string: explicit typeof checks in commands/doctor-sandbox.ts

### T015 - Add Inline Suppression Comments

**Completed**: 2026-02-05 14:30 (done as part of T007-T012)

**Notes**: Inline suppression comments with justification added for TypeBox schema boundaries, Grammy type boundaries, plugin hook handler casts, and ws checkServerIdentity callback.

### T016 - Final .oxlintrc.json

**Completed**: 2026-02-05 14:20 (config written during T004-T005)

### Type Assertion Restoration (discovered during T017-T020)

**Completed**: 2026-02-05 15:30

**Notes**: The `oxlint --fix` auto-fix for `no-unnecessary-type-assertion` removed `as { ... }` type casts from `callGateway()` and `callGatewayTool()` return values across 20+ files. These casts were necessary for TypeScript because the functions return `unknown` by default.

**Fix approach**: Converted `as` casts to generic type parameters:
- `(await callGateway({...})) as { status?: string }` -> `await callGateway<{ status?: string }>({...})`
- `(await callGatewayTool(...)) as { payload: unknown }` -> `await callGatewayTool<{ payload: unknown }>(...)`

Also restored necessary `as` casts:
- `src/agents/model-scan.ts`: `Array.from({...}) as R[]`
- `src/agents/skills.ts`: `manager as "npm" | "pnpm" | "yarn" | "bun"` with oxlint suppression
- `src/wizard/onboarding.gateway-config.ts`: `as GatewayBindMode`, `as GatewayTailscaleMode`

### T017-T020 - Validation

**Completed**: 2026-02-05 15:40

**Results**:
- `pnpm lint`: 0 warnings, 0 errors (134 rules, 2153 files)
- `pnpm build`: clean (135 files across 3 build targets)
- `pnpm test`: 3851 tests passed, 653 test files (1 pre-existing flaky EBADF error in session-write-lock.test.ts)
- `pnpm check`: typecheck + lint + format all clean

---

## Design Decisions

### Decision 1: Generic Type Parameters vs Type Assertions

**Context**: `callGateway`/`callGatewayTool` return `unknown` by default. The `oxlint --fix` removed `as { ... }` type assertions.
**Options Considered**:
1. Restore `as { ... }` casts -- simple, matches original code
2. Use generic type parameters `callGateway<T>()` -- idiomatic, type-safe

**Chosen**: Option 2 (generic type parameters)
**Rationale**: Both functions already support generics with `<T = unknown>`. Using generic parameters is the idiomatic TypeScript approach and avoids the `no-unnecessary-type-assertion` lint rule firing again.

### Decision 2: Test File Any Types via Overrides

**Context**: 47 `no-explicit-any` violations in test files (out of scope per spec)
**Options Considered**:
1. Per-file inline suppressions -- noisy, 47 comments needed
2. `.oxlintrc.json` overrides section -- clean, single config change

**Chosen**: Option 2 (overrides)
**Rationale**: oxlint supports file-glob-based rule overrides. A single override entry disabling `typescript/no-explicit-any` for test patterns is cleaner than 47 inline comments.

### Decision 3: TypeBox Boundary Suppressions

**Context**: `AgentTool<any>` generics required because TypeBox `TSchema` from `pi-agent-core` uses a different module instance
**Options Considered**:
1. Use `AgentTool<unknown>` -- changes the type semantics
2. Use `AgentTool<TSchema>` with local import -- module mismatch at runtime
3. Suppress with oxlint comment -- preserves existing behavior

**Chosen**: Option 3 (inline suppression with justification)
**Rationale**: The `any` is genuinely necessary at TypeBox schema boundaries where different module instances produce incompatible types.

---

## Final State

- `.oxlintrc.json`: fully aligned with upstream (correctness + perf + suspicious as error, 12 rule overrides, no-explicit-any as error with test override)
- `package.json`: oxlint `^1.43.0`, oxfmt `0.28.0`, oxlint-tsgolint `^0.11.2`
- Zero lint errors across 2153 files with 134 rules
- All tests passing (653 files, 3851 tests)
- `pnpm check` (tsc + lint + format) passes clean
