# Session Specification

**Session ID**: `phase05-session01-research-build-tooling-delta`
**Phase**: 05 - Upstream Build Tooling Port
**Status**: Not Started
**Created**: 2026-02-05

---

## 1. Session Overview

This session performs a comprehensive analysis of the delta between crocbot's current build tooling and upstream OpenClaw's build tooling. The output is a research document that maps every difference across entry points, TypeScript configuration, oxlint rules, and `any` type usage -- producing a verified migration plan that Sessions 02-05 will consume.

This is the mandatory first session of Phase 05 and follows the proven research-first pattern established in Phase 03 (where Session 01 researched upstream features before Session 02 implemented them). Without this research, subsequent sessions would proceed without verified entry point mappings, risk incorrect tsconfig changes, and lack baseline metrics for linting migration effort.

The session is entirely analytical -- no code changes, no dependency installations, no configuration modifications. It produces a single research document with structured tables and prioritized recommendations that serve as the source of truth for the entire phase.

---

## 2. Objectives

1. Map all crocbot entry points against upstream OpenClaw entry points, identifying which exist, which were removed during strip-down, and what tsdown configuration each requires
2. Produce a line-by-line tsconfig.json delta analysis comparing crocbot's current configuration with upstream, with rationale for adopting or rejecting each difference
3. Produce a rule-by-rule oxlint delta analysis comparing crocbot's current `.oxlintrc.json` with upstream, including impact assessment for enabling new rule categories
4. Establish a baseline `any` type inventory across the codebase, distinguishing between active code and stub/disabled-feature files
5. Deliver a prioritized migration plan document with clear session-to-session dependency ordering for Sessions 02-05

---

## 3. Prerequisites

### Required Sessions
- [x] `phase04-session01-grammy-timeout-recovery` - Upstream bug fixes ported
- [x] `phase04-session02-session-transcript-repair` - Session transcript repair ported
- [x] `phase04-session03-bug-fix-validation` - All bug fixes validated, zero regressions

### Required Tools/Knowledge
- Access to upstream OpenClaw codebase in `.001_ORIGINAL/`
- Familiarity with tsdown bundler configuration format
- Understanding of oxlint rule categories and severity levels
- TypeScript compiler option semantics (target, module, moduleResolution)

### Environment Requirements
- Node 22+ runtime available
- pnpm package manager installed
- Git repository with clean working tree (for accurate grep/search)
- `.001_ORIGINAL/` directory populated with upstream reference code

---

## 4. Scope

### In Scope (MVP)
- Entry point mapping: `src/index.ts`, `src/entry.ts`, `src/plugin-sdk/index.ts` (crocbot) vs upstream (adds `src/extensionAPI.ts`)
- tsconfig.json comparison: root config line-by-line (crocbot ES2022/NodeNext vs upstream)
- ui/tsconfig.json comparison: UI config differences
- `.oxlintrc.json` comparison: plugins, rule categories, ignored patterns
- `any` type usage inventory: count by directory, distinguish stubs from active code
- tsdown installation requirements: version, pnpm compatibility, Node 22 support
- tsdown.config.ts analysis: upstream config structure, entry points, DTS generation
- Build script pipeline comparison: current `pnpm build` steps vs upstream equivalent
- Crocbot-specific adaptation identification: what cannot be ported verbatim
- Research document with migration plan and dependency ordering

### Out of Scope (Deferred)
- Actual tsdown installation or migration - *Reason: Session 02*
- TypeScript configuration changes - *Reason: Session 03*
- Enabling new oxlint rules - *Reason: Session 04*
- CI/CD workflow updates - *Reason: Session 05*
- Runtime testing or deployment - *Reason: Session 05*
- UI build tooling changes (esbuild for a2ui) - *Reason: Unchanged in upstream*

---

## 5. Technical Approach

### Architecture

This is a pure research session. The approach is systematic comparison:

1. **Extract** current crocbot configuration from source files
2. **Extract** upstream OpenClaw configuration from `.001_ORIGINAL/`
3. **Diff** each configuration dimension (entry points, tsconfig, oxlint, build scripts)
4. **Analyze** each difference for applicability to crocbot's stripped-down architecture
5. **Inventory** `any` type usage with `grep`/`ripgrep` across `src/`
6. **Synthesize** findings into a structured migration plan document

### Design Patterns
- **Research-first**: Proven pattern from Phase 03 -- understand before acting
- **Structured comparison tables**: Each delta presented in tabular format for quick reference
- **Decision documentation**: Every "adopt/reject/adapt" decision includes rationale

