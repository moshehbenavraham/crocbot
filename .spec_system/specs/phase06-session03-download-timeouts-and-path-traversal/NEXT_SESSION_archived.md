# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-02-06
**Project State**: Phase 06 - Upstream Security Hardening Port
**Completed Sessions**: 31

---

## Recommended Next Session

**Session ID**: `phase06-session03-download-timeouts-and-path-traversal`
**Session Name**: Download Timeouts and Path Traversal
**Estimated Duration**: 2-3 hours
**Estimated Tasks**: ~18

---

## Why This Session Next?

### Prerequisites Met
- [x] Session 01 (Research Security Hardening Delta) completed
- [x] Session 02 (SSRF Guards) completed - SSRF guards now in place
- [x] Grammy AbortSignal compatibility confirmed (Session 01 research)

### Dependencies
- **Builds on**: `phase06-session02-ssrf-guards` (SSRF infrastructure provides the guarded fetch patterns this session extends with timeouts)
- **Enables**: `phase06-session04-security-validation` (final validation of all Phase 06 security measures)

### Project Progression
This is the natural next step in Phase 06's linear dependency chain. Session 02 established SSRF guards for outbound fetches. Session 03 completes the remaining two security hardening measures: download timeout enforcement (preventing DoS from slow/malicious downloads) and path traversal validation (preventing sandbox escape in file operations). Both are required before Session 04 can perform end-to-end security validation.

---

## Session Overview

### Objective
Enforce timeout limits on Telegram file download operations to prevent DoS from slow/malicious downloads, and add path traversal validation to file operations to prevent sandbox escape.

### Key Deliverables
1. Timeout-enforced Telegram download operations (`getFile` and `downloadFile` with `AbortSignal.timeout`)
2. Path traversal validation in agent tool file operations (realpath + prefix check)
3. Unit tests for timeout enforcement
4. Unit tests for path traversal blocking
5. Build passes with zero errors/warnings

### Scope Summary
- **In Scope (MVP)**: AbortSignal.timeout on Telegram getFile/downloadFile, configurable timeout defaults, path traversal validation using realpath + prefix check in message-tool.ts and other file-writing tools, unit tests for both
- **Out of Scope**: Content-type/file-size validation, streaming download progress, timeout configuration UI, SSRF guards (already done in Session 02)

---

## Technical Considerations

### Technologies/Patterns
- `AbortSignal.timeout()` for download timeout enforcement
- `fs.realpath()` + prefix validation for path traversal prevention
- Grammy `getFile` / `downloadFile` API integration
- Upstream reference: `src/telegram/download.ts`, `src/agents/tools/message-tool.ts` in `.001_ORIGINAL/`

### Potential Challenges
- Grammy's file download API may have its own internal timeout behavior that needs coordination with AbortSignal
- Path traversal validation must handle symlinks correctly (realpath resolves symlinks before prefix check)
- Need to identify all file-writing tool operations beyond message-tool.ts that require path validation

### Relevant Considerations
- [P04] **Verbatim upstream port pattern**: Match upstream implementation first, then adapt only what crocbot's architecture requires. Minimizes divergence.
- [P00] **Incremental verification**: Run build/lint/test after each major change. Add timeout enforcement first, verify, then add path traversal, verify again.

---

## Alternative Sessions

If this session is blocked:
1. **phase06-session04-security-validation** - Could be partially started (SSRF-only validation) but would be incomplete without Session 03 deliverables
2. **New phase planning** - If Phase 06 is deprioritized, could begin scoping a new phase (e.g., feature work, performance optimization)

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
