# Task Checklist

**Session ID**: `phase06-session03-download-timeouts-and-path-traversal`
**Total Tasks**: 20
**Estimated Duration**: 6-8 hours
**Created**: 2026-02-06

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0603]` = Session reference (Phase 06, Session 03)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 2 | 2 | 0 |
| Foundation | 4 | 4 | 0 |
| Implementation | 9 | 9 | 0 |
| Testing | 5 | 5 | 0 |
| **Total** | **20** | **20** | **0** |

---

## Setup (2 tasks)

Initial verification and environment preparation.

- [x] T001 [S0603] Verify prerequisites: Node 22 `AbortSignal.timeout()` support, existing `assertSandboxPath` in `src/agents/sandbox-paths.ts`, SSRF guards from session 02 in place (`src/infra/net/ssrf.ts`)
- [x] T002 [S0603] Read upstream `download.ts` reference implementation to confirm exact parameter signatures, defaults (30s/60s), and `originalFilename` pass-through pattern

---

## Foundation (4 tasks)

Core guard functions and type changes.

- [x] T003 [S0603] Add `assertMediaPath()` helper function in `src/media/store.ts` -- resolve destination with `path.resolve()`, validate via `path.relative()` that result does not escape media root, throw on `../` or absolute escape (`src/media/store.ts`)
- [x] T004 [S0603] Add `timeoutMs` parameter to `getTelegramFile()` signature with default `30_000`, wire `AbortSignal.timeout(timeoutMs)` as `signal` option on the `fetch()` call (`src/telegram/download.ts`)
- [x] T005 [S0603] Add `timeoutMs` parameter to `downloadTelegramFile()` signature with default `60_000`, wire `AbortSignal.timeout(timeoutMs)` as `signal` option on the `fetch()` call (`src/telegram/download.ts`)
- [x] T006 [S0603] Pass `info.file_path` as `originalFilename` argument to `saveMediaBuffer()` inside `downloadTelegramFile()` for upstream parity (`src/telegram/download.ts`)

---

## Implementation (9 tasks)

Main feature implementation.

- [x] T007 [S0603] Apply `assertMediaPath()` guard to `saveMediaBuffer()` before the `fs.writeFile()` call -- validate that `path.join(resolveMediaDir(), subdir)` does not escape the media root (`src/media/store.ts`)
- [x] T008 [S0603] Apply `assertMediaPath()` guard to `saveMediaSource()` before the `fs.mkdir()` call for URL downloads and before `fs.writeFile()` for local copies -- validate `subdir` does not escape media root (`src/media/store.ts`)
- [x] T009 [S0603] Add timeout enforcement to `downloadToFile()` in media store -- add `timeoutMs` parameter (default 60_000), use `setTimeout` + `req.destroy()` pattern since it uses `http.request`, ensure write stream cleanup on abort (`src/media/store.ts`)
- [x] T010 [S0603] [P] Audit `src/agents/tools/message-tool.ts` for file-writing operations -- determine if file paths flow through message actions and whether `assertSandboxPath` is needed (message-tool delegates to `runMessageAction` which handles media via `saveMediaSource`) (`src/agents/tools/message-tool.ts`)
- [x] T011 [S0603] [P] Audit `src/agents/pi-tools.read.ts` for sandbox path enforcement -- verify `createSandboxedReadTool`, `createSandboxedWriteTool`, `createSandboxedEditTool` all use `wrapSandboxPathGuard` (already guarded) (`src/agents/pi-tools.read.ts`)
- [x] T012 [S0603] [P] Audit `src/agents/bash-tools.shared.ts` for sandbox path enforcement -- verify `resolveSandboxWorkdir` uses `assertSandboxPath` for workdir validation (already guarded) (`src/agents/bash-tools.shared.ts`)
- [x] T013 [S0603] [P] Audit `src/agents/apply-patch.ts` for sandbox path enforcement -- verify `resolvePatchPath` calls `assertSandboxPath` when `sandboxRoot` is set (already guarded) (`src/agents/apply-patch.ts`)
- [x] T014 [S0603] [P] Audit `src/agents/pi-embedded-runner/run/images.ts` for sandbox path enforcement -- verify `loadImageFromRef` calls `assertSandboxPath` when `sandboxRoot` option is set (already guarded), add guard if missing (`src/agents/pi-embedded-runner/run/images.ts`)
- [x] T015 [S0603] Create implementation-notes.md documenting audit findings for each agent tool file, recording which are already guarded and which (if any) required changes (`implementation-notes.md`)

---

## Testing (5 tasks)

Verification and quality assurance.

- [x] T016 [S0603] [P] Add timeout abort tests to `src/telegram/download.test.ts` -- test that `getTelegramFile` passes `signal` to `fetch`, test that `downloadTelegramFile` passes `signal` to `fetch`, test custom `timeoutMs` values propagate, update existing tests for new function signatures (`src/telegram/download.test.ts`)
- [x] T017 [S0603] [P] Add path traversal rejection tests to `src/media/store.test.ts` -- test `assertMediaPath` rejects `../` in subdir, rejects absolute paths outside media root, allows valid subdirectories, test `saveMediaBuffer` rejects malicious subdir (`src/media/store.test.ts`)
- [x] T018 [S0603] [P] Add `originalFilename` pass-through test to `src/telegram/download.test.ts` -- verify `downloadTelegramFile` passes `info.file_path` to `saveMediaBuffer` as `originalFilename` (`src/telegram/download.test.ts`)
- [x] T019 [S0603] Run full quality gates: `pnpm build` (zero errors/warnings), `pnpm lint` (zero errors), `pnpm test` (no regressions)
- [x] T020 [S0603] Validate all modified/created files use ASCII encoding and Unix LF line endings

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing
- [x] All files ASCII-encoded
- [x] implementation-notes.md updated
- [x] Ready for `/validate`

---

## Notes

### Parallelization
Tasks marked `[P]` can be worked on simultaneously:
- **T010-T014**: Agent tool audits are independent of each other
- **T016-T018**: Test files can be written in parallel

### Task Timing
Target ~20-25 minutes per task.

### Dependencies
- T003 must complete before T007, T008 (guard function used by both)
- T004, T005 must complete before T016, T018 (signature changes needed before tests)
- T006 must complete before T018 (originalFilename pass-through test)
- T007, T008, T009 must complete before T017 (path traversal implementation before tests)
- All implementation tasks must complete before T019 (quality gates)

### Key Observations from Code Review
- `message-tool.ts` does NOT perform direct file writes -- it delegates entirely to `runMessageAction`. Audit will likely confirm no changes needed.
- `pi-tools.read.ts` already wraps all tools (read/write/edit) with `wrapSandboxPathGuard`. Already guarded.
- `bash-tools.shared.ts` uses `assertSandboxPath` in `resolveSandboxWorkdir`. Already guarded.
- `apply-patch.ts` calls `assertSandboxPath` in `resolvePatchPath` when `sandboxRoot` is set. Already guarded.
- `images.ts` calls `assertSandboxPath` in `loadImageFromRef` when `sandboxRoot` option is set. Already guarded.
- The main new code is in `download.ts` (timeouts + originalFilename) and `store.ts` (assertMediaPath + downloadToFile timeout).

---

## Next Steps

Run `/implement` to begin AI-led implementation.
