---
summary: "CLI reference for `crocbot message` (send + channel actions)"
read_when:
  - Adding or modifying message CLI actions
  - Changing outbound channel behavior
---

# `crocbot message`

Single outbound command for sending messages and channel actions via Telegram.

## Usage

```
crocbot message <subcommand> [flags]
```

Channel selection:
- `--channel telegram` (required if more than one channel is configured)
- If exactly one channel is configured, it becomes the default.

Target formats (`--target`):
- Telegram: chat id or `@username`

## Common flags

- `--channel <name>`
- `--account <id>`
- `--target <dest>` (target channel or user for send/poll/read/etc)
- `--targets <name>` (repeat; broadcast only)
- `--json`
- `--dry-run`
- `--verbose`

## Actions

### Core

- `send`
  - Required: `--target`, plus `--message` or `--media`
  - Optional: `--media`, `--reply-to`, `--thread-id`
  - Telegram only: `--buttons` (requires `channels.telegram.capabilities.inlineButtons` to allow it)
  - Telegram only: `--thread-id` (forum topic id)

- `react`
  - Required: `--message-id`, `--target`
  - Optional: `--emoji`, `--remove`
  - Note: `--remove` requires `--emoji` (omit `--emoji` to clear own reactions where supported; see /tools/reactions)

- `delete`
  - Required: `--message-id`, `--target`

### Broadcast

- `broadcast`
  - Required: `--targets` (repeat)
  - Optional: `--message`, `--media`, `--dry-run`

## Examples

Send a Telegram message:
```
crocbot message send --channel telegram \
  --target @mychat --message "Hello!"
```

Send a Telegram reply:
```
crocbot message send --channel telegram \
  --target 123456789 --message "hi" --reply-to 456
```

Send Telegram inline buttons:
```
crocbot message send --channel telegram --target @mychat --message "Choose:" \
  --buttons '[ [{"text":"Yes","callback_data":"cmd:yes"}], [{"text":"No","callback_data":"cmd:no"}] ]'
```

React in Telegram:
```
crocbot message react --channel telegram \
  --target 123456789 --message-id 456 --emoji "thumbs_up"
```
