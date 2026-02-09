import { describe, expect, it, vi } from "vitest";

import { createTransport } from "./client-transport.js";
import type { McpServerConfig } from "./types.js";

vi.mock("./transport-sse.js", () => ({
  createSseTransport: vi.fn().mockResolvedValue({ _mockType: "sse-transport" }),
}));

vi.mock("./transport-http.js", () => ({
  createHttpTransport: vi.fn().mockResolvedValue({ _mockType: "http-transport" }),
}));

describe("createTransport", () => {
  it("creates a StdioClientTransport for stdio config", async () => {
    const config: McpServerConfig = {
      type: "stdio",
      command: "echo",
      args: ["hello"],
      env: { FOO: "bar" },
    };

    const transport = await createTransport(config);
    expect(transport).toBeDefined();
    expect(typeof transport.start).toBe("function");
    expect(typeof transport.close).toBe("function");
  });

  it("maps command, args, and env correctly", async () => {
    const config: McpServerConfig = {
      type: "stdio",
      command: "node",
      args: ["server.js", "--port", "3000"],
      env: { NODE_ENV: "test", API_KEY: "secret" },
    };

    const transport = await createTransport(config);
    expect(transport).toBeDefined();
  });

  it("creates transport with no args or env", async () => {
    const config: McpServerConfig = {
      type: "stdio",
      command: "my-server",
    };

    const transport = await createTransport(config);
    expect(transport).toBeDefined();
  });

  it("delegates to createSseTransport for SSE config", async () => {
    const { createSseTransport } = await import("./transport-sse.js");
    const config: McpServerConfig = {
      type: "sse",
      url: "https://example.com/events",
    };

    const transport = await createTransport(config);

    expect(createSseTransport).toHaveBeenCalledWith(config);
    expect(transport).toEqual({ _mockType: "sse-transport" });
  });

  it("delegates to createHttpTransport for HTTP config", async () => {
    const { createHttpTransport } = await import("./transport-http.js");
    const config: McpServerConfig = {
      type: "http",
      url: "https://example.com/mcp",
    };

    const transport = await createTransport(config);

    expect(createHttpTransport).toHaveBeenCalledWith(config);
    expect(transport).toEqual({ _mockType: "http-transport" });
  });

  it("throws for missing command in stdio config", async () => {
    const config: McpServerConfig = {
      type: "stdio",
    };

    await expect(createTransport(config)).rejects.toThrow("requires a command");
  });
});
