# Implementation Summary

**Session ID**: `phase17-session03-agent-compaction-deadlock-and-token-fixes`
**Completed**: 2026-02-23
**Duration**: ~1 hour

---

## Overview

Eliminated critical runtime stability defects in the agent compaction pipeline: deadlock prevention via direct-path compaction calls, safety timeouts on `session.compact()`, and post-compaction token accounting correction to prevent false overflow retries. Additionally ported 10+ targeted runtime hardening fixes covering force-store for OpenAI responses, empty-chunk timeout classification, tool-call ID sanitization, whitespace stripping, undefined-path guards, and model fallback consolidation.

---

## Deliverables

### Files Created
| File | Purpose | Lines |
|------|---------|-------|
| `src/shared/with-timeout.ts` | Reusable timeout wrapper using AbortSignal.timeout() | ~45 |
| `src/shared/with-timeout.test.ts` | Unit tests for timeout utility (7 tests) | ~80 |

### Files Modified
| File | Changes |
|------|---------|
| `src/agents/pi-embedded-runner/compact.ts` | Added configurable timeout (120s default) wrapping session.compact() with withTimeout() |
| `src/agents/pi-embedded-runner/run.ts` | Post-compaction token accounting update, empty-chunk failure detection in shouldRotate |
| `src/agents/pi-embedded-runner/run/attempt.ts` | Inject store=true for OpenAI Responses API direct calls |
| `src/agents/pi-embedded-helpers/errors.ts` | Added stripLeadingWhitespace to sanitizeUserFacingText, extracted isRecoverableToolError helper |
| `src/agents/pi-embedded-helpers.ts` | Added barrel export for isRecoverableToolError |
| `src/agents/pi-embedded-runner/utils.ts` | Added safeContextFilePath null/undefined guard |
| `src/agents/pi-embedded-runner/model.ts` | Extracted resolveForwardCompatModel with ForwardCompatSpec type |
| `src/auto-reply/reply/session-usage.ts` | Added totalTokensOverride parameter to persistSessionUsageUpdate |
| `src/agents/session-transcript-repair.ts` | Added sanitizeToolCallIdForRepair (replaces invalid chars, truncates to 128) |
| `src/agents/pi-embedded-runner/run/payloads.ts` | Replaced inline tool-error check with isRecoverableToolError() |
| `src/agents/system-prompt.ts` | Added null guards for file.path usage |
| `src/agents/pi-embedded-runner/run.overflow-compaction.test.ts` | Added 2 tests for direct-path usage and token accounting |
| `src/agents/pi-embedded-helpers.sanitizeuserfacingtext.test.ts` | Added 4 tests for whitespace stripping |
| `src/agents/session-transcript-repair.test.ts` | Updated oversized ID test to match truncation behavior |

---

## Technical Decisions

1. **AbortSignal.timeout() for compaction safety**: Zero-dependency Node 22+ native API with automatic cleanup, composable with AbortSignal.any() for caller-supplied abort signals
2. **Sanitize vs skip invalid tool call IDs**: Chose sanitization (replace invalid chars with `_`, truncate to 128) over skipping to preserve tool call pairing and prevent orphaned tool results
3. **store=true at attempt level**: Injected in attempt.ts rather than extra-params.ts because `store` is not part of SimpleStreamOptions type, avoiding type widening
4. **Deferred prompt bloat reduction**: Upstream #29 spans 23 files; evaluated system-prompt.ts (thin wrapper, no actionable bloat) and deferred bulk reduction per spec guidance

---

## Test Results

| Metric | Value |
|--------|-------|
| Test Files | 791 |
| Total Tests | 6082 |
| Passed | 6081 |
| Failed | 0 |
| Skipped | 1 |
| Coverage | N/A (not configured) |

---

## Lessons Learned

1. Regex for whitespace stripping needs to handle `\n` sequences (literal backslash-n in sanitized text), not just actual newline characters -- initial `^[\t ]*\n` pattern was insufficient
2. Type system caught incorrect injection point for `store: true` (TS2339 in extra-params.ts) -- TypeScript strict mode validates design decisions early
3. Some upstream fixes were already present in crocbot (T009 direct-path, T012 exec override preservation) -- always verify before modifying

---

## Future Considerations

Items for future sessions:
1. **Prompt token bloat reduction** (upstream #29): 23 files deferred; address in a dedicated optimization session
2. **Session 04**: Store locking improvements and transcript path resolution (depends on stable compaction from this session)
3. **Session 05**: Memory bounding and validation (depends on stable token accounting from this session)

---

## Session Statistics

- **Tasks**: 22 completed
- **Files Created**: 2
- **Files Modified**: 14
- **Tests Added**: 13 (7 timeout + 4 whitespace + 2 compaction)
- **Blockers**: 0 resolved
