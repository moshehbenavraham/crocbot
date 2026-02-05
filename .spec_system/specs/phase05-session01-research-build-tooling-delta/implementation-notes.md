# Implementation Notes

**Session ID**: `phase05-session01-research-build-tooling-delta`
**Started**: 2026-02-05 11:37
**Last Updated**: 2026-02-05 11:50

---

## Session Progress

| Metric | Value |
|--------|-------|
| Tasks Completed | 18 / 18 |
| Blockers | 0 |

---

## Task Log

### [2026-02-05] - Session Start

**Environment verified**:
- [x] Prerequisites confirmed (jq, git available)
- [x] Tools available (ripgrep 14.1.0, node 22.19.0)
- [x] Directory structure ready (.spec_system/PRD/phase_05/research/ created)

---

### Task T001 - Verify upstream reference

**Started**: 2026-02-05 11:37
**Completed**: 2026-02-05 11:38

**Notes**:
- `.001_ORIGINAL/` exists with upstream at commit `2b1da4f5d86f` (2026-02-04)
- Latest commit: "docs: note zh-CN landing revamp (#8994)"

**Files Changed**: None (verification only)

---

### Task T002 - Verify Phase 04 completion

**Started**: 2026-02-05 11:38
**Completed**: 2026-02-05 11:38

**Notes**:
- state.json confirms Phase 04 complete (all 3 sessions validated)
- All 24 prior sessions completed successfully

**Files Changed**: None (verification only)

---

### Task T003 - Create research output directory

**Started**: 2026-02-05 11:38
**Completed**: 2026-02-05 11:38

**Notes**:
- Created `.spec_system/PRD/phase_05/research/` directory

**Files Changed**:
- `.spec_system/PRD/phase_05/research/` - directory created

---

### Tasks T004-T007 - Extract configurations (parallel)

**Started**: 2026-02-05 11:38
**Completed**: 2026-02-05 11:42

**Notes**:
- T004: Extracted crocbot entry points (src/index.ts, src/entry.ts, src/plugin-sdk/index.ts confirmed; src/extensionAPI.ts absent)
- T005: Extracted upstream entry points (all 4 exist + tsdown.config.ts)
- T006: Extracted crocbot configs (tsconfig.json, ui/tsconfig.json, .oxlintrc.json, package.json scripts)
- T007: Extracted upstream configs (tsconfig.json, no ui/tsconfig.json, .oxlintrc.json, package.json scripts, tsdown.config.ts)
- Used parallel explore agents for T004/T005; direct reads for T006/T007

**Key Findings**:
- Upstream has no separate ui/tsconfig.json (includes ui/ in root config)
- Upstream uses tsdown ^0.20.1 with rolldown 1.0.0-rc.2
- Upstream uses tsgo for type checking (separate from build)
- Upstream oxlint adds perf/suspicious categories and 12 explicit rules

**Files Changed**: None (extraction only)

---

### Task T008 - Entry point mapping table

**Started**: 2026-02-05 11:42
**Completed**: 2026-02-05 11:45

**Notes**:
- Documented all 4 entry points with tsdown config requirements
- Proposed crocbot tsdown.config.ts with 3 entries (no extensionAPI.ts)
- Documented common tsdown settings (env, fixedExtension, platform)

**Files Changed**:
- `.spec_system/PRD/phase_05/research/build-tooling-delta.md` - Section 1

---

### Task T009 - extensionAPI.ts absence impact

**Started**: 2026-02-05 11:45
**Completed**: 2026-02-05 11:46

**Notes**:
- Confirmed safe to omit: no tsdown config impact, no package export impact, no internal dependency
- extensionAPI.ts was for native app integrations removed in Phase 00

**Files Changed**:
- `.spec_system/PRD/phase_05/research/build-tooling-delta.md` - Section 2

---

### Task T010 - tsconfig.json delta analysis

**Started**: 2026-02-05 11:46
**Completed**: 2026-02-05 11:47

**Notes**:
- 7 options already match; 7 to adopt/adapt
- Key changes: target ES2022->es2023, add allowImportingTsExtensions, noEmit, declaration
- Rejected: include ui/**/* (keep separate ui config)

**Files Changed**:
- `.spec_system/PRD/phase_05/research/build-tooling-delta.md` - Section 3

---

