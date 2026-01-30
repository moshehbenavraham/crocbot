# Session Specification

**Session ID**: `phase00-session07-remove-mobile-code`
**Phase**: 00 - Strip Moltbot to minimal footprint for VPS/Coolify/Ubuntu deployment
**Status**: Not Started
**Created**: 2026-01-30

---

## 1. Session Overview

This session removes all mobile-specific functionality from crocbot to continue the transformation into a lean CLI + Telegram gateway for VPS hosting. With native apps removed (Session 01), extensions stripped (Session 02), non-Telegram channels eliminated (Session 03), and dead code refactored (Session 06), the mobile-specific code is now isolated and safe to remove.

The primary targets are: device/node pairing infrastructure (designed for mobile app authentication), Bonjour/mDNS discovery (used for LAN device discovery), and text-to-speech (TTS) functionality (designed for voice interactions on mobile). These features add complexity and dependencies that are unnecessary for a VPS deployment focused solely on Telegram messaging.

This is the penultimate session in Phase 00, clearing the way for the final documentation cleanup in Session 08.

---

## 2. Objectives

1. Remove all pairing infrastructure (`src/pairing/`, device pairing, node pairing) and related CLI commands
2. Remove Bonjour/mDNS discovery code and the `@homebridge/ciao` dependency
3. Remove TTS (text-to-speech) functionality and related dependencies (`node-edge-tts`)
4. Ensure gateway starts and operates without pairing or discovery requirements

---

## 3. Prerequisites

### Required Sessions
- [x] `phase00-session01-remove-native-apps` - Native apps removed
- [x] `phase00-session02-remove-extensions` - Extensions stripped
- [x] `phase00-session03-remove-channels` - Non-Telegram channels removed
- [x] `phase00-session04-simplify-build` - Build system simplified
- [x] `phase00-session05-remove-dependencies` - Unused dependencies removed
- [x] `phase00-session06-refactor-dead-code` - Dead channel code refactored

### Required Tools/Knowledge
- TypeScript/ESM module system
- Commander.js CLI patterns
- Gateway server architecture

### Environment Requirements
- Node 22+
- pnpm for package management
- Build passes before starting (`pnpm build`)

---

## 4. Scope

### In Scope (MVP)
- Remove `src/pairing/` directory (pairing-store, pairing-labels, pairing-messages)
- Remove `src/tts/` directory (text-to-speech functionality)
- Remove Bonjour/mDNS code (`src/infra/bonjour*.ts`)
- Remove device pairing code (`src/infra/device-pairing.ts`, `src/infra/node-pairing.ts`)
- Remove CLI commands: `pairing`, `devices`, gateway discovery commands
- Remove TTS configuration from config schema
- Remove `@homebridge/ciao` and `node-edge-tts` dependencies
- Update gateway to not start Bonjour advertiser
- Clean up any imports/references to removed code

### Out of Scope (Deferred)
- Documentation updates - *Reason: Session 08 handles all documentation*
- Pi model aliasing for TTS summary models - *Reason: Entire TTS being removed*
- Mobile-specific config options in user configs - *Reason: Config files are user-owned*

---

## 5. Technical Approach

### Architecture
The removal follows a bottom-up approach: first remove the core modules (`src/pairing/`, `src/tts/`, `src/infra/bonjour*.ts`, `src/infra/device-pairing.ts`, `src/infra/node-pairing.ts`), then remove CLI commands that depend on them, then clean up gateway server code that initializes these systems, and finally remove the npm dependencies.

### Design Patterns
- **Surgical removal**: Delete entire modules where possible rather than modifying internals
- **Reference tracing**: Follow imports to find all dependent code
- **Incremental verification**: Build after each major removal to catch breakages early

### Technology Stack
- TypeScript 5.x (ESM)
- Commander.js for CLI
- Vitest for testing

---

## 6. Deliverables

