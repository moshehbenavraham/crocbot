import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { createHttpTransport } from "./transport-http.js";
import { createSseTransport } from "./transport-sse.js";
import type { McpServerConfig } from "./types.js";

/**
 * Create an MCP transport for the given server configuration.
 *
 * Supports stdio, SSE, and streamable HTTP transport types. Remote
 * transports (SSE/HTTP) perform SSRF validation before connecting.
 */
export async function createTransport(config: McpServerConfig): Promise<Transport> {
  switch (config.type) {
    case "stdio":
      return createStdioTransport(config);

    case "sse":
      return await createSseTransport(config);

    case "http":
      return await createHttpTransport(config);

    default: {
      const exhaustive: never = config.type;
      throw new Error(`Unknown MCP transport type: ${exhaustive as string}`);
    }
  }
}

function createStdioTransport(config: McpServerConfig): StdioClientTransport {
  if (!config.command) {
    throw new Error("stdio transport requires a command");
  }

  return new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: config.env,
    stderr: "pipe",
  });
}
