import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IncomingMessage } from "node:http";

import { extractBearerToken, validateToken, authenticateMcpRequest } from "./server-auth.js";
import { loadMcpServerConfig } from "./config.js";
import type { ServerDeps, MemorySearchResultItem } from "./server-tools.js";
import { registerServerTools, _getActiveChatSessions } from "./server-tools.js";

// Mock the logger to avoid real I/O in tests.
vi.mock("../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  }),
}));

// ---------------------------------------------------------------------------
// Token Auth Tests
// ---------------------------------------------------------------------------

describe("extractBearerToken", () => {
  it("extracts token from valid Authorization header", () => {
    const req = { headers: { authorization: "Bearer my-secret-token" } } as IncomingMessage;
    expect(extractBearerToken(req)).toBe("my-secret-token");
  });

  it("extracts token case-insensitively", () => {
    const req = { headers: { authorization: "bearer TOKEN_123" } } as IncomingMessage;
    expect(extractBearerToken(req)).toBe("TOKEN_123");
  });

  it("returns undefined when header is missing", () => {
    const req = { headers: {} } as IncomingMessage;
    expect(extractBearerToken(req)).toBeUndefined();
  });

  it("returns undefined when header is not Bearer format", () => {
    const req = { headers: { authorization: "Basic abc123" } } as IncomingMessage;
    expect(extractBearerToken(req)).toBeUndefined();
  });

  it("returns undefined when token part is empty", () => {
    const req = { headers: { authorization: "Bearer " } } as IncomingMessage;
    expect(extractBearerToken(req)).toBeUndefined();
  });
});

describe("validateToken", () => {
  it("returns true for matching tokens", () => {
    expect(validateToken("secret-token", "secret-token")).toBe(true);
  });

  it("returns false for mismatched tokens", () => {
    expect(validateToken("wrong-token", "secret-token")).toBe(false);
  });

  it("returns false for different length tokens", () => {
    expect(validateToken("short", "longer-token")).toBe(false);
  });

  it("returns false when provided is undefined", () => {
    expect(validateToken(undefined, "secret-token")).toBe(false);
  });

  it("returns false when expected is empty", () => {
    expect(validateToken("token", "")).toBe(false);
  });
});

