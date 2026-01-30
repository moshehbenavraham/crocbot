# Session Specification

**Session ID**: `phase01-session01-clean-technical-debt`
**Phase**: 01 - Production Hardening and Deployment
**Status**: Not Started
**Created**: 2026-01-30

---

## 1. Session Overview

This session eliminates technical debt remaining from Phase 00's codebase stripping. During Phase 00, the project was transformed from a multi-platform application to a lean Telegram-only gateway. To minimize cascading changes, API-compatible stubs were left in place for removed features (TTS, pairing, Bonjour/mDNS). Now that the major deletions are complete and stable, these stubs can be safely removed.

The cleanup also includes removing orphaned type definitions (WhatsApp types no longer used after web provider removal), verifying BlueBubbles provider status, and ensuring the plugin loader contains no references to removed extensions. This session prepares a clean foundation for Docker optimization in Session 02.

Successful completion ensures the codebase contains only active, production-necessary code with no dead stubs or orphaned references.

---

## 2. Objectives

1. Remove all TTS stub files and update consumers to eliminate TTS imports entirely
2. Remove all pairing stub files and update consumers to eliminate pairing imports
3. Remove Bonjour/mDNS references from configuration schemas
4. Verify and remove orphaned type definitions (WhatsApp types, BlueBubbles provider)
5. Clean plugin loader of any references to removed extensions
6. Achieve clean build/lint/test with no dead code

---

## 3. Prerequisites

### Required Sessions
- [x] `phase00-session01-remove-native-apps` - Native app code removed
- [x] `phase00-session02-remove-extensions` - Extension packages removed
- [x] `phase00-session03-remove-channels` - Non-Telegram channels removed
- [x] `phase00-session04-simplify-build` - Build system simplified
- [x] `phase00-session05-remove-dependencies` - Unused dependencies removed
- [x] `phase00-session06-refactor-dead-code` - Dead channel code removed
- [x] `phase00-session07-remove-mobile-code` - Mobile infrastructure stubbed
- [x] `phase00-session08-update-documentation` - User-facing docs updated

### Required Tools/Knowledge
- TypeScript strict mode for identifying broken imports
- ripgrep/grep for reference tracing before deletion
- Understanding of stub pattern used in Phase 00

### Environment Requirements
- Node 22+
- pnpm for dependency management
- All tests currently passing

---

## 4. Scope

### In Scope (MVP)
- Remove `src/tts/tts.ts` and directory
- Remove `src/pairing/pairing-store.ts` and `src/pairing/pairing-messages.ts`
- Remove `src/infra/device-pairing.ts`
- Update 9 files that import TTS stubs to remove TTS functionality
- Update 9 files that import pairing stubs to remove pairing functionality
- Update 2 files that import device-pairing to remove that functionality
- Remove `src/config/types.whatsapp.ts` (web provider already removed)
- Remove Bonjour/mDNS config schema references (4 files)
- Verify and clean BlueBubbles provider references (11 files)
- Verify plugin loader has no removed extension references (3 files)
- Full build/lint/test validation

### Out of Scope (Deferred)
- Docker optimization - *Reason: Session 02 scope*
- Gateway hardening - *Reason: Session 03 scope*
- CI/CD changes - *Reason: Session 04 scope*
- Internal documentation cleanup - *Reason: Session 05 scope*

---

## 5. Technical Approach

### Architecture
This is a deletion-focused cleanup session. The approach follows the proven Phase 00 pattern: trace references, delete leaf files first, update consumers, verify incrementally.

### Design Patterns
- **Bottom-up deletion**: Delete files with no dependents first, then work up to widely-imported files
- **Incremental verification**: Run build/lint/test after each major deletion category
- **Reference tracing**: grep all imports before deleting to prevent dangling references
- **Stub removal**: Replace stub imports with inline disabled behavior or remove entirely

### Technology Stack
- TypeScript (strict mode) for compile-time verification
- Vitest for test verification
- oxlint/oxfmt for lint/format verification

---

## 6. Deliverables

