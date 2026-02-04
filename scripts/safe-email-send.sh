#!/usr/bin/env bash
# safe-email-send.sh - Safe email send with verification
# Prevents duplicate sends when SMTP succeeds but IMAP folder save fails
#
# Usage:
#   echo "From: me@example.com\nTo: them@example.com\nSubject: Test\n\nBody" | ./safe-email-send.sh
#   cat message.txt | ./safe-email-send.sh
#   cat message.txt | HIMALAYA_ACCOUNT=work ./safe-email-send.sh
#
# Environment variables:
#   VERIFY_DELAY_SECS - Delay before checking Sent folder (default: 3)
#   SENT_FOLDER       - Folder name to verify send (default: "Sent")
#   HIMALAYA_ACCOUNT  - Himalaya account to use (optional)

set -o pipefail

# Configuration with defaults
VERIFY_DELAY_SECS="${VERIFY_DELAY_SECS:-3}"
SENT_FOLDER="${SENT_FOLDER:-Sent}"
HIMALAYA_ACCOUNT="${HIMALAYA_ACCOUNT:-}"

# Read email from stdin
EMAIL_CONTENT=$(cat)

if [ -z "$EMAIL_CONTENT" ]; then
  echo "ERROR: No email content provided on stdin" >&2
  exit 1
fi

# Extract key fields for verification
SUBJECT=$(echo "$EMAIL_CONTENT" | grep -i "^Subject:" | head -1 | sed 's/^[Ss]ubject:\s*//' | xargs)
TO=$(echo "$EMAIL_CONTENT" | grep -i "^To:" | head -1 | sed 's/^[Tt]o:\s*//' | xargs)
TIMESTAMP_BEFORE=$(date +%s)

# Build himalaya command
HIMALAYA_CMD="himalaya"
if [ -n "$HIMALAYA_ACCOUNT" ]; then
  HIMALAYA_CMD="himalaya --account $HIMALAYA_ACCOUNT"
fi

# Log send attempt
echo "Sending email to: $TO"
echo "Subject: $SUBJECT"

# Attempt send
SEND_OUTPUT=$(echo "$EMAIL_CONTENT" | $HIMALAYA_CMD template send 2>&1)
SEND_EXIT=$?

if [ $SEND_EXIT -eq 0 ]; then
  echo "SUCCESS: Email sent"
  exit 0
fi

echo "WARN: Send command returned error (exit code $SEND_EXIT)" >&2
echo "Output: $SEND_OUTPUT" >&2
echo "Checking if email was actually sent..." >&2

# Wait for IMAP sync
sleep "$VERIFY_DELAY_SECS"

# Check sent folder for recent matching email
RECENT=$($HIMALAYA_CMD envelope list --folder "$SENT_FOLDER" --page-size 5 --output json 2>/dev/null)
FOLDER_CHECK_EXIT=$?

if [ $FOLDER_CHECK_EXIT -ne 0 ]; then
  echo "ERROR: Could not verify sent folder" >&2
  echo "Original send error exit code: $SEND_EXIT" >&2
  exit $SEND_EXIT
fi

# Parse JSON to find matching subject (simple grep approach)
# Escape special characters in subject for grep
ESCAPED_SUBJECT=$(echo "$SUBJECT" | sed 's/["\]/\\&/g' | sed 's/[][^$.*?+(){}|]/\\&/g')

if echo "$RECENT" | grep -qi "$ESCAPED_SUBJECT"; then
  echo "VERIFIED: Email found in Sent folder despite error"
  echo "This was likely an IMAP save error, not an SMTP failure"
  echo "Email was successfully sent - no retry needed"
  exit 0
fi

echo "CONFIRMED: Email not found in Sent folder" >&2
echo "Send genuinely failed - safe to retry" >&2
exit $SEND_EXIT
