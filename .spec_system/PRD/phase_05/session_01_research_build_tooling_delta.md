# Session 01: Research Build Tooling Delta

**Session ID**: `phase05-session01-research-build-tooling-delta`
**Status**: Not Started
**Estimated Tasks**: ~15
**Estimated Duration**: 2-4 hours

---

## Objective

Analyze the complete delta between crocbot's current build tooling and upstream OpenClaw's build tooling, producing a detailed migration plan with entry point mapping, dependency requirements, and risk assessment.

---

## Scope

### In Scope (MVP)
- Map all crocbot entry points (src/index.ts, src/entry.ts, src/plugin-sdk/index.ts, src/extensionAPI.ts)
- Compare current tsconfig.json with upstream tsconfig.json line-by-line
- Compare current .oxlintrc.json with upstream .oxlintrc.json rule-by-rule
- Inventory current build script pipeline steps and dependencies
- Document tsdown installation requirements and version compatibility
- Identify crocbot-specific adaptations needed vs verbatim upstream port
- Count existing `any` type usage to estimate lint migration effort
- Produce research document with migration plan

### Out of Scope
- Actual migration (Session 02-04)
- CI/CD changes (Session 05)
- Runtime testing (Session 05)

---

## Prerequisites

- [ ] Phase 04 completed
- [ ] `.001_ORIGINAL/` available with upstream reference code

---

## Deliverables

1. Research document: `.spec_system/PRD/phase_05/research/build-tooling-delta.md`
2. Entry point mapping table
3. tsconfig delta analysis
4. oxlint rule delta analysis
5. `any` type usage inventory
6. Prioritized migration plan with dependency order

---

## Success Criteria

- [ ] All entry points identified and mapped
- [ ] tsconfig differences documented with rationale for each change
- [ ] oxlint rule differences documented with impact assessment
- [ ] `any` type count established as baseline
- [ ] Migration plan produced with clear session-to-session dependencies
