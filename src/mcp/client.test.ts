import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { McpClientManager } from "./client.js";
import type { McpClientManagerDeps } from "./client.js";
import { McpConnectionError, McpToolError } from "./errors.js";
import { McpClientState } from "./types.js";
import type { McpGlobalConfig } from "./types.js";

// Stub logger that captures nothing
function createStubLogger() {
  const noop = () => {};
  const logger = {
    subsystem: "mcp-test",
    trace: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    fatal: noop,
    raw: noop,
    child: () => logger,
  };
  return logger;
}

const stubDeps: McpClientManagerDeps = {
  createLogger: () => createStubLogger(),
};

/** Create a mock MCP server with tools and connect it to a client manager via InMemoryTransport. */
function createMockServerAndTransport(tools: Array<{ name: string; description: string }> = []) {
  const server = new Server(
    { name: "test-server", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: { type: "object" as const, properties: {} },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    if (toolName === "error-tool") {
      return {
        content: [{ type: "text" as const, text: "Tool execution failed" }],
        isError: true,
      };
    }
    if (toolName === "slow-tool") {
      // Delay longer than any reasonable timeout
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      return { content: [{ type: "text" as const, text: "done" }] };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            tool: toolName,
            args: request.params.arguments,
          }),
        },
      ],
    };
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  return { server, serverTransport, clientTransport };
}

