# crocbot Integration Map

**Analysis Date**: 2026-02-05
**Session**: phase03-session01-research-upstream-features

---

## 1. File Mapping

### 1.1 Model Button Files

| Upstream File | crocbot Status | Notes |
|---------------|----------------|-------|
| `src/telegram/model-buttons.ts` | **MISSING** | New file required |
| `src/telegram/model-buttons.test.ts` | **MISSING** | New test file required |

### 1.2 Handler Files

| Upstream File | crocbot Equivalent | Delta |
|---------------|-------------------|-------|
| `src/telegram/bot-handlers.ts` | `src/telegram/bot-handlers.ts` | Missing model callback handler (lines 474-583) |

### 1.3 Command Files

| Upstream File | crocbot Equivalent | Delta |
|---------------|-------------------|-------|
| `src/auto-reply/reply/commands-models.ts` | `src/auto-reply/reply/commands-models.ts` | Missing `buildModelsProviderData` export, `surface` param, Telegram button rendering |

### 1.4 Model Selection Files

| Upstream File | crocbot Equivalent | Status |
|---------------|-------------------|--------|
| `src/auto-reply/reply/model-selection.ts` | `src/auto-reply/reply/model-selection.ts` | EXISTS - verify `resolveStoredModelOverride` |
| `src/agents/model-selection.ts` | `src/agents/model-selection.ts` | EXISTS |
| `src/agents/model-catalog.ts` | `src/agents/model-catalog.ts` | EXISTS |
| `src/agents/defaults.ts` | `src/agents/defaults.ts` | EXISTS |

---

## 2. Function Mapping

### 2.1 Functions to Add (New)

| Function | Target File | Purpose |
|----------|-------------|---------|
| `parseModelCallbackData` | `model-buttons.ts` | Parse `mdl_*` callback strings |
| `buildProviderKeyboard` | `model-buttons.ts` | Build provider selection keyboard |
| `buildModelsKeyboard` | `model-buttons.ts` | Build paginated model list keyboard |
| `buildBrowseProvidersButton` | `model-buttons.ts` | Single "Browse providers" button |
| `calculateTotalPages` | `model-buttons.ts` | Calculate pagination |
| `getModelsPageSize` | `model-buttons.ts` | Return page size constant |
| `resolveTelegramSessionModel` | `bot-handlers.ts` | Get current model for session |

### 2.2 Functions to Modify

| Function | File | Changes Required |
|----------|------|------------------|
| `resolveModelsCommandReply` | `commands-models.ts` | Add `surface` param, add Telegram button rendering branch |
| `handleModelsCommand` | `commands-models.ts` | Pass `surface` from context |

### 2.3 Functions to Export (Extract from inline)

| Function | Current Location | Target |
|----------|-----------------|--------|
| `buildModelsProviderData` | Inline in upstream `commands-models.ts` | Export from `commands-models.ts` |

---

## 3. Type Definitions

### 3.1 New Types Required

```typescript
// model-buttons.ts
export type ButtonRow = Array<{ text: string; callback_data: string }>;

export type ParsedModelCallback =
  | { type: "providers" }
  | { type: "list"; provider: string; page: number }
  | { type: "select"; provider: string; model: string }
  | { type: "back" };

export type ProviderInfo = {
  id: string;
  count: number;
};

export type ModelsKeyboardParams = {
  provider: string;
  models: string[];
  currentModel?: string;
  currentPage: number;
  totalPages: number;
  pageSize?: number;
};
```

```typescript
// commands-models.ts
export type ModelsProviderData = {
  byProvider: Map<string, Set<string>>;
  providers: string[];
  resolvedDefault: { provider: string; model: string };
};
```

### 3.2 Existing Types (Verify Compatibility)

| Type | Location | Status |
|------|----------|--------|
| `ReplyPayload` | `src/auto-reply/types.ts` | Verify `channelData.telegram.buttons` support |
| `TelegramMessage` | `src/telegram/bot/types.ts` | Compatible |

---

## 4. Import Additions

### 4.1 bot-handlers.ts

Add these imports:
```typescript
import { buildModelsProviderData } from "../auto-reply/reply/commands-models.js";
import { resolveStoredModelOverride } from "../auto-reply/reply/model-selection.js";
import { loadSessionStore, resolveStorePath } from "../config/sessions.js";
import { resolveAgentRoute } from "../routing/resolve-route.js";
import { resolveThreadSessionKeys } from "../routing/session-key.js";
import { buildTelegramGroupPeerId } from "./bot/helpers.js";
import {
  buildModelsKeyboard,
  buildProviderKeyboard,
  calculateTotalPages,
  getModelsPageSize,
  parseModelCallbackData,
  type ProviderInfo,
} from "./model-buttons.js";
```

