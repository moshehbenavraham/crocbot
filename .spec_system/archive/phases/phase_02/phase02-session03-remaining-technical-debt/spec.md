# Session Specification

**Session ID**: `phase02-session03-remaining-technical-debt`
**Phase**: 02 - Operational Maturity and Observability
**Status**: Not Started
**Created**: 2026-01-30

---

## 1. Session Overview

This session addresses the remaining technical debt accumulated during Phase 00 and Phase 01. During the rapid stripping of crocbot from a multi-platform application to a lean Telegram-only CLI gateway, several stub files were intentionally left in place for API compatibility. These stubs include the pairing infrastructure (`src/pairing/pairing-store.ts`, `src/infra/device-pairing.ts`) and potentially unused provider references (BlueBubbles).

With the codebase now stable, production-hardened, and equipped with structured logging and metrics monitoring, this is the appropriate time to resolve these remnants. Cleaning up technical debt before Session 04 (Error Reporting) and Session 05 (Runbooks) ensures that error reporting won't flag dead code warnings and that operational documentation reflects the actual codebase state.

The session involves careful analysis of stub usage, incremental removal with build verification at each step, and documentation updates to close out the Active Concerns in CONSIDERATIONS.md.

---

## 2. Objectives

1. Resolve pairing stub files by analyzing usage and removing or documenting with justification
2. Resolve BlueBubbles provider references by verifying usage and removing dead code
3. Achieve a clean build/lint/test cycle with no dead code warnings
4. Update CONSIDERATIONS.md to close resolved technical debt items

---

## 3. Prerequisites

### Required Sessions
- [x] `phase00-session01` through `phase00-session08` - Telegram-only stripping complete
- [x] `phase01-session01` through `phase01-session05` - Production hardening complete
- [x] `phase02-session01-structured-logging` - Logging infrastructure in place
- [x] `phase02-session02-metrics-monitoring` - Metrics endpoint operational

### Required Tools/Knowledge
- TypeScript strict mode for identifying unused code
- Grep/find for reference tracing
- Understanding of the pairing subsystem's original purpose

### Environment Requirements
- Node 22+ runtime
- pnpm package manager
- Git for incremental commits

---

## 4. Scope

### In Scope (MVP)
- Analyze pairing-store.ts usage (7 files importing)
- Analyze device-pairing.ts usage (1 file importing)
- Analyze BlueBubbles references in config schemas (44 files, mostly docs/archive)
- Remove stub implementations where safely possible
- Replace stubs with minimal type-only exports if types are still needed
- Remove dead imports and unused type exports
- Update CONSIDERATIONS.md Active Concerns section

### Out of Scope (Deferred)
- Adding new features - *Reason: cleanup session only*
- Refactoring working Telegram code - *Reason: out of session scope*
- Performance optimizations - *Reason: addressed in separate sessions*
- Web provider removal assessment - *Reason: requires separate analysis of provider-web.ts usage*

---

## 5. Technical Approach

### Architecture
This is a cleanup session with no new architecture. The approach is surgical removal of dead code with careful verification at each step.

### Design Patterns
- **Incremental deletion**: Remove one category at a time, verify build after each
- **Reference tracing**: Grep for all imports before deletion to catch indirect dependencies
- **Bottom-up deletion**: Start with leaf files (no dependents), work up to widely-imported files
- **Type-only preservation**: Keep minimal type exports if types are imported but implementations unused

### Technology Stack
- TypeScript strict mode for dead code detection
- Vitest for regression testing
- oxlint for lint verification

---

## 6. Deliverables

### Files to Create
| File | Purpose | Est. Lines |
|------|---------|------------|
| None | Cleanup session - no new files | 0 |

