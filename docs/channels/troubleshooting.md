---
summary: "Telegram troubleshooting shortcuts"
read_when:
  - A channel connects but messages don't flow
  - Investigating channel misconfiguration (permissions, privacy mode)
---
# Channel troubleshooting

Start with:

```bash
crocbot doctor
crocbot channels status --probe
```

`channels status --probe` prints warnings when it can detect common channel misconfigurations, and includes small live checks (credentials, some permissions/membership).

## Telegram quick fixes
- Logs show `HttpError: Network request for 'sendMessage' failed` or `sendChatAction` → check IPv6 DNS. If `api.telegram.org` resolves to IPv6 first and the host lacks IPv6 egress, force IPv4 or enable IPv6. See [/channels/telegram#troubleshooting](/channels/telegram#troubleshooting).
- Logs show `setMyCommands failed` → check outbound HTTPS and DNS reachability to `api.telegram.org` (common on locked-down VPS or proxies).