### Task T011 - ui/tsconfig.json delta analysis

**Started**: 2026-02-05 11:47
**Completed**: 2026-02-05 11:48

**Notes**:
- Upstream has no separate ui/tsconfig.json (unified with root)
- Decision: REJECT unification, keep separate ui/tsconfig.json
- Recommended updates: target and lib year alignment to ES2023

**Files Changed**:
- `.spec_system/PRD/phase_05/research/build-tooling-delta.md` - Section 4

---

### Task T012 - oxlint delta analysis

**Started**: 2026-02-05 11:48
**Completed**: 2026-02-05 11:49

**Notes**:
- Plugins match; 2 new categories to adopt (perf, suspicious)
- 12 explicit rules to adopt (mostly disabling overly strict rules)
- Key addition: typescript/no-explicit-any: error
- Version updates needed: oxlint ^1.41.0 -> ^1.43.0, oxfmt 0.26.0 -> 0.28.0

**Files Changed**:
- `.spec_system/PRD/phase_05/research/build-tooling-delta.md` - Section 5

---

### Task T013 - any type inventory

**Started**: 2026-02-05 11:42
**Completed**: 2026-02-05 11:49

**Notes**:
- Total: 70 occurrences across 30 files
- Active code: 26 occurrences across 18 files
- Test files: 44 occurrences across 12 files
- Stub files: 0 occurrences (no any in tts/, pairing/, device-pairing.ts)
- Primary patterns: AgentTool<any> generics, as any casts on third-party types, mock objects in tests
- Commands documented and reproducible

**Files Changed**:
- `.spec_system/PRD/phase_05/research/build-tooling-delta.md` - Section 6

---

### Task T014 - Build script pipeline comparison

**Started**: 2026-02-05 11:49
**Completed**: 2026-02-05 11:50

**Notes**:
- Current: 5-step pipeline with tsc compilation
- Upstream: 6-step pipeline with tsdown bundling
- Key difference: tsc (emits + type-checks) vs tsdown (emits) + tsgo/tsc --noEmit (type-checks)
- No pnpm.patchedDependencies conflicts
- write-cli-compat.ts not needed for crocbot

**Files Changed**:
- `.spec_system/PRD/phase_05/research/build-tooling-delta.md` - Section 7

---

### Task T015 - Prioritized migration plan

**Started**: 2026-02-05 11:50
**Completed**: 2026-02-05 11:50

**Notes**:
- Linear dependency chain: S02 -> S03 -> S04 -> S05
- Each session has clear scope, crocbot-specific adaptations, and risk assessment
- Total 6 tool version updates identified

**Files Changed**:
- `.spec_system/PRD/phase_05/research/build-tooling-delta.md` - Section 8

---

### Tasks T016-T018 - Testing and verification

**Started**: 2026-02-05 11:50
**Completed**: 2026-02-05 11:52

**Notes**:
- T016: Verified all entry point files exist via ls; cross-checked against tsdown config
- T017: Re-ran any type grep commands; confirmed totals match (70 total, 26 active, 44 test)
- T018: Final review passed -- all delta items have decisions, no TBD entries, ASCII encoding verified

**Files Changed**: None (verification only)

---

## Design Decisions

### Decision 1: Keep separate ui/tsconfig.json

**Context**: Upstream unifies ui/ into root tsconfig with DOM libs
**Options Considered**:
1. Unify (match upstream) - requires DOM libs in root, mixes Node and browser concerns
2. Keep separate (crocbot pattern) - clean separation, different moduleResolution

**Chosen**: Option 2 (keep separate)
**Rationale**: crocbot is Node-first; adding DOM types to root tsconfig pollutes the type space for src/ code. Different build tools (tsdown for src, esbuild/Vite for ui) warrant different configs.

### Decision 2: Omit extensionAPI.ts from tsdown config

**Context**: Upstream bundles 4 entry points; crocbot only needs 3
**Chosen**: Omit
**Rationale**: extensionAPI.ts served native app integrations removed in Phase 00. No consumers exist.

### Decision 3: Defer oxlint-tsgolint

**Context**: Upstream uses tsgo for type checking with oxlint integration
**Chosen**: Defer to future evaluation
**Rationale**: tsgo is not yet critical; tsc --noEmit provides equivalent type checking. Can evaluate in S03/S04 if performance becomes a concern.
