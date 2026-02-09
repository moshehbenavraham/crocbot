# MCP (Model Context Protocol)

In-process MCP client and server for crocbot. Replaces the subprocess-based `mcporter` skill with native TypeScript integration using `@modelcontextprotocol/sdk`.

## Client

Agents dynamically discover and invoke tools from external MCP servers without leaving the runtime.

### Transports

| Transport | Use Case | Config Key |
|-----------|----------|------------|
| stdio | Local tool servers (child process) | `command`, `args` |
| SSE | Remote servers (Server-Sent Events) | `url`, `headers` |
| HTTP | Modern MCP endpoints (streamable HTTP) | `url`, `headers` |

All remote transports (SSE, HTTP) pass through SSRF validation before connecting.

### Configuration

```json5
{
  "mcp": {
    "servers": {
      "my-tool": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@example/mcp-server"]
      },
      "remote-api": {
        "type": "sse",
        "url": "https://api.example.com/mcp/sse",
        "headers": { "Authorization": "Bearer ..." },
        "timeout": 30000
      }
    }
  }
}
```

### Key Modules

| File | Purpose |
|------|---------|
| `client.ts` | `McpClientManager` -- lifecycle manager (connect, getTools, callTool, disconnect, shutdown) |
| `client-transport.ts` | Async transport factory (stdio/SSE/HTTP) |
| `config.ts` | Config validation and normalization |
| `tool-bridge.ts` | Converts MCP tools to agent tools with collision detection |
| `transport-ssrf.ts` | SSRF validation and guarded fetch for remote transports |
| `transport-sse.ts` | SSE transport with SSRF protection |
| `transport-http.ts` | Streamable HTTP transport with SSRF protection |

## Server

Exposes crocbot capabilities as MCP tools so external AI systems can call into crocbot.

### Tools

| Tool | Purpose |
|------|---------|
| `send_message` | Chat dispatch with in-memory session continuity |
| `finish_chat` | Session cleanup |
| `query_memory` | Memory search with configurable limit |
| `list_capabilities` | Tool names, model config, memory status |

### Transports

- **SSE**: `GET /mcp/sse` (event stream), `POST /mcp/messages` (messages)
- **Streamable HTTP**: `POST /mcp/http` (stateless per-request)

### Authentication

Bearer token required on all requests. Validated with timing-safe comparison.

### Configuration

```json5
{
  "mcp": {
    "server": {
      "enabled": true,
      "token": "your-secret-token",
      "basePath": "/mcp"
    }
  }
}
```

### Key Modules

| File | Purpose |
|------|---------|
| `server.ts` | MCP server factory |
| `server-auth.ts` | Bearer token authentication |
| `server-tools.ts` | Tool handler implementations |
| `server-mount.ts` | HTTP transport route mounting |

## CLI

```bash
# Check MCP server connection status
crocbot mcp status
```

## Testing

```bash
# Unit tests
pnpm vitest run src/mcp/

# E2E tests
pnpm vitest run src/mcp/mcp.e2e.test.ts
pnpm vitest run src/mcp/mcp-server.e2e.test.ts
pnpm vitest run src/mcp/mcp-ssrf.e2e.test.ts
```

## Dependencies

- `@modelcontextprotocol/sdk` -- official MCP TypeScript SDK
- `@sinclair/typebox` -- `Type.Unsafe()` for JSON Schema wrapping in tool bridge
