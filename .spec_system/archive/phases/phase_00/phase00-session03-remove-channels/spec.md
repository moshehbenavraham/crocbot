# Session Specification

**Session ID**: `phase00-session03-remove-channels`
**Phase**: 00 - Strip Moltbot to minimal footprint for VPS/Coolify/Ubuntu deployment
**Status**: Not Started
**Created**: 2026-01-30

---

## 1. Session Overview

This session removes all non-Telegram channel implementations from the crocbot codebase, transforming it from a multi-channel messaging platform to a Telegram-only gateway. The channels being removed include Discord, Slack, Signal, iMessage, WhatsApp/Web, and Line - totaling approximately 279 files across 7 directories.

This is a critical step in the stripping process that builds on Sessions 01 (native apps removed) and 02 (extensions removed). By eliminating multi-channel complexity, we reduce the codebase footprint, simplify routing logic, and remove dependencies on channel-specific libraries. After this session, the gateway will be purpose-built for Telegram deployment on VPS/Coolify/Ubuntu environments.

The session requires careful handling of the channel registry, routing system, CLI commands, and shared plugin infrastructure. We must ensure that channel-agnostic code in `src/channels/` remains functional while removing channel-specific implementations and updating type definitions to reflect the Telegram-only state.

---

## 2. Objectives

1. Remove all non-Telegram channel directories (~279 files total)
2. Update channel registry to Telegram-only with simplified types
3. Update CLI channel commands to reflect single-channel architecture
4. Remove channel-specific plugin code (actions, normalize, outbound, onboarding)
5. Update `.github/labeler.yml` to remove channel labels
6. Verify build, lint, and tests pass with Telegram functionality intact

---

## 3. Prerequisites

### Required Sessions
- [x] `phase00-session01-remove-native-apps` - Native app directories removed
- [x] `phase00-session02-remove-extensions` - Extension packages removed

### Required Tools/Knowledge
- TypeScript and ESM module system
- Understanding of channel plugin architecture in `src/channels/plugins/`
- Familiarity with grammy (Telegram bot framework)

### Environment Requirements
- Node 22+ runtime
- pnpm package manager
- Telegram bot token (for verification testing)

---

## 4. Scope

### In Scope (MVP)
- Remove `src/discord/` directory (61 files)
- Remove `src/slack/` directory (65 files)
- Remove `src/signal/` directory (24 files)
- Remove `src/imessage/` directory (16 files)
- Remove `src/web/` directory (77 files - WhatsApp Web)
- Remove `src/line/` directory (34 files)
- Remove `src/whatsapp/` directory (2 files)
- Update `src/channels/registry.ts` to Telegram-only
- Update channel plugin files in `src/channels/plugins/`
- Update CLI channel commands in `src/commands/channels/`
- Remove channel labels from `.github/labeler.yml`
- Update routing code if channel-specific logic exists

### Out of Scope (Deferred)
- Telegram code changes - *Reason: preserve as-is for stability*
- Shared utility refactoring - *Reason: Session 06 scope*
- Dependency cleanup - *Reason: Session 05 scope*
- Documentation updates - *Reason: Session 08 scope*
- Test file cleanup for removed channels - *Reason: handled implicitly by directory removal*

---

## 5. Technical Approach

### Architecture
The channel system uses a plugin-based architecture where each channel implements:
1. Core implementation directory (`src/<channel>/`)
2. Plugin registration in `src/channels/plugins/`
3. Actions, normalize, outbound, and onboarding handlers
4. Registry entry in `src/channels/registry.ts`

We will systematically remove non-Telegram channels by:
1. Deleting channel implementation directories
2. Updating the registry to Telegram-only
3. Removing channel-specific plugin files
4. Updating shared plugin code to remove dead references
5. Fixing TypeScript type errors from removed channels

### Design Patterns
- **Surgical deletion**: Remove entire directories first, then fix compilation errors
- **Type-driven refactoring**: Let TypeScript errors guide necessary updates
- **Registry simplification**: Reduce `CHAT_CHANNEL_ORDER` to single entry

