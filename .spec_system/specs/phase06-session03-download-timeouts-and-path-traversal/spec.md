# Session Specification

**Session ID**: `phase06-session03-download-timeouts-and-path-traversal`
**Phase**: 06 - Upstream Security Hardening Port
**Status**: Not Started
**Created**: 2026-02-06

---

## 1. Session Overview

This session completes two remaining security hardening measures from the upstream OpenClaw port: download timeout enforcement and path traversal validation. Together with the SSRF guards delivered in Session 02, these protections close the three primary attack surfaces identified during Session 01's security delta research.

The Telegram file download functions (`getTelegramFile` and `downloadTelegramFile` in `src/telegram/download.ts`) currently issue unbounded HTTP requests with no abort signal. A slow or malicious Telegram file server response could hang the gateway indefinitely, effectively creating a denial-of-service vector. The upstream implementation solves this with `AbortSignal.timeout()` and sensible defaults (30s for metadata, 60s for content). This session ports that pattern verbatim.

The media storage layer (`src/media/store.ts`) and the `downloadToFile` HTTP downloader within it lack validation that resolved file paths remain within the media directory. Additionally, several agent tool file operations beyond `image-tool.ts` lack the `assertSandboxPath` guard already used there. This session adds `realpath` + prefix validation to media storage paths and audits all agent file-writing tools for consistent sandbox enforcement.

---

## 2. Objectives

1. Enforce configurable timeout limits on all Telegram file download operations via `AbortSignal.timeout()`
2. Add path traversal validation to media storage functions ensuring all writes stay within the media directory
3. Audit and guard all agent tool file-writing operations with `assertSandboxPath`
4. Deliver unit tests proving timeout abort and path traversal rejection behavior

---

## 3. Prerequisites

### Required Sessions
- [x] `phase06-session01-research-security-hardening-delta` - Identified security gaps and confirmed Grammy AbortSignal compatibility
- [x] `phase06-session02-ssrf-guards` - SSRF guard infrastructure (`fetch-guard.ts`, `ssrf.ts`) now in place

### Required Tools/Knowledge
- Node.js `AbortSignal.timeout()` API (stable in Node 22)
- `path.resolve()` / `path.relative()` for canonical path validation
- Grammy Telegram Bot API file download patterns
- Existing `assertSandboxPath` pattern in `src/agents/sandbox-paths.ts`

### Environment Requirements
- Node 22+ (for stable `AbortSignal.timeout()`)
- pnpm for dependency management and test execution

---

## 4. Scope

### In Scope (MVP)
- Add `timeoutMs` parameter with `AbortSignal.timeout()` to `getTelegramFile()` (default 30s)
- Add `timeoutMs` parameter with `AbortSignal.timeout()` to `downloadTelegramFile()` (default 60s)
- Add path traversal validation to `saveMediaBuffer()` ensuring `subdir` cannot escape media root
- Add path traversal validation to `saveMediaSource()` ensuring `subdir` cannot escape media root
- Add timeout to `downloadToFile()` HTTP request in `src/media/store.ts`
- Audit agent tools (`message-tool.ts`, `pi-tools.read.ts`, `bash-tools.shared.ts`, `apply-patch.ts`, `pi-embedded-runner/run/images.ts`) for sandbox path enforcement
- Unit tests for timeout abort behavior in `download.test.ts`
- Unit tests for path traversal rejection in media store
- Pass `originalFilename` from `downloadTelegramFile()` to `saveMediaBuffer()` (upstream parity)

### Out of Scope (Deferred)
- Content-type or file-size validation - *Reason: separate concern, not a security hardening priority*
- Streaming download progress reporting - *Reason: UX enhancement, not security*
- Timeout configuration UI - *Reason: config-file or env-var is sufficient for now*
- SSRF guards - *Reason: completed in Session 02*

---

## 5. Technical Approach

### Architecture

**Timeout Enforcement**: Add a `timeoutMs` parameter to both `getTelegramFile()` and `downloadTelegramFile()` with upstream-matching defaults (30s and 60s respectively). Pass `AbortSignal.timeout(timeoutMs)` as the `signal` option to `fetch()`. For the legacy `downloadToFile()` in media store, add a `setTimeout` + `req.destroy()` pattern since it uses Node's `http.request` (not `fetch`).

**Path Traversal Validation**: Add a `assertMediaPath()` helper in `src/media/store.ts` that resolves the final destination path and verifies via `path.relative()` that it does not escape the media root. Apply this check before every `fs.writeFile()` / `fs.rename()` / `createWriteStream()` call. For agent tools, audit each file-writing operation and ensure `assertSandboxPath()` from `src/agents/sandbox-paths.ts` is called consistently.

### Design Patterns
- **Verbatim upstream port**: Match upstream `download.ts` signature and behavior first, then adapt only what crocbot's architecture requires
- **Defense in depth**: Path validation at both the media storage layer (innermost) and agent tool layer (outermost)
- **Fail-fast guard clauses**: Validate paths before any I/O operations

