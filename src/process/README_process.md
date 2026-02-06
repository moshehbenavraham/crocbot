# src/process/

Child process management — command queuing, exec bridging, and spawn utilities.

## Key Files

| File | Purpose |
|------|---------|
| `command-queue.ts` | Queues and serializes child process commands |
| `exec-bridge.ts` | Bridge between agent tool calls and OS exec |
| `spawn.ts` | Safe child process spawning |
| `lanes.ts` | Process execution lanes (parallelism control) |

## Purpose

Manages how the agent executes shell commands on the host. Provides queuing, rate limiting, and safe spawning to prevent runaway processes.

## Related

- Exec approvals: `src/infra/exec-approvals.ts`
- Sandbox mode: `src/agents/sandbox/`