### Technology Stack
- ripgrep/grep for codebase analysis
- diff tooling for configuration comparison
- Markdown for research document output

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `.spec_system/PRD/phase_05/research/build-tooling-delta.md` | Primary research document with all analysis | ~300 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| None | This is a research-only session | 0 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] All 3 crocbot entry points mapped with tsdown configuration requirements
- [ ] Upstream `src/extensionAPI.ts` absence documented with impact assessment
- [ ] tsconfig.json delta table complete with adopt/reject/adapt decision per option
- [ ] ui/tsconfig.json differences documented
- [ ] oxlint plugin and rule category delta documented with severity recommendations
- [ ] `any` type count established: total, by directory, stubs vs active code breakdown
- [ ] tsdown version and compatibility requirements documented
- [ ] Build script migration path documented (current steps to new steps)
- [ ] Migration plan with session-to-session dependency ordering complete

### Testing Requirements
- [ ] Research document reviewed for completeness (all sections populated)
- [ ] Entry point mapping verified against actual file existence
- [ ] `any` type counts reproducible (commands documented in research)

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Research document uses consistent table formatting
- [ ] Every delta item has a decision (adopt/reject/adapt) with rationale
- [ ] No placeholder or TBD entries in final document

---

## 8. Implementation Notes

### Key Considerations
- crocbot removed `src/extensionAPI.ts` during Phase 00 strip-down; upstream tsdown.config.ts references it as a 4th entry point. The research must document this difference and confirm it can be safely omitted.
- The current build uses `tsc -p tsconfig.json` with `noEmitOnError: true`. tsdown separates compilation from type checking -- the research must document how type checking will be preserved (likely `tsc --noEmit` or `tsgo`).
- crocbot targets ES2022; upstream may target ES2023. The research must assess whether ES2023 target is safe for Node 22+ and what runtime features it unlocks.
- The `ui/` directory uses a separate tsconfig with `moduleResolution: Bundler` and DOM libs. Unification feasibility (Session 03 scope) depends on this research identifying conflicts.

### Potential Challenges
- **Upstream `.001_ORIGINAL/` may not be latest**: If the upstream reference is outdated, some configuration options may have changed. Mitigation: Document the upstream commit/version being compared.
- **`any` count accuracy**: Grep-based counting may include false positives (comments, strings, type parameters). Mitigation: Use targeted regex patterns and document methodology.
- **tsdown version uncertainty**: The exact tsdown version upstream uses may have breaking changes between versions. Mitigation: Document the version and check changelog.

### Relevant Considerations
- [P00] **Stub files for disabled features**: Stubs in `src/tts/`, `src/pairing/`, `src/infra/device-pairing.ts` may contain `any` types that inflate the baseline count. Research must distinguish stub `any` from active code `any` to give accurate migration effort estimates.
- [P00] **Incremental verification**: The research-first approach follows the proven pattern of understanding before acting. This entire session is the "understand" step for Phase 05.
- [P00] **pnpm patches require exact versions**: tsdown installation (Session 02) must account for any pnpm patch constraints. Research should check `pnpm.patchedDependencies` in package.json.
- [P00] **Conservative dependency removal**: When the build tool changes in Session 02, the research must map which current dependencies become unnecessary and which gain new roles.
- [P04] **Verbatim upstream port pattern**: Migration sessions should match upstream approach first, then adapt. This research identifies exactly where adaptation is needed so implementers know upfront.

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- N/A -- this is a research session producing documentation only

### Integration Tests
- N/A -- no code changes

### Manual Testing
- Verify entry point file existence matches research claims (`ls -la src/index.ts src/entry.ts src/plugin-sdk/index.ts`)
- Verify `any` type counts are reproducible by re-running documented grep commands
- Spot-check 3-5 tsconfig delta entries against actual files
- Spot-check 3-5 oxlint delta entries against actual files
- Confirm `.001_ORIGINAL/` files referenced in research exist and match quoted content

### Edge Cases
- Upstream config files may have comments or non-standard JSON (jsonc) -- parser must handle this
- Some oxlint rules may exist in upstream but not be recognized by crocbot's oxlint version
- Entry points may have re-export chains that complicate the mapping

---

## 10. Dependencies

### External Libraries
- None -- research session only, no new dependencies

### Other Sessions
- **Depends on**: Phase 04 completion (all 3 sessions validated)
- **Depended by**: `phase05-session02-tsdown-migration` (consumes entry point mapping, tsdown config analysis), `phase05-session03-typescript-config-unification` (consumes tsconfig delta), `phase05-session04-stricter-linting-rules` (consumes oxlint delta, `any` type inventory), `phase05-session05-build-validation-ci-integration` (consumes full migration plan)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
