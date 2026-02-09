import { describe, it, expect, vi, beforeEach } from "vitest";

import { McpClientState } from "./types.js";
import type { McpToolInfo, McpServerStatus, McpCallToolResult } from "./types.js";
import { McpToolError } from "./errors.js";
import { wrapMcpTool, resolveMcpTools } from "./tool-bridge.js";

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

function createMockTool(overrides: Partial<McpToolInfo> = {}): McpToolInfo {
  return {
    name: "test-tool",
    description: "A test tool",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
    },
    ...overrides,
  };
}

interface MockManager {
  callTool: ReturnType<typeof vi.fn>;
  getTools: ReturnType<typeof vi.fn>;
  getStatus: ReturnType<typeof vi.fn>;
}

function createMockManager(overrides: Partial<MockManager> = {}): MockManager {
  return {
    callTool: vi.fn(),
    getTools: vi.fn(),
    getStatus: vi.fn().mockReturnValue([]),
    ...overrides,
  };
}

describe("wrapMcpTool", () => {
  let manager: MockManager;

  beforeEach(() => {
    manager = createMockManager();
  });

  it("wraps MCP tool metadata into AnyAgentTool shape", () => {
    const tool = createMockTool();
    // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
    const wrapped = wrapMcpTool(manager as any, "myserver", tool);

    expect(wrapped.name).toBe("myserver.test-tool");
    expect(wrapped.description).toBe("A test tool");
    expect(wrapped.label).toBe("MCP: myserver/test-tool");
    // Type.Unsafe() adds a Symbol(TypeBox.Kind) property, so check fields individually
    expect(wrapped.parameters.type).toBe("object");
    expect(wrapped.parameters.properties).toEqual({
      query: { type: "string", description: "Search query" },
    });
  });

  it("uses Type.Unsafe to wrap JSON Schema as TSchema", () => {
    const tool = createMockTool({
      inputSchema: {
        type: "object",
        properties: {
          items: { type: "array", items: { type: "string" } },
        },
        required: ["items"],
      },
    });
    // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
    const wrapped = wrapMcpTool(manager as any, "srv", tool);

    // TypeBox Unsafe preserves the raw schema
    expect(wrapped.parameters.type).toBe("object");
    expect(wrapped.parameters.required).toEqual(["items"]);
  });

  it("provides default description when tool description is empty", () => {
    const tool = createMockTool({ description: "" });
    // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
    const wrapped = wrapMcpTool(manager as any, "srv", tool);

    expect(wrapped.description).toBe("MCP tool: srv.test-tool");
  });

  describe("execute", () => {
    it("delegates to manager.callTool with correct arguments", async () => {
      const callResult: McpCallToolResult = {
        content: [{ type: "text", text: "hello world" }],
      };
      manager.callTool.mockResolvedValue(callResult);

      const tool = createMockTool();
      // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
      const wrapped = wrapMcpTool(manager as any, "srv", tool);
      const result = await wrapped.execute("call-1", { query: "test" });

      expect(manager.callTool).toHaveBeenCalledWith("srv", "test-tool", { query: "test" });
      expect(result.content).toEqual([{ type: "text", text: "hello world" }]);
      expect(result.details).toEqual({ serverName: "srv", toolName: "test-tool" });
    });

    it("maps text content from CallToolResult", async () => {
      manager.callTool.mockResolvedValue({
        content: [
          { type: "text", text: "line 1" },
          { type: "text", text: "line 2" },
        ],
      });

      const tool = createMockTool();
      // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
      const wrapped = wrapMcpTool(manager as any, "srv", tool);
      const result = await wrapped.execute("call-2", {});

      expect(result.content).toHaveLength(2);
      expect(result.content[0]).toEqual({ type: "text", text: "line 1" });
      expect(result.content[1]).toEqual({ type: "text", text: "line 2" });
    });

    it("maps image content from CallToolResult", async () => {
      manager.callTool.mockResolvedValue({
        content: [{ type: "image", data: "base64data==", mimeType: "image/png" }],
      });

      const tool = createMockTool();
      // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
      const wrapped = wrapMcpTool(manager as any, "srv", tool);
      const result = await wrapped.execute("call-3", {});

      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: "image",
        data: "base64data==",
        mimeType: "image/png",
      });
    });

    it("returns empty text for empty content array", async () => {
      manager.callTool.mockResolvedValue({ content: [] });

      const tool = createMockTool();
      // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
      const wrapped = wrapMcpTool(manager as any, "srv", tool);
      const result = await wrapped.execute("call-4", {});

      expect(result.content).toEqual([{ type: "text", text: "" }]);
    });

    it("catches McpToolError and returns error result", async () => {
      manager.callTool.mockRejectedValue(
        new McpToolError("srv", "test-tool", "Something went wrong", { isTimeout: false }),
      );

      const tool = createMockTool();
      // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
      const wrapped = wrapMcpTool(manager as any, "srv", tool);
      const result = await wrapped.execute("call-5", {});

      expect(result.content[0]?.type).toBe("text");
      const text = (result.content[0] as { type: "text"; text: string }).text;
      expect(text).toContain("srv.test-tool");
      expect(text).toContain("failed");
      expect((result.details as Record<string, unknown>).error).toBe(true);
      expect((result.details as Record<string, unknown>).isTimeout).toBe(false);
    });

    it("catches McpToolError timeout and surfaces timeout context", async () => {
      manager.callTool.mockRejectedValue(
        new McpToolError("srv", "test-tool", "Timed out after 60000ms", { isTimeout: true }),
      );

      const tool = createMockTool();
      // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
      const wrapped = wrapMcpTool(manager as any, "srv", tool);
      const result = await wrapped.execute("call-6", {});

      const text = (result.content[0] as { type: "text"; text: string }).text;
      expect(text).toContain("timed out");
      expect((result.details as Record<string, unknown>).isTimeout).toBe(true);
    });

    it("catches non-McpToolError errors gracefully", async () => {
      manager.callTool.mockRejectedValue(new Error("Unexpected"));

      const tool = createMockTool();
      // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
      const wrapped = wrapMcpTool(manager as any, "srv", tool);
      const result = await wrapped.execute("call-7", {});

      const text = (result.content[0] as { type: "text"; text: string }).text;
      expect(text).toContain("Unexpected");
      expect((result.details as Record<string, unknown>).error).toBe(true);
    });
  });
});

