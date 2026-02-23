# Slack Read-Only Channel Re-Implementation

> **Status**: In Progress — Phases 1-5 complete, manual testing next (Sessions 1-5: 2026-02-07)
> **Goal**: Re-introduce Slack as a channel where the agent **reads** messages from Slack channels/DMs but **never posts** anything back.

---

## 1. Concept

Slack becomes a **read-only ingest channel**: the bot connects to Slack via Socket Mode, receives events (messages, reactions, etc.), and feeds them into the agent's context/memory pipeline. The agent can use Slack content to inform responses on other channels (Telegram, CLI) but **never writes back to Slack** -- no `chat.postMessage`, no reactions, no edits, no deletes, no pins, no file uploads.

This is useful for passively monitoring team channels, ingesting context, and being aware of conversations happening in Slack without any risk of the bot speaking there.

---

## 2. Current State

### What exists in crocbot today

| Component | Status |
|---|---|
| `extensions/slack/` | **Exists** but broken -- imports Slack helpers from `crocbot/plugin-sdk` that were removed |
| `extensions/slack/src/channel.ts` | Full upstream channel plugin (602 lines) with read+write paths |
| `extensions/slack/src/runtime.ts` | Thin runtime accessor (imports from `openclaw/plugin-sdk` -- wrong package name) |
| `extensions/slack/index.ts` | Plugin registration entry point |
| `src/slack/` | **Deleted entirely** during strip-down (session `phase00-session03`) |
| `src/config/types.slack.ts` | **Deleted** -- config types gone |
| `src/channels/plugins/normalize/slack.ts` | **Deleted** |
| `src/channels/plugins/onboarding/slack.ts` | **Deleted** |
| `src/channels/plugins/outbound/slack.ts` | **Deleted** |
| `src/agents/tools/slack-actions.ts` | **Deleted** |
| `@slack/bolt`, `@slack/web-api` | **Not in package.json** (removed with deps) |
| Plugin-SDK Slack exports | **Removed** from `src/plugin-sdk/index.ts` |
| PluginRuntime `channel.slack` | **Removed** from `src/plugins/runtime/types.ts` |
| Channel registry | **`["telegram"]` only** -- no `"slack"` |
| Config schema labels | **Still has** `channels.slack.*` entries in `src/config/schema.ts` (leftover) |
| Zod schema | **Still has** `slack: QueueModeSchema.optional()` in `src/config/zod-schema.core.ts` (leftover) |

### What exists in upstream (.001_ORIGINAL)

Full Slack implementation across ~60 files:
- `src/slack/` -- core: accounts, actions, client, format, monitor, send, threading, etc.
- `src/channels/plugins/{normalize,onboarding,outbound}/slack.ts` -- channel plugin adapters
- `src/agents/tools/slack-actions.ts` -- agent tool definitions
- `src/config/types.slack.ts` -- config types
- `extensions/slack/` -- extension entry point + channel plugin

---

## 3. Architecture Decision: Read-Only Strategy

Two approaches to "read-only":

### Option A: Bring back full Slack stack, gate writes at the outbound layer
- Copy upstream `src/slack/` wholesale
- In the extension's `outbound.sendText` / `outbound.sendMedia`, return a no-op result
- Disable write actions (send, react, edit, delete, pin) in the `actions.listActions` gate
- **Pro**: Minimal divergence from upstream, easy to "turn on" writes later
- **Con**: Ships dead code (send.ts, format.ts write helpers), larger dep surface

### Option B: Bring back only read-path Slack files, stub the rest **(Recommended)**
- Copy only the files needed for: connection, event receiving, message ingest, account resolution, config types
- Stub out `sendMessageSlack` and `handleSlackAction` as no-ops
- Omit `src/slack/send.ts` write logic, `src/slack/format.ts` (only needed for outbound mrkdwn)
- Simplify `extensions/slack/src/channel.ts` to remove all outbound/action handlers
- **Pro**: Clean, minimal, clear intent
- **Con**: More divergence from upstream; if we want writes later, need to bring more back

**Recommendation: Option B** -- We want this to be clean and intentional. The extension should clearly declare it is read-only.

---

## 4. Files To Bring Back From Upstream

### 4.1 Core Slack Module (`src/slack/`)

These files are needed for **connecting to Slack and receiving events**:

| File | Purpose | Needed? |
|---|---|---|
| `accounts.ts` | Account resolution, token lookup, `ResolvedSlackAccount` | **YES** -- core dependency |
| `token.ts` | Token resolution (bot/app/user) | **YES** |
| `client.ts` | WebClient initialization | **YES** (monitor needs it) |
| `types.ts` | Slack type definitions | **YES** |
| `targets.ts` | Slack target parsing | **YES** (used in monitor) |
| `index.ts` | Re-exports `monitorSlackProvider` | **YES** |
| `probe.ts` | Health check (`auth.test`) | **YES** |
| `scopes.ts` | OAuth scope definitions | **Optional** (nice for docs/status) |
| `resolve-channels.ts` | Channel lookup | **YES** (for allowlist resolution) |
| `resolve-users.ts` | User lookup | **YES** (for allowlist resolution) |
| `threading.ts` | Thread timestamp resolution | **YES** (used in monitor) |
| `threading-tool-context.ts` | Thread context for tools | **YES** (referenced by extension) |
| `channel-migration.ts` | Config migration | **YES** (safe to include) |
| `directory-live.ts` | Live directory listing | **YES** (used by extension) |

**Monitor subsystem** (`src/slack/monitor/`):

