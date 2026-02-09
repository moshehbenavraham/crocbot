import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import type { McpServerConfig } from "./types.js";

/**
 * Create an MCP transport for the given server configuration.
 *
 * Currently only stdio is supported. SSE and HTTP transports
 * will be added in Session 03.
 */
export function createTransport(config: McpServerConfig): Transport {
  switch (config.type) {
    case "stdio":
      return createStdioTransport(config);

    case "sse":
    case "http":
      throw new Error(`MCP transport type "${config.type}" is not yet implemented`);

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
