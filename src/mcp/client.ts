import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { createTransport } from "./client-transport.js";
import { McpConnectionError, McpToolError } from "./errors.js";
import { McpClientState, DEFAULT_TOOL_TIMEOUT_MS } from "./types.js";
import type {
  McpGlobalConfig,
  McpToolInfo,
  McpServerStatus,
  McpCallToolResult,
  ManagedServer,
} from "./types.js";
import type { SubsystemLogger } from "../logging/subsystem.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const CLIENT_INFO = { name: "crocbot", version: "1.0.0" } as const;

export interface McpClientManagerDeps {
  createLogger: (name: string) => SubsystemLogger;
}

function createDefaultDeps(): McpClientManagerDeps {
  return { createLogger: createSubsystemLogger };
}

/**
 * Manages persistent connections to multiple MCP servers.
 *
 * Provides a uniform API for tool discovery and invocation across all
 * configured MCP servers. Each server runs in its own child process
 * (stdio) or network connection (SSE/HTTP, future).
 */
export class McpClientManager {
  private readonly servers: Map<string, ManagedServer> = new Map();
  private readonly logger: SubsystemLogger;

  constructor(config: McpGlobalConfig, deps: McpClientManagerDeps = createDefaultDeps()) {
    this.logger = deps.createLogger("mcp");

    for (const [name, serverConfig] of Object.entries(config.servers)) {
      this.servers.set(name, {
        name,
        config: serverConfig,
        state: McpClientState.Disconnected,
        client: null,
        transport: null,
        tools: null,
        lastError: null,
      });
    }

    this.logger.info("MCP client manager initialized", {
      serverCount: this.servers.size,
      servers: Object.keys(config.servers),
    });
  }

  /**
   * Connect to an MCP server by name.
   *
   * Spawns the transport, creates an SDK Client, and completes the
   * MCP capability negotiation handshake. Idempotent -- calling
   * connect on an already-connected server is a no-op.
   */
  async connect(serverName: string): Promise<void> {
    const server = this.getServer(serverName);

    if (server.state === McpClientState.Connected) {
      this.logger.debug("Already connected", { serverName });
      return;
    }

    server.state = McpClientState.Connecting;
    server.lastError = null;

    try {
      const transport = await createTransport(server.config);
      const client = new Client(CLIENT_INFO);

      await client.connect(transport);

      server.client = client;
      server.transport = transport;
      server.state = McpClientState.Connected;
      server.tools = null; // Clear cache on reconnect

      this.logger.info("Connected to MCP server", { serverName });
    } catch (err) {
      const cause = err instanceof Error ? err : new Error(String(err));
      server.state = McpClientState.Error;
      server.lastError = cause;
      server.client = null;
      server.transport = null;

      this.logger.error("Failed to connect to MCP server", {
        serverName,
        error: cause.message,
      });

      throw new McpConnectionError(
        serverName,
        `Failed to connect to MCP server "${serverName}": ${cause.message}`,
        { cause },
      );
    }
  }

  /**
   * Get the cached tool list for a server, fetching on first call.
   *
   * Returns an array of tool metadata (name, description, input schema).
   * Results are cached until refreshTools() is called.
   */
  async getTools(serverName: string): Promise<McpToolInfo[]> {
    const server = this.getServer(serverName);
    this.assertConnected(server);

    if (server.tools !== null) {
      return server.tools;
    }

    const result = await server.client.listTools();
    const tools: McpToolInfo[] = result.tools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      inputSchema: (t.inputSchema ?? {}) as Record<string, unknown>,
    }));

    server.tools = tools;
    this.logger.debug("Cached tool list", {
      serverName,
      toolCount: tools.length,
    });

    return tools;
  }

  /**
   * Clear the cached tool list for a server, forcing a refresh on next getTools() call.
   */
  refreshTools(serverName: string): void {
    const server = this.getServer(serverName);
    server.tools = null;
    this.logger.debug("Tool cache cleared", { serverName });
  }

  /**
   * Call a tool on a connected MCP server.
   *
   * Applies timeout enforcement via AbortSignal.timeout(). Returns the
   * raw CallToolResult from the SDK.
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown> = {},
  ): Promise<McpCallToolResult> {
    const server = this.getServer(serverName);
    this.assertConnected(server);

    const timeoutMs = server.config.timeout ?? DEFAULT_TOOL_TIMEOUT_MS;

    try {
      const result = await server.client.callTool({ name: toolName, arguments: args }, undefined, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      return result as McpCallToolResult;
    } catch (err) {
      const cause = err instanceof Error ? err : new Error(String(err));
      const isTimeout = isAbortOrTimeoutError(cause);

      throw new McpToolError(
        serverName,
        toolName,
        isTimeout
          ? `Tool call "${toolName}" on "${serverName}" timed out after ${timeoutMs}ms`
          : `Tool call "${toolName}" on "${serverName}" failed: ${cause.message}`,
        { cause, isTimeout },
      );
    }
  }

  /**
   * Disconnect from a specific MCP server.
   *
   * Closes the SDK client and terminates the transport. Idempotent --
   * calling disconnect on an already-disconnected server is a no-op.
   */
  async disconnect(serverName: string): Promise<void> {
    const server = this.getServer(serverName);

    if (server.state === McpClientState.Disconnected) {
      return;
    }

    try {
      if (server.client) {
        await server.client.close();
      }
    } catch (err) {
      this.logger.warn("Error closing MCP client", {
        serverName,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      server.client = null;
      server.transport = null;
      server.tools = null;
      server.state = McpClientState.Disconnected;
      server.lastError = null;
    }

    this.logger.info("Disconnected from MCP server", { serverName });
  }

  /**
   * Disconnect all connected servers gracefully.
   */
  async shutdown(): Promise<void> {
    this.logger.info("Shutting down MCP client manager");

    const connected = [...this.servers.entries()]
      .filter(([, s]) => s.state !== McpClientState.Disconnected)
      .map(([name]) => name);

    await Promise.all(connected.map((name) => this.disconnect(name)));

    this.logger.info("MCP client manager shutdown complete");
  }

  /**
   * Get connection status for all registered servers.
   */
  getStatus(): McpServerStatus[] {
    return [...this.servers.values()].map((s) => ({
      name: s.name,
      state: s.state,
      toolCount: s.tools?.length ?? 0,
      lastError: s.lastError?.message ?? null,
    }));
  }

  private getServer(serverName: string): ManagedServer {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new McpConnectionError(serverName, `Unknown MCP server: "${serverName}"`);
    }
    return server;
  }

  private assertConnected(server: ManagedServer): asserts server is ManagedServer & {
    client: NonNullable<ManagedServer["client"]>;
  } {
    if (server.state !== McpClientState.Connected || !server.client) {
      throw new McpConnectionError(
        server.name,
        `MCP server "${server.name}" is not connected (state: ${server.state})`,
      );
    }
  }
}

/** Check whether an error (or its cause chain) is an abort/timeout error. */
function isAbortOrTimeoutError(err: Error): boolean {
  let current: Error | undefined = err;
  while (current) {
    if (current.name === "TimeoutError" || current.name === "AbortError") {
      return true;
    }
    // The MCP SDK wraps AbortError as McpError with "TimeoutError" in the message
    if (
      current.message.includes("TimeoutError") ||
      current.message.includes("aborted due to timeout")
    ) {
      return true;
    }
    current = current.cause instanceof Error ? current.cause : undefined;
  }
  return false;
}
