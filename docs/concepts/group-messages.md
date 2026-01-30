---
summary: "Behavior and config for Telegram group message handling"
read_when:
  - Changing group message rules or mentions
---
# Group messages (Telegram channel)

Goal: let crocbot sit in Telegram groups, wake up only when pinged, and keep that thread separate from the personal DM session.

Note: `agents.list[].groupChat.mentionPatterns` is the main way to configure mention patterns. For multi-agent setups, set `agents.list[].groupChat.mentionPatterns` per agent (or use `messages.groupChat.mentionPatterns` as a global fallback).

## What's implemented
- Activation modes: `mention` (default) or `always`. `mention` requires a ping (real Telegram @-mentions, regex patterns, or replies to bot messages). `always` wakes the agent on every message but it should reply only when it can add meaningful value; otherwise it returns the silent token `NO_REPLY`. Defaults can be set in config (`channels.telegram.groups`) and overridden per group via `/activation`. When `channels.telegram.groups` is set, it also acts as a group allowlist (include `"*"` to allow all).
- Group policy: `channels.telegram.groupPolicy` controls whether group messages are accepted (`open|disabled|allowlist`). `allowlist` uses `channels.telegram.groupAllowFrom`. Default is `allowlist` (blocked until you add senders).
- Per-group sessions: session keys look like `agent:<agentId>:telegram:group:<chatId>` so commands such as `/verbose on` or `/think high` (sent as standalone messages) are scoped to that group; personal DM state is untouched. Heartbeats are skipped for group threads.
- Telegram forum topics: session keys include `:topic:<threadId>` for forum topic isolation.
- Context injection: **pending-only** group messages (default 50) that *did not* trigger a run are prefixed under `[Chat messages since your last reply - for context]`, with the triggering line under `[Current message - respond to this]`. Messages already in the session are not re-injected.
- Sender surfacing: every group batch includes sender info so the model knows who is speaking.
- Group system prompt: on the first turn of a group session (and whenever `/activation` changes the mode) we inject a short blurb into the system prompt like `You are replying inside the Telegram group "<title>". Activation: trigger-only … Address the specific sender noted in the message context.` If metadata isn't available we still tell the agent it's a group chat.

## Config example (Telegram)
Add a `groupChat` block to `~/.crocbot/crocbot.json` so display-name pings work:

```json5
{
  channels: {
    telegram: {
      groups: {
        "*": { requireMention: true }
      }
    }
  },
  agents: {
    list: [
      {
        id: "main",
        groupChat: {
          historyLimit: 50,
          mentionPatterns: [
            "@?crocbot",
            "@?mybot"
          ]
        }
      }
    ]
  }
}
```

Notes:
- The regexes are case-insensitive; they cover a display-name ping like `@crocbot`.
- Replying to a bot message counts as an implicit mention.

### Activation command (owner-only)

Use the group chat command:
- `/activation mention`
- `/activation always`

Only the owner (from `channels.telegram.allowFrom`) can change this. Send `/status` as a standalone message in the group to see the current activation mode.

## How to use
1) Add your Telegram bot to the group.
2) Mention `@yourbot` or reply to a bot message. Only allowlisted senders can trigger it unless you set `groupPolicy: "open"`.
3) The agent prompt will include recent group context so it can address the right person.
4) Session-level directives (`/verbose on`, `/think high`, `/new` or `/reset`, `/compact`) apply only to that group's session; send them as standalone messages so they register. Your personal DM session remains independent.

## Testing / verification
- Manual smoke:
  - Send a `@bot` ping in the group and confirm a reply that references the sender name.
  - Send a second ping and verify the history block is included then cleared on the next turn.
- Check gateway logs (run with `--verbose`) to see inbound message entries.

## Known considerations
- Heartbeats are intentionally skipped for groups to avoid noisy broadcasts.
- Echo suppression uses the combined batch string; if you send identical text twice without mentions, only the first will get a response.
- Session store entries will appear as `agent:<agentId>:telegram:group:<chatId>` in the session store (`~/.crocbot/agents/<agentId>/sessions/sessions.json` by default); a missing entry just means the group hasn't triggered a run yet.
- Typing indicators in groups follow `agents.defaults.typingMode` (default: `message` when unmentioned).
