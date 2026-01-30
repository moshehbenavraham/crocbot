# Session 03: Remove Non-Telegram Channels

**Session ID**: `phase00-session03-remove-channels`
**Status**: Not Started
**Estimated Tasks**: ~20-25
**Estimated Duration**: 3-4 hours

---

## Objective

Remove all non-Telegram channel implementations (Discord, Slack, Signal, iMessage, WhatsApp/Web, Line) while preserving full Telegram functionality.

---

## Scope

### In Scope (MVP)
- Remove `src/discord/` directory (60 files)
- Remove `src/slack/` directory (65 files)
- Remove `src/signal/` directory (24 files)
- Remove `src/imessage/` directory (16 files)
- Remove `src/web/` directory (77 files - WhatsApp Web)
- Remove `src/line/` directory (34 files)
- Update channel registry/routing to only include Telegram
- Update `crocbot channels` CLI commands
- Update channel status display
- Remove channel-related entries from `.github/labeler.yml`
- Verify Telegram channel still works

### Out of Scope
- Telegram code changes (preserve as-is)
- Shared utility refactoring (Session 06)
- Dependency cleanup (Session 05)
- Documentation updates (Session 08)

---

## Prerequisites

- [ ] Session 01 completed (native apps removed)
- [ ] Session 02 completed (extensions removed)
- [ ] `pnpm build` completes successfully
- [ ] Telegram bot token available for testing

---

## Deliverables

1. All non-Telegram channel directories removed
2. Channel registry updated to Telegram-only
3. CLI channel commands reflect Telegram-only state
4. Routing code simplified for single channel
5. Build verification passed
6. Telegram functionality verified

---

## Success Criteria

- [ ] `src/discord/`, `src/slack/`, `src/signal/`, `src/imessage/`, `src/web/`, `src/line/` directories removed
- [ ] `pnpm install` completes without errors
- [ ] `pnpm build` completes without errors
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (Telegram tests)
- [ ] `crocbot channels status` shows only Telegram
- [ ] Telegram channel connects and responds to messages
- [ ] No TypeScript errors referencing removed channels
