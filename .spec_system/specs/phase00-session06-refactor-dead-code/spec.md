# Session Specification

**Session ID**: `phase00-session06-refactor-dead-code`
**Phase**: 00 - Strip Moltbot to minimal footprint for VPS/Coolify/Ubuntu deployment
**Status**: Not Started
**Created**: 2026-01-30

---

## 1. Session Overview

This session performs a comprehensive cleanup of dead code remaining after sessions 01-05 removed native apps, extensions, non-Telegram channels, and their dependencies. The codebase still contains type definitions, configuration schemas, routing logic, and CLI utilities that reference removed channels (Discord, Slack, Signal, iMessage, WhatsApp, Google Chat, MS Teams). This dead code increases maintenance burden, causes potential type confusion, and bloats the bundle unnecessarily.

The cleanup focuses on three main areas: (1) removing channel-specific type definition files and their re-exports, (2) simplifying Zod configuration schemas to Telegram-only, and (3) removing dead routing branches and CLI utilities. After this session, the codebase will have a clean, single-channel architecture with no dangling references to removed channels.

This session is critical for enabling Session 07 (remove-mobile-code) and Session 08 (update-documentation), which depend on a clean codebase without dead type references that could cause confusion or TypeScript errors.

---

## 2. Objectives

1. Remove all type definition files for removed channels (Discord, Slack, Signal, iMessage, WhatsApp, Google Chat, MS Teams)
2. Simplify ChannelsConfig type and Zod schemas to Telegram-only
3. Remove dead routing code and channel adapters for removed channels
4. Ensure clean TypeScript compilation and all tests pass

---

## 3. Prerequisites

### Required Sessions
- [x] `phase00-session01-remove-native-apps` - Removed native app code
- [x] `phase00-session02-remove-extensions` - Removed extension packages
- [x] `phase00-session03-remove-channels` - Removed channel directories
- [x] `phase00-session04-simplify-build` - Simplified build system
- [x] `phase00-session05-remove-dependencies` - Removed unused dependencies

### Required Tools/Knowledge
- TypeScript type system (unions, interfaces, re-exports)
- Zod schema composition and validation
- Project structure and import patterns

### Environment Requirements
- Node 22+ runtime
- pnpm for dependency management
- Access to run build/lint/test commands

---

## 4. Scope

### In Scope (MVP)
- Delete channel type files: types.discord.ts, types.slack.ts, types.signal.ts, types.imessage.ts, types.whatsapp.ts, types.googlechat.ts, types.msteams.ts
- Update types.channels.ts to remove non-Telegram channel fields
- Update types.ts to remove re-exports of deleted files
- Remove Discord/Slack/Signal/iMessage/GoogleChat/MSTeams schemas from zod-schema.providers-core.ts
- Simplify zod-schema.providers.ts ChannelsSchema to Telegram-only
- Clean up plugin-sdk/index.ts exports
- Remove dead routing code in outbound-session.ts (resolveMSTeamsSession)
- Simplify channel-adapters.ts (remove DISCORD_ADAPTER)
- Delete register.discord-admin.ts CLI file
- Delete signal-install.ts command file
- Fix any resulting TypeScript errors

### Out of Scope (Deferred)
- Telegram code modifications - *Reason: Telegram is the kept channel, no changes needed*
- New features or optimizations - *Reason: Cleanup session only*
- Mobile-specific code removal - *Reason: Session 07 scope*
- Documentation updates - *Reason: Session 08 scope*
- WhatsApp web provider assessment - *Reason: May still be used, requires separate evaluation*

---

## 5. Technical Approach

### Architecture
The cleanup follows a bottom-up approach: first remove leaf type files, then update aggregating re-exports, then simplify schemas, and finally remove dead runtime code. This order minimizes cascading TypeScript errors during the refactor.

### Design Patterns
- **Incremental deletion**: Remove files one category at a time, running type-check after each to catch cascading issues
- **Import tracing**: Follow import chains to ensure no orphaned references remain
- **Test verification**: Run tests after each major deletion group to catch runtime issues