describe("resolveMcpTools", () => {
  it("returns empty array when no servers are connected", async () => {
    const manager = createMockManager({
      getStatus: vi
        .fn()
        .mockReturnValue([
          { name: "srv1", state: McpClientState.Disconnected, toolCount: 0, lastError: null },
        ] satisfies McpServerStatus[]),
    });
    // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
    const tools = await resolveMcpTools(manager as any, new Set());

    expect(tools).toEqual([]);
  });

  it("wraps tools from connected servers", async () => {
    const manager = createMockManager({
      getStatus: vi
        .fn()
        .mockReturnValue([
          { name: "srv1", state: McpClientState.Connected, toolCount: 1, lastError: null },
        ] satisfies McpServerStatus[]),
      getTools: vi.fn().mockResolvedValue([createMockTool({ name: "search" })]),
    });
    // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
    const tools = await resolveMcpTools(manager as any, new Set());

    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe("srv1.search");
    expect(tools[0]?.label).toBe("MCP: srv1/search");
  });

  it("skips MCP tools that collide with existing native/plugin tools", async () => {
    const manager = createMockManager({
      getStatus: vi
        .fn()
        .mockReturnValue([
          { name: "srv1", state: McpClientState.Connected, toolCount: 2, lastError: null },
        ] satisfies McpServerStatus[]),
      getTools: vi
        .fn()
        .mockResolvedValue([createMockTool({ name: "search" }), createMockTool({ name: "fetch" })]),
    });

    const existing = new Set(["srv1.search"]); // Collision with native tool
    // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
    const tools = await resolveMcpTools(manager as any, existing);

    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe("srv1.fetch");
  });

  it("skips MCP-vs-MCP cross-server duplicate tools", async () => {
    const manager = createMockManager({
      getStatus: vi.fn().mockReturnValue([
        { name: "srv1", state: McpClientState.Connected, toolCount: 1, lastError: null },
        { name: "srv1", state: McpClientState.Connected, toolCount: 1, lastError: null },
      ] satisfies McpServerStatus[]),
      getTools: vi.fn().mockResolvedValue([createMockTool({ name: "search" })]),
    });
    // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
    const tools = await resolveMcpTools(manager as any, new Set());

    // First srv1.search is kept, duplicate is skipped
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe("srv1.search");
  });

  it("handles tools from multiple servers", async () => {
    const manager = createMockManager({
      getStatus: vi.fn().mockReturnValue([
        { name: "github", state: McpClientState.Connected, toolCount: 1, lastError: null },
        { name: "jira", state: McpClientState.Connected, toolCount: 1, lastError: null },
      ] satisfies McpServerStatus[]),
      getTools: vi
        .fn()
        .mockResolvedValueOnce([createMockTool({ name: "search" })])
        .mockResolvedValueOnce([createMockTool({ name: "create-issue" })]),
    });
    // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
    const tools = await resolveMcpTools(manager as any, new Set());

    expect(tools).toHaveLength(2);
    expect(tools[0]?.name).toBe("github.search");
    expect(tools[1]?.name).toBe("jira.create-issue");
  });

  it("continues when getTools fails for one server", async () => {
    const manager = createMockManager({
      getStatus: vi.fn().mockReturnValue([
        { name: "broken", state: McpClientState.Connected, toolCount: 0, lastError: null },
        { name: "working", state: McpClientState.Connected, toolCount: 1, lastError: null },
      ] satisfies McpServerStatus[]),
      getTools: vi
        .fn()
        .mockRejectedValueOnce(new Error("Connection lost"))
        .mockResolvedValueOnce([createMockTool({ name: "search" })]),
    });
    // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
    const tools = await resolveMcpTools(manager as any, new Set());

    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe("working.search");
  });

  it("skips servers in error state", async () => {
    const manager = createMockManager({
      getStatus: vi
        .fn()
        .mockReturnValue([
          { name: "bad", state: McpClientState.Error, toolCount: 0, lastError: "Timeout" },
        ] satisfies McpServerStatus[]),
    });
    // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
    const tools = await resolveMcpTools(manager as any, new Set());

    expect(tools).toEqual([]);
    expect(manager.getTools).not.toHaveBeenCalled();
  });

  it("returns empty array when all servers have zero tools", async () => {
    const manager = createMockManager({
      getStatus: vi
        .fn()
        .mockReturnValue([
          { name: "empty", state: McpClientState.Connected, toolCount: 0, lastError: null },
        ] satisfies McpServerStatus[]),
      getTools: vi.fn().mockResolvedValue([]),
    });
    // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
    const tools = await resolveMcpTools(manager as any, new Set());

    expect(tools).toEqual([]);
  });
});

