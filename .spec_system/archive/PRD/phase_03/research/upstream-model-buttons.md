# Upstream Model Buttons Implementation Analysis

**Analysis Date**: 2026-02-05
**Source Files**: `.001_ORIGINAL/src/telegram/model-buttons.ts`, `.001_ORIGINAL/src/telegram/bot-handlers.ts`
**Session**: phase03-session01-research-upstream-features

---

## 1. Overview

The upstream OpenClaw project implements an inline keyboard-based model selection system for Telegram. Users can browse available AI providers, paginate through model lists, and select models via button taps without typing commands.

**Key Features**:
- Provider selection keyboard (2 providers per row)
- Paginated model lists (8 models per page)
- Current model indicator (checkmark)
- Back navigation between views
- Callback data encoding within Telegram's 64-byte limit

---

## 2. Callback Data Format

Telegram callback data is limited to 64 bytes. The upstream implementation uses a compact prefix-based encoding scheme.

### 2.1 Callback Patterns

| Pattern | Purpose | Example |
|---------|---------|---------|
| `mdl_prov` | Show providers list | `mdl_prov` |
| `mdl_list_{provider}_{page}` | Show models for provider (1-indexed page) | `mdl_list_anthropic_1` |
| `mdl_sel_{provider/model}` | Select a specific model | `mdl_sel_anthropic/claude-3-opus` |
| `mdl_back` | Return to providers list | `mdl_back` |

### 2.2 Parsing Logic

The `parseModelCallbackData` function (model-buttons.ts:40-77) returns a typed result:

```typescript
export type ParsedModelCallback =
  | { type: "providers" }
  | { type: "list"; provider: string; page: number }
  | { type: "select"; provider: string; model: string }
  | { type: "back" };
```

**Parsing Rules**:
1. Must start with `mdl_` prefix
2. `mdl_prov` and `mdl_back` are direct matches
3. `mdl_list_` uses regex: `/^mdl_list_([a-z0-9_-]+)_(\d+)$/i`
4. `mdl_sel_` extracts provider/model by finding first `/` separator
5. Returns `null` for unrecognized patterns (allows other callback handlers to process)

### 2.3 Byte Limit Handling

Models with long IDs that would exceed 64 bytes when encoded as `mdl_sel_{provider/model}` are silently skipped (model-buttons.ts:137-140):

```typescript
if (Buffer.byteLength(callbackData, "utf8") > MAX_CALLBACK_DATA_BYTES) {
  continue;
}
```

---

## 3. Pagination Logic

### 3.1 Constants

```typescript
const MODELS_PAGE_SIZE = 8;
const MAX_CALLBACK_DATA_BYTES = 64;
```

### 3.2 Page Calculation

```typescript
export function calculateTotalPages(totalModels: number, pageSize?: number): number {
  const size = pageSize ?? MODELS_PAGE_SIZE;
  return size > 0 ? Math.ceil(totalModels / size) : 1;
}
```

### 3.3 Keyboard Construction

The `buildModelsKeyboard` function (model-buttons.ts:115-184) constructs:

1. **Model Buttons** (one per row):
   - Display text truncated to 38 chars with ellipsis prefix if too long
   - Current model gets checkmark suffix
   - Callback data: `mdl_sel_{provider}/{model}`

2. **Pagination Row** (if totalPages > 1):
   - "Prev" button (if currentPage > 1): `mdl_list_{provider}_{page-1}`
   - Page indicator: `{current}/{total}` (callback is noop, same page)
   - "Next" button (if currentPage < totalPages): `mdl_list_{provider}_{page+1}`

3. **Back Button** (always present):
   - Text: `<< Back`
   - Callback: `mdl_back`

### 3.4 Model ID Truncation

Long model IDs are truncated for display only (callback data uses full ID):

```typescript
function truncateModelId(modelId: string, maxLen: number): string {
  if (modelId.length <= maxLen) {
    return modelId;
  }
  return `...${modelId.slice(-(maxLen - 1))}`;
}
```

---

## 4. Data Flow

### 4.1 Entry Points

The model button system can be triggered by:
1. `/model` command - shows current model with "Browse providers" button
2. `/models` command - shows provider list or model list with buttons
3. Callback query from any model button tap

### 4.2 Callback Query Flow (bot-handlers.ts:474-583)

```
User taps button
    |
    v
bot.on("callback_query")
    |
    v
parseModelCallbackData(data)
    |
    +-- type: "providers" or "back"
    |       |
    |       v
    |   buildProviderKeyboard(providers)
    |       |
    |       v
    |   editMessageText("Select a provider:", keyboard)
    |
    +-- type: "list"
    |       |
    |       v
    |   Lookup models for provider
    |       |
    |       v
    |   resolveTelegramSessionModel() -- get current model
    |       |
    |       v
    |   buildModelsKeyboard({provider, models, currentModel, page, totalPages})
    |       |
    |       v
    |   editMessageText("Models ({provider}) -- N available", keyboard)
    |
    +-- type: "select"
            |
            v
        Create synthetic message: "/model {provider}/{model}"
            |
            v
        processMessage() -- handles as if user typed command
```