### Technology Stack
- TypeScript 5.x (strict mode)
- Zod for schema validation
- Vitest for testing

---

## 6. Deliverables

### Files to Delete
| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/config/types.discord.ts` | Discord config types | ~100 |
| `src/config/types.slack.ts` | Slack config types | ~80 |
| `src/config/types.signal.ts` | Signal config types | ~60 |
| `src/config/types.imessage.ts` | iMessage config types | ~50 |
| `src/config/types.whatsapp.ts` | WhatsApp config types | ~70 |
| `src/config/types.googlechat.ts` | Google Chat config types | ~60 |
| `src/config/types.msteams.ts` | MS Teams config types | ~80 |
| `src/cli/program/message/register.discord-admin.ts` | Discord admin CLI | ~150 |
| `src/commands/signal-install.ts` | Signal install helper | ~100 |

### Files to Modify
| File | Changes | Est. Lines Changed |
|------|---------|-------------------|
| `src/config/types.channels.ts` | Remove non-Telegram fields from ChannelsConfig | ~30 |
| `src/config/types.ts` | Remove re-exports of deleted type files | ~10 |
| `src/config/zod-schema.providers-core.ts` | Remove Discord/Slack/Signal/iMessage/GoogleChat/MSTeams schemas | ~400 |
| `src/config/zod-schema.providers.ts` | Simplify ChannelsSchema imports and fields | ~30 |
| `src/plugin-sdk/index.ts` | Remove GoogleChat/MSTeams type/schema exports | ~20 |
| `src/infra/outbound/outbound-session.ts` | Remove resolveMSTeamsSession and case branch | ~40 |
| `src/infra/outbound/channel-adapters.ts` | Remove DISCORD_ADAPTER, simplify getChannelMessageAdapter | ~15 |
| `src/cli/program/message/register.send.ts` | Remove discord-admin imports if present | ~5 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] No TypeScript references to Discord, Slack, Signal, iMessage, WhatsApp, Google Chat, or MS Teams in src/config/
- [ ] ChannelsConfig type only includes Telegram field
- [ ] Zod ChannelsSchema only validates Telegram configuration
- [ ] No dead routing branches in outbound-session.ts
- [ ] No channel-specific adapters except default

### Testing Requirements
- [ ] `pnpm build` succeeds with no type errors
- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm test` passes (all existing tests)
- [ ] Manual verification of config validation

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions (CONVENTIONS.md)
- [ ] No orphaned imports or unused exports

---

## 8. Implementation Notes

### Key Considerations
- Types and schemas form a dependency graph; delete in leaf-first order
- Some schemas may be referenced by plugin SDK; check exports carefully
- Channel adapters default fallback must remain functional

### Potential Challenges
- **Circular imports**: Type files may have subtle cross-references; trace carefully
- **Plugin SDK compatibility**: Ensure no breaking changes to exported types that plugins depend on
- **Test coverage**: Some tests may import removed types for testing purposes

### Relevant Considerations
<!-- From CONSIDERATIONS.md - no active concerns currently apply -->
*No active concerns from CONSIDERATIONS.md apply to this session. This is a cleanup session with well-defined scope.*

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- Verify Zod schema validation still accepts valid Telegram config
- Verify Zod schema rejects config with unknown channel fields (passthrough behavior)
- Run existing Telegram-related tests to ensure no regressions

### Integration Tests
- Run full test suite to catch any broken imports
- Verify CLI commands still function after discord-admin removal

### Manual Testing
- Run `crocbot config validate` with a Telegram-only config
- Verify TypeScript IDE shows no errors in modified files

### Edge Cases
- Config files with legacy channel fields should be handled gracefully (passthrough or ignore)
- Empty channels config should still be valid

---

## 10. Dependencies

### External Libraries
- Zod: ^3.x (existing, no changes)
- TypeScript: ^5.x (existing, no changes)

### Other Sessions
- **Depends on**: Sessions 01-05 (completed)
- **Depended by**: Session 07 (remove-mobile-code), Session 08 (update-documentation)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
