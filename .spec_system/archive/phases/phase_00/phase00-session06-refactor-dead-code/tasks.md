# Task Checklist

**Session ID**: `phase00-session06-refactor-dead-code`
**Total Tasks**: 20
**Estimated Duration**: 6-8 hours
**Created**: 2026-01-30

---

## Legend

- `[x]` = Completed
- `[ ]` = Pending
- `[P]` = Parallelizable (can run with other [P] tasks)
- `[S0006]` = Session reference (Phase 00, Session 06)
- `TNNN` = Task ID

---

## Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Setup | 2 | 2 | 0 |
| Foundation | 7 | 6 | 1 |
| Implementation | 7 | 7 | 0 |
| Cleanup | 2 | 2 | 0 |
| Testing | 2 | 2 | 0 |
| **Total** | **20** | **19** | **1** |

---

## Setup (2 tasks)

Initial verification and baseline establishment.

- [x] T001 [S0006] Verify prerequisites met - run `pnpm build && pnpm lint && pnpm test` to establish baseline
- [x] T002 [S0006] Audit target files exist - verify all files listed in spec are present before deletion

---

## Foundation (7 tasks)

Delete channel type definition files (leaf-first approach to minimize cascading errors).

- [x] T003 [S0006] [P] Delete Discord type file (`src/config/types.discord.ts`)
- [x] T004 [S0006] [P] Delete Slack type file (`src/config/types.slack.ts`)
- [x] T005 [S0006] [P] Delete Signal type file (`src/config/types.signal.ts`)
- [x] T006 [S0006] [P] Delete iMessage type file (`src/config/types.imessage.ts`)
- [KEPT] T007 [S0006] [P] WhatsApp type file (`src/config/types.whatsapp.ts`) - KEPT: still used by web provider
- [x] T008 [S0006] [P] Delete Google Chat type file (`src/config/types.googlechat.ts`)
- [x] T009 [S0006] [P] Delete MS Teams type file (`src/config/types.msteams.ts`)

---

## Implementation (7 tasks)

Update aggregating files, schemas, and remove dead runtime code.

- [x] T010 [S0006] Update types.channels.ts - remove non-Telegram fields from ChannelsConfig (`src/config/types.channels.ts`)
- [x] T011 [S0006] Update types.ts - remove re-exports of deleted type files (`src/config/types.ts`)
- [x] T012 [S0006] Simplify zod-schema.providers-core.ts - remove Discord/Slack/Signal/iMessage/GoogleChat/MSTeams schemas (`src/config/zod-schema.providers-core.ts`)
- [x] T013 [S0006] Simplify zod-schema.providers.ts - reduce ChannelsSchema to Telegram+WhatsApp+BlueBubbles (`src/config/zod-schema.providers.ts`)
- [x] T014 [S0006] Clean up plugin-sdk exports - remove GoogleChat/MSTeams type/schema exports (`src/plugin-sdk/index.ts`)
- [x] T015 [S0006] Remove dead routing code - delete resolveMSTeamsSession and related branches (`src/infra/outbound/outbound-session.ts`)
- [x] T016 [S0006] Simplify channel adapters - remove DISCORD_ADAPTER and dead switch cases (`src/infra/outbound/channel-adapters.ts`)

---

## Cleanup (2 tasks)

Delete CLI utilities for removed channels.

- [x] T017 [S0006] [P] Delete Discord admin CLI command (`src/cli/program/message/register.discord-admin.ts`)
- [x] T018 [S0006] [P] Delete Signal install command (`src/commands/signal-install.ts`)

---

## Testing (2 tasks)

Verification and quality assurance.

- [x] T019 [S0006] Run full verification - execute `pnpm build && pnpm lint && pnpm test` and fix any errors
- [x] T020 [S0006] Validate session completion - verify all success criteria from spec.md are met

---

## Completion Checklist

Before marking session complete:

- [x] All tasks marked `[x]}` (19/20 - T007 intentionally kept)
- [x] All tests passing (`pnpm test`) - 3654 tests pass
- [x] Build succeeds (`pnpm build`)
- [x] Lint passes (`pnpm lint`)
- [x] All files ASCII-encoded
- [x] implementation-notes.md updated
- [x] Ready for `/validate`

---

## Notes

### Deviation from Spec
- **T007 (WhatsApp type file)**: The spec listed types.whatsapp.ts for deletion, but this file is still actively used by the WhatsApp web provider which was marked as "out of scope" for removal. The file was restored to maintain functionality.

### Additional Changes Made
- Deleted `src/config/config.msteams.test.ts` - test file for removed MS Teams config
- Updated `src/infra/outbound/outbound-policy.test.ts` - removed Discord-specific embed test
- Updated `src/security/audit-extra.ts` - removed Discord/Slack configuration checks
- Updated `src/cli/program/register.message.ts` - removed Discord admin command import

### Parallelization
Tasks T003-T009 were executed in parallel (all independent type file deletions).
Tasks T017-T018 were executed in parallel (independent CLI file deletions).

### Order of Operations Followed
1. Deleted leaf type files first (T003-T009)
2. Updated aggregating re-exports (T010-T011)
3. Simplified Zod schemas (T012-T013)
4. Cleaned up plugin SDK (T014)
5. Removed dead runtime code (T015-T016)
6. Deleted CLI utilities (T017-T018)
7. Verified and tested (T019-T020)

---

## Session Complete

All tasks completed. Run `/validate` to verify session completeness.