### Files to Delete
| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/tts/tts.ts` | TTS stub module | ~150 |
| `src/pairing/pairing-store.ts` | Pairing store stub | ~150 |
| `src/pairing/pairing-messages.ts` | Pairing messages stub | ~30 |
| `src/infra/device-pairing.ts` | Device pairing stub | ~145 |
| `src/config/types.whatsapp.ts` | WhatsApp config types | ~160 |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `src/agents/pi-embedded-runner/run/attempt.ts` | Remove TTS import/usage | ~10 |
| `src/agents/pi-embedded-runner/compact.ts` | Remove TTS import/usage | ~10 |
| `src/plugins/runtime/index.ts` | Remove TTS and pairing imports | ~15 |
| `src/agents/cli-runner/helpers.ts` | Remove TTS import/usage | ~10 |
| `src/agents/tools/tts-tool.ts` | Remove or stub entire file | ~50 |
| `src/auto-reply/reply/commands-context-report.ts` | Remove TTS import/usage | ~10 |
| `src/auto-reply/reply/dispatch-from-config.ts` | Remove TTS import/usage | ~10 |
| `src/auto-reply/status.ts` | Remove TTS import/usage | ~10 |
| `src/auto-reply/reply/commands-tts.ts` | Remove or stub entire file | ~50 |
| `src/plugin-sdk/index.ts` | Remove pairing re-exports | ~10 |
| `src/auto-reply/reply/commands-allowlist.ts` | Remove pairing import/usage | ~10 |
| `src/telegram/bot-message-context.ts` | Remove pairing import/usage | ~10 |
| `src/telegram/bot-native-commands.ts` | Remove pairing import/usage | ~10 |
| `src/commands/doctor-security.ts` | Remove pairing import/usage | ~10 |
| `src/security/audit.ts` | Remove pairing import/usage | ~10 |
| `src/security/fix.ts` | Remove pairing import/usage | ~10 |
| `src/telegram/bot-handlers.ts` | Remove pairing import/usage | ~10 |
| `src/gateway/server.auth.e2e.test.ts` | Remove device-pairing import | ~10 |
| `src/gateway/server/ws-connection/message-handler.ts` | Remove device-pairing import | ~15 |
| `src/config/schema.ts` | Remove Bonjour/BlueBubbles refs | ~20 |
| `src/config/types.gateway.ts` | Remove Bonjour refs | ~10 |
| `src/config/zod-schema.ts` | Remove Bonjour refs | ~10 |
| `src/config/types.ts` | Remove WhatsApp type import | ~5 |
| `src/config/types.channels.ts` | Remove WhatsApp type import | ~5 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] No TTS stub files remain in `src/tts/`
- [ ] No pairing stub files remain in `src/pairing/`
- [ ] No device-pairing stub file remains in `src/infra/`
- [ ] No imports of removed TTS/pairing modules in codebase
- [ ] WhatsApp types removed (web provider already gone)
- [ ] Bonjour/mDNS config schema references removed
- [ ] BlueBubbles provider references cleaned or justified

### Testing Requirements
- [ ] All existing unit tests pass
- [ ] All existing e2e tests pass
- [ ] No TypeScript errors

### Quality Gates
- [ ] `pnpm build` passes with no errors
- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm test` passes with full coverage thresholds
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions

---

## 8. Implementation Notes

### Key Considerations
- TTS tool (`src/agents/tools/tts-tool.ts`) may need to become a no-op tool or be removed entirely
- TTS commands file (`src/auto-reply/reply/commands-tts.ts`) should be removed or return disabled status
- Plugin SDK re-exports pairing types - verify no external plugins depend on this
- Some pairing functions return "always allowed" behavior - ensure this is preserved where needed

### Potential Challenges
- **Hidden consumers**: Some imports may be dynamic or conditional, not caught by static grep
- **Test fixtures**: Tests may depend on stub behavior - need to verify test logic remains valid
- **Type exports**: Plugin SDK exports pairing types - external plugins may break (acceptable)

### Relevant Considerations
- [P00] **Stub files for disabled features**: API-compatible stubs were intentionally left in Phase 00 to minimize cascading changes. This session removes them now that the codebase is stable.
- [P00] **WhatsApp types retained**: Originally kept for web provider, but web provider was removed in Phase 00. Safe to delete.
- [P00] **BlueBubbles provider status**: Appears in config schemas but may be unused. Will verify and clean.
- [P00] **Incremental verification**: Proven pattern from Phase 00 - run build/lint/test after each major change.
- [P00] **Bottom-up deletion order**: Delete leaf files first to minimize TypeScript error cascades.

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- Run full test suite after each deletion category
- Verify no tests fail due to missing imports
- Check that mocked TTS/pairing behavior in tests is updated

### Integration Tests
- Verify gateway still starts correctly
- Verify Telegram channel still processes messages
- Verify CLI commands work without TTS/pairing

### Manual Testing
- `pnpm crocbot --help` runs without errors
- `pnpm crocbot channels status` works
- Gateway starts and responds to health checks

### Edge Cases
- Commands that previously used TTS should gracefully report "disabled"
- Pairing-related commands should report feature not available
- Config validation should not require removed config sections

---

## 10. Dependencies

### External Libraries
- No new dependencies required
- No dependency changes needed

### Other Sessions
- **Depends on**: All Phase 00 sessions (complete)
- **Depended by**: `phase01-session02-docker-optimization` (needs clean codebase)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
