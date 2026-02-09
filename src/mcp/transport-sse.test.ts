import { describe, expect, it, vi } from "vitest";

import { SsrFBlockedError } from "../infra/net/ssrf.js";
import { createSseTransport } from "./transport-sse.js";
import type { SseTransportDeps } from "./transport-sse.js";
import type { McpServerConfig } from "./types.js";

const { MockSSEClientTransport } = vi.hoisted(() => {
  const MockSSEClientTransport = vi.fn();
  return { MockSSEClientTransport };
});

vi.mock("@modelcontextprotocol/sdk/client/sse.js", () => ({
  SSEClientTransport: MockSSEClientTransport,
}));

function createMockDeps(overrides?: Partial<SseTransportDeps>): SseTransportDeps {
  return {
    validateUrl: vi.fn().mockImplementation(async (url: string) => new URL(url)),
    createFetch: vi.fn().mockReturnValue(vi.fn()),
    ...overrides,
  };
}

describe("createSseTransport", () => {
  it("creates transport for a valid public URL", async () => {
    const deps = createMockDeps();
    const config: McpServerConfig = {
      type: "sse",
      url: "https://mcp.example.com/events",
    };

    const transport = await createSseTransport(config, deps);

    expect(transport).toBeDefined();
    expect(deps.validateUrl).toHaveBeenCalledWith("https://mcp.example.com/events");
    expect(deps.createFetch).toHaveBeenCalled();
  });

  it("rejects a URL blocked by SSRF policy", async () => {
    const deps = createMockDeps({
      validateUrl: vi
        .fn()
        .mockRejectedValue(new SsrFBlockedError("Blocked: private/internal IP address")),
    });
    const config: McpServerConfig = {
      type: "sse",
      url: "http://127.0.0.1:8080/events",
    };

    await expect(createSseTransport(config, deps)).rejects.toThrow(SsrFBlockedError);
    await expect(createSseTransport(config, deps)).rejects.toThrow("private/internal");
  });

  it("passes custom headers to SDK transport", async () => {
    const deps = createMockDeps();
    const config: McpServerConfig = {
      type: "sse",
      url: "https://mcp.example.com/events",
      headers: { Authorization: "Bearer test-token", "X-Api-Key": "key123" },
    };

    await createSseTransport(config, deps);

    expect(MockSSEClientTransport).toHaveBeenCalledWith(
      new URL("https://mcp.example.com/events"),
      expect.objectContaining({
        requestInit: { headers: { Authorization: "Bearer test-token", "X-Api-Key": "key123" } },
        eventSourceInit: {
          headers: { Authorization: "Bearer test-token", "X-Api-Key": "key123" },
        },
      }),
    );
  });

  it("passes empty requestInit when no headers configured", async () => {
    const deps = createMockDeps();
    const config: McpServerConfig = {
      type: "sse",
      url: "https://mcp.example.com/events",
    };

    await createSseTransport(config, deps);

    expect(MockSSEClientTransport).toHaveBeenCalledWith(
      new URL("https://mcp.example.com/events"),
      expect.objectContaining({
        requestInit: {},
        eventSourceInit: {},
      }),
    );
  });

  it("throws when url is missing", async () => {
    const deps = createMockDeps();
    const config: McpServerConfig = { type: "sse" };

    await expect(createSseTransport(config, deps)).rejects.toThrow("SSE transport requires a url");
  });

  it("injects guarded fetch into SDK transport", async () => {
    const mockFetch = vi.fn();
    const deps = createMockDeps({
      createFetch: vi.fn().mockReturnValue(mockFetch),
    });
    const config: McpServerConfig = {
      type: "sse",
      url: "https://mcp.example.com/events",
    };

    await createSseTransport(config, deps);

    expect(MockSSEClientTransport).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ fetch: mockFetch }),
    );
  });
});
