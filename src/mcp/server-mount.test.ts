import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";

import { createMcpServerHandler } from "./server-mount.js";
import type { McpServerModeConfig } from "./types.js";

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

const TEST_TOKEN = "test-mcp-server-token";

function createMockConfig(overrides: Partial<McpServerModeConfig> = {}): McpServerModeConfig {
  return {
    enabled: true,
    token: TEST_TOKEN,
    basePath: "/mcp",
    ...overrides,
  };
}

function createMockLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

// Create a minimal mock MCP Server that satisfies the interface.
function createMockMcpServer() {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    setRequestHandler: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

// Helper to build an IncomingMessage-like object for testing the handler directly.
function buildMockReq(
  method: string,
  url: string,
  headers: Record<string, string> = {},
): IncomingMessage {
  return {
    method,
    url,
    headers: {
      host: "localhost:18789",
      ...headers,
    },
  } as unknown as IncomingMessage;
}

// Collect response data from a mock ServerResponse.
function buildMockRes() {
  let statusCode = 200;
  const headersMap: Record<string, string> = {};
  const chunks: string[] = [];
  let ended = false;

  const res = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(code: number) {
      statusCode = code;
    },
    get headersSent() {
      return ended;
    },
    setHeader(name: string, value: string) {
      headersMap[name.toLowerCase()] = value;
    },
    end(data?: string) {
      if (data) {
        chunks.push(data);
      }
      ended = true;
    },
    write(data: string) {
      chunks.push(data);
    },
    on: vi.fn(),
    // Expose state for assertions
    _getStatus: () => statusCode,
    _getHeaders: () => headersMap,
    _getBody: () => chunks.join(""),
    _isEnded: () => ended,
  } as unknown as ServerResponse & {
    _getStatus: () => number;
    _getHeaders: () => Record<string, string>;
    _getBody: () => string;
    _isEnded: () => boolean;
  };

  return res;
}

describe("createMcpServerHandler", () => {
  let handler: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
  let mockServer: ReturnType<typeof createMockMcpServer>;
  let mockLog: ReturnType<typeof createMockLog>;

  beforeEach(() => {
    mockServer = createMockMcpServer();
    mockLog = createMockLog();
    handler = createMcpServerHandler({
      // oxlint-disable-next-line typescript/no-explicit-any -- mock server
      server: mockServer as any,
      config: createMockConfig(),
      log: mockLog,
    });
  });

  describe("path matching", () => {
    it("returns false for non-MCP paths", async () => {
      const req = buildMockReq("GET", "/health", { authorization: `Bearer ${TEST_TOKEN}` });
      const res = buildMockRes();
      const handled = await handler(req, res);
      expect(handled).toBe(false);
    });

    it("returns false for paths that do not start with basePath", async () => {
      const req = buildMockReq("GET", "/api/mcp/sse", { authorization: `Bearer ${TEST_TOKEN}` });
      const res = buildMockRes();
      const handled = await handler(req, res);
      expect(handled).toBe(false);
    });

    it("handles paths under basePath", async () => {
      const req = buildMockReq("GET", "/mcp/sse", { authorization: `Bearer ${TEST_TOKEN}` });
      const res = buildMockRes();
      const handled = await handler(req, res);
      // The handler will attempt to create SSE transport which may fail in test,
      // but the path was recognized and handled.
      expect(handled).toBe(true);
    });
  });

  describe("authentication", () => {
    it("rejects requests without Authorization header", async () => {
      const req = buildMockReq("GET", "/mcp/sse");
      const res = buildMockRes();
      const handled = await handler(req, res);
      expect(handled).toBe(true);
      expect(res._getStatus()).toBe(401);
      expect(res._getBody()).toBe("Unauthorized");
    });

    it("rejects requests with invalid token", async () => {
      const req = buildMockReq("GET", "/mcp/sse", { authorization: "Bearer wrong-token" });
      const res = buildMockRes();
      const handled = await handler(req, res);
      expect(handled).toBe(true);
      expect(res._getStatus()).toBe(401);
    });

    it("accepts requests with valid token", async () => {
      const req = buildMockReq("POST", "/mcp/http", {
        authorization: `Bearer ${TEST_TOKEN}`,
        "content-type": "application/json",
      });
      const res = buildMockRes();
      const handled = await handler(req, res);
      // The handler recognizes the path and attempts to process it.
      expect(handled).toBe(true);
      // It should not return 401.
      expect(res._getStatus()).not.toBe(401);
    });
  });

  describe("unknown sub-paths", () => {
    it("returns 404 for unknown sub-paths under basePath", async () => {
      const req = buildMockReq("GET", "/mcp/unknown", { authorization: `Bearer ${TEST_TOKEN}` });
      const res = buildMockRes();
      const handled = await handler(req, res);
      expect(handled).toBe(true);
      expect(res._getStatus()).toBe(404);
      expect(res._getBody()).toBe("Not Found");
    });
  });

  describe("SSE messages endpoint", () => {
    it("returns 400 for messages without valid session", async () => {
      const req = buildMockReq("POST", "/mcp/messages?sessionId=invalid", {
        authorization: `Bearer ${TEST_TOKEN}`,
      });
      const res = buildMockRes();
      const handled = await handler(req, res);
      expect(handled).toBe(true);
      expect(res._getStatus()).toBe(400);
      expect(res._getBody()).toMatch(/Unknown or expired session/);
    });
  });

  describe("custom basePath", () => {
    it("uses custom basePath from config", async () => {
      const customHandler = createMcpServerHandler({
        // oxlint-disable-next-line typescript/no-explicit-any -- mock server
        server: mockServer as any,
        config: createMockConfig({ basePath: "/api/v1/mcp" }),
        log: mockLog,
      });

      // Standard path should not match
      const req1 = buildMockReq("GET", "/mcp/sse", { authorization: `Bearer ${TEST_TOKEN}` });
      const res1 = buildMockRes();
      expect(await customHandler(req1, res1)).toBe(false);

      // Custom path should match
      const req2 = buildMockReq("GET", "/api/v1/mcp/unknown", {
        authorization: `Bearer ${TEST_TOKEN}`,
      });
      const res2 = buildMockRes();
      expect(await customHandler(req2, res2)).toBe(true);
    });
  });
});
