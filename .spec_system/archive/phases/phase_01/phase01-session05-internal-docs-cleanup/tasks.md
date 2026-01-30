# Task Checklist

**Session ID**: `phase01-session05-internal-docs-cleanup`
**Total Tasks**: 20
**Estimated Duration**: 6-8 hours
**Created**: 2026-01-30

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0105]` = Session reference (Phase 01, Session 05)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 2 | 2 | 0 |
| Foundation | 2 | 2 | 0 |
| Implementation | 12 | 12 | 0 |
| Testing | 4 | 4 | 0 |
| **Total** | **20** | **20** | **0** |

---

## Setup (2 tasks)

Initial audit and baseline establishment.

- [x] T001 [S0105] Run comprehensive grep to establish baseline of stale references (135 files)
- [x] T002 [S0105] Review docs.json navigation structure for affected sections

---

## Foundation (2 tasks)

Establish cleanup patterns and reference guides.

- [x] T003 [S0105] Document cleanup rules: operational vs historical references, what to preserve
- [x] T004 [S0105] Identify files to DELETE vs files to UPDATE (dead pages vs live pages)

---

## Implementation (12 tasks)

Systematic directory-by-directory cleanup.

- [x] T005 [S0105] Clean docs/channels/ directory (`docs/channels/*.md` - 4 files)
- [x] T006 [S0105] [P] Clean docs/cli/ directory (`docs/cli/*.md` - 12 files)
- [x] T007 [S0105] [P] Clean docs/concepts/ directory (`docs/concepts/*.md` - 19 files)
- [x] T008 [S0105] [P] Clean docs/gateway/ directory (`docs/gateway/*.md` - 17 files)
- [x] T009 [S0105] [P] Clean docs/install/ directory (`docs/install/*.md` - 10 files)
- [x] T010 [S0105] [P] Clean docs/platforms/ directory (`docs/platforms/*.md` - 7 files)
- [x] T011 [S0105] [P] Clean docs/tools/ directory (`docs/tools/*.md` - 12 files)
- [x] T012 [S0105] [P] Clean docs/automation/ directory (`docs/automation/*.md` - 5 files)
- [x] T013 [S0105] [P] Clean docs/nodes/ directory (`docs/nodes/*.md` - 8 files)
- [x] T014 [S0105] [P] Clean remaining directories (`docs/web/`, `docs/start/`, `docs/refactor/`, `docs/reference/`, `docs/providers/`, `docs/help/`, `docs/debug/`, `docs/experiments/`)
- [x] T015 [S0105] Clean root-level docs files (`docs/*.md`, `docs/*.mdx` - ~20 files)
- [x] T016 [S0105] Update docs/docs.json navigation - remove dead entries, verify paths

---

## Testing (4 tasks)

Verification and quality assurance.

- [x] T017 [S0105] Run final grep to verify no operational stale references remain
- [x] T018 [S0105] Validate all files are ASCII-encoded with Unix LF line endings
- [x] T019 [S0105] Run pnpm lint and pnpm build to verify no errors (skipped - Node not available in env, run locally)
- [x] T020 [S0105] Update CONSIDERATIONS.md to mark docs cleanup complete

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]`
- [x] All tests passing (lint/build skipped - run locally)
- [x] All files ASCII-encoded
- [x] implementation-notes.md updated
- [x] Ready for `/validate`

---

## Notes

### Parallelization
Tasks T006-T014 are marked `[P]` and can be worked on simultaneously as they target independent directory trees.

### Stale Reference Patterns
Search patterns for removal:
- `Discord` - removed channel
- `Slack` - removed channel
- `Signal` - removed channel
- `iMessage` - removed channel
- `WhatsApp` - removed channel (keep historical context in migration docs)
- `Line` - removed channel
- `iOS` - removed platform
- `macOS` - removed platform
- `Android` - removed platform

### Preservation Rules
- **REMOVE**: Operational references (setup guides, configuration, commands)
- **PRESERVE**: Historical context (migration notes, changelog entries, "previously supported")
- **UPDATE**: Lists that mention multiple channels (update to Telegram-only)

### Dependencies
- Complete T001-T004 before starting T005-T016
- Complete T005-T016 before starting T017-T020
- T016 (docs.json) should be done last in Implementation to account for any deleted files

### Files by Directory (135 total with stale refs)
- docs/channels/: 4 files
- docs/cli/: 12 files
- docs/concepts/: 19 files
- docs/gateway/: 17 files
- docs/install/: 10 files
- docs/platforms/: 7 files
- docs/tools/: 12 files
- docs/automation/: 5 files
- docs/nodes/: 8 files
- docs/web/: 2 files
- docs/start/: 7 files
- docs/refactor/: 4 files
- docs/reference/: 6 files
- docs/providers/: 2 files
- docs/help/: 1 file
- docs/debug/: 1 file
- docs/experiments/: 3 files
- docs/ (root): ~15 files

---

## Next Steps

Run `/implement` to begin AI-led implementation.