### Technology Stack
- TypeScript 5.x (strict mode)
- grammy (Telegram bot framework) - retained
- Vitest (testing framework)

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| None | No new files needed | - |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `src/channels/registry.ts` | Remove non-Telegram channels from registry | ~-60 |
| `src/channels/plugins/index.ts` | Remove non-Telegram plugin imports | ~-20 |
| `src/channels/plugins/load.ts` | Update channel loading logic | ~-30 |
| `src/channels/plugins/catalog.ts` | Remove non-Telegram catalog entries | ~-50 |
| `src/channels/plugins/types.ts` | Update ChannelId type union | ~-10 |
| `src/channels/plugins/actions/*.ts` | Remove discord, signal action files | ~-200 |
| `src/channels/plugins/normalize/*.ts` | Remove non-Telegram normalize files | ~-150 |
| `src/channels/plugins/outbound/*.ts` | Remove non-Telegram outbound files | ~-100 |
| `src/channels/plugins/onboarding/*.ts` | Remove non-Telegram onboarding files | ~-100 |
| `src/channels/plugins/status-issues/*.ts` | Remove non-Telegram status files | ~-50 |
| `src/commands/channels/*.ts` | Update CLI commands for Telegram-only | ~-50 |
| `.github/labeler.yml` | Remove channel labels | ~-25 |

### Directories to Delete
| Directory | Files | Description |
|-----------|-------|-------------|
| `src/discord/` | 61 | Discord bot implementation |
| `src/slack/` | 65 | Slack bot implementation |
| `src/signal/` | 24 | Signal REST implementation |
| `src/imessage/` | 16 | iMessage implementation |
| `src/web/` | 77 | WhatsApp Web implementation |
| `src/line/` | 34 | Line bot implementation |
| `src/whatsapp/` | 2 | WhatsApp shared utilities |

---

## 7. Success Criteria

### Functional Requirements
- [ ] All non-Telegram channel directories removed
- [ ] `src/channels/registry.ts` contains only Telegram
- [ ] CLI `crocbot channels` commands work with Telegram-only
- [ ] No TypeScript references to removed channels

### Testing Requirements
- [ ] `pnpm build` completes without errors
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (Telegram tests)
- [ ] Manual verification: `crocbot channels status` shows only Telegram

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions
- [ ] No console.log statements added
- [ ] No new dependencies introduced

---

## 8. Implementation Notes

### Key Considerations
- The `src/channels/` directory contains shared channel infrastructure that must be preserved
- Some plugin files have channel-specific implementations that need surgical removal
- Type unions like `ChannelId` will need updating to remove deleted channel types
- The `DEFAULT_CHAT_CHANNEL` is currently "whatsapp" - must change to "telegram"

### Potential Challenges
- **Shared utilities**: Some code in `src/channels/plugins/` imports from removed channels - need to trace all imports
- **Type narrowing**: Union types may need simplification after removing channels
- **Test coupling**: Tests may reference removed channels indirectly through shared fixtures
- **Runtime checks**: Channel validation logic may have switch statements or conditionals for removed channels

### Relevant Considerations
No active concerns in CONSIDERATIONS.md currently apply to this session. This is a straightforward deletion task with minimal architectural risk.

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- Verify `normalizeChatChannelId()` returns null for removed channel names
- Verify `listChatChannels()` returns only Telegram
- Verify channel plugin loading excludes removed channels

### Integration Tests
- `pnpm test` should pass with no failures
- Tests for removed channels will be deleted with their directories

### Manual Testing
- Run `crocbot channels status` - should show only Telegram
- Run `crocbot channels list` - should show only Telegram
- Verify build output contains no references to removed channels

### Edge Cases
- Channel aliases (e.g., "imsg" for iMessage) must be removed from `CHAT_CHANNEL_ALIASES`
- Channel-specific action handlers must be removed from shared dispatch logic
- Outbound message routing must not reference removed channels

---

## 10. Dependencies

### External Libraries
- grammy: retained (Telegram bot framework)
- @grammyjs/runner: retained
- @grammyjs/transformer-throttler: retained

### Other Sessions
- **Depends on**: `phase00-session01-remove-native-apps`, `phase00-session02-remove-extensions`
- **Depended by**: `phase00-session04-simplify-build`, `phase00-session05-remove-dependencies`, `phase00-session06-refactor-dead-code`

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
