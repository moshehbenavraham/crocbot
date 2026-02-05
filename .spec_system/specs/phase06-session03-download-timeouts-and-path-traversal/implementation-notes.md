# Implementation Notes

**Session ID**: `phase06-session03-download-timeouts-and-path-traversal`
**Started**: 2026-02-06 00:22
**Last Updated**: 2026-02-06 00:40
**Completed**: 2026-02-06 00:40

---

## Session Progress

| Metric | Value |
|--------|-------|
| Tasks Completed | 20 / 20 |
| Estimated Remaining | 0 |
| Blockers | 0 |

---

## Task Log

### 2026-02-06 - Session Start

**Environment verified**:
- [x] Prerequisites confirmed (Node 22, jq, git)
- [x] Tools available (AbortSignal.timeout, assertSandboxPath, SSRF guards)
- [x] Directory structure ready

---

### Task T001 - Verify prerequisites

**Completed**: 2026-02-06 00:22

**Notes**:
- Node 22 AbortSignal.timeout() confirmed available
- assertSandboxPath exists in src/agents/sandbox-paths.ts with symlink detection
- SSRF guards in place (resolvePinnedHostname used in store.ts)

---

### Task T002 - Read upstream reference

**Completed**: 2026-02-06 00:23

**Notes**:
- Upstream getTelegramFile: (token, fileId, timeoutMs = 30_000) with AbortSignal.timeout
- Upstream downloadTelegramFile: (token, info, maxBytes?, timeoutMs = 60_000) with AbortSignal.timeout
- Upstream passes info.file_path to saveMediaBuffer as originalFilename

---

### Task T003 - Add assertMediaPath() helper

**Completed**: 2026-02-06 00:25

**Notes**:
- Added assertMediaPath(resolvedPath, mediaRoot) to src/media/store.ts
- Uses path.resolve() + path.relative() to detect escape via ../ or absolute paths
- Exported for testing

**Files Changed**:
- `src/media/store.ts` - Added assertMediaPath function and DOWNLOAD_TIMEOUT_MS constant

---

### Task T004 - Add timeoutMs to getTelegramFile

**Completed**: 2026-02-06 00:26

**Notes**:
- Added timeoutMs parameter with default 30_000
- Wired AbortSignal.timeout(timeoutMs) as signal option on fetch

**Files Changed**:
- `src/telegram/download.ts` - Updated getTelegramFile signature

---

### Task T005 - Add timeoutMs to downloadTelegramFile

**Completed**: 2026-02-06 00:26

**Notes**:
- Added timeoutMs parameter with default 60_000
- Wired AbortSignal.timeout(timeoutMs) as signal option on fetch

**Files Changed**:
- `src/telegram/download.ts` - Updated downloadTelegramFile signature

---

### Task T006 - Pass originalFilename

**Completed**: 2026-02-06 00:26

**Notes**:
- Passes info.file_path as 5th argument (originalFilename) to saveMediaBuffer
- Matches upstream behavior

**Files Changed**:
- `src/telegram/download.ts` - Updated saveMediaBuffer call

---

### Task T007 - Apply assertMediaPath to saveMediaBuffer

**Completed**: 2026-02-06 00:28

**Notes**:
- Added assertMediaPath(dir, baseDir) before fs.mkdir in saveMediaBuffer
- Validates subdir does not escape media root

**Files Changed**:
- `src/media/store.ts` - Added guard before mkdir

---

### Task T008 - Apply assertMediaPath to saveMediaSource

**Completed**: 2026-02-06 00:28

**Notes**:
- Added assertMediaPath(dir, baseDir) before fs.mkdir in saveMediaSource
- Validates subdir does not escape media root

**Files Changed**:
- `src/media/store.ts` - Added guard before mkdir

---

### Task T009 - Add timeout to downloadToFile

**Completed**: 2026-02-06 00:29

**Notes**:
- Added timeoutMs parameter with default DOWNLOAD_TIMEOUT_MS (60s)
- Used setTimeout + req.destroy() pattern since downloadToFile uses http.request
- Ensured timer cleanup on all paths: redirect, error, success, size limit, pipeline catch
- Passes timeoutMs through on redirects

