---
name: himalaya
description: "CLI to manage emails via IMAP/SMTP. Use `himalaya` to list, read, write, reply, forward, search, and organize emails from the terminal. Supports multiple accounts and message composition with MML (MIME Meta Language)."
homepage: https://github.com/pimalaya/himalaya
metadata: {"crocbot":{"emoji":"📧","requires":{"bins":["himalaya"]},"install":[{"id":"brew","kind":"brew","formula":"himalaya","bins":["himalaya"],"label":"Install Himalaya (brew)"}]}}
---

# Himalaya Email CLI

Himalaya is a CLI email client that lets you manage emails from the terminal using IMAP, SMTP, Notmuch, or Sendmail backends.

## References

- `references/configuration.md` (config file setup + IMAP/SMTP authentication)
- `references/message-composition.md` (MML syntax for composing emails)

## Prerequisites

1. Himalaya CLI installed (`himalaya --version` to verify)
2. A configuration file at `~/.config/himalaya/config.toml`
3. IMAP/SMTP credentials configured (password stored securely)

## Configuration Setup

Run the interactive wizard to set up an account:
```bash
himalaya account configure
```

Or create `~/.config/himalaya/config.toml` manually:
```toml
[accounts.personal]
email = "you@example.com"
display-name = "Your Name"
default = true

backend.type = "imap"
backend.host = "imap.example.com"
backend.port = 993
backend.encryption.type = "tls"
backend.login = "you@example.com"
backend.auth.type = "password"
backend.auth.cmd = "pass show email/imap"  # or use keyring

message.send.backend.type = "smtp"
message.send.backend.host = "smtp.example.com"
message.send.backend.port = 587
message.send.backend.encryption.type = "start-tls"
message.send.backend.login = "you@example.com"
message.send.backend.auth.type = "password"
message.send.backend.auth.cmd = "pass show email/smtp"
```

## Common Operations

### List Folders

```bash
himalaya folder list
```

### List Emails

List emails in INBOX (default):
```bash
himalaya envelope list
```

List emails in a specific folder:
```bash
himalaya envelope list --folder "Sent"
```

List with pagination:
```bash
himalaya envelope list --page 1 --page-size 20
```

### Search Emails

```bash
himalaya envelope list from john@example.com subject meeting
```

### Read an Email

Read email by ID (shows plain text):
```bash
himalaya message read 42
```

Export raw MIME:
```bash
himalaya message export 42 --full
```

### Reply to an Email

Interactive reply (opens $EDITOR):
```bash
himalaya message reply 42
```

Reply-all:
```bash
himalaya message reply 42 --all
```

### Forward an Email

```bash
himalaya message forward 42
```

### Write a New Email

Interactive compose (opens $EDITOR):
```bash
himalaya message write
```

Send directly using template:
```bash
cat << 'EOF' | himalaya template send
From: you@example.com
To: recipient@example.com
Subject: Test Message

Hello from Himalaya!
EOF
```

Or with headers flag:
```bash
himalaya message write -H "To:recipient@example.com" -H "Subject:Test" "Message body here"
```

### Move/Copy Emails

Move to folder:
```bash
himalaya message move 42 "Archive"
```

Copy to folder:
```bash
himalaya message copy 42 "Important"
```

### Delete an Email

```bash
himalaya message delete 42
```

### Manage Flags

Add flag:
```bash
himalaya flag add 42 --flag seen
```

Remove flag:
```bash
himalaya flag remove 42 --flag seen
```

## Multiple Accounts

List accounts:
```bash
himalaya account list
```

Use a specific account:
```bash
himalaya --account work envelope list
```

## Attachments

Save attachments from a message:
```bash
himalaya attachment download 42
```

Save to specific directory:
```bash
himalaya attachment download 42 --dir ~/Downloads
```

## Output Formats

Most commands support `--output` for structured output:
```bash
himalaya envelope list --output json
himalaya envelope list --output plain
```

## Debugging

Enable debug logging:
```bash
RUST_LOG=debug himalaya envelope list
```

Full trace with backtrace:
```bash
RUST_LOG=trace RUST_BACKTRACE=1 himalaya envelope list
```

## Tips

- Use `himalaya --help` or `himalaya <command> --help` for detailed usage.
- Message IDs are relative to the current folder; re-list after folder changes.
- For composing rich emails with attachments, use MML syntax (see `references/message-composition.md`).
- Store passwords securely using `pass`, system keyring, or a command that outputs the password.

## Handling Send Failures (IMPORTANT)

When `himalaya template send` returns an error, it may be a **"false failure"**:

- SMTP send succeeded (email was delivered)
- IMAP copy to Sent folder failed (network/auth issue)
- Himalaya reports failure due to IMAP error

This can cause duplicate emails if you retry without verification!

### Verification Workflow

**Before retrying a failed send, ALWAYS verify it wasn't actually sent:**

1. Check the Sent folder for recent emails:
   ```bash
   himalaya envelope list --folder "Sent" --page-size 5
   ```

2. Look for your email by subject and recipient in the results

3. **Decision logic:**
   - If found in Sent folder → Email was sent, **DO NOT retry**
   - If not found in Sent folder → Safe to retry

### Safe Send Wrapper

For automated sending, use the safe send wrapper script that automatically verifies before reporting failure:

```bash
cat message.txt | scripts/safe-email-send.sh
```

Or with a specific account:
```bash
cat message.txt | HIMALAYA_ACCOUNT=work scripts/safe-email-send.sh
```

The wrapper:
1. Attempts to send the email
2. If the send command returns an error, waits briefly then checks the Sent folder
3. If the email is found in Sent → Reports success (IMAP save error, not SMTP failure)
4. If not found → Reports failure (safe to retry)

### Environment Variables for Safe Send

- `VERIFY_DELAY_SECS` - Delay before checking Sent folder (default: 3)
- `SENT_FOLDER` - Folder name to check (default: "Sent")
- `HIMALAYA_ACCOUNT` - Himalaya account to use

### Example: Manual Verification After Error

```bash
# Send attempt fails with error
echo "From: me@example.com
To: them@example.com
Subject: Meeting Tomorrow

Let's meet at 3pm." | himalaya template send

# Error! But was it actually sent? Check:
himalaya envelope list --folder "Sent" --page-size 3

# If "Meeting Tomorrow" appears in the list, the email was sent
# despite the error - don't send again!
```
