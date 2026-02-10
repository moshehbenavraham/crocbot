# 3. Native MCP Integration

**Status:** Accepted
**Date:** 2026-02-09

## Context

crocbot used a subprocess-based `mcporter` CLI skill to invoke MCP tools. Each tool call spawned a new process, adding ~200ms overhead and preventing streaming responses. The MCP specification matured enough to warrant a first-class integration.

## Decision

Build an in-process MCP client and server using `@modelcontextprotocol/sdk`:

- **Client**: McpClientManager with lifecycle management (connect, getTools, callTool, disconnect, shutdown). Supports stdio (local), SSE (remote), and streamable HTTP transports. All remote transports pass SSRF validation.
- **Server**: Expose crocbot as MCP infrastructure via SSE and streamable HTTP transports. Bearer token authentication. Four tools: send_message, finish_chat, query_memory, list_capabilities.
- **Tool bridge**: Convert MCP tool schemas to agent tools with collision detection against existing tool names.

## Consequences

### Enables
- Zero-overhead tool invocation (no subprocess spawn)
- Streaming responses from MCP tools
- External AI systems can call into crocbot via MCP server mode
- SSRF-protected remote connections

### Prevents
- Using the old mcporter subprocess approach (marked READY FOR REPLACEMENT)
- Unguarded connections to remote MCP servers

### Trade-offs
- Adds `@modelcontextprotocol/sdk` as a runtime dependency
- MCP server mode requires a shared token for authentication
- Protocol drift risk as MCP spec evolves (mitigated by official SDK)