describe("authenticateMcpRequest", () => {
  it("returns true for valid Bearer token", () => {
    const req = { headers: { authorization: "Bearer my-token" } } as IncomingMessage;
    expect(authenticateMcpRequest(req, "my-token")).toBe(true);
  });

  it("returns false for invalid token", () => {
    const req = { headers: { authorization: "Bearer wrong" } } as IncomingMessage;
    expect(authenticateMcpRequest(req, "my-token")).toBe(false);
  });

  it("returns false for missing Authorization header", () => {
    const req = { headers: {} } as IncomingMessage;
    expect(authenticateMcpRequest(req, "my-token")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// loadMcpServerConfig Tests
// ---------------------------------------------------------------------------

describe("loadMcpServerConfig", () => {
  it("returns null when raw is null", () => {
    expect(loadMcpServerConfig(null)).toBeNull();
  });

  it("returns null when server section is missing", () => {
    expect(loadMcpServerConfig({ servers: {} })).toBeNull();
  });

  it("returns null when enabled is false", () => {
    expect(loadMcpServerConfig({ server: { enabled: false, token: "abc" } })).toBeNull();
  });

  it("returns null when enabled is not present", () => {
    expect(loadMcpServerConfig({ server: { token: "abc" } })).toBeNull();
  });

  it("throws when enabled but token is missing", () => {
    expect(() => loadMcpServerConfig({ server: { enabled: true } })).toThrow(/requires a token/);
  });

  it("throws when enabled but token is empty string", () => {
    expect(() => loadMcpServerConfig({ server: { enabled: true, token: "  " } })).toThrow(
      /requires a token/,
    );
  });

  it("returns config with defaults when valid", () => {
    const result = loadMcpServerConfig({
      server: { enabled: true, token: "my-token" },
    });
    expect(result).toEqual({
      enabled: true,
      token: "my-token",
      basePath: "/mcp",
    });
  });

  it("uses custom basePath", () => {
    const result = loadMcpServerConfig({
      server: { enabled: true, token: "t", basePath: "/api/mcp" },
    });
    expect(result?.basePath).toBe("/api/mcp");
  });

  it("normalizes basePath by adding leading slash", () => {
    const result = loadMcpServerConfig({
      server: { enabled: true, token: "t", basePath: "mcp" },
    });
    expect(result?.basePath).toBe("/mcp");
  });

  it("strips trailing slash from basePath", () => {
    const result = loadMcpServerConfig({
      server: { enabled: true, token: "t", basePath: "/mcp/" },
    });
    expect(result?.basePath).toBe("/mcp");
  });
});

// ---------------------------------------------------------------------------
// Server Tools Tests
// ---------------------------------------------------------------------------

function createMockDeps(overrides: Partial<ServerDeps> = {}): ServerDeps {
  return {
    dispatchChat: vi.fn().mockResolvedValue("Hello from crocbot!"),
    searchMemory: vi
      .fn()
      .mockResolvedValue([
        { path: "memory/note.md", snippet: "Test memory", score: 0.9 },
      ] satisfies MemorySearchResultItem[]),
    getConfig: vi.fn().mockReturnValue({
      agents: { defaults: { model: { primary: "gpt-4" } } },
      memory: { enabled: true },
      mcp: {},
    }),
    ...overrides,
  };
}

/** Extract the method literal from a Zod schema's shape. */
function extractSchemaMethod(schema: unknown): string {
  // oxlint-disable-next-line typescript/no-explicit-any -- accessing internal zod structure
  const def = (schema as any)?.def;
  if (def?.shape?.method?.def?.values?.[0]) {
    return def.shape.method.def.values[0];
  }
  return "unknown";
}

describe("Server Tools", () => {
  let handlers: Map<string, (request: unknown) => Promise<unknown>>;
  let mockServer: {
    handlers: Map<string, (request: unknown) => Promise<unknown>>;
    setRequestHandler: ReturnType<typeof vi.fn>;
  };
  let deps: ServerDeps;

  beforeEach(() => {
    _getActiveChatSessions().clear();
    handlers = new Map<string, (request: unknown) => Promise<unknown>>();
    mockServer = {
      handlers,
      setRequestHandler: vi.fn(
        (schema: unknown, handler: (request: unknown) => Promise<unknown>) => {
          const method = extractSchemaMethod(schema);
          handlers.set(method, handler);
        },
      ),
    };
    deps = createMockDeps();
    // oxlint-disable-next-line typescript/no-explicit-any -- mock server
    registerServerTools(mockServer as any, deps);
  });

  async function callTool(name: string, args?: Record<string, unknown>): Promise<unknown> {
    const handler = mockServer.handlers.get("tools/call");
    if (!handler) {
      throw new Error("No CallToolRequest handler registered");
    }
    return handler({ params: { name, arguments: args } });
  }

  async function listTools(): Promise<unknown> {
    const handler = mockServer.handlers.get("tools/list");
    if (!handler) {
      throw new Error("No ListToolsRequest handler registered");
    }
    return handler({});
  }

  it("registers list and call handlers", () => {
    expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(2);
  });

  describe("tools/list", () => {
    it("returns all four tools", async () => {
      const result = (await listTools()) as { tools: Array<{ name: string }> };
      const names = result.tools.map((t) => t.name);
      expect(names).toEqual(["send_message", "finish_chat", "query_memory", "list_capabilities"]);
    });
  });

  describe("send_message", () => {
    it("sends message and returns response with chat_id", async () => {
      const result = (await callTool("send_message", { message: "Hello" })) as {
        content: Array<{ text: string }>;
        isError?: boolean;
      };
      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.response).toBe("Hello from crocbot!");
      expect(parsed.chat_id).toBeTruthy();
      expect(deps.dispatchChat).toHaveBeenCalledOnce();
    });

    it("supports conversation continuity with chat_id", async () => {
      // First message
      const first = (await callTool("send_message", { message: "Hi" })) as {
        content: Array<{ text: string }>;
      };
      const chatId = JSON.parse(first.content[0].text).chat_id;

      // Second message with same chat_id
      await callTool("send_message", { message: "Follow up", chat_id: chatId });

      const calls = (deps.dispatchChat as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0][0].sessionKey).toBe(calls[1][0].sessionKey);
    });

    it("returns error when message is empty", async () => {
      const result = (await callTool("send_message", { message: "" })) as {
        isError?: boolean;
        content: Array<{ text: string }>;
      };
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/message is required/);
    });

    it("returns error when message is missing", async () => {
      const result = (await callTool("send_message", {})) as {
        isError?: boolean;
      };
      expect(result.isError).toBe(true);
    });

    it("returns error when dispatchChat throws", async () => {
      deps = createMockDeps({
        dispatchChat: vi.fn().mockRejectedValue(new Error("Agent failed")),
      });
      // oxlint-disable-next-line typescript/no-explicit-any -- mock server
      registerServerTools(mockServer as any, deps);
      const result = (await callTool("send_message", { message: "Hi" })) as {
        isError?: boolean;
        content: Array<{ text: string }>;
      };
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Agent failed/);
    });
  });

  describe("finish_chat", () => {
    it("closes an active chat session", async () => {
      // Start a chat
      const first = (await callTool("send_message", { message: "Hi" })) as {
        content: Array<{ text: string }>;
      };
      const chatId = JSON.parse(first.content[0].text).chat_id;

      // Close it
      const result = (await callTool("finish_chat", { chat_id: chatId })) as {
        content: Array<{ text: string }>;
        isError?: boolean;
      };
      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe("closed");
    });

    it("returns error for unknown chat_id", async () => {
      const result = (await callTool("finish_chat", { chat_id: "nonexistent" })) as {
        isError?: boolean;
        content: Array<{ text: string }>;
      };
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Unknown chat_id/);
    });

    it("returns error when chat_id is missing", async () => {
      const result = (await callTool("finish_chat", {})) as {
        isError?: boolean;
      };
      expect(result.isError).toBe(true);
    });
  });

  describe("query_memory", () => {
    it("returns memory search results", async () => {
      const result = (await callTool("query_memory", { query: "test" })) as {
        content: Array<{ text: string }>;
        isError?: boolean;
      };
      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.results).toHaveLength(1);
      expect(parsed.results[0].snippet).toBe("Test memory");
    });

    it("passes limit to searchMemory", async () => {
      await callTool("query_memory", { query: "test", limit: 10 });
      expect(deps.searchMemory).toHaveBeenCalledWith({ query: "test", limit: 10 });
    });

    it("defaults limit to 5", async () => {
      await callTool("query_memory", { query: "test" });
      expect(deps.searchMemory).toHaveBeenCalledWith({ query: "test", limit: 5 });
    });

    it("returns error when query is empty", async () => {
      const result = (await callTool("query_memory", { query: "" })) as {
        isError?: boolean;
      };
      expect(result.isError).toBe(true);
    });

    it("returns error when memory search fails", async () => {
      deps = createMockDeps({
        searchMemory: vi.fn().mockRejectedValue(new Error("Memory not configured")),
      });
      // oxlint-disable-next-line typescript/no-explicit-any -- mock server
      registerServerTools(mockServer as any, deps);
      const result = (await callTool("query_memory", { query: "test" })) as {
        isError?: boolean;
        content: Array<{ text: string }>;
      };
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Memory not configured/);
    });
  });

  describe("list_capabilities", () => {
    it("returns capabilities from config", async () => {
      const result = (await callTool("list_capabilities")) as {
        content: Array<{ text: string }>;
      };
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.tools).toEqual([
        "send_message",
        "finish_chat",
        "query_memory",
        "list_capabilities",
      ]);
      expect(parsed.memory).toBe(true);
    });
  });

  describe("unknown tool", () => {
    it("returns error for unknown tool name", async () => {
      const result = (await callTool("nonexistent_tool")) as {
        isError?: boolean;
        content: Array<{ text: string }>;
      };
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Unknown tool/);
    });
  });
});
