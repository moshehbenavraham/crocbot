import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { McpServerModeConfig } from "./types.js";
import { registerServerTools } from "./server-tools.js";
import type { ServerDeps } from "./server-tools.js";

/**
 * Create and configure an MCP Server instance with all tool handlers registered.
 *
 * The returned `Server` is not yet connected to a transport -- callers mount it
 * via `server-mount.ts` which handles SSE and streamable HTTP transports.
 */
export function createMcpServer(config: McpServerModeConfig, deps: ServerDeps): Server {
  const server = new Server({ name: "crocbot", version: "1.0.0" }, { capabilities: { tools: {} } });

  registerServerTools(server, deps);

  return server;
}
