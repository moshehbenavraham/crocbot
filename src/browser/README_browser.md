# src/browser/

Browser automation via Chrome DevTools Protocol (CDP). Provides the agent with web browsing capabilities.

## Structure

```
browser/
  routes/         # Browser-related HTTP routes
```

## Key Files

| File                 | Purpose                                     |
| -------------------- | ------------------------------------------- |
| `client.ts`          | High-level browser client API               |
| `cdp.ts`             | Chrome DevTools Protocol connection         |
| `chrome.ts`          | Chrome/Chromium process management          |
| `client-actions.ts`  | Browser actions (click, type, scroll, etc.) |
| `client-fetch.ts`    | Fetch within browser context                |
| `client-navigate.ts` | Navigation and page loading                 |
| `client-snapshot.ts` | Page snapshot capture                       |

## How It Works

- Manages a dedicated Chrome/Chromium instance via CDP
- Supports profiles, uploads, and cookie persistence
- The agent uses browser tools to navigate, interact with, and extract data from web pages
- Browser runs on the gateway host (not sandboxed by default)

## Related

- Browser tool definitions: `src/agents/tools/`
- Security config: `agents.defaults.sandbox` in crocbot.json