describe("McpClientManager", () => {
  describe("constructor", () => {
    it("creates successfully with valid config", () => {
      const config: McpGlobalConfig = {
        servers: {
          test: { type: "stdio", command: "echo" },
        },
      };

      const manager = new McpClientManager(config, stubDeps);
      expect(manager).toBeDefined();
    });

    it("creates with empty servers config", () => {
      const manager = new McpClientManager({ servers: {} }, stubDeps);
      expect(manager.getStatus()).toEqual([]);
    });

    it("registers multiple servers", () => {
      const config: McpGlobalConfig = {
        servers: {
          first: { type: "stdio", command: "cmd1" },
          second: { type: "stdio", command: "cmd2" },
        },
      };

      const manager = new McpClientManager(config, stubDeps);
      const status = manager.getStatus();
      expect(status).toHaveLength(2);
      expect(status.map((s) => s.name).toSorted()).toEqual(["first", "second"]);
    });
  });

  describe("connect", () => {
    it("starts in disconnected state", () => {
      const config: McpGlobalConfig = {
        servers: {
          test: { type: "stdio", command: "echo" },
        },
      };

      const manager = new McpClientManager(config, stubDeps);
      expect(manager.getStatus()[0].state).toBe(McpClientState.Disconnected);
    });

    it("throws McpConnectionError on unknown server name", async () => {
      const manager = new McpClientManager({ servers: {} }, stubDeps);

      await expect(manager.connect("nonexistent")).rejects.toThrow(McpConnectionError);
      await expect(manager.connect("nonexistent")).rejects.toThrow("Unknown MCP server");
    });
  });

  describe("getTools", () => {
    it("throws McpConnectionError on disconnected server", async () => {
      const config: McpGlobalConfig = {
        servers: {
          test: { type: "stdio", command: "echo" },
        },
      };

      const manager = new McpClientManager(config, stubDeps);

      await expect(manager.getTools("test")).rejects.toThrow(McpConnectionError);
      await expect(manager.getTools("test")).rejects.toThrow("not connected");
    });

    it("throws McpConnectionError on unknown server", async () => {
      const manager = new McpClientManager({ servers: {} }, stubDeps);

      await expect(manager.getTools("unknown")).rejects.toThrow(McpConnectionError);
    });
  });

  describe("callTool", () => {
    it("throws McpConnectionError on disconnected server", async () => {
      const config: McpGlobalConfig = {
        servers: {
          test: { type: "stdio", command: "echo" },
        },
      };

      const manager = new McpClientManager(config, stubDeps);

      await expect(manager.callTool("test", "some-tool", {})).rejects.toThrow(McpConnectionError);
    });

    it("throws McpConnectionError on unknown server", async () => {
      const manager = new McpClientManager({ servers: {} }, stubDeps);

      await expect(manager.callTool("unknown", "tool", {})).rejects.toThrow(McpConnectionError);
    });
  });

  describe("disconnect", () => {
    it("is idempotent on already-disconnected server", async () => {
      const config: McpGlobalConfig = {
        servers: {
          test: { type: "stdio", command: "echo" },
        },
      };

      const manager = new McpClientManager(config, stubDeps);

      // Should not throw
      await manager.disconnect("test");
      await manager.disconnect("test");

      expect(manager.getStatus()[0].state).toBe(McpClientState.Disconnected);
    });

    it("throws on unknown server", async () => {
      const manager = new McpClientManager({ servers: {} }, stubDeps);

      await expect(manager.disconnect("unknown")).rejects.toThrow(McpConnectionError);
    });
  });

  describe("shutdown", () => {
    it("completes on manager with no servers", async () => {
      const manager = new McpClientManager({ servers: {} }, stubDeps);
      await manager.shutdown();
    });

    it("disconnects all registered servers", async () => {
      const config: McpGlobalConfig = {
        servers: {
          first: { type: "stdio", command: "cmd1" },
          second: { type: "stdio", command: "cmd2" },
        },
      };

      const manager = new McpClientManager(config, stubDeps);

      // All are already disconnected, should complete without error
      await manager.shutdown();

      const status = manager.getStatus();
      expect(status.every((s) => s.state === McpClientState.Disconnected)).toBe(true);
    });
  });

  describe("getStatus", () => {
    it("returns status for all registered servers", () => {
      const config: McpGlobalConfig = {
        servers: {
          alpha: { type: "stdio", command: "echo" },
          beta: { type: "stdio", command: "echo" },
        },
      };

      const manager = new McpClientManager(config, stubDeps);
      const status = manager.getStatus();

      expect(status).toHaveLength(2);
      expect(status[0]).toEqual({
        name: "alpha",
        state: McpClientState.Disconnected,
        toolCount: 0,
        lastError: null,
      });
    });

    it("returns empty array for no servers", () => {
      const manager = new McpClientManager({ servers: {} }, stubDeps);
      expect(manager.getStatus()).toEqual([]);
    });
  });

  describe("refreshTools", () => {
    it("clears cached tools for known server", () => {
      const config: McpGlobalConfig = {
        servers: {
          test: { type: "stdio", command: "echo" },
        },
      };

      const manager = new McpClientManager(config, stubDeps);
      // Should not throw even when no tools cached
      manager.refreshTools("test");
    });

    it("throws on unknown server", () => {
      const manager = new McpClientManager({ servers: {} }, stubDeps);
      expect(() => manager.refreshTools("unknown")).toThrow(McpConnectionError);
    });
  });

  // Integration-style tests using InMemoryTransport to verify full lifecycle
  describe("full lifecycle with InMemoryTransport", () => {
    let server: Server;
    let manager: McpClientManager;
    let serverTransport: InMemoryTransport;
    let clientTransport: InMemoryTransport;

    beforeEach(async () => {
      const mock = createMockServerAndTransport([
        { name: "search", description: "Search documents" },
        { name: "error-tool", description: "Always fails" },
        { name: "slow-tool", description: "Takes forever" },
      ]);

      server = mock.server;
      serverTransport = mock.serverTransport;
      clientTransport = mock.clientTransport;

      // Start the mock server
      await server.connect(serverTransport);

      // Create a manager with a custom config that uses our InMemoryTransport
      // We inject the transport by creating the manager and then manually
      // wiring the internal state. This is needed because the public API
      // calls createTransport() which would try to spawn a child process.
      const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");

      const client = new Client({ name: "crocbot-test", version: "1.0.0" });
      await client.connect(clientTransport);

      const config: McpGlobalConfig = {
        servers: {
          test: { type: "stdio", command: "echo", timeout: 500 },
        },
      };

      manager = new McpClientManager(config, stubDeps);

      // Directly set the internal state to simulate a successful connect.
      // This is needed because createTransport() would try to spawn a real process.
      // We access the private servers map via the manager's internal state.
      const serversMap = (manager as unknown as { servers: Map<string, unknown> }).servers;
      const entry = serversMap.get("test") as Record<string, unknown>;
      entry.client = client;
      entry.transport = clientTransport;
      entry.state = McpClientState.Connected;
    });

    afterEach(async () => {
      await server.close();
    });

    it("getTools returns tool list from connected server", async () => {
      const tools = await manager.getTools("test");

      expect(tools).toHaveLength(3);
      expect(tools[0]).toEqual({
        name: "search",
        description: "Search documents",
        inputSchema: { type: "object", properties: {} },
      });
    });

    it("getTools caches tools after first call", async () => {
      const tools1 = await manager.getTools("test");
      const tools2 = await manager.getTools("test");

      // Same reference means cached
      expect(tools1).toBe(tools2);
    });

    it("refreshTools clears cache and next getTools fetches fresh", async () => {
      const tools1 = await manager.getTools("test");
      manager.refreshTools("test");
      const tools2 = await manager.getTools("test");

      // Different reference after refresh
      expect(tools1).not.toBe(tools2);
      // But same content
      expect(tools1).toEqual(tools2);
    });

    it("callTool sends request and returns result", async () => {
      const result = await manager.callTool("test", "search", { query: "hello" });

      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);

      const textContent = result.content[0];
      expect(textContent.type).toBe("text");
      const parsed = JSON.parse((textContent as { type: "text"; text: string }).text);
      expect(parsed.tool).toBe("search");
      expect(parsed.args).toEqual({ query: "hello" });
    });

    it("callTool returns error result from server", async () => {
      const result = await manager.callTool("test", "error-tool", {});

      expect(result.isError).toBe(true);
      const textContent = result.content[0] as { type: "text"; text: string };
      expect(textContent.text).toBe("Tool execution failed");
    });

    it("callTool timeout produces McpToolError", async () => {
      // The timeout is set to 500ms and slow-tool takes 10s
      const promise = manager.callTool("test", "slow-tool", {});

      await expect(promise).rejects.toThrow(McpToolError);
      await expect(manager.callTool("test", "slow-tool", {})).rejects.toMatchObject({
        isTimeout: true,
        serverName: "test",
        toolName: "slow-tool",
      });
    }, 10_000);

    it("disconnect transitions state to disconnected", async () => {
      expect(manager.getStatus()[0].state).toBe(McpClientState.Connected);

      await manager.disconnect("test");

      expect(manager.getStatus()[0].state).toBe(McpClientState.Disconnected);
      expect(manager.getStatus()[0].toolCount).toBe(0);
    });

    it("disconnect is idempotent after disconnect", async () => {
      await manager.disconnect("test");
      await manager.disconnect("test"); // Should not throw

      expect(manager.getStatus()[0].state).toBe(McpClientState.Disconnected);
    });

    it("shutdown disconnects all connected servers", async () => {
      expect(manager.getStatus()[0].state).toBe(McpClientState.Connected);

      await manager.shutdown();

      expect(manager.getStatus()[0].state).toBe(McpClientState.Disconnected);
    });

    it("getStatus reflects connected state and tool count", async () => {
      // Populate the tool cache
      await manager.getTools("test");

      const status = manager.getStatus();
      expect(status[0]).toEqual({
        name: "test",
        state: McpClientState.Connected,
        toolCount: 3,
        lastError: null,
      });
    });

    it("callTool with no args sends empty object", async () => {
      const result = await manager.callTool("test", "search");

      expect(result.content).toBeDefined();
      const parsed = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
      expect(parsed.args).toEqual({});
    });
  });
});