| File | Purpose | Needed? |
|---|---|---|
| `provider.ts` | Main entry: creates Bolt app, registers events | **YES** -- the core |
| `types.ts` | Monitor types | **YES** |
| `context.ts` | Monitor context | **YES** |
| `events.ts` | Event registration hub | **YES** |
| `events/messages.ts` | Message event handlers | **YES** |
| `events/reactions.ts` | Reaction event handlers | **YES** (for awareness) |
| `events/channels.ts` | Channel join/leave/rename events | **YES** |
| `events/members.ts` | Member join/leave events | **Optional** |
| `events/pins.ts` | Pin events | **Optional** |
| `message-handler.ts` | Debouncing, thread resolution | **YES** |
| `message-handler/prepare.ts` | Message preparation | **YES** |
| `message-handler/dispatch.ts` | Dispatch to agent pipeline | **YES** -- this is the read path |
| `message-handler/types.ts` | Handler types | **YES** |
| `policy.ts` | Channel access policy | **YES** |
| `allow-list.ts` | Allowlist management | **YES** |
| `auth.ts` | Auth helpers | **YES** |
| `thread-resolution.ts` | Thread ts resolution | **YES** |
| `channel-config.ts` | Per-channel config | **YES** |
| `slash.ts` | Slash command handling | **NO** (writes ephemeral responses) |
| `commands.ts` | Command handling | **NO** (triggers write responses) |
| `media.ts` | Media handling (download from Slack) | **YES** (for reading file attachments) |
| `replies.ts` | Reply dispatch | **Modify** -- this sends replies back, needs to be a no-op |

**HTTP subsystem** (`src/slack/http/`):

| File | Purpose | Needed? |
|---|---|---|
| `index.ts` | HTTP exports | **Only if HTTP mode desired** |
| `registry.ts` | HTTP webhook routing | **Only if HTTP mode desired** |

**Files to OMIT entirely:**

| File | Reason |
|---|---|
| `send.ts` | Outbound message sending -- the whole write path |
| `format.ts` | Markdown-to-mrkdwn conversion -- only for outbound formatting |
| `actions.ts` | Write operations (react, edit, delete, pin, etc.) |

### 4.2 Channel Plugin Helpers (`src/channels/plugins/`)

| File | Purpose | Bring back? |
|---|---|---|
| `normalize/slack.ts` | Target normalization | **YES** |
| `onboarding/slack.ts` | Setup wizard | **YES** (modified for read-only) |
| `outbound/slack.ts` | Outbound adapter | **NO** -- replace with no-op |

### 4.3 Config Types (`src/config/`)

| File | Purpose | Bring back? |
|---|---|---|
| `types.slack.ts` | `SlackConfig`, `SlackAccountConfig`, etc. | **YES** (full copy) |
| `zod-schema.providers-core.ts` | `SlackConfigSchema` zod schema | **YES** (add `SlackConfigSchema`) |

### 4.4 Agent Tools (`src/agents/tools/`)

| File | Purpose | Bring back? |
|---|---|---|
| `slack-actions.ts` | `handleSlackAction()` | **Stub only** -- return "read-only mode" for writes; keep `readMessages` |

---

## 5. Changes To Existing Files

### 5.1 Channel Registry (`src/channels/registry.ts`)

```diff
- export const CHAT_CHANNEL_ORDER = ["telegram"] as const;
+ export const CHAT_CHANNEL_ORDER = ["telegram", "slack"] as const;
```

Add `slack` to `CHAT_CHANNEL_META` with appropriate metadata.

### 5.2 Plugin SDK Exports (`src/plugin-sdk/index.ts`)

Add Slack exports (mirroring the upstream pattern for Telegram):

```typescript
// Channel: Slack
export {
  listEnabledSlackAccounts,
  listSlackAccountIds,
  resolveDefaultSlackAccountId,
  resolveSlackAccount,
  resolveSlackReplyToMode,
  type ResolvedSlackAccount,
} from "../slack/accounts.js";
export { slackOnboardingAdapter } from "../channels/plugins/onboarding/slack.js";
export {
  looksLikeSlackTargetId,
  normalizeSlackMessagingTarget,
} from "../channels/plugins/normalize/slack.js";
export { buildSlackThreadingToolContext } from "../slack/threading-tool-context.js";
export {
  listSlackDirectoryGroupsFromConfig,
  listSlackDirectoryPeersFromConfig,
} from "../channels/plugins/directory-config.js";   // may need slack-specific variant
export {
  resolveSlackGroupRequireMention,
  resolveSlackGroupToolPolicy,
} from "../channels/plugins/group-mentions.js";      // may need slack-specific variant
```

### 5.3 Plugin Runtime Types (`src/plugins/runtime/types.ts`)

Add `channel.slack` section to `PluginRuntime`:

```typescript
slack: {
  listDirectoryGroupsLive: ListSlackDirectoryGroupsLive;
  listDirectoryPeersLive: ListSlackDirectoryPeersLive;
  probeSlack: ProbeSlack;
  resolveChannelAllowlist: ResolveSlackChannelAllowlist;
  resolveUserAllowlist: ResolveSlackUserAllowlist;
  monitorSlackProvider: MonitorSlackProvider;
  // sendMessageSlack: OMITTED (read-only)
  // handleSlackAction: OMITTED or stubbed
};
```

### 5.4 Plugin Runtime Index (`src/plugins/runtime/index.ts`)

Wire up the Slack runtime functions (imports from `src/slack/*`).

### 5.5 Config Type Imports (`src/config/types.channels.ts`)

Add `SlackConfig` import and `slack?: SlackConfig` property.

### 5.6 Zod Schema (`src/config/zod-schema.providers-core.ts` or equivalent)

Add `SlackConfigSchema` and wire it into the channels schema.

### 5.7 Extension Fix (`extensions/slack/`)

- Fix `runtime.ts` import: `openclaw/plugin-sdk` -> `crocbot/plugin-sdk`
- Heavily simplify `channel.ts`:
  - Remove all `outbound` handlers (sendText, sendMedia) or make them return `{ ok: false, error: "read-only" }`
  - Remove all write actions from `actions.handleAction` (send, react, edit, delete, pin, unpin)
  - Keep: read, member-info, emoji-list, list-pins (read operations)
  - Remove pairing `notifyApproval` (it sends a message)
  - Add a clear `readOnly: true` flag or comment

