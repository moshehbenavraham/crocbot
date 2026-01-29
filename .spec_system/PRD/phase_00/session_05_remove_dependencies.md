# Session 05: Remove Unused Dependencies

**Session ID**: `phase00-session05-remove-dependencies`
**Status**: Not Started
**Estimated Tasks**: ~12-18
**Estimated Duration**: 2-3 hours

---

## Objective

Remove all npm dependencies that were only used by removed native apps, extensions, and channels, reducing the final Docker image size and install time.

---

## Scope

### In Scope (MVP)
- Remove Discord dependencies (`@buape/carbon`, `discord-api-types`)
- Remove Slack dependencies (`@slack/bolt`, `@slack/web-api`)
- Remove WhatsApp dependencies (`@whiskeysockets/baileys`, `qrcode-terminal`)
- Remove Line dependencies (`@line/bot-sdk`)
- Remove Bonjour/mDNS dependencies (`@homebridge/ciao`)
- Remove TTS dependencies (`node-edge-tts`)
- Remove any other unused dependencies identified
- Update `pnpm-lock.yaml`
- Verify no runtime errors from missing dependencies
- Run `pnpm install` and verify clean install

### Out of Scope
- Code refactoring (Session 06)
- Telegram dependencies (keep all grammy-related)
- Core CLI dependencies
- Build tool dependencies (keep dev deps as needed)

---

## Prerequisites

- [ ] Session 01-04 completed (code using these deps is removed)
- [ ] `pnpm build` completes successfully
- [ ] Full test suite passes

---

## Deliverables

1. `package.json` cleaned of removed channel/app dependencies
2. `pnpm-lock.yaml` regenerated
3. No orphaned dependencies
4. Build verification passed
5. Runtime verification passed

---

## Success Criteria

- [ ] Discord deps removed: `@buape/carbon`, `discord-api-types`
- [ ] Slack deps removed: `@slack/bolt`, `@slack/web-api`
- [ ] WhatsApp deps removed: `@whiskeysockets/baileys`, `qrcode-terminal`
- [ ] Line deps removed: `@line/bot-sdk`
- [ ] Mobile deps removed: `@homebridge/ciao`, `node-edge-tts`
- [ ] `pnpm install` completes without errors
- [ ] `pnpm build` completes without errors
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] Telegram channel works at runtime
- [ ] `node_modules` size reduced
