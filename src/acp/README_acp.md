# src/acp/

Agent Client Protocol (ACP) — inter-process communication layer for agent requests and session management.

## Purpose

ACP enables communication between the gateway and external agent clients over a standardized protocol. It translates between crocbot's internal session model and the ACP wire format.

## Key Files

| File              | Purpose                                                           |
| ----------------- | ----------------------------------------------------------------- |
| `client.ts`       | ACP client interface (permission handler with tool safety checks) |
| `server.ts`       | ACP server handler                                                |
| `session.ts`      | Session lifecycle management                                      |
| `translator.ts`   | Protocol translation (internal <-> ACP)                           |
| `event-mapper.ts` | Maps internal events to ACP events                                |
| `commands.ts`     | ACP command handling                                              |
| `tool-safety.ts`  | Tool safety classification (inferToolKind, classifyToolSafety)    |

## Tool Safety

The ACP permission handler evaluates tool safety before granting permissions:

- `inferToolKind()` classifies tools as read, search, write, execute, or dangerous
- `classifyToolSafety()` determines if a tool is safe, requires approval, or should be denied
- Dangerous tools (shell execution, HTTP tools on deny list) are auto-denied
- Read/search-only operations are auto-approved
- All other operations prompt for explicit approval

## Related

- ACP SDK dependency: `@agentclientprotocol/sdk`
- Gateway integration: `src/gateway/`
- Tool policy: `src/agents/tool-policy.ts` (gateway HTTP tool deny list)
