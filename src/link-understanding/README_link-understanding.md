# src/link-understanding/

URL detection and content extraction from messages.

## Key Files

| File | Purpose |
|------|---------|
| `detect.ts` | Extracts URLs from message text |
| `apply.ts` | Processes detected links (fetch, summarize) |
| `runner.ts` | Execution pipeline for link processing |
| `format.ts` | Formats extracted content for the agent |
| `defaults.ts` | Default behavior configuration |

## How It Works

When a message contains URLs, this module detects them, fetches the page content, and provides a summary to the agent so it can reference the linked material in its response.
