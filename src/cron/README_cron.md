# src/cron/

Scheduled job management — cron expressions, job execution, and logging.

## Structure

```
cron/
  isolated-agent/   # Runs cron jobs in isolated agent sessions
  service/          # Cron service lifecycle
```

## Key Files

| File          | Purpose                             |
| ------------- | ----------------------------------- |
| `service.ts`  | Cron job scheduler and service loop |
| `schedule.ts` | Next-run calculation                |
| `parse.ts`    | Cron expression parsing             |
| `run-log.ts`  | Execution history logging           |

## How It Works

1. Cron jobs are defined in `crocbot.json` or via the CLI
2. The cron service runs inside the gateway process
3. Each job triggers an isolated agent session
4. Execution logs are persisted for debugging

## Related

- Cron CLI: `src/cli/cron-cli/`
- Cron docs: [Automation / Cron jobs](https://aiwithapex.mintlify.app/automation/cron-jobs)
