# Session 05: Remove Unused Dependencies

**Session ID**: `phase00-session05-remove-dependencies`
**Status**: Complete
**Actual Tasks**: 18
**Completed**: 2026-01-30

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

- [x] Discord deps removed: `@buape/carbon`, `discord-api-types`
- [x] Slack deps removed: `@slack/bolt`, `@slack/web-api`
- [x] WhatsApp deps removed: `@whiskeysockets/baileys`, `qrcode-terminal`
- [x] Line deps removed: `@line/bot-sdk`
- [N/A] Mobile deps: `@homebridge/ciao`, `node-edge-tts` - Retained (active code in 9 and 12 files respectively)
- [x] `pnpm install` completes without errors
- [x] `pnpm build` completes without errors
- [x] `pnpm lint` passes
- [x] `pnpm test` passes
- [x] CLI functions correctly
- [x] `node_modules` size reduced: 71.8 MB (5.3%)
