# src/logging/

Structured logging with sensitive data redaction and request correlation.

## Key Files

| File             | Purpose                                    |
| ---------------- | ------------------------------------------ |
| `logger.ts`      | Main logger factory (tslog-based)          |
| `format.ts`      | Log output formatting                      |
| `redact.ts`      | Redacts secrets, tokens, and PII from logs |
| `correlation.ts` | Request correlation IDs for tracing        |
| `console.ts`     | Console output integration                 |

## Usage

```typescript
import { logger } from "./logging/logger.js";

logger.info("Gateway started", { port: 18789 });
logger.error("Connection failed", { error });
```

## Log Viewing

```bash
journalctl --user -u crocbot-gateway --since "1 hour ago"
```

## Related

- Metrics: `src/metrics/`
- Alerting: `src/alerting/`
