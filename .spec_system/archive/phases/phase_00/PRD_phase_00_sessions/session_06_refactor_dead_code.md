# Session 06: Refactor Dead Channel Code

**Session ID**: `phase00-session06-refactor-dead-code`
**Status**: Not Started
**Estimated Tasks**: ~18-25
**Estimated Duration**: 3-4 hours

---

## Objective

Clean up remaining references to removed channels throughout the codebase, simplifying shared utilities, routing logic, and type definitions to reflect Telegram-only architecture.

---

## Scope

### In Scope (MVP)
- Remove channel type unions that reference deleted channels
- Simplify `src/channels/` routing code for single channel
- Clean up `src/routing/` for Telegram-only routing
- Remove channel-specific utility functions
- Update shared types and interfaces
- Remove dead code paths in message handling
- Clean up configuration schemas for removed channels
- Fix any TypeScript errors from stale references
- Remove channel-specific test utilities

### Out of Scope
- Telegram code changes (preserve functionality)
- Adding new features
- Performance optimizations
- Mobile-specific code (Session 07)

---

## Prerequisites

- [ ] Session 01-05 completed
- [ ] `pnpm build` completes (may have type errors to fix)
- [ ] Understanding of channel abstraction architecture

---

## Deliverables

1. Clean channel type definitions (Telegram only)
2. Simplified routing code
3. No dead code paths for removed channels
4. Clean TypeScript compilation
5. All tests pass

---

## Success Criteria

- [ ] No TypeScript errors
- [ ] No references to removed channel names in active code
- [ ] `pnpm install` completes without errors
- [ ] `pnpm build` completes without errors
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] Channel routing simplified to Telegram-only
- [ ] Configuration loading works with minimal config
- [ ] Code review shows no dead channel references
