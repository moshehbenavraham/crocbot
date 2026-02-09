import http from "node:http";
import { randomUUID } from "node:crypto";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, describe, expect, it } from "vitest";

import { createMcpServer } from "./server.js";
import { createMcpServerHandler } from "./server-mount.js";
import type { McpServerModeConfig } from "./types.js";
import type { ServerDeps } from "./server-tools.js";
import type { crocbotConfig } from "../config/config.js";

// ---------------------------------------------------------------------------
// Helpers: in-process MCP server with dynamic port
// ---------------------------------------------------------------------------

interface LoopbackServer {
  httpServer: http.Server;
  port: number;
  token: string;
  baseUrl: string;
}

function createMockDeps(): ServerDeps {
  return {
    dispatchChat: async (params) => `echo: ${params.message}`,
    searchMemory: async (params) => [
      { path: "test/memory.md", snippet: `match for: ${params.query}`, score: 0.95 },
    ],
    getConfig: () =>
      ({
        agents: { defaults: { model: "test-model" } },
        memory: {},
        mcp: {},
      }) as unknown as crocbotConfig,
  };
}

const testLog = {
  info: () => {},
  warn: () => {},
  error: (msg: string) => {
    // Capture errors for debugging but don't fail the test
    process.stderr.write(`[mcp-test-log] ${msg}\n`);
  },
};

async function startLoopbackServer(overrides?: {
  token?: string;
  basePath?: string;
}): Promise<LoopbackServer> {
  const token = overrides?.token ?? randomUUID();
  const basePath = overrides?.basePath ?? "/mcp";

  const config: McpServerModeConfig = {
    enabled: true,
    token,
    basePath,
  };

  const deps = createMockDeps();
  const mcpServer = createMcpServer(config, deps);
  const handler = createMcpServerHandler({
    server: mcpServer,
    config,
    log: testLog,
    serverFactory: () => createMcpServer(config, deps),
  });

  const httpServer = http.createServer(async (req, res) => {
    const handled = await handler(req, res);
    if (!handled) {
      res.statusCode = 404;
      res.end("Not Found");
    }
  });

  const port = await new Promise<number>((resolve, reject) => {
    httpServer.listen(0, "127.0.0.1", () => {
      const addr = httpServer.address();
      if (addr && typeof addr === "object") {
        resolve(addr.port);
      } else {
        reject(new Error("Failed to get server port"));
      }
    });
  });

  return {
    httpServer,
    port,
    token,
    baseUrl: `http://127.0.0.1:${port}${basePath}`,
  };
}

async function stopLoopbackServer(srv: LoopbackServer): Promise<void> {
  return new Promise((resolve) => {
    srv.httpServer.close(() => resolve());
    // Force-close idle connections
    srv.httpServer.closeAllConnections();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MCP server E2E (loopback)", () => {
  let loopback: LoopbackServer | null = null;
  let client: Client | null = null;

  afterEach(async () => {
    if (client) {
      try {
        await client.close();
      } catch {
        // ignore
      }
      client = null;
    }
    if (loopback) {
      await stopLoopbackServer(loopback);
      loopback = null;
    }
  });

  // T011: SSE loopback
  it("SSE loopback: connects, lists tools, calls send_message", async () => {
    loopback = await startLoopbackServer();

    const sseUrl = new URL(`${loopback.baseUrl}/sse`);
    const transport = new SSEClientTransport(sseUrl, {
      requestInit: {
        headers: { Authorization: `Bearer ${loopback.token}` },
      },
      eventSourceInit: {
        headers: { Authorization: `Bearer ${loopback.token}` },
      },
    });

    client = new Client({ name: "e2e-sse-client", version: "1.0.0" });
    await client.connect(transport);

    // List tools
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map((t) => t.name).toSorted();
    expect(toolNames).toEqual(["finish_chat", "list_capabilities", "query_memory", "send_message"]);

    // Call send_message
    const result = await client.callTool({
      name: "send_message",
      arguments: { message: "hello from SSE client" },
    });
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);

    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.response).toBe("echo: hello from SSE client");
    expect(parsed.chat_id).toBeDefined();
  }, 30_000);

  // T012: HTTP loopback
  it("HTTP loopback: connects, lists tools, calls query_memory", async () => {
    loopback = await startLoopbackServer();

    const httpUrl = new URL(`${loopback.baseUrl}/http`);
    const transport = new StreamableHTTPClientTransport(httpUrl, {
      requestInit: {
        headers: { Authorization: `Bearer ${loopback.token}` },
      },
    });

    client = new Client({ name: "e2e-http-client", version: "1.0.0" });
    await client.connect(transport);

    // List tools
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map((t) => t.name).toSorted();
    expect(toolNames).toEqual(["finish_chat", "list_capabilities", "query_memory", "send_message"]);

    // Call query_memory
    const result = await client.callTool({
      name: "query_memory",
      arguments: { query: "test query" },
    });
    expect(result.content).toBeDefined();

    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0].snippet).toContain("test query");
  }, 30_000);

  // T013: Auth tests
  it("rejects requests without a bearer token (401)", async () => {
    loopback = await startLoopbackServer();

    const res = await fetch(`${loopback.baseUrl}/http`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 1, params: {} }),
    });
    expect(res.status).toBe(401);
    const body = await res.text();
    expect(body).toBe("Unauthorized");
  }, 10_000);

  it("rejects requests with an invalid bearer token (401)", async () => {
    loopback = await startLoopbackServer();

    const res = await fetch(`${loopback.baseUrl}/http`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer wrong-token-value",
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 1, params: {} }),
    });
    expect(res.status).toBe(401);
    const body = await res.text();
    expect(body).toBe("Unauthorized");
  }, 10_000);

  it("accepts requests with a valid bearer token", async () => {
    loopback = await startLoopbackServer();

    const res = await fetch(`${loopback.baseUrl}/http`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${loopback.token}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        id: 1,
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0.0" },
        },
      }),
    });
    // Should be 200 (handled, not 401)
    expect(res.status).toBe(200);
  }, 10_000);
});
