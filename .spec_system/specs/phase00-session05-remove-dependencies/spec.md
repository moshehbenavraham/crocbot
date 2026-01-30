# Session Specification

**Session ID**: `phase00-session05-remove-dependencies`
**Phase**: 00 - Strip Moltbot to minimal footprint for VPS/Coolify/Ubuntu deployment
**Status**: Not Started
**Created**: 2026-01-30

---

## 1. Session Overview

This session removes npm dependencies that were exclusively used by native apps, extensions, and non-Telegram channels that have been eliminated in sessions 01-04. With all consuming code now removed, these orphaned dependencies add unnecessary weight to the production image and increase install times without providing any value.

The target dependencies include Discord SDK packages (@buape/carbon, discord-api-types), Slack integration (@slack/bolt, @slack/web-api), WhatsApp/Baileys (@whiskeysockets/baileys, qrcode-terminal), Line SDK (@line/bot-sdk), and mobile-specific packages (@homebridge/ciao for mDNS, node-edge-tts for text-to-speech). Removing these will yield measurable reductions in `node_modules` size and `pnpm install` duration.

This session is strategically positioned after code removal (sessions 01-04) and before dead code refactoring (session 06). A clean dependency tree makes it easier to identify truly dead code and reduces noise in subsequent analysis.

---

## 2. Objectives

1. Remove all dependencies exclusively used by removed channels (Discord, Slack, WhatsApp, Line)
2. Remove all dependencies exclusively used by removed native apps and mobile features
3. Regenerate lockfile and verify clean installation
4. Measure and document reduction in `node_modules` size

---

## 3. Prerequisites

### Required Sessions
- [x] `phase00-session01-remove-native-apps` - Removed iOS/macOS/Android apps
- [x] `phase00-session02-remove-extensions` - Removed extension packages
- [x] `phase00-session03-remove-channels` - Removed Discord/Slack/WhatsApp/Line channels
- [x] `phase00-session04-simplify-build` - Simplified CI and build scripts

### Required Tools/Knowledge
- pnpm package manager
- Understanding of dependency tree analysis
- Familiarity with `package.json` structure

### Environment Requirements
- Node 22+
- pnpm 10.23.0+
- Clean working directory (no uncommitted changes)

---

## 4. Scope

### In Scope (MVP)
- Remove Discord dependencies: `@buape/carbon`, `discord-api-types`
- Remove Slack dependencies: `@slack/bolt`, `@slack/web-api`
- Remove WhatsApp dependencies: `@whiskeysockets/baileys`, `qrcode-terminal`, `@types/qrcode-terminal`
- Remove Line dependencies: `@line/bot-sdk`
- Remove mobile/native dependencies: `@homebridge/ciao`, `node-edge-tts`
- Regenerate `pnpm-lock.yaml`
- Verify build, lint, and test all pass
- Measure and record `node_modules` size reduction

### Out of Scope (Deferred)
- Code refactoring - *Reason: Session 06 scope*
- Telegram dependencies (grammy ecosystem) - *Reason: Core functionality*
- Core CLI dependencies - *Reason: Still in use*
- Build/dev tool dependencies - *Reason: Still needed for development*

---

## 5. Technical Approach

### Architecture
This session modifies only the root `package.json` and regenerates the lockfile. No source code changes are required since all consuming code was removed in prior sessions. The approach is conservative: remove one category of dependencies at a time, verify the build, then proceed.

### Design Patterns
- **Incremental removal**: Remove dependencies in logical groups, verify after each group
- **Validation-first**: Run full build/test suite after each change to catch hidden usages

### Technology Stack
- pnpm 10.23.0+ (package manager)
- Node 22+ (runtime verification)
- TypeScript (build verification)

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| None | No new files | 0 |

### Files to Modify
| File | Changes | Est. Lines Changed |
|------|---------|-------------------|
| `package.json` | Remove ~10 unused dependencies | ~15 |
| `pnpm-lock.yaml` | Regenerated automatically | N/A |

---

## 7. Success Criteria

### Functional Requirements
- [ ] `@buape/carbon` removed from package.json
- [ ] `discord-api-types` removed from package.json
- [ ] `@slack/bolt` removed from package.json
- [ ] `@slack/web-api` removed from package.json
- [ ] `@whiskeysockets/baileys` removed from package.json
- [ ] `qrcode-terminal` removed from package.json
- [ ] `@types/qrcode-terminal` removed from package.json
- [ ] `@line/bot-sdk` removed from package.json
- [ ] `@homebridge/ciao` removed from package.json
- [ ] `node-edge-tts` removed from package.json

### Testing Requirements
- [ ] `pnpm install` completes without errors
- [ ] `pnpm build` completes without errors
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] CLI starts successfully (`pnpm crocbot --help`)

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] No orphaned type definitions
- [ ] `node_modules` size reduced (document before/after)

---

## 8. Implementation Notes

### Key Considerations
- CONVENTIONS.md states: "Fewer dependencies = less risk" - this session directly supports that principle
- CONVENTIONS.md states: "Keep Telegram deps: grammy, @grammyjs/runner, @grammyjs/transformer-throttler" - do not touch these
- CONVENTIONS.md states: "Never update Carbon dependency" - we are removing it entirely, which is allowed

### Potential Challenges
- **Hidden transitive dependency usage**: Mitigation - run full build/test after each removal
- **Runtime-only imports**: Mitigation - test CLI startup and basic operations
- **Shared dependencies**: Some removed packages may have dependencies used by remaining packages; pnpm will keep those

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- Run full test suite: `pnpm test`
- No new tests needed (removing code, not adding)

### Integration Tests
- Run e2e tests: `pnpm test:e2e`

### Manual Testing
- Verify `pnpm crocbot --help` displays help
- Verify `pnpm crocbot config get` works
- Verify build output is functional

### Edge Cases
- Check that no source files import removed packages
- Verify no TypeScript compilation errors from missing types

---

## 10. Dependencies

### External Libraries
- pnpm: 10.23.0+ (existing)

### Other Sessions
- **Depends on**: phase00-session01, phase00-session02, phase00-session03, phase00-session04 (all completed)
- **Depended by**: phase00-session06-refactor-dead-code (clean dependency tree aids analysis)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
