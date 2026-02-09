import { describe, expect, it } from "vitest";

import { createTransport } from "./client-transport.js";
import type { McpServerConfig } from "./types.js";

describe("createTransport", () => {
  it("creates a StdioClientTransport for stdio config", () => {
    const config: McpServerConfig = {
      type: "stdio",
      command: "echo",
      args: ["hello"],
      env: { FOO: "bar" },
    };

    const transport = createTransport(config);
    expect(transport).toBeDefined();
    expect(typeof transport.start).toBe("function");
    expect(typeof transport.close).toBe("function");
  });

  it("maps command, args, and env correctly", () => {
    const config: McpServerConfig = {
      type: "stdio",
      command: "node",
      args: ["server.js", "--port", "3000"],
      env: { NODE_ENV: "test", API_KEY: "secret" },
    };

    // Verifies no throw and transport is created
    const transport = createTransport(config);
    expect(transport).toBeDefined();
  });

  it("creates transport with no args or env", () => {
    const config: McpServerConfig = {
      type: "stdio",
      command: "my-server",
    };

    const transport = createTransport(config);
    expect(transport).toBeDefined();
  });

  it("throws for SSE transport type (not yet implemented)", () => {
    const config: McpServerConfig = {
      type: "sse",
      url: "https://example.com/events",
    };

    expect(() => createTransport(config)).toThrow("not yet implemented");
  });

  it("throws for HTTP transport type (not yet implemented)", () => {
    const config: McpServerConfig = {
      type: "http",
      url: "https://example.com/mcp",
    };

    expect(() => createTransport(config)).toThrow("not yet implemented");
  });

  it("throws for missing command in stdio config", () => {
    const config: McpServerConfig = {
      type: "stdio",
    };

    expect(() => createTransport(config)).toThrow("requires a command");
  });
});