### Technology Stack
- Node.js 22 `AbortSignal.timeout()` (stable, no polyfill needed)
- `path.resolve()` / `path.relative()` for canonical path comparison
- Vitest for unit testing

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/media/store.test.ts` | Unit tests for path traversal validation in media store | ~80 |

### Files to Modify
| File | Changes | Est. Lines Changed |
|------|---------|------------|
| `src/telegram/download.ts` | Add `timeoutMs` params + `AbortSignal.timeout()` to both functions, pass `originalFilename` | ~10 |
| `src/telegram/download.test.ts` | Add timeout abort tests, update existing tests for new signatures | ~40 |
| `src/media/store.ts` | Add `assertMediaPath()` guard, apply to `saveMediaBuffer`, `saveMediaSource`, `downloadToFile`; add timeout to `downloadToFile` | ~30 |
| `src/agents/tools/message-tool.ts` | Add `assertSandboxPath` guard if file-writing paths lack it | ~5 |
| `src/agents/pi-tools.read.ts` | Verify/add sandbox path validation | ~5 |
| `src/agents/bash-tools.shared.ts` | Verify/add sandbox path validation | ~5 |
| `src/agents/apply-patch.ts` | Verify/add sandbox path validation | ~5 |
| `src/agents/pi-embedded-runner/run/images.ts` | Verify/add sandbox path validation | ~5 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] `getTelegramFile()` aborts after 30s (configurable) with `AbortError`
- [ ] `downloadTelegramFile()` aborts after 60s (configurable) with `AbortError`
- [ ] `downloadToFile()` in media store aborts after timeout
- [ ] `saveMediaBuffer()` rejects `subdir` values that escape media root
- [ ] `saveMediaSource()` rejects `subdir` values that escape media root
- [ ] `downloadTelegramFile()` passes `info.file_path` as `originalFilename` to `saveMediaBuffer()`
- [ ] All agent file-writing tools enforce sandbox path validation

### Testing Requirements
- [ ] Unit tests verify timeout triggers abort on `getTelegramFile`
- [ ] Unit tests verify timeout triggers abort on `downloadTelegramFile`
- [ ] Unit tests verify path traversal attempts (`../`, absolute paths) are rejected by media store
- [ ] Unit tests verify symlink-based escape attempts are rejected
- [ ] Existing download tests pass with updated function signatures
- [ ] Full test suite passes (`pnpm test`) with no regressions

### Quality Gates
- [ ] `pnpm build` passes with zero errors and zero warnings
- [ ] `pnpm lint` passes with zero errors
- [ ] `pnpm test` passes with no new failures
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions (CONVENTIONS.md)

---

## 8. Implementation Notes

### Key Considerations
- Upstream `download.ts` is the reference implementation -- match its signature exactly (parameter order, defaults)
- `saveMediaBuffer()` already accepts `originalFilename` parameter but crocbot's `downloadTelegramFile()` does not pass it -- upstream does (line 51 of upstream)
- The `downloadToFile()` function uses `http.request` (not `fetch`), so `AbortSignal.timeout()` cannot be passed directly -- use `setTimeout` + `req.destroy()` instead
- `assertSandboxPath` already handles symlink detection via `assertNoSymlink` -- reuse this pattern rather than inventing a new one

### Potential Challenges
- **Grammy internal timeouts**: Grammy's file API may have its own timeout behavior. Our timeouts are on the raw `fetch` calls to Telegram's API, not Grammy's abstractions, so they should not conflict.
- **`downloadToFile` timeout wiring**: The function uses Node's `http.request` with callbacks + streams. Adding timeout requires careful cleanup of the request and write stream on abort.
- **Agent tool audit scope**: Some agent tools may delegate file writes to shared utilities rather than writing directly. Need to trace the full call chain to determine where validation is most effective.

### Relevant Considerations
- [P04] **Verbatim upstream port pattern**: Match upstream `download.ts` implementation exactly (timeouts, parameter names, defaults), then adapt only what crocbot's stripped-down architecture requires. Minimizes divergence.
- [P00] **Incremental verification**: Port timeout enforcement first (verify build+test), then add path traversal validation (verify again). Two clear milestones.
- [P00] **Reference tracing before deletion**: Before adding guards to agent tools, grep all `assertSandboxPath` / file-write calls to ensure complete coverage.

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- `src/telegram/download.test.ts`: Test that `getTelegramFile` passes `signal` to `fetch`, test that `downloadTelegramFile` passes `signal` to `fetch`, test custom timeout values propagate
- `src/media/store.test.ts`: Test `assertMediaPath` rejects `../` in subdir, test it rejects absolute paths outside media root, test it allows valid subdirectories

### Integration Tests
- Verify `downloadTelegramFile` end-to-end with mocked fetch that the saved file includes `originalFilename` in the path

### Manual Testing
- Build the project (`pnpm build`) and confirm zero errors/warnings
- Run full test suite (`pnpm test`) and confirm no regressions
- Verify lint passes (`pnpm lint`)

### Edge Cases
- Empty `timeoutMs` (should use default, not zero/infinity)
- `subdir` with encoded traversal (`%2e%2e%2f`) -- `path.resolve` handles this
- `subdir` with trailing slashes or double slashes
- `originalFilename` with Unicode characters (sanitizeFilename already handles)
- Symlink within media directory pointing outside

---

## 10. Dependencies

### External Libraries
- No new dependencies required
- Uses existing: `node:fs/promises`, `node:path`, `node:crypto`, `vitest`

### Other Sessions
- **Depends on**: `phase06-session02-ssrf-guards` (SSRF infrastructure provides guarded fetch patterns and `resolvePinnedHostname`)
- **Depended by**: `phase06-session04-security-validation` (final end-to-end validation of all Phase 06 security measures)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