**Files Changed**:
- `src/media/store.ts` - Added timeout enforcement to downloadToFile

---

### Tasks T010-T014 - Agent tool audits

**Completed**: 2026-02-06 00:30

**Notes**:

**T010 - message-tool.ts**: No direct file writes. Delegates entirely to
runMessageAction which handles media via saveMediaSource (now guarded with
assertMediaPath). No changes needed.

**T011 - pi-tools.read.ts**: All three sandboxed tools (createSandboxedReadTool,
createSandboxedWriteTool, createSandboxedEditTool) are wrapped with
wrapSandboxPathGuard which calls assertSandboxPath. Already guarded.

**T012 - bash-tools.shared.ts**: resolveSandboxWorkdir (line 92) calls
assertSandboxPath for workdir validation. Already guarded.

**T013 - apply-patch.ts**: resolvePatchPath (line 220) calls assertSandboxPath
when sandboxRoot is set. Already guarded.

**T014 - images.ts**: loadImageFromRef (line 208) calls assertSandboxPath when
sandboxRoot option is set. Already guarded.

**Conclusion**: All agent tool file-writing operations are already protected by
assertSandboxPath. No additional changes required.

---

## Design Decisions

### Decision 1: assertMediaPath as standalone function

**Context**: Needed path traversal validation for media storage
**Options Considered**:
1. Reuse assertSandboxPath from sandbox-paths.ts - full symlink detection
2. New assertMediaPath with path.resolve/relative only - simpler, synchronous

**Chosen**: Option 2 - assertMediaPath
**Rationale**: assertSandboxPath is async (symlink checks) and designed for agent
sandbox contexts. Media store paths are constructed from trusted subdirectory names,
so a synchronous resolve+relative check is sufficient and avoids an async dependency
in the guard. The subdir values come from internal code ("inbound", ""), not user input.

### Decision 2: setTimeout + req.destroy for downloadToFile timeout

**Context**: downloadToFile uses Node http.request, not fetch, so AbortSignal.timeout
cannot be passed directly
**Options Considered**:
1. Convert downloadToFile to use fetch - large refactor, not needed
2. setTimeout + req.destroy - matches upstream pattern, minimal change

**Chosen**: Option 2
**Rationale**: Minimal change, follows spec guidance. Proper cleanup on all exit paths.

---

### Tasks T016-T018 - Tests

**Completed**: 2026-02-06 00:35

**Notes**:
- Added 5 timeout enforcement tests (signal passing, default timeout, custom timeout)
- Added 1 originalFilename pass-through test
- Added 8 path traversal tests (assertMediaPath + saveMediaBuffer/saveMediaSource)
- Fixed test mock isolation with afterEach(vi.restoreAllMocks)
- Total new tests: 14 (download: 6 new, store: 8 new)

**Files Changed**:
- `src/telegram/download.test.ts` - Added timeout and originalFilename tests
- `src/media/store.test.ts` - Added path traversal rejection tests

---

### Tasks T019-T020 - Quality gates

**Completed**: 2026-02-06 00:40

**Notes**:
- pnpm build: zero errors, zero warnings
- pnpm lint: zero errors (0 warnings, 0 errors, 2158 files, 134 rules)
- pnpm test: 655 test files, 3903 passed, 2 skipped, 0 failed
- All new code is ASCII-only, Unix LF line endings
- Pre-existing non-ASCII in store.ts (arrow in comment) and store.test.ts
  (Chinese chars in Unicode filename test) were not modified

---

## Summary

All 20 tasks completed successfully. Changes:

**Files Modified**:
- `src/telegram/download.ts` - Added timeoutMs to both functions, AbortSignal.timeout, originalFilename pass-through
- `src/telegram/download.test.ts` - Added 6 new tests (timeout + originalFilename), mock cleanup
- `src/media/store.ts` - Added assertMediaPath guard, applied to saveMediaBuffer/saveMediaSource, added timeout to downloadToFile
- `src/media/store.test.ts` - Added 8 new tests (path traversal validation)

**Files Created**:
- `.spec_system/specs/phase06-session03-download-timeouts-and-path-traversal/implementation-notes.md`

**No agent tool files were modified** - all 5 audited tools were already guarded.