### 5.8 Package Dependencies

Add to root `package.json`:
```json
"@slack/bolt": "^4.6.0",
"@slack/web-api": "^7.13.0"
```

---

## 6. Read-Only Safeguards

Multiple layers to prevent accidental writes:

1. **No `send.ts`**: The file that calls `chat.postMessage` is not brought back
2. **No `actions.ts` write functions**: `reactSlackMessage`, `editSlackMessage`, `deleteSlackMessage` are not brought back
3. **Extension outbound = no-op**: `outbound.sendText` / `outbound.sendMedia` return immediately without calling any Slack API
4. **Action gate**: `actions.listActions` returns only read actions (`["read", "reactions", "list-pins", "member-info", "emoji-list"]`) -- no `"send"`, `"react"`, `"edit"`, `"delete"`, `"pin"`, `"unpin"`
5. **PluginRuntime**: No `sendMessageSlack` or write `handleSlackAction` exposed
6. **Bot token scopes**: Can configure the Slack app with read-only scopes (no `chat:write`)
7. **Monitor replies stub**: The `replies.ts` dispatch that normally sends agent responses back to Slack threads is replaced with a logger/no-op

---

## 7. What the Agent Sees

When Slack is running in read-only mode:

- **Inbound messages appear in the agent context** with `channel: "slack"` metadata (sender, channel name, thread, timestamp)
- **The agent can reference Slack context** when responding on other channels ("I saw in #engineering that...")
- **The `read` action works**: agent can pull Slack message history via `conversations.history` / `conversations.replies` (this is an API read, not a write)
- **No send/react/edit/delete/pin tools** are available for Slack -- the agent literally cannot write to Slack
- **Status/health**: `crocbot channels status` shows Slack as connected and read-only

---

## 8. Implementation Order

### Phase 1: Core Slack Module
1. Copy `src/config/types.slack.ts` from upstream
2. Copy core `src/slack/` files (accounts, client, token, types, targets, threading, probe, resolve-*)
3. Copy monitor subsystem (`src/slack/monitor/`) -- modify `replies.ts` to no-op
4. Add `@slack/bolt` and `@slack/web-api` to dependencies
5. Build check

### Phase 2: Integration Layer
6. Add Slack to channel registry
7. Add Slack exports to plugin-sdk
8. Add `channel.slack` to PluginRuntime types and index
9. Add SlackConfig to config types and zod schema
10. Build check

### Phase 3: Extension Rewrite
11. Fix `extensions/slack/src/runtime.ts` import path
12. Rewrite `extensions/slack/src/channel.ts` for read-only:
    - Remove outbound send handlers
    - Remove write actions
    - Keep config, security, status, gateway (startAccount)
    - Add read-only guards
13. Build check

### Phase 4: Channel Plugin Helpers
14. Copy `src/channels/plugins/normalize/slack.ts` from upstream
15. Copy/adapt `src/channels/plugins/onboarding/slack.ts` (simplified for read-only)
16. Add Slack-specific `group-mentions.ts` and `directory-config.ts` helpers if needed
17. Build check + lint

### Phase 5: Testing & Verification
18. Verify no write paths exist (grep for `chat.postMessage`, `chat.update`, `chat.delete`, `reactions.add`, `files.uploadV2`, `pins.add`)
19. Run existing tests, add basic Slack read-only tests
20. Manual test: connect to a test Slack workspace, verify messages are received, verify no writes occur

---

## 9. Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Accidentally shipping a write path | High | Multi-layer guards (Section 6), grep audit, no `send.ts` |
| Build breakage from missing imports | Medium | Incremental phase approach with build checks |
| Upstream drift making future sync harder | Low | Document all divergences; keep file structure similar |
| Extension imports breaking due to missing helpers | Medium | Ensure all plugin-sdk exports are complete before touching extension |
| Slack Bolt version incompatibility | Low | Pin to same versions as upstream (`^4.6.0`, `^7.13.0`) |
| Config schema conflicts with leftover Slack entries | Low | Clean up existing leftovers in Phase 2 |

---

## 10. Files Changed Summary

