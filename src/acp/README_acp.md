# src/acp/

Agent Client Protocol (ACP) — inter-process communication layer for agent requests and session management.

## Purpose

ACP enables communication between the gateway and external agent clients over a standardized protocol. It translates between crocbot's internal session model and the ACP wire format.

## Key Files

| File | Purpose |
|------|---------|
| `client.ts` | ACP client interface |
| `server.ts` | ACP server handler |
| `session.ts` | Session lifecycle management |
| `translator.ts` | Protocol translation (internal <-> ACP) |
| `event-mapper.ts` | Maps internal events to ACP events |
| `commands.ts` | ACP command handling |

## Related

- ACP SDK dependency: `@agentclientprotocol/sdk`
- Gateway integration: `src/gateway/`