### Files to Delete
| File/Directory | Purpose |
|----------------|---------|
| `src/pairing/` | Device pairing store, labels, messages (5 files) |
| `src/tts/` | Text-to-speech functionality (2 files) |
| `src/infra/bonjour.ts` | Bonjour advertiser |
| `src/infra/bonjour-ciao.ts` | Ciao library helpers |
| `src/infra/bonjour-errors.ts` | Bonjour error formatting |
| `src/infra/bonjour-discovery.ts` | Bonjour discovery client |
| `src/infra/bonjour.test.ts` | Bonjour tests |
| `src/infra/bonjour-discovery.test.ts` | Discovery tests |
| `src/infra/device-pairing.ts` | Device pairing logic |
| `src/infra/device-pairing.test.ts` | Device pairing tests |
| `src/infra/node-pairing.ts` | Node pairing logic |
| `src/cli/pairing-cli.ts` | Pairing CLI commands |
| `src/cli/pairing-cli.test.ts` | Pairing CLI tests |
| `src/cli/devices-cli.ts` | Devices CLI commands |
| `src/cli/gateway-cli/discover.ts` | Gateway discover command |

### Files to Modify
| File | Changes | Est. Lines |
|------|---------|------------|
| `src/cli/program/register.subclis.ts` | Remove pairing/devices entries | ~15 |
| `src/gateway/server-startup.ts` | Remove Bonjour advertiser start | ~20 |
| `src/gateway/server-close.ts` | Remove Bonjour shutdown | ~10 |
| `src/gateway/server-discovery.ts` | Remove/simplify discovery helpers | ~30 |
| `src/gateway/server-methods.ts` | Remove device pairing methods | ~20 |
| `src/gateway/server-methods/devices.ts` | Remove device pairing RPC | ~50 |
| `src/gateway/server-methods/nodes.ts` | Remove node pairing RPC | ~30 |
| `src/config/schema.ts` | Remove TTS/pairing config | ~40 |
| `src/config/types.gateway.ts` | Remove Bonjour types | ~15 |
| `src/config/zod-schema.ts` | Remove TTS schema | ~30 |
| `src/channels/plugins/pairing.ts` | Remove pairing plugin | ~20 |
| `package.json` | Remove dependencies, update files | ~10 |

---

## 7. Success Criteria

### Functional Requirements
- [ ] `src/pairing/` directory no longer exists
- [ ] `src/tts/` directory no longer exists
- [ ] No Bonjour/mDNS code in `src/infra/`
- [ ] No `@homebridge/ciao` or `node-edge-tts` in dependencies
- [ ] Gateway starts without Bonjour/pairing initialization
- [ ] No `pairing` or `devices` CLI subcommands

### Testing Requirements
- [ ] `pnpm test` passes (all remaining tests)
- [ ] Manual: `crocbot gateway run` starts successfully
- [ ] Manual: `crocbot --help` shows no pairing/devices commands

### Quality Gates
- [ ] `pnpm install` completes without errors
- [ ] `pnpm build` completes without errors
- [ ] `pnpm lint` passes
- [ ] No TypeScript errors
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings

---

## 8. Implementation Notes

### Key Considerations
- The `src/channels/plugins/pairing.ts` file may have Telegram-specific pairing; verify it's only used for removed channels
- Gateway server-methods has device/node pairing RPC handlers that need removal
- TTS config is deeply integrated into the config schema; trace all type references
- The `files` array in `package.json` includes `dist/pairing/**` and `dist/tts/**` which need removal

### Potential Challenges
- **Gateway initialization order**: Bonjour advertiser is started during server startup; ensure clean removal doesn't break startup sequence
- **Config schema coupling**: TTS config types are referenced by multiple config files; need to trace and remove all references
- **Hidden imports**: Some files may dynamically import pairing/TTS modules; use grep to find all references

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- Remove all pairing/TTS test files (they test removed code)
- Verify remaining tests pass after removal

### Integration Tests
- Gateway startup without pairing
- CLI help output verification

### Manual Testing
- Start gateway: `crocbot gateway run`
- Verify no Bonjour errors in logs
- Verify `crocbot pairing` returns unknown command
- Verify `crocbot devices` returns unknown command

### Edge Cases
- Config files with TTS settings (should be ignored gracefully or error clearly)
- Existing paired device state files (should be ignored)

---

## 10. Dependencies

### External Libraries to Remove
- `@homebridge/ciao`: mDNS/Bonjour library
- `node-edge-tts`: Microsoft Edge TTS library

### Other Sessions
- **Depends on**: Sessions 01-06 (all prerequisites completed)
- **Depended by**: Session 08 (documentation update - waits for final feature set)

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
