# Implementation Notes

**Session ID**: `phase00-session01-remove-native-apps`
**Started**: 2026-01-29 23:55
**Last Updated**: 2026-01-30 00:25
**Completed**: 2026-01-30 00:25

---

## Session Progress

| Metric | Value |
|--------|-------|
| Tasks Completed | 20 / 20 |
| Estimated Remaining | 0 |
| Blockers | 0 |

---

## Task Log

### [2026-01-29] - Session Start

**Environment verified**:
- [x] Prerequisites confirmed (jq, git available)
- [x] .spec_system directory valid
- [x] Directory structure ready

### T001-T002 - Setup Tasks

**Completed**: 2026-01-29 23:58

**Notes**:
- Node v22.19.0, pnpm 10.23.0 verified
- Working tree clean (only .spec_system/ untracked as expected)
- Fixed pre-existing rebrand issue: renamed `moltbot-root.ts` to `crocbot-root.ts` and `moltbot-tools.ts` to `crocbot-tools.ts`
- Baseline build/lint/test passed (extension tests have pre-existing failures due to missing deps)

**Files Changed**:
- `src/infra/moltbot-root.ts` -> `src/infra/crocbot-root.ts` (git mv)
- `src/agents/moltbot-tools.ts` -> `src/agents/crocbot-tools.ts` (git mv)

### T003-T007 - Foundation Tasks

**Completed**: 2026-01-30 00:05

**Notes**:
- Identified 47 files referencing `apps/`
- Identified 6 files referencing `src/macos/` (mostly spec files + vitest.config.ts)
- CI workflow has 3 jobs to remove: macos-app, ios, android
- Labeler has 3 rules to remove: app:android, app:ios, app:macos
- Package.json has 8+ scripts to remove
- No TypeScript imports of src/macos/ in core code

### T008-T012 - Directory Deletions

**Completed**: 2026-01-30 00:08

**Notes**:
- Deleted apps/android/, apps/ios/, apps/macos/, apps/shared/
- Deleted apps/ root directory
- Deleted src/macos/

**Files Changed**:
- Removed ~544 files in apps/
- Removed 4 files in src/macos/

### T013-T016 - Configuration Updates

**Completed**: 2026-01-30 00:15

**Notes**:
- Removed LEGACY_MACOS_APP_SOURCES_DIR from src/compat/legacy-names.ts
- Removed ios:*, android:*, lint:swift, format:swift, format:all, lint:all scripts from package.json
- Updated protocol:check to remove Swift file reference
- Removed dist/macos/** from files array
- Cleaned vitest.exclude of apps/macos patterns
- Removed app:android, app:ios, app:macos labels from .github/labeler.yml
- Removed macos-app, ios, android jobs from .github/workflows/ci.yml (~300 lines)

**Files Changed**:
- `src/compat/legacy-names.ts` - Removed LEGACY_MACOS_APP_SOURCES_DIR export
- `package.json` - Removed ~12 scripts, updated vitest exclude, removed dist/macos
- `.github/labeler.yml` - Removed 3 app label rules
- `.github/workflows/ci.yml` - Removed 3 CI jobs (~300 lines)

### T017-T020 - Verification Tests

**Completed**: 2026-01-30 00:25

**Notes**:
- pnpm install: SUCCESS
- pnpm build: SUCCESS
- pnpm lint: SUCCESS (0 warnings, 0 errors)
- pnpm test: Core tests pass (788 files, 4751 tests)
- Fixed cron-protocol-conformance.test.ts which depended on removed Swift files

**Files Changed**:
- `src/cron/cron-protocol-conformance.test.ts` - Removed Swift file checks (no longer applicable)

---

## Design Decisions

### Decision 1: Keep checks-macos CI job

**Context**: Should we remove checks-macos along with macos-app?
**Chosen**: Keep checks-macos
**Rationale**: checks-macos runs core Node.js tests on macOS runner (pnpm test), which is valuable for cross-platform compatibility. Only macos-app/ios/android jobs that build native apps were removed.

### Decision 2: Remove protocol:gen:swift script

**Context**: protocol:check referenced Swift protocol generation
**Chosen**: Remove protocol:gen:swift from protocol:check, keep protocol:gen
**Rationale**: Swift protocol generation is no longer needed without macOS app. JSON schema generation (protocol:gen) remains useful.

---

## Blockers & Solutions

None encountered.

---

## Summary

Session completed successfully. Removed all native application code:
- ~544 files in apps/ directory (android, ios, macos, shared)
- 4 files in src/macos/ directory
- ~300 lines of CI workflow jobs
- 12+ package.json scripts
- 3 labeler rules

All core tests pass. Extension tests have pre-existing failures due to missing dependencies (unrelated to this session).
