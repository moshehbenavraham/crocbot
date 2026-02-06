# Session 03: Download Timeouts and Path Traversal

**Session ID**: `phase06-session03-download-timeouts-and-path-traversal`
**Status**: Not Started
**Estimated Tasks**: ~18
**Estimated Duration**: 2-3 hours

---

## Objective

Enforce timeout limits on Telegram file download operations to prevent DoS from slow/malicious downloads, and add path traversal validation to file operations to prevent sandbox escape.

---

## Scope

### In Scope (MVP)
- Add `AbortSignal.timeout` to Telegram `getFile` operations
- Add `AbortSignal.timeout` to Telegram `downloadFile` operations
- Configurable timeout values with sensible defaults
- Path traversal validation using `realpath` + prefix check
- Validate file paths stay within sandbox root in `src/agents/tools/message-tool.ts`
- Apply path validation to any other file-writing tool operations
- Unit tests for timeout behavior
- Unit tests for path traversal blocking

### Out of Scope
- SSRF guards (Session 02)
- Content-type or file-size validation
- Streaming download progress reporting
- Timeout configuration UI

---

## Prerequisites

- [ ] Session 02 completed (SSRF guards in place)
- [ ] Grammy AbortSignal compatibility confirmed (Session 01 research)

---

## Deliverables

1. Timeout-enforced Telegram download operations
2. Path traversal validation in agent tool file operations
3. Unit tests for timeout enforcement
4. Unit tests for path traversal blocking
5. Build passes with zero errors/warnings

---

## Success Criteria

- [ ] `getFile` operations abort after configured timeout
- [ ] `downloadFile` operations abort after configured timeout
- [ ] Timeout values are configurable with sensible defaults
- [ ] Path traversal attempts (../, symlink escape) are blocked
- [ ] File paths validated against sandbox root via realpath
- [ ] Unit tests verify timeout triggers abort
- [ ] Unit tests verify traversal attempts are rejected
- [ ] Existing tests pass with no regressions
