---
summary: "Poll sending via gateway + CLI"
read_when:
  - Adding or modifying poll support
  - Debugging poll sends from the CLI or gateway
---
# Polls


## Supported channels
- Telegram

## CLI

```bash
# Telegram
crocbot message poll --channel telegram --target -1001234567890 \
  --poll-question "Lunch today?" --poll-option "Yes" --poll-option "No" --poll-option "Maybe"
crocbot message poll --channel telegram --target -1001234567890 \
  --poll-question "Meeting time?" --poll-option "10am" --poll-option "2pm" --poll-option "4pm" --poll-multi
```

Options:
- `--channel`: `telegram`
- `--poll-multi`: allow selecting multiple options

## Gateway RPC

Method: `poll`

Params:
- `to` (string, required)
- `question` (string, required)
- `options` (string[], required)
- `maxSelections` (number, optional)
- `durationHours` (number, optional)
- `channel` (string, optional, default: `telegram`)
- `idempotencyKey` (string, required)

## Channel differences
- Telegram: 2-10 options, `maxSelections` enables multi-select when greater than 1.

## Agent tool (Message)
Use the `message` tool with `poll` action (`to`, `pollQuestion`, `pollOption`, optional `pollMulti`, `channel`).
