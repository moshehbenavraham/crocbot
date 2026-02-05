# Task Checklist

**Session ID**: `phase06-session01-research-security-hardening-delta`
**Total Tasks**: 18
**Estimated Duration**: 6-8 hours
**Created**: 2026-02-05

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0601]` = Session reference (Phase 06, Session 01)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 3 | 3 | 0 |
| Foundation | 4 | 4 | 0 |
| Implementation | 8 | 8 | 0 |
| Testing | 3 | 3 | 0 |
| **Total** | **18** | **18** | **0** |

---

## Setup (3 tasks)

Initial environment verification and document scaffolding.

- [x] T001 [S0601] Verify prerequisites: upstream `.001_ORIGINAL/` exists, crocbot `src/infra/net/ssrf.ts` exists, `src/agents/sandbox-paths.ts` exists, Grammy version in `package.json` noted
- [x] T002 [S0601] Create output directory `.spec_system/PRD/phase_06/research/` and scaffold empty `security-hardening-delta.md` with all section headings
- [x] T003 [S0601] Verify working tree state: confirm build passes (`pnpm build`) and grep tools work against codebase

---

## Foundation (4 tasks)

Call site inventories and upstream file reads that feed into all later analysis sections.

- [x] T004 [S0601] [P] Inventory all outbound `fetch()` call sites in crocbot `src/` -- search for `fetch(`, `globalThis.fetch`, destructured fetch aliases; record file, line, and purpose for each
- [x] T005 [S0601] [P] Inventory all outbound `http.get`, `http.request`, `https.get`, `https.request`, and third-party HTTP clients (`axios`, `got`, `undici`) in crocbot `src/`
- [x] T006 [S0601] [P] Read and document upstream `src/infra/net/ssrf.ts` from `.001_ORIGINAL/` -- extract every exported function, blocked range, and policy type
- [x] T007 [S0601] [P] Read and document upstream `src/infra/net/fetch-guard.ts` from `.001_ORIGINAL/` -- extract the full guarded-fetch wrapper, redirect validation logic, and timeout integration

---

## Implementation (8 tasks)

Core analysis, comparison, and research document authoring.

- [x] T008 [S0601] Write SSRF delta analysis: compare crocbot `src/infra/net/ssrf.ts` against upstream version function-by-function; produce delta table with adopt/reject/adapt decisions (`security-hardening-delta.md` Section 2)
- [x] T009 [S0601] Write fetch-guard gap analysis: document that `src/infra/net/fetch-guard.ts` is entirely missing from crocbot; detail every function in upstream version and its integration requirements (`security-hardening-delta.md` Section 3)
- [x] T010 [S0601] [P] Read upstream Telegram download code and document timeout patterns -- identify where AbortSignal.timeout is used for download operations in upstream (`security-hardening-delta.md` Section 4a)
- [x] T011 [S0601] [P] Research Grammy SDK AbortSignal.timeout compatibility: check Grammy v1.39.3 `getFile`/download API; document version requirements and integration approach (`security-hardening-delta.md` Section 4b)
- [x] T012 [S0601] Write path traversal delta analysis: compare crocbot `src/agents/sandbox-paths.ts` against upstream; compare `message-tool.ts` sandbox integration; produce delta table (`security-hardening-delta.md` Section 5)
- [x] T013 [S0601] Categorize all inventoried fetch call sites by security boundary (core, plugins, Telegram, agents) and SSRF coverage need; write call site inventory table (`security-hardening-delta.md` Section 1)
- [x] T014 [S0601] Produce risk assessment for each security change: impact (high/medium/low), complexity, regression risk, and rationale (`security-hardening-delta.md` Section 6)
- [x] T015 [S0601] Produce prioritized implementation plan mapping every identified change to Session 02 (SSRF guards), Session 03 (download timeouts + path traversal), or Session 04 (validation); include dependency ordering (`security-hardening-delta.md` Section 7)

---

## Testing (3 tasks)

Verification of research document accuracy and completeness.

- [x] T016 [S0601] Spot-check 5+ call site inventory entries: verify file exists, line number is correct, purpose description is accurate
- [x] T017 [S0601] Verify all upstream file references: confirm quoted content matches actual `.001_ORIGINAL/` files; confirm all delta claims are accurate
- [x] T018 [S0601] Final review: confirm no placeholder/TBD entries, all sections populated, consistent table formatting, ASCII-only encoding, Unix LF line endings

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All sections of `security-hardening-delta.md` populated
- [x] All files ASCII-encoded
- [x] implementation-notes.md updated
- [x] Ready for `/validate`

---

## Notes

### Parallelization
Tasks marked `[P]` can be worked on simultaneously:
- **T004 + T005**: Independent call site inventory searches (fetch vs http/third-party)
- **T006 + T007**: Independent upstream file reads (ssrf.ts vs fetch-guard.ts)
- **T010 + T011**: Independent timeout research (upstream patterns vs Grammy SDK)

### Task Timing
Target ~20-25 minutes per task. Research tasks (T008-T015) may trend toward 25-30 minutes due to analysis and writing.

### Dependencies
- T004-T007 (Foundation) must complete before T008-T015 (Implementation)
- T008-T009 feed into T013 (call site categorization depends on SSRF analysis)
- T013-T014 feed into T015 (implementation plan depends on inventory + risk assessment)
- T016-T018 (Testing) depend on all Implementation tasks

### Key Output File
Single deliverable: `.spec_system/PRD/phase_06/research/security-hardening-delta.md`

Document sections:
1. Call Site Inventory (from T004, T005, T013)
2. SSRF Delta Analysis (from T008)
3. Fetch-Guard Gap Analysis (from T009)
4. Telegram Download Timeouts (from T010, T011)
5. Path Traversal Delta (from T012)
6. Risk Assessment (from T014)
7. Implementation Plan for Sessions 02-04 (from T015)

---

## Next Steps

Run `/implement` to begin AI-led implementation.
