import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makePlaceholder } from "../infra/secrets/masker.js";
import { SecretsRegistry } from "../infra/secrets/registry.js";
import type { McpCallToolResult } from "./types.js";
import { wrapMcpTool } from "./tool-bridge.js";
import type { McpToolInfo } from "./types.js";

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

describe("MCP tool bridge masking", () => {
  beforeEach(() => {
    SecretsRegistry.reset();
  });

  afterEach(() => {
    SecretsRegistry.reset();
  });

  // ---------------------------------------------------------------------------
  // Text entries masked
  // ---------------------------------------------------------------------------

  describe("text content masking", () => {
    it("masks secrets in text content entries", async () => {
      const secret = "sk-test-abc123XYZ";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("api-key", secret);
      const placeholder = makePlaceholder(secret);

      const callResult: McpCallToolResult = {
        content: [{ type: "text", text: `API key: ${secret}` }],
      };
      const manager = createMockManager({
        callTool: vi.fn().mockResolvedValue(callResult),
      });

      const tool = createMockTool();
      // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
      const wrapped = wrapMcpTool(manager as any, "srv", tool);
      const result = await wrapped.execute("call-1", {});

      const text = (result.content[0] as { type: "text"; text: string }).text;
      expect(text).toBe(`API key: ${placeholder}`);
      expect(text).not.toContain(secret);
    });

    it("masks secrets in multiple text entries", async () => {
      const secret = "database-password-xyz123";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("db-pass", secret);
      const placeholder = makePlaceholder(secret);

      const callResult: McpCallToolResult = {
        content: [
          { type: "text", text: `line1: ${secret}` },
          { type: "text", text: `line2: ${secret}` },
        ],
      };
      const manager = createMockManager({
        callTool: vi.fn().mockResolvedValue(callResult),
      });

      const tool = createMockTool();
      // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
      const wrapped = wrapMcpTool(manager as any, "srv", tool);
      const result = await wrapped.execute("call-2", {});

      expect(result.content).toHaveLength(2);
      expect((result.content[0] as { text: string }).text).toBe(`line1: ${placeholder}`);
      expect((result.content[1] as { text: string }).text).toBe(`line2: ${placeholder}`);
    });
  });

  // ---------------------------------------------------------------------------
  // Image entries unchanged
  // ---------------------------------------------------------------------------

  describe("image content preservation", () => {
    it("does not modify image content entries", async () => {
      const secret = "image-secret-value-abc";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("key", secret);

      const callResult: McpCallToolResult = {
        content: [{ type: "image", data: "base64data==", mimeType: "image/png" }],
      };
      const manager = createMockManager({
        callTool: vi.fn().mockResolvedValue(callResult),
      });

      const tool = createMockTool();
      // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
      const wrapped = wrapMcpTool(manager as any, "srv", tool);
      const result = await wrapped.execute("call-3", {});

      expect(result.content[0]).toEqual({
        type: "image",
        data: "base64data==",
        mimeType: "image/png",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Mixed content
  // ---------------------------------------------------------------------------

  describe("mixed content", () => {
    it("masks text but preserves image in mixed content", async () => {
      const secret = "mixed-secret-value-abc";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("key", secret);
      const placeholder = makePlaceholder(secret);

      const callResult: McpCallToolResult = {
        content: [
          { type: "text", text: `secret: ${secret}` },
          { type: "image", data: "base64data==", mimeType: "image/png" },
        ],
      };
      const manager = createMockManager({
        callTool: vi.fn().mockResolvedValue(callResult),
      });

      const tool = createMockTool();
      // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
      const wrapped = wrapMcpTool(manager as any, "srv", tool);
      const result = await wrapped.execute("call-4", {});

      expect(result.content).toHaveLength(2);
      expect((result.content[0] as { text: string }).text).toBe(`secret: ${placeholder}`);
      expect(result.content[1]).toEqual({
        type: "image",
        data: "base64data==",
        mimeType: "image/png",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Empty results
  // ---------------------------------------------------------------------------

  describe("empty results", () => {
    it("handles empty content array", async () => {
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("key", "some-secret-value");

      const callResult: McpCallToolResult = { content: [] };
      const manager = createMockManager({
        callTool: vi.fn().mockResolvedValue(callResult),
      });

      const tool = createMockTool();
      // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
      const wrapped = wrapMcpTool(manager as any, "srv", tool);
      const result = await wrapped.execute("call-5", {});

      // Falls through to the empty-content default
      expect(result.content).toEqual([{ type: "text", text: "" }]);
    });
  });

  // ---------------------------------------------------------------------------
  // Error results
  // ---------------------------------------------------------------------------

  describe("error results", () => {
    it("masks secrets in error result text", async () => {
      const secret = "error-secret-in-message";
      const registry = SecretsRegistry.getInstance({ minLength: 4 });
      registry.register("key", secret);

      // The error message won't contain the secret since McpToolError creates its own message.
      // But if the error message included the secret, it would be in the error result.
      const manager = createMockManager({
        callTool: vi.fn().mockRejectedValue(new Error(`Connection to ${secret} failed`)),
      });

      const tool = createMockTool();
      // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
      const wrapped = wrapMcpTool(manager as any, "srv", tool);
      const result = await wrapped.execute("call-6", {});

      // The error message is formatted by formatErrorMessage which now masks
      const text = (result.content[0] as { text: string }).text;
      expect(text).not.toContain(secret);
    });
  });

  // ---------------------------------------------------------------------------
  // No-op when registry is empty
  // ---------------------------------------------------------------------------

  describe("no-op", () => {
    it("passes text through unchanged when registry is empty", async () => {
      SecretsRegistry.getInstance();

      const callResult: McpCallToolResult = {
        content: [{ type: "text", text: "hello world" }],
      };
      const manager = createMockManager({
        callTool: vi.fn().mockResolvedValue(callResult),
      });

      const tool = createMockTool();
      // oxlint-disable-next-line typescript/no-explicit-any -- mock manager
      const wrapped = wrapMcpTool(manager as any, "srv", tool);
      const result = await wrapped.execute("call-7", {});

      expect((result.content[0] as { text: string }).text).toBe("hello world");
    });
  });
});