**New files** (~25-30 files from upstream):
- `src/config/types.slack.ts`
- `src/slack/` (accounts, client, token, types, targets, threading, probe, resolve-*, monitor/*, index)
- `src/channels/plugins/normalize/slack.ts`
- `src/channels/plugins/onboarding/slack.ts`

**Modified files** (~8-10 files):
- `src/channels/registry.ts` -- add "slack"
- `src/plugin-sdk/index.ts` -- add Slack exports
- `src/plugins/runtime/types.ts` -- add `channel.slack`
- `src/plugins/runtime/index.ts` -- wire Slack runtime
- `src/config/types.channels.ts` -- add SlackConfig
- `src/config/zod-schema.providers-core.ts` or equivalent -- add SlackConfigSchema
- `extensions/slack/src/channel.ts` -- rewrite for read-only
- `extensions/slack/src/runtime.ts` -- fix import path
- `package.json` -- add `@slack/bolt`, `@slack/web-api`

**NOT brought back** (write-path files):
- `src/slack/send.ts`
- `src/slack/format.ts`
- `src/slack/actions.ts` (full version -- may create a read-only stub)
- `src/channels/plugins/outbound/slack.ts`
- `src/agents/tools/slack-actions.ts` (full version -- may create a read-only stub)

---

## 11. Session Log

### Session 1 (2026-02-07): Foundation Copy + Config Wiring

**Completed:**
- [x] Phase 1.1: Copied `src/config/types.slack.ts` from upstream, renamed `openclaw` → `crocbot` in comments
- [x] Phase 1.2: Copied 33 core `src/slack/` files from upstream (all read-path files)
- [x] Phase 1.3: Copied entire `src/slack/monitor/` subsystem (including events/, message-handler/)
- [x] Phase 1.4: Installed `@slack/bolt@^4.6.0` and `@slack/web-api@^7.13.0`
- [x] Created read-only `src/slack/index.ts` (exports only accounts, monitor, probe, token — NO actions/send)
- [x] Added `export * from "./types.slack.js"` to `src/config/types.ts`
- [x] Added `slack?: SlackConfig` to `ChannelsConfig` in `src/config/types.channels.ts`
- [x] Global rename: `OpenClawConfig` → `crocbotConfig` across all copied files
- [x] Build passes (rolldown bundle succeeds — copied files tree-shaken since no entry point imports them yet)

**Key discovery — the config type is `crocbotConfig` (lowercase 'c'):**
- Upstream: `import type { OpenClawConfig } from "../config/config.js"`
- Crocbot: `import type { crocbotConfig } from "../config/config.js"` (re-exports from types.ts → types.crocbot.ts)

**Remaining type errors (from `npx tsc --noEmit`):**

These are all in the copied monitor files and fall into clear categories:

#### Category A: Intentionally omitted write-path modules (need stubs or rewrites)

| File | Missing Import | Fix Needed |
|---|---|---|
| `src/slack/monitor.ts` | `./monitor/commands.js` | Remove import — we're omitting slash/commands |
| `src/slack/monitor/provider.ts` | `../http/index.js` | Remove HTTP receiver import (socket-only) |
| `src/slack/monitor/provider.ts` | `./commands.js` | Remove command registration |
| `src/slack/monitor/provider.ts` | `./slash.js` | Remove slash command handling |
| `src/slack/monitor/replies.ts` | `../format.js`, `../send.js` | **Rewrite as no-op** (this is the reply delivery — core of read-only) |
| `src/slack/monitor/message-handler/dispatch.ts` | `../../actions.js` | Remove `readSlackMessages` import — stub or inline read-only version |
| `src/slack/monitor/message-handler/prepare.ts` | `../../actions.js`, `../../send.js` | Remove write-path imports |

#### Category B: Missing project modules (may not exist in crocbot)

| File | Missing Import | Fix Needed |
|---|---|---|
| `src/slack/monitor/message-handler/prepare.ts` | `../../../pairing/pairing-messages.js` | Check if pairing module exists; if not, stub |
| `src/slack/monitor/message-handler/prepare.ts` | `../../../security/channel-metadata.js` | Check if security module exists; if not, stub |

#### Category C: Minor type issues

| File | Error | Fix |
|---|---|---|
| `prepare.ts:88` | `allowBots` on `{}` type | Fixed by adding `SlackConfig` to `ChannelsConfig` (done) — verify |
| `prepare.ts:146` | `.code` on pairing result | Depends on pairing module shape |
| `prepare.ts:370` | Implicit `any` on `err` | Add `: unknown` type annotation |

### Session 2 (2026-02-07): Resolve All Monitor Type Errors — Phase 1 Complete

**Completed:**
- [x] Priority 1.1: Rewrote `src/slack/monitor/replies.ts` as a read-only no-op
  - `deliverReplies()` → logs and returns (no Slack write)
  - `deliverSlackSlashReplies()` → logs and returns (no Slack write)
  - `resolveSlackThreadTs()` → kept (pure computation)
  - `createSlackReplyDeliveryPlan()` → kept (pure computation, used by dispatch flow)
  - Removed imports of `../format.js` and `../send.js`
- [x] Priority 1.2: Created stub `src/slack/http/index.ts` — no-op HTTP receiver (socket mode only)
- [x] Priority 1.3: Created stub `src/slack/monitor/commands.ts` — returns disabled slash command config
- [x] Priority 1.4: Created stub `src/slack/monitor/slash.ts` — no-op registration
- [x] Priority 1.5: Fixed `src/slack/monitor/message-handler/dispatch.ts`
  - Removed `removeSlackReaction` import (from `../../actions.js`)
  - Removed `removeAckReactionAfterReply` and `logAckFailure` imports
  - Removed ack reaction removal block (write path)
- [x] Priority 1.6: Fixed `src/slack/monitor/message-handler/prepare.ts`
  - Removed `reactSlackMessage` import (from `../../actions.js`)
  - Removed `sendMessageSlack` import (from `../../send.js`)
  - Removed `buildPairingReply` import (from `../../../pairing/pairing-messages.js`)
  - Removed `upsertChannelPairingRequest` import (from `../../../pairing/pairing-store.js`)
  - Replaced pairing block with log-and-drop (read-only: no pairing reply sent)
  - Replaced ack reaction block with `const ackReactionPromise = null;` (read-only: no reactions)
- [x] Priority 1.7: Copied `src/security/channel-metadata.ts` from upstream (read-path utility for context enrichment)
  - Added `"channel_metadata"` to `ExternalContentSource` union in `src/security/external-content.ts`
- [x] `npx tsc --noEmit | grep "src/slack"` → **zero errors**
- [x] `pnpm build` → **passes**
- [x] Write-path audit: grepped for `sendMessageSlack`, `reactSlackMessage`, `removeSlackReaction`, `chat.postMessage`, `chat.update`, `chat.delete`, `reactions.add`, `files.uploadV2`, `pins.add` in `src/slack/` → **zero matches**

**Design decisions made (diverging from work file):**

1. **Stub files instead of surgical removal in provider.ts**: Rather than heavily modifying provider.ts (removing HTTP mode, slash commands, etc.), I created minimal stub files for the 3 missing modules (`http/index.ts`, `commands.ts`, `slash.ts`). Rationale:
   - Provider.ts has ~380 lines; surgical removal would be ~15 edits with high breakage risk
   - Stubs preserve code structure and are less invasive
   - HTTP mode is already guarded by `slackMode === "http"` (defaults to "socket"), so HTTP code paths don't execute
   - Stubs clearly document intent with comments

2. **Pairing block simplified**: The work file suggested keeping `upsertChannelPairingRequest`. I removed it because:
   - Crocbot's pairing-store.ts has a different function signature than upstream (positional args vs. object)
   - Recording a pairing request without being able to reply with the code is useless
   - Simpler to just log and drop unauthorized DMs in pairing mode

3. **`channel-metadata.ts` copied from upstream**: This is a read-path utility (enriches agent context with channel topic/purpose). It was missing from crocbot's `src/security/` — needed to add `"channel_metadata"` to the `ExternalContentSource` type union.

**Phase 1 is now complete.** All copied `src/slack/` files compile cleanly. No write-path code exists.

---

### Next Session Priorities (Session 3)

**Priority 1: Phase 2 — Integration Layer**

1. Add `"slack"` to `CHAT_CHANNEL_ORDER` in `src/channels/registry.ts`
2. Add Slack to `CHAT_CHANNEL_META` with appropriate metadata (read-only flag)
3. Add Slack exports to `src/plugin-sdk/index.ts` (see Section 5.2 for list)
4. Add `channel.slack` section to `PluginRuntime` types (`src/plugins/runtime/types.ts`)
5. Wire Slack runtime functions in `src/plugins/runtime/index.ts`
6. Wire up Slack in zod schema (`src/config/zod-schema.providers-core.ts` or equivalent)
7. Clean up leftover Slack entries in `src/config/schema.ts` and `src/config/zod-schema.core.ts`
8. Build check

**Priority 2: Phase 3 — Extension Rewrite**

9. Fix `extensions/slack/src/runtime.ts` import path (`openclaw/plugin-sdk` → `crocbot/plugin-sdk`)
10. Rewrite `extensions/slack/src/channel.ts` for read-only:
    - Remove all outbound send handlers (sendText, sendMedia) or return `{ ok: false, error: "read-only" }`
    - Remove write actions (send, react, edit, delete, pin, unpin)
    - Keep: read, member-info, emoji-list, list-pins (read operations)
    - Remove `notifyApproval` (it sends a message)
    - Add clear `readOnly: true` flag
11. Build check + lint

**Priority 3: Phase 4 — Channel Plugin Helpers**

12. Copy `src/channels/plugins/normalize/slack.ts` from upstream
13. Copy/adapt `src/channels/plugins/onboarding/slack.ts` (simplified for read-only)
14. Build check + lint

### Important Notes for Next Session

- **monitor/events.ts is clean**: Verified it only imports from files that exist (events/*.ts, context.ts, message-handler.ts). No omitted-file imports.
- **`src/slack/monitor.ts` re-exports are all valid now**: commands.ts (stub), policy.ts, provider.ts, replies.ts (rewritten), types.ts — all exist and compile.
- **provider.ts still contains HTTP mode code**: It's guarded by `slackMode === "http"` (defaults to "socket"), so it won't execute. The http/index.ts stub ensures it compiles. If we want to clean this up later, it's a separate task.
- **No `src/slack/actions.ts` exists**: All write-action imports have been removed. If `readSlackMessages` is needed later (for agent to read message history via Slack API), create a minimal `src/slack/actions-readonly.ts` with ONLY read operations.
- **Pre-existing type errors**: 5 unrelated errors across `src/agents/context.ts`, `src/agents/model-catalog.ts`, `src/agents/pi-embedded-runner/compact.ts`, `src/agents/pi-embedded-runner/run/attempt.ts`, `src/commands/auth-choice.apply.oauth.ts`. These are not related to Slack work (9 total TS errors, all pre-existing).
- **Files changed this session**: `src/slack/monitor/replies.ts` (rewrite), `src/slack/monitor/message-handler/dispatch.ts` (edit), `src/slack/monitor/message-handler/prepare.ts` (edit), `src/security/external-content.ts` (type addition). **Files created**: `src/slack/http/index.ts`, `src/slack/monitor/commands.ts`, `src/slack/monitor/slash.ts`, `src/security/channel-metadata.ts`.

### Session 3 (2026-02-07): Phase 2 — Integration Layer Complete

**Completed:**
- [x] Phase 2.1: Added `SlackConfigSchema` to `src/config/zod-schema.providers-core.ts`
  - Full Zod schemas: `SlackDmSchema`, `SlackChannelSchema`, `SlackThreadSchema`, `SlackAccountSchema`, `SlackConfigSchema`
  - Copied from upstream with no modifications; reused existing `ToolPolicyBySenderSchema` (already defined in file)
  - `SlackConfigSchema.superRefine` validates HTTP mode requires `signingSecret`
- [x] Phase 2.2: Wired `SlackConfigSchema` into `ChannelsSchema` in `src/config/zod-schema.providers.ts`
  - Added `slack: SlackConfigSchema.optional()` alongside telegram/whatsapp
- [x] Phase 2.3: Added `"slack"` to `CHAT_CHANNEL_ORDER` in `src/channels/registry.ts`
  - Added Slack entry to `CHAT_CHANNEL_META` with read-only metadata: `selectionLabel: "Slack (Read-Only)"`, `detailLabel: "Slack Monitor"`, blurb describes read-only ingest
- [x] Phase 2.4: Added Slack channel dock entry in `src/channels/dock.ts`
  - Added `resolveSlackAccount` import from `../slack/accounts.js`
  - Capabilities: chatTypes (direct/group/channel/thread), nativeCommands=false, blockStreaming=false
  - No outbound (read-only channel)
  - Config: `resolveAllowFrom` reads from `dm?.allowFrom` (Slack has no top-level `allowFrom` like Telegram)
  - Threading: `resolveReplyToMode` always returns "off" (read-only — never replies)
- [x] Phase 2.5: Added Slack exports to `src/plugin-sdk/index.ts`
  - Exported `SlackConfigSchema` from zod schemas
  - Exported `listEnabledSlackAccounts`, `listSlackAccountIds`, `resolveDefaultSlackAccountId`, `resolveSlackAccount`, `resolveSlackReplyToMode`, `ResolvedSlackAccount` from accounts
  - Exported `buildSlackThreadingToolContext` from threading-tool-context
  - **Note**: `slackOnboardingAdapter` and `normalizeSlackMessagingTarget` NOT exported yet — those files don't exist (Phase 4)
- [x] Phase 2.6: Added `channel.slack` section to `PluginRuntime` types (`src/plugins/runtime/types.ts`)
  - Type aliases: `ProbeSlack`, `ResolveSlackBotToken`, `ResolveSlackAppToken`, `MonitorSlackProvider`
  - No `sendMessageSlack` or `messageActions` (read-only)
- [x] Phase 2.7: Wired Slack runtime functions in `src/plugins/runtime/index.ts`
  - Imported and wired: `probeSlack`, `resolveSlackBotToken`, `resolveSlackAppToken`, `monitorSlackProvider`
- [x] `npx tsc --noEmit | grep "src/slack\|src/channels/dock\|src/config/zod-schema\|src/plugins/runtime\|src/plugin-sdk\|src/channels/registry"` → **zero errors**
- [x] `pnpm build` → **passes**
- [x] Write-path audit: `sendMessageSlack`, `chat.postMessage`, `chat.update`, `chat.delete`, `reactions.add`, `files.uploadV2`, `pins.add` in `src/slack/` → **zero matches**

**Key design decisions:**

1. **`SlackAccountConfig` has no top-level `allowFrom`**: Unlike Telegram, Slack's allowlists are nested under `dm.allowFrom` and `channels[x].users`. The dock's `resolveAllowFrom` pulls from `dm?.allowFrom`. If this proves insufficient, we can add a top-level `allowFrom` to `SlackAccountConfig` later.

2. **Threading resolveReplyToMode returns "off"**: Since this is read-only, the reply-to-mode is always off. The `buildToolContext` still resolves thread IDs (useful for context/awareness), but no replies are sent.

3. **Plugin SDK exports are partial**: We exported only what exists. Onboarding adapter and normalize adapter are Phase 4 (files don't exist yet). The extension will need these wired before it can register properly.

4. **Schema leftover in `zod-schema.core.ts` is NOT a leftover**: The `slack: QueueModeSchema.optional()` in `QueueModeBySurfaceSchema` (line 313) is a valid per-surface queue mode entry, not channel config. It stays.

5. **Schema labels in `schema.ts` stay**: The existing `channels.slack.*` labels and help text are actually valid now and will be used by the config UI. No cleanup needed.

**Phase 2 is now complete.** All integration plumbing is wired. The Slack channel is registered, typed, and validated.

---

### Session 4 (2026-02-07): Phase 3 + Phase 4 — Extension Rewrite + Channel Plugin Helpers

**Completed:**
- [x] Phase 4.1: Created `src/channels/plugins/normalize/slack.ts` from upstream
  - `normalizeSlackMessagingTarget()` and `looksLikeSlackTargetId()` — depends on `parseSlackTarget` from `src/slack/targets.js`
- [x] Phase 4.2: Added Slack functions to `src/channels/plugins/group-mentions.ts`
  - `resolveSlackGroupRequireMention()` — resolves per-channel mention requirements
  - `resolveSlackGroupToolPolicy()` — resolves per-channel tool policy (with toolsBySender support)
  - Added `normalizeSlackSlug()` helper, `resolveSlackAccount` import, `resolveToolsBySender` import, `GroupToolPolicyBySenderConfig` type import
- [x] Phase 4.3: Added Slack functions to `src/channels/plugins/directory-config.ts`
  - `listSlackDirectoryPeersFromConfig()` — lists user peers from dm.allowFrom + dms + channel users
  - `listSlackDirectoryGroupsFromConfig()` — lists groups from channels config
  - Added `resolveSlackAccount` import, `normalizeSlackMessagingTarget` import
- [x] Phase 4.4: Added all new Slack exports to `src/plugin-sdk/index.ts`
  - Exported: `looksLikeSlackTargetId`, `normalizeSlackMessagingTarget`, `resolveSlackGroupRequireMention`, `resolveSlackGroupToolPolicy`, `listSlackDirectoryGroupsFromConfig`, `listSlackDirectoryPeersFromConfig`
- [x] Phase 3.1: Added live directory + allowlist resolve functions to PluginRuntime
  - `src/plugins/runtime/types.ts`: Added `ListSlackDirectoryPeersLive`, `ListSlackDirectoryGroupsLive`, `ResolveSlackChannelAllowlist`, `ResolveSlackUserAllowlist` type aliases
  - `src/plugins/runtime/index.ts`: Wired `listSlackDirectoryPeersLive`, `listSlackDirectoryGroupsLive`, `resolveSlackChannelAllowlist`, `resolveSlackUserAllowlist`
- [x] Phase 3.2: Fixed `extensions/slack/src/runtime.ts` — changed `openclaw/plugin-sdk` → `crocbot/plugin-sdk`
- [x] Phase 3.3: Fixed `extensions/slack/index.ts` — changed `OpenClawPluginApi` → `crocbotPluginApi`, updated name/description to reflect read-only
- [x] Phase 3.4: Rewrote `extensions/slack/src/channel.ts` for read-only (602 → ~250 lines)
  - **Removed**: `outbound` section (sendText, sendMedia), `pairing` section (notifyApproval sends messages), `streaming` section (no outbound), `getTokenForOperation()` helper (only used for writes), `extractToolSend` (no send action)
  - **Removed all write actions**: `actions.listActions` returns `[]` (empty — no agent tools for Slack)
  - **Removed all write action handlers**: `handleAction` throws read-only error for any action
  - **Modified**: `capabilities` — reactions/threads/media/nativeCommands all set to false
  - **Modified**: `threading.resolveReplyToMode` — always returns `"off"` (never replies)
  - **Modified**: `security.resolveDmPolicy` — removed `approveHint` and `formatPairingApproveHint` (no pairing in read-only)
  - **Modified**: `status.buildChannelSummary` and `buildAccountSnapshot` — added `readOnly: true` field
  - **Modified**: `gateway.startAccount` log message — "(read-only)"
  - **Kept intact**: `config`, `security`, `groups`, `threading.buildToolContext`, `messaging`, `directory`, `resolver`, `setup`, `status`, `gateway`
- [x] `npx tsc --noEmit` → **zero errors** in all modified/created files
- [x] `pnpm build` → **passes**
- [x] Write-path audit: `sendMessageSlack`, `reactSlackMessage`, `removeSlackReaction`, `chat.postMessage`, `chat.update`, `chat.delete`, `reactions.add`, `files.uploadV2`, `pins.add` in `extensions/slack/` and `src/slack/` → **zero matches** (only match is docstring comment)

**Key design decisions:**

1. **Phase 4 before Phase 3**: The work file suggested extension rewrite before channel helpers, but the extension imports from those helpers (normalize, group-mentions, directory-config). Doing Phase 4 first prevented compilation failures.

2. **Actions completely empty (not read-only subset)**: The original plan suggested keeping read actions (read, reactions, list-pins, member-info, emoji-list). However, all action handlers go through `handleSlackAction()` which was intentionally omitted from the runtime (it's the monolithic actions handler in `src/slack/actions.ts` that contains both read and write operations). Rather than create a partial read-only actions module, I set `listActions: () => []`. This means the agent cannot query Slack APIs at all — it only receives events passively. If read actions are needed later, create `src/slack/actions-readonly.ts` with only `readMessages`, `reactions`, `listPins`, `memberInfo`, `emojiList` operations, add to runtime, and update the extension.

3. **Onboarding adapter omitted**: The `onboarding` field is optional in `ChannelPlugin`. Rather than create or copy `src/channels/plugins/onboarding/slack.ts`, I omitted it. Slack can be configured via the config file or CLI setup commands. Onboarding wizard support can be added in a future session.

4. **Runtime extended with 4 read-only functions**: Added `listDirectoryPeersLive`, `listDirectoryGroupsLive`, `resolveChannelAllowlist`, `resolveUserAllowlist` to the Slack runtime section. These are all read operations (Slack API calls: `conversations.list`, `users.list`, `conversations.info`, `users.info`) and are needed for the extension's `directory` and `resolver` sections.

5. **`approveHint` removed from `resolveDmPolicy`**: The original had `formatPairingApproveHint("slack")` for the pairing flow. Since read-only mode can't send pairing approval messages, this was removed entirely.

**Phases 1-4 are now complete.** The Slack read-only channel is fully wired: config schema validated, channel registered, extension compiled, all helpers in place. No write paths exist.

### Session 5 (2026-02-07): Phase 5 — Testing & Verification Complete

**Completed:**
- [x] Phase 5.1: Full test suite — **667 test files pass, 4025 tests, 0 failures** (up from 665 files / 4001 tests — 24 new tests added)
- [x] Phase 5.2: Comprehensive write-path audit:
  - `chat.postMessage`, `chat.update`, `chat.delete`, `reactions.add`, `files.uploadV2`, `pins.add`, `pins.remove` in `src/slack/` → **zero matches**
  - `sendMessageSlack`, `reactSlackMessage`, `removeSlackReaction`, `editSlackMessage`, `deleteSlackMessage` in `src/` → **3 matches**, all pre-existing test mocks (`vi.fn()`) in `plugin-sdk/index.test.ts`, `commands/message.test.ts`, `gateway/boot.test.ts` — NOT actual write-path code
  - Same audit in `extensions/slack/` → **zero matches** (only match is in a docstring comment explaining read-only mode)
  - Verified `src/slack/send.ts`, `src/slack/format.ts`, `src/slack/actions.ts`, `src/channels/plugins/outbound/slack.ts`, `src/agents/tools/slack-actions.ts` → **all correctly absent** (file not found)
- [x] Phase 5.3: Plugin-SDK forbidden exports test verified — `monitorSlackProvider`, `sendMessageSlack`, `probeSlack` all correctly NOT exported from plugin-sdk (pre-existing test on line 31-40 of `src/plugin-sdk/index.test.ts`)
- [x] Phase 5.4: Created `extensions/slack/src/channel.test.ts` — 12 tests covering:
  - `actions.listActions()` returns `[]`
  - `actions.handleAction()` throws "read-only mode" for both write ("send") and read ("read") actions
  - `threading.resolveReplyToMode()` returns `"off"`
  - All write-related capabilities disabled (reactions, threads, media, nativeCommands = false)
  - Chat types for ingest present (direct, group, channel, thread)
  - No `outbound`, `pairing`, or `streaming` handlers present
  - `status.buildChannelSummary` includes `readOnly: true`
  - `status.buildAccountSnapshot` includes `readOnly: true`
  - Plugin identifies as `"slack"`
- [x] Phase 5.5: Created `src/channels/plugins/normalize/slack.test.ts` — 12 tests covering:
  - `looksLikeSlackTargetId` matches: user mentions (`<@U12345678>`), `user:` prefix, `channel:` prefix, `slack:` prefix, `@`/`#` prefix, raw channel/user/DM IDs
  - Rejects: empty string, plain text, short IDs
- [x] `pnpm build` → **passes**

**Pre-existing issues (NOT related to Slack work):**
- `session-write-lock.test.ts` has a flaky EBADF error (Node.js file descriptor GC timing) — pre-existing, unrelated
- 9 pre-existing TS errors across other files remain unchanged

**Files created this session**: `extensions/slack/src/channel.test.ts`, `src/channels/plugins/normalize/slack.test.ts`

---

### Session 5.5 (2026-02-07): Live Integration Testing — BLOCKED

**Config changes applied:**
- [x] `channels.slack.enabled`: `false` → `true`
- [x] `channels.slack.appToken`: added (`xapp-1-A0ACZMFUEUX-...`)
- [x] `channels.slack.groupPolicy`: added `"open"` (overrides inherited `"allowlist"` from defaults, which was silently dropping all channel messages since no Slack channel allowlist was configured)
- [x] `plugins.slack.enabled`: `false` → `true`

**What works:**
- Gateway starts, Slack monitor initializes: `[slack] [default] starting Slack monitor (read-only)`
- Socket Mode connects successfully: `[slack] socket mode connected`
- No `Socket Mode is not turned on` warning (Socket Mode enabled in Slack app settings)
- `auth.test` succeeds: bot is `krox_crocbot` (U0AD8P1B63D) in workspace `Apex Web Services LLC` (T07M2GRLGC9)
- Bot token has correct OAuth scopes: `channels:history`, `groups:history`, `im:history`, `channels:read`, `groups:read`, `im:read`, `app_mentions:read`, `reactions:read`, `files:read`, `users:read`, `emoji:read`, `team:read`
- Bot was invited to test channels

**What does NOT work:**
- **No message events are received.** After sending messages in channels where the bot is a member, zero events appear in logs. No errors, no drops, no handler invocations — complete silence after `socket mode connected`.

**What was NOT properly investigated (session ran out of quality):**
- The actual event handler code path was not debugged with instrumentation (e.g. adding temporary logging at the top of the Bolt `app.event("message", ...)` handler in `src/slack/monitor/events/messages.ts:20` to confirm whether Bolt is receiving events at all)
- The `shouldDropMismatchedSlackEvent` and `isChannelAllowed` checks in `context.ts` use `logVerbose` which may not be visible at default log levels — need to check if events are arriving but being silently filtered
- No investigation into whether the Bolt `App` instance has an error handler registered — unhandled errors in event handlers may be swallowed silently
- The `message-handler.ts` flow (debouncing, thread resolution) was not traced — a crash there could eat events
- Did NOT check if the `member_joined_channel` event fired when the bot was invited (this would confirm whether ANY events are flowing, not just messages)
- Did NOT add a temporary `app.event("*", ...)` catch-all to see if Bolt receives anything at all

**Root cause candidates (ordered by likelihood):**
1. **Bolt event handler error being swallowed** — No `app.error()` handler is registered in `provider.ts`. If the message event handler throws during setup or first invocation, Bolt may eat the error silently.
2. **Event handler code path issue** — The copied monitor code may have a runtime error in `messages.ts`, `message-handler.ts`, or `prepare.ts` that only manifests when a real event arrives (e.g., a missing import that compiled fine but fails at runtime because the module it calls into has different signatures in crocbot vs upstream).
3. **Socket Mode event delivery issue** — Less likely since the connection is established, but possible if the Slack app's event subscriptions were changed after the socket connected (would need a reconnect).

---

### Next Session Priorities (Session 6)

**Priority 1: Debug why events aren't received — CRITICAL**

The live connection works but events are silent. Systematic debugging approach:

1. **Add temporary instrumentation** to confirm whether Bolt receives events at all:
   - Add `app.error(async (error) => { runtime.log?.("slack bolt error: " + error.message); })` in `provider.ts` after the App is created
   - Add a log line at the very top of the `app.event("message", ...)` handler in `src/slack/monitor/events/messages.ts:21` (before any filtering)
   - Rebuild, restart, send a test message, check logs
2. **If Bolt receives events but handler fails**: Trace the error through `messages.ts` → `message-handler.ts` → `prepare.ts` → `dispatch.ts`. The most likely failure points are in `prepare.ts` (which had heavy edits in Session 2 to remove write-path code) and `dispatch.ts`.
3. **If Bolt does NOT receive events**: The issue is in Slack app config or Socket Mode. Verify by checking Slack app dashboard → "Event Subscriptions" → "Request URL" shows socket mode active. Also verify the app is installed to the workspace (not just configured).
4. Once events flow, verify the read-only contract: no writes, no reactions, no responses sent back.

**Priority 2: Optional Enhancements**

5. Add `src/channels/plugins/onboarding/slack.ts` for setup wizard support
6. Add read-only actions module (`src/slack/actions-readonly.ts`) if agent needs to query Slack API
7. Add Slack-specific status issues collector (like `collectTelegramStatusIssues`)

### Important Notes for Next Session

- **All 5 phases (automated) complete**: Config types, integration layer, extension, channel helpers, unit tests — all done and compiling. 24 new tests pass.
- **Live testing blocked**: Socket connects but events don't arrive. See debugging plan above.
- **Config is ready**: `crocbot.json` has `channels.slack` with botToken, appToken, `enabled: true`, `groupPolicy: "open"`. `plugins.slack.enabled: true`.
- **Gateway is running** with Slack monitor active. No need to rebuild unless code changes are made.
- **Key files to instrument for debugging**: `src/slack/monitor/provider.ts` (add `app.error` handler), `src/slack/monitor/events/messages.ts` (add entry logging), `src/slack/monitor/message-handler.ts` (add entry logging).
- **The `logVerbose` calls in `context.ts`** (lines 349, 361, 377, 383) may be hiding useful filter information — check what log level `logVerbose` maps to and whether it's enabled.