### 4.3 Key Functions

| Function | File | Purpose |
|----------|------|---------|
| `parseModelCallbackData` | model-buttons.ts:40 | Parse callback data string |
| `buildProviderKeyboard` | model-buttons.ts:82 | Build provider selection keyboard |
| `buildModelsKeyboard` | model-buttons.ts:115 | Build model list keyboard |
| `buildBrowseProvidersButton` | model-buttons.ts:189 | Single "Browse providers" button |
| `buildModelsProviderData` | commands-models.ts:34 | Fetch provider/model data from config |
| `resolveTelegramSessionModel` | bot-handlers.ts:135 | Get current model for session |

### 4.4 Session Model Resolution

The `resolveTelegramSessionModel` function resolves the current model by:
1. Building peer ID from chat context
2. Resolving agent route for the peer
3. Loading session store
4. Checking for stored model override
5. Falling back to session entry's model/provider
6. Final fallback to config defaults

This allows the current model checkmark to work correctly across different sessions.

---

## 5. Type Definitions

### 5.1 Exported Types (model-buttons.ts)

```typescript
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

### 5.2 Provider Data (commands-models.ts)

```typescript
export type ModelsProviderData = {
  byProvider: Map<string, Set<string>>;
  providers: string[];
  resolvedDefault: { provider: string; model: string };
};
```

---

## 6. Imports and Dependencies

### 6.1 model-buttons.ts

No external dependencies - pure utility functions.

### 6.2 bot-handlers.ts (model-related imports)

```typescript
import { buildModelsProviderData } from "../auto-reply/reply/commands-models.js";
import { resolveStoredModelOverride } from "../auto-reply/reply/model-selection.js";
import {
  buildModelsKeyboard,
  buildProviderKeyboard,
  calculateTotalPages,
  getModelsPageSize,
  parseModelCallbackData,
  type ProviderInfo,
} from "./model-buttons.js";
```

---

## 7. Edge Cases and Error Handling

### 7.1 Empty Provider List

When no providers are available:
```typescript
if (providers.length === 0) {
  await editMessageWithButtons("No providers available.", []);
  return;
}
```

### 7.2 Unknown Provider

When user navigates to invalid provider (URL tampering, stale button):
```typescript
if (!modelSet || modelSet.size === 0) {
  // Show providers list with error message
  await editMessageWithButtons(
    `Unknown provider: ${provider}\n\nSelect a provider:`,
    buttons,
  );
  return;
}
```

### 7.3 Page Out of Bounds

Page is clamped to valid range:
```typescript
const safePage = Math.max(1, Math.min(page, totalPages));
```

### 7.4 Edit Message Errors

Telegram throws error if message content unchanged (user re-taps same button):
```typescript
} catch (editErr) {
  const errStr = String(editErr);
  if (!errStr.includes("message is not modified")) {
    throw editErr;
  }
}
```

### 7.5 Concurrent Button Presses

The callback query is answered immediately (`answerCallbackQuery`) before processing to prevent Telegram retries. Processing continues asynchronously.

---

## 8. Unicode Characters Used

- Checkmark: `\u2713` (current model indicator)
- Left arrow: `\u25C0` (Prev button)
- Right arrow: `\u25B6` (Next button)
- Ellipsis: `\u2026` (truncated model names)

---

## 9. Test Coverage

The upstream includes comprehensive tests in `model-buttons.test.ts`:
- Parsing all callback patterns
- Pagination boundary conditions
- Model ID truncation
- Provider keyboard layout
- Byte limit enforcement

---

## 10. Integration Notes for crocbot

### 10.1 Missing in crocbot

- `src/telegram/model-buttons.ts` - entire file missing
- Model callback handler in `bot-handlers.ts` (lines 474-583 in upstream)
- `resolveTelegramSessionModel` helper function
- Imports for model button utilities

### 10.2 Existing in crocbot

- `commands_page_` callback handler (pagination for commands list)
- Same grammy version (^1.39.3)
- Same bot-handlers structure
- Same buildInlineKeyboard function

### 10.3 Integration Strategy

1. Copy `model-buttons.ts` (new file)
2. Add model callback handler to `bot-handlers.ts` after commands_page handler
3. Add `resolveTelegramSessionModel` helper
4. Import model button utilities
5. Verify `commands-models.ts` compatibility