### Files to Modify
| File | Changes | Est. Lines Changed |
|------|---------|-------------------|
| `src/pairing/pairing-store.ts` | Remove or minimize to type-only exports | ~-100 |
| `src/infra/device-pairing.ts` | Remove or minimize to type-only exports | ~-100 |
| `src/auto-reply/reply/commands-allowlist.ts` | Remove pairing imports if unused | ~-5 |
| `src/telegram/bot-message-context.ts` | Remove pairing imports if unused | ~-5 |
| `src/telegram/bot-native-commands.ts` | Remove pairing imports if unused | ~-10 |
| `src/commands/doctor-security.ts` | Remove pairing imports if unused | ~-5 |
| `src/security/audit.ts` | Remove pairing imports if unused | ~-5 |
| `src/security/fix.ts` | Remove pairing imports if unused | ~-5 |
| `src/telegram/bot-handlers.ts` | Remove pairing imports if unused | ~-5 |
| `src/gateway/server/ws-connection/message-handler.ts` | Remove device-pairing imports | ~-5 |
| `src/config/zod-schema.providers.ts` | Remove BlueBubbles if unused | ~-10 |
| `src/config/zod-schema.providers-core.ts` | Remove BlueBubbles if unused | ~-10 |
| `.spec_system/CONSIDERATIONS.md` | Update Active Concerns as resolved | ~+10 |

### Files to Potentially Delete
| File | Condition |
|------|-----------|
| `src/pairing/pairing-store.ts` | If all imports can be removed |
| `src/infra/device-pairing.ts` | If all imports can be removed |
| `skills/bluebubbles/` | If BlueBubbles skill is unused |

---

## 7. Success Criteria

### Functional Requirements
- [ ] All pairing stub file usages analyzed and resolved
- [ ] All BlueBubbles references in active code analyzed and resolved
- [ ] No runtime behavior changes (stubs already returned empty/disabled)

### Testing Requirements
- [ ] `pnpm build` succeeds with no dead code warnings
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes with no regressions
- [ ] Manual verification that Telegram bot still functions

### Quality Gates
- [ ] All files ASCII-encoded
- [ ] Unix LF line endings
- [ ] Code follows project conventions (CONVENTIONS.md)
- [ ] No new TypeScript errors introduced

---

## 8. Implementation Notes

### Key Considerations
- Pairing stub is imported by 7 files - each must be analyzed individually
- Some imports may be type-only (can be preserved with minimal type exports)
- BlueBubbles appears in 44 files but most are in .spec_system/archive (documentation)
- Config schemas may have BlueBubbles as a provider type - need Zod schema analysis

### Potential Challenges
- **Type dependency chains**: Some files may import types that cascade to other types
  - *Mitigation*: Use TypeScript --noUnusedLocals to identify truly unused imports
- **Config schema validation**: Removing provider types may break config validation for existing configs
  - *Mitigation*: Check if any live configs reference BlueBubbles before removal
- **Test fixtures**: Tests may reference pairing/BlueBubbles in fixtures
  - *Mitigation*: Update test fixtures as part of cleanup

### Relevant Considerations
- [P00] **Stub files for disabled features**: This session directly resolves this Active Concern by analyzing and removing TTS, pairing, and related stubs.
- [P00] **BlueBubbles provider status**: This session verifies BlueBubbles usage and removes if confirmed unused.
- [P00] **Removing types still in use**: Learned from Phase 00 - always verify actual usage before deleting type definitions.
- [P00] **Reference tracing before deletion**: Apply this lesson - grep all imports/references before deleting any code.

### ASCII Reminder
All output files must use ASCII-only characters (0-127).

---

## 9. Testing Strategy

### Unit Tests
- Run existing test suite to catch any regressions
- No new unit tests needed (cleanup session)

### Integration Tests
- Verify Telegram bot handlers still compile and type-check
- Verify config schema validation still works for Telegram configs

### Manual Testing
- Start gateway with `crocbot gateway run`
- Verify Telegram channel connects and responds
- Verify `/doctor` command still works (uses pairing imports currently)

### Edge Cases
- Config files that reference removed provider types (should fail gracefully or warn)
- Plugin SDK consumers that may import pairing types (check published types)

---

## 10. Dependencies

### External Libraries
- No new dependencies
- No dependency changes expected

### Other Sessions
- **Depends on**: `phase02-session01-structured-logging`, `phase02-session02-metrics-monitoring`
- **Depended by**: `phase02-session04-error-reporting-alerting`, `phase02-session05-operational-runbooks`

---

## Next Steps

Run `/tasks` to generate the implementation task checklist.