describe("integration: resolveMcpTools merged with native tools", () => {
  it("MCP tools merge with native tools without collision", async () => {
    const nativeTools = new Set(["browser", "message", "image"]);

    const manager = createMockManager({
      getStatus: vi
        .fn()
        .mockReturnValue([
          { name: "external", state: McpClientState.Connected, toolCount: 2, lastError: null },
        ] satisfies McpServerStatus[]),
      getTools: vi
        .fn()
        .mockResolvedValue([
          createMockTool({ name: "translate" }),
          createMockTool({ name: "summarize" }),
        ]),
    });
    // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
    const mcpTools = await resolveMcpTools(manager as any, nativeTools);

    // Simulate how createcrocbotTools merges: [...nativeTools, ...pluginTools, ...mcpTools]
    const allNames = [...nativeTools, ...mcpTools.map((t) => t.name)];
    expect(allNames).toEqual([
      "browser",
      "message",
      "image",
      "external.translate",
      "external.summarize",
    ]);
  });

  it("MCP tool with collision is excluded, native/plugin tools unaffected", async () => {
    // Simulate a scenario where an MCP tool has the same qualified name as a native tool
    const nativeTools = new Set(["browser", "external.translate"]);

    const manager = createMockManager({
      getStatus: vi
        .fn()
        .mockReturnValue([
          { name: "external", state: McpClientState.Connected, toolCount: 2, lastError: null },
        ] satisfies McpServerStatus[]),
      getTools: vi
        .fn()
        .mockResolvedValue([
          createMockTool({ name: "translate" }),
          createMockTool({ name: "summarize" }),
        ]),
    });
    // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
    const mcpTools = await resolveMcpTools(manager as any, nativeTools);

    expect(mcpTools).toHaveLength(1);
    expect(mcpTools[0]?.name).toBe("external.summarize");
    // Native tools unaffected
    expect(nativeTools.has("browser")).toBe(true);
    expect(nativeTools.has("external.translate")).toBe(true);
  });
});