### 4.2 commands-models.ts

Add these imports:
```typescript
import {
  buildModelsKeyboard,
  buildProviderKeyboard,
  calculateTotalPages,
  getModelsPageSize,
  type ProviderInfo,
} from "../../telegram/model-buttons.js";
```

---

## 5. Configuration Compatibility

### 5.1 grammy Version

| Component | Version | Match |
|-----------|---------|-------|
| Upstream grammy | ^1.39.3 | YES |
| crocbot grammy | ^1.39.3 | YES |
| @grammyjs/runner | ^2.0.3 | YES |
| @grammyjs/transformer-throttler | ^1.2.1 | YES |

### 5.2 Config Types

The upstream uses `OpenClawConfig` while crocbot uses `crocbotConfig`. These are type aliases and the underlying structure is compatible.

---

## 6. Routing/Session Dependencies

### 6.1 Required Functions (Verify Existence)

| Function | Module | Purpose |
|----------|--------|---------|
| `resolveAgentRoute` | `src/routing/resolve-route.js` | Get agent route for peer |
| `resolveThreadSessionKeys` | `src/routing/session-key.js` | Thread session key resolution |
| `loadSessionStore` | `src/config/sessions.js` | Load session store |
| `resolveStorePath` | `src/config/sessions.js` | Resolve store path |
| `resolveStoredModelOverride` | `src/auto-reply/reply/model-selection.js` | Get stored model override |
| `buildTelegramGroupPeerId` | `src/telegram/bot/helpers.js` | Build group peer ID |

### 6.2 Verification Commands

```bash
# Check routing module
grep -l "resolveAgentRoute" src/routing/*.ts

# Check session modules
grep -l "loadSessionStore\|resolveStorePath" src/config/*.ts

# Check model-selection module
grep -l "resolveStoredModelOverride" src/auto-reply/reply/*.ts

# Check helpers
grep -l "buildTelegramGroupPeerId" src/telegram/bot/*.ts
```

---

## 7. ReplyPayload Enhancement

### 7.1 Current Structure (verify)

```typescript
// src/auto-reply/types.ts
export type ReplyPayload = {
  text: string;
  channelData?: {
    telegram?: {
      buttons?: ButtonRow[];
      // ... other telegram-specific fields
    };
  };
};
```

### 7.2 Required Structure

The `channelData.telegram.buttons` field must be supported to pass inline keyboard data from commands to the Telegram send layer.

---

## 8. Integration Order

### Phase 1: Add New Files
1. Create `src/telegram/model-buttons.ts` (copy from upstream)
2. Create `src/telegram/model-buttons.test.ts` (copy from upstream)

### Phase 2: Modify commands-models.ts
1. Extract `buildModelsProviderData` as exported function
2. Add `surface` and `currentModel` parameters to `resolveModelsCommandReply`
3. Add Telegram button rendering branch
4. Update `handleModelsCommand` to pass context

### Phase 3: Modify bot-handlers.ts
1. Add model button imports
2. Add `resolveTelegramSessionModel` helper
3. Add model callback handler after commands_page handler

### Phase 4: Verify Reply Pipeline
1. Ensure `ReplyPayload.channelData.telegram.buttons` flows through
2. Verify `buildInlineKeyboard` accepts ButtonRow[]

---

## 9. Difference Summary

### 9.1 crocbot commands-models.ts vs Upstream

| Feature | crocbot | Upstream |
|---------|---------|----------|
| `buildModelsProviderData` export | NO | YES |
| `surface` parameter | NO | YES |
| `currentModel` parameter | NO | YES |
| Telegram button rendering | NO | YES |
| Text-only fallback | YES | YES |

### 9.2 crocbot bot-handlers.ts vs Upstream

| Feature | crocbot | Upstream |
|---------|---------|----------|
| `commands_page_*` callback | YES | YES |
| `mdl_*` callback | NO | YES |
| `resolveTelegramSessionModel` | NO | YES |
| Model button imports | NO | YES |

---

## 10. Testing Considerations

### 10.1 Unit Tests Required
- `model-buttons.test.ts` - copy from upstream
- `commands-models.test.ts` - add Telegram button tests

### 10.2 Integration Tests
- Button tap -> model change flow
- Pagination navigation
- Back button navigation
- Session model resolution

### 10.3 Manual Testing
- Test in DM context
- Test in group context
- Test with forum topics
- Test with different providers
- Test pagination boundaries
