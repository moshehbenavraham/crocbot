import { describe, expect, it, vi } from "vitest";

import { SsrFBlockedError } from "../infra/net/ssrf.js";
import { createHttpTransport } from "./transport-http.js";
import type { HttpTransportDeps } from "./transport-http.js";
import type { McpServerConfig } from "./types.js";

const { MockStreamableHTTPClientTransport } = vi.hoisted(() => {
  const MockStreamableHTTPClientTransport = vi.fn();
  return { MockStreamableHTTPClientTransport };
});

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: MockStreamableHTTPClientTransport,
}));

function createMockDeps(overrides?: Partial<HttpTransportDeps>): HttpTransportDeps {
  return {
    validateUrl: vi.fn().mockImplementation(async (url: string) => new URL(url)),
    createFetch: vi.fn().mockReturnValue(vi.fn()),
    ...overrides,
  };
}

describe("createHttpTransport", () => {
  it("creates transport for a valid public URL", async () => {
    const deps = createMockDeps();
    const config: McpServerConfig = {
      type: "http",
      url: "https://mcp.example.com/mcp",
    };

    const transport = await createHttpTransport(config, deps);

    expect(transport).toBeDefined();
    expect(deps.validateUrl).toHaveBeenCalledWith("https://mcp.example.com/mcp");
    expect(deps.createFetch).toHaveBeenCalled();
  });

  it("rejects a URL blocked by SSRF policy", async () => {
    const deps = createMockDeps({
      validateUrl: vi
        .fn()
        .mockRejectedValue(new SsrFBlockedError("Blocked: private/internal IP address")),
    });
    const config: McpServerConfig = {
      type: "http",
      url: "http://192.168.1.1:8080/mcp",
    };

    await expect(createHttpTransport(config, deps)).rejects.toThrow(SsrFBlockedError);
    await expect(createHttpTransport(config, deps)).rejects.toThrow("private/internal");
  });

  it("passes custom headers to SDK transport", async () => {
    const deps = createMockDeps();
    const config: McpServerConfig = {
      type: "http",
      url: "https://mcp.example.com/mcp",
      headers: { Authorization: "Bearer test-token" },
    };

    await createHttpTransport(config, deps);

    expect(MockStreamableHTTPClientTransport).toHaveBeenCalledWith(
      new URL("https://mcp.example.com/mcp"),
      expect.objectContaining({
        requestInit: { headers: { Authorization: "Bearer test-token" } },
      }),
    );
  });

  it("passes empty requestInit when no headers configured", async () => {
    const deps = createMockDeps();
    const config: McpServerConfig = {
      type: "http",
      url: "https://mcp.example.com/mcp",
    };

    await createHttpTransport(config, deps);

    expect(MockStreamableHTTPClientTransport).toHaveBeenCalledWith(
      new URL("https://mcp.example.com/mcp"),
      expect.objectContaining({
        requestInit: {},
      }),
    );
  });

  it("throws when url is missing", async () => {
    const deps = createMockDeps();
    const config: McpServerConfig = { type: "http" };

    await expect(createHttpTransport(config, deps)).rejects.toThrow(
      "HTTP transport requires a url",
    );
  });

  it("injects guarded fetch into SDK transport", async () => {
    const mockFetch = vi.fn();
    const deps = createMockDeps({
      createFetch: vi.fn().mockReturnValue(mockFetch),
    });
    const config: McpServerConfig = {
      type: "http",
      url: "https://mcp.example.com/mcp",
    };

    await createHttpTransport(config, deps);

    expect(MockStreamableHTTPClientTransport).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ fetch: mockFetch }),
    );
  });
});
