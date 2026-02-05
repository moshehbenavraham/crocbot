# Blockers and Mitigations

**Analysis Date**: 2026-02-05
**Session**: phase03-session01-research-upstream-features

---

## 1. Summary

After thorough analysis of the upstream model button implementation and crocbot's current state, **no blocking conflicts** were identified. The integration is straightforward with all required dependencies available.

---

## 2. Identified Issues

### 2.1 Minor: Missing `buildModelsProviderData` Export

**Issue**: crocbot's `commands-models.ts` has the model/provider building logic inline but does not export a reusable `buildModelsProviderData` function that the callback handler needs.

**Severity**: Low (code refactoring)

**Mitigation**: Extract the provider data building logic into an exported function. The code already exists; it just needs to be refactored for reuse.

**Implementation Steps**:
1. Create `ModelsProviderData` type export
2. Extract provider building logic into `buildModelsProviderData` function
3. Refactor `resolveModelsCommandReply` to use the new function
4. Add exports for use by bot-handlers callback

---

### 2.2 Minor: Missing `surface` Parameter

**Issue**: crocbot's `resolveModelsCommandReply` function doesn't accept a `surface` parameter to differentiate Telegram button rendering from text-only responses.

**Severity**: Low (parameter addition)

**Mitigation**: Add optional `surface` and `currentModel` parameters to the function signature and add conditional Telegram button rendering.

**Implementation Steps**:
1. Add `surface?: string` parameter
2. Add `currentModel?: string` parameter
3. Add Telegram-specific button rendering branch when `surface === "telegram"`
4. Update `handleModelsCommand` to pass context surface

---

### 2.3 Low: Type Config Name Difference

**Issue**: Upstream uses `OpenClawConfig` while crocbot uses `crocbotConfig` as the config type name.

**Severity**: Very Low (type alias)

**Mitigation**: No action required. These are type aliases and the underlying structure is identical. Imports will use crocbot's type name.

---

### 2.4 Low: Import Path Differences

**Issue**: Some import paths in upstream reference modules that may have been reorganized in crocbot during the strip-down.

**Severity**: Low (path adjustment)

**Mitigation**: Verify import paths during implementation. The functions exist; paths may differ slightly.

**Verification Commands**:
```bash
# Session store
grep -r "loadSessionStore" src/ --include="*.ts"

# Route resolution
grep -r "resolveAgentRoute" src/ --include="*.ts"

# Thread session keys
grep -r "resolveThreadSessionKeys" src/ --include="*.ts"
```

---

## 3. Pre-verified Compatibility

The following critical dependencies were verified to exist and be compatible:

| Dependency | Status | Location |
|------------|--------|----------|
| grammy ^1.39.3 | MATCH | package.json |
| `resolveStoredModelOverride` | EXISTS | `src/auto-reply/reply/model-selection.ts` |
| `resolveAgentRoute` | EXISTS | `src/routing/resolve-route.ts` |
| `loadSessionStore` | EXISTS | `src/config/sessions.ts` |
| `resolveStorePath` | EXISTS | `src/config/sessions.ts` |
| `buildTelegramGroupPeerId` | EXISTS | `src/telegram/bot/helpers.ts` |
| `resolveTelegramForumThreadId` | EXISTS | `src/telegram/bot/helpers.ts` |
| `channelData.telegram.buttons` | SUPPORTED | `src/telegram/bot/delivery.ts:86-89` |
| `buildInlineKeyboard` | EXISTS | `src/telegram/send.ts` |

---

## 4. Integration Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| grammy API incompatibility | Very Low | High | Versions match exactly |
| Button rendering broken | Very Low | Medium | Delivery layer already supports buttons |
| Session model resolution fails | Low | Medium | All helper functions exist |
| Import path errors | Low | Low | Easy to fix during implementation |

**Overall Risk**: LOW

---

## 5. Testing Strategy

### 5.1 Pre-Implementation Verification

Before starting implementation, run these commands to verify the environment:

```bash
# Verify grammy versions match
cat package.json | grep grammy

# Verify button support in delivery layer
grep -A5 "channelData?.telegram" src/telegram/bot/delivery.ts

# Verify session store functions exist
grep -l "loadSessionStore" src/config/*.ts
```

### 5.2 Post-Implementation Verification

After implementing model buttons:

1. **Unit Tests**: Run `pnpm test` to verify all existing tests pass
2. **Type Check**: Run `pnpm build` to verify no type errors
3. **Manual Tests**:
   - `/model` command shows "Browse providers" button
   - `/models` command shows provider buttons
   - Tapping provider shows model list
   - Pagination works (Prev/Next)
   - Back button returns to providers
   - Model selection works
   - Current model shows checkmark

---

## 6. Rollback Plan

If model buttons cause issues:

1. Revert `model-buttons.ts` (new file - just delete)
2. Revert changes to `bot-handlers.ts` (remove model callback handler)
3. Revert changes to `commands-models.ts` (restore original)

The feature is self-contained and can be cleanly removed if needed.

---

## 7. Conclusion

The model button implementation is a clean port with no architectural blockers. All required dependencies exist in crocbot, and the grammy versions are identical. The main work is:

1. Copy `model-buttons.ts` (new file)
2. Refactor `commands-models.ts` (export function, add parameters)
3. Add callback handler to `bot-handlers.ts`
4. Add helper function for session model resolution

Estimated complexity: **Low-Medium**
Estimated risk: **Low**
