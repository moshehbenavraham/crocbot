# NEXT_SESSION.md

## Session Recommendation

**Generated**: 2026-01-30
**Project State**: Phase 00 - Strip Moltbot to minimal footprint for VPS/Coolify/Ubuntu deployment
**Completed Sessions**: 2

---

## Recommended Next Session

**Session ID**: `phase00-session03-remove-channels`
**Session Name**: Remove Non-Telegram Channels
**Estimated Duration**: 3-4 hours
**Estimated Tasks**: 20-25

---

## Why This Session Next?

### Prerequisites Met
- [x] Session 01 completed (native apps removed)
- [x] Session 02 completed (extensions removed)
- [x] `pnpm build` completes successfully (verified in Session 02)

### Dependencies
- **Builds on**: Sessions 01 & 02 - native apps and extensions already removed, reducing complexity
- **Enables**: Session 04 (simplify build), Session 05 (remove dependencies), Session 06 (refactor dead code)

### Project Progression
This is the logical next step in the stripping process. The PRD specifies the implementation order: native apps (done) -> extensions (done) -> channels (next). Removing channels is medium-risk and requires testing, but the groundwork from Sessions 01-02 has simplified the codebase. After this session, we'll have eliminated all multi-channel complexity and can proceed to build simplification and dependency cleanup.

---

## Session Overview

### Objective
Remove all non-Telegram channel implementations (Discord, Slack, Signal, iMessage, WhatsApp/Web, Line) while preserving full Telegram functionality.

### Key Deliverables
1. Remove all non-Telegram channel directories (~276 files across 6 directories)
2. Update channel registry/routing to Telegram-only
3. Update CLI channel commands to reflect single-channel state
4. Simplify routing code for single channel
5. Verify Telegram functionality remains intact

### Scope Summary
- **In Scope (MVP)**: Remove `src/discord/`, `src/slack/`, `src/signal/`, `src/imessage/`, `src/web/`, `src/line/`; update channel registry; update CLI commands; update `.github/labeler.yml`; verify Telegram works
- **Out of Scope**: Telegram code changes; shared utility refactoring (Session 06); dependency cleanup (Session 05); documentation updates (Session 08)

---

## Technical Considerations

### Technologies/Patterns
- Channel registry pattern in `src/channels/`
- Routing logic in `src/routing/`
- CLI commands in `src/commands/`
- Telegram retained: grammy, @grammyjs/runner, @grammyjs/transformer-throttler

### Potential Challenges
- **Shared utilities**: Some channel code may share utilities with Telegram - need careful review
- **Type references**: TypeScript types may reference removed channels in union types
- **Routing complexity**: Multi-channel routing logic needs simplification, not just deletion
- **Test coverage**: Need to ensure Telegram tests still pass and aren't coupled to removed channels

### Relevant Considerations
*No active concerns in CONSIDERATIONS.md apply to this session.*

---

## Alternative Sessions

If this session is blocked:
1. **phase00-session04-simplify-build** - Can parallelize some build simplification if channel removal is blocked by dependencies
2. **phase00-session05-remove-dependencies** - Partial dependency removal could proceed for clearly unused packages

---

## Next Steps

Run `/sessionspec` to generate the formal specification.
