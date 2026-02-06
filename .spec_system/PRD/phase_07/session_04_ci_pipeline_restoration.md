# Session 04: CI Pipeline Restoration

**Session ID**: `phase07-session04-ci-pipeline-restoration`
**Status**: Not Started
**Estimated Tasks**: ~15
**Estimated Duration**: 2-4 hours

---

## Objective

Restore all GitHub Actions CI pipelines to operational status, enable CodeQL code scanning, and address transitive dependency vulnerabilities.

---

## Scope

### In Scope (MVP)
- Document GitHub billing fix steps and verify billing is resolved (or create local CI fallback)
- Verify all 5 CI pipeline bundles run successfully after billing fix:
  - Code Quality (lint, format, typecheck)
  - Build & Test (build, test with coverage)
  - Security (detect-secrets, CodeQL, dependency-review, npm-audit)
  - Integration (E2E tests on PR to main)
  - Operations (Docker release, dependabot)
- Enable CodeQL "Code scanning" in repo Settings -> Security
- Triage npm audit vulnerabilities (7 total: 3 high, 4 moderate)
- Apply pnpm overrides for fixable transitive vulnerabilities
- Document unfixable vulnerabilities with risk assessment and timeline

### Out of Scope
- Rewriting CI workflows (they're already configured)
- Adding new CI jobs
- Fixing issues in upstream dependency code

---

## Prerequisites

- [ ] Sessions 01-03 complete (E2E tests all passing)
- [ ] Access to GitHub billing settings for `moshehbenavraham` account
- [ ] Access to repo Settings -> Security for CodeQL enablement

---

## Deliverables

1. GitHub Actions billing resolved (or documented blocker with local fallback)
2. All 5 CI pipeline bundles verified passing
3. CodeQL code scanning enabled
4. Dependency vulnerability triage document
5. pnpm overrides applied for fixable vulnerabilities

---

## Success Criteria

- [ ] All CI pipeline bundles pass on a test push/PR (or documented external blocker)
- [ ] CodeQL enabled and first scan completes
- [ ] High-severity npm audit vulnerabilities resolved or documented with mitigation
- [ ] No new lint, format, or typecheck errors in CI
- [ ] Docker release workflow triggers successfully on main push
