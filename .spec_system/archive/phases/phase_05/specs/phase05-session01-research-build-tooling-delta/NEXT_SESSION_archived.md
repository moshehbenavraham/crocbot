# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-02-05
**Project State**: Phase 05 - Upstream Build Tooling Port
**Completed Sessions**: 24

---

## Recommended Next Session

**Session ID**: `phase05-session01-research-build-tooling-delta`
**Session Name**: Research Build Tooling Delta
**Estimated Duration**: 2-4 hours
**Estimated Tasks**: ~15

---

## Why This Session Next?

### Prerequisites Met
- [x] Phase 04 completed (all 3 sessions: Grammy timeout recovery, session transcript repair, bug fix validation)
- [x] `.001_ORIGINAL/` available with upstream reference code

### Dependencies
- **Builds on**: Phase 04 completion (upstream bug fixes fully validated)
- **Enables**: Session 02 (tsdown migration), Session 03 (tsconfig unification), Session 04 (stricter linting) - all depend on this research output

### Project Progression
This is the natural first session of Phase 05 and is a **mandatory prerequisite** for all subsequent sessions. It produces the entry point mapping, tsconfig delta analysis, oxlint rule delta analysis, and `any` type inventory that Sessions 02-04 consume. Without this research, the migration sessions would proceed without a verified plan, risking rework. The research-first pattern has proven effective in Phase 03 (session 01 researched upstream features before session 02 implemented them).

---

## Session Overview

### Objective
Analyze the complete delta between crocbot's current build tooling and upstream OpenClaw's build tooling, producing a detailed migration plan with entry point mapping, dependency requirements, and risk assessment.

### Key Deliverables
1. Research document: `.spec_system/PRD/phase_05/research/build-tooling-delta.md`
2. Entry point mapping table (src/index.ts, src/entry.ts, src/plugin-sdk/index.ts, src/extensionAPI.ts)
3. tsconfig delta analysis (line-by-line comparison with upstream)
4. oxlint rule delta analysis (rule-by-rule comparison with upstream)
5. `any` type usage inventory (baseline count for lint migration effort)
6. Prioritized migration plan with dependency order across Sessions 02-05

### Scope Summary
- **In Scope (MVP)**: Entry point mapping, tsconfig comparison, oxlint comparison, `any` type count, tsdown installation requirements, crocbot-specific adaptation identification, migration plan document
- **Out of Scope**: Actual migration (Session 02-04), CI/CD changes (Session 05), runtime testing (Session 05)

---

## Technical Considerations

### Technologies/Patterns
- tsdown bundler (replacement for tsc)
- oxlint rule configuration (.oxlintrc.json)
- TypeScript compiler options (tsconfig.json)
- ES2023 target migration
- NodeNext module resolution

### Potential Challenges
- Identifying crocbot-specific entry points that differ from upstream due to strip-down (removed native apps, extensions, non-Telegram channels)
- Accurately assessing `any` type count across codebase to determine whether `no-explicit-any` should be error vs warn
- tsdown version compatibility with Node 22+ and pnpm workspace structure
- Understanding which tsconfig options are upstream-specific vs genuinely beneficial for crocbot

### Relevant Considerations
- [P00] **Stub files for disabled features**: These stubs may contain `any` types that inflate the baseline count. Research should distinguish between stub `any` usage and active code `any` usage.
- [P00] **Incremental verification**: The research-first approach follows the proven pattern of understanding before acting. Apply the same methodology to build tooling analysis.
- [P00] **pnpm patches require exact versions**: tsdown installation must account for any pnpm patch constraints in the project.

---

## Alternative Sessions

If this session is blocked:
1. **phase05-session04-stricter-linting-rules** - Could be partially started (oxlint rule analysis) independently, though it formally requires Session 01's `any` type inventory
2. **Phase 06 planning** - If build tooling port is deprioritized, security hardening (SSRF guards, download timeouts, path traversal) could begin with its own research session

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
