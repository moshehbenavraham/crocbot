# Session 07: Remove Mobile-Specific Code

**Session ID**: `phase00-session07-remove-mobile-code`
**Status**: Not Started
**Estimated Tasks**: ~12-18
**Estimated Duration**: 2-3 hours

---

## Objective

Remove all mobile-specific functionality including device pairing, Bonjour/mDNS discovery, and text-to-speech (TTS) code that is not needed for VPS deployment.

---

## Scope

### In Scope (MVP)
- Remove `src/pairing/` directory (device pairing)
- Remove `src/tts/` directory (text-to-speech)
- Remove Bonjour/mDNS discovery code
- Remove device pairing CLI commands
- Remove TTS-related CLI commands
- Clean up any mobile-specific configuration options
- Remove mobile-specific API endpoints if any
- Update gateway code to not require pairing

### Out of Scope
- Channel code (already handled)
- Native app code (already handled)
- Dependency cleanup (already handled in Session 05)
- Documentation (Session 08)

---

## Prerequisites

- [ ] Session 01-06 completed
- [ ] `pnpm build` completes successfully
- [ ] Understanding of pairing/discovery architecture

---

## Deliverables

1. `src/pairing/` directory removed
2. `src/tts/` directory removed
3. Bonjour/mDNS code removed
4. CLI commands updated
5. Gateway runs without pairing requirements
6. Build verification passed

---

## Success Criteria

- [ ] `src/pairing/` directory no longer exists
- [ ] `src/tts/` directory no longer exists
- [ ] No Bonjour/mDNS code references
- [ ] `pnpm install` completes without errors
- [ ] `pnpm build` completes without errors
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] Gateway starts without pairing configuration
- [ ] No TTS-related CLI commands
- [ ] Configuration simplified for VPS deployment
