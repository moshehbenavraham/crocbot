import { describe, expect, it } from "vitest";

import { loadMcpConfig } from "./config.js";
import { DEFAULT_TOOL_TIMEOUT_MS } from "./types.js";

describe("loadMcpConfig", () => {
  it("parses a valid stdio config", () => {
    const result = loadMcpConfig({
      servers: {
        "docs-search": {
          type: "stdio",
          command: "node",
          args: ["server.js"],
          env: { API_KEY: "test" },
          timeout: 30_000,
        },
      },
    });

    expect(result.servers["docs-search"]).toEqual({
      type: "stdio",
      command: "node",
      args: ["server.js"],
      env: { API_KEY: "test" },
      timeout: 30_000,
      url: undefined,
      headers: undefined,
    });
  });

  it("accepts a valid HTTP config at type level", () => {
    const result = loadMcpConfig({
      servers: {
        remote: {
          type: "http",
          url: "https://example.com/mcp",
        },
      },
    });

    expect(result.servers.remote).toEqual({
      type: "http",
      command: undefined,
      args: undefined,
      env: undefined,
      url: "https://example.com/mcp",
      timeout: DEFAULT_TOOL_TIMEOUT_MS,
      headers: undefined,
    });
  });

  it("accepts a valid SSE config", () => {
    const result = loadMcpConfig({
      servers: {
        stream: {
          type: "sse",
          url: "https://example.com/events",
        },
      },
    });

    expect(result.servers.stream.type).toBe("sse");
    expect(result.servers.stream.url).toBe("https://example.com/events");
  });

  it("throws on missing command for stdio config", () => {
    expect(() =>
      loadMcpConfig({
        servers: { bad: { type: "stdio" } },
      }),
    ).toThrow('stdio transport requires a "command" field');
  });

  it("throws on empty command for stdio config", () => {
    expect(() =>
      loadMcpConfig({
        servers: { bad: { type: "stdio", command: "" } },
      }),
    ).toThrow('stdio transport requires a "command" field');
  });

  it("throws on missing url for HTTP config", () => {
    expect(() =>
      loadMcpConfig({
        servers: { bad: { type: "http" } },
      }),
    ).toThrow('http transport requires a "url" field');
  });

  it("throws on missing url for SSE config", () => {
    expect(() =>
      loadMcpConfig({
        servers: { bad: { type: "sse" } },
      }),
    ).toThrow('sse transport requires a "url" field');
  });

  it("throws on unknown transport type", () => {
    expect(() =>
      loadMcpConfig({
        servers: { bad: { type: "websocket" } },
      }),
    ).toThrow('unknown transport type "websocket"');
  });

  it("applies default timeout when not specified", () => {
    const result = loadMcpConfig({
      servers: {
        test: { type: "stdio", command: "echo" },
      },
    });

    expect(result.servers.test.timeout).toBe(DEFAULT_TOOL_TIMEOUT_MS);
  });

  it("filters out disabled servers", () => {
    const result = loadMcpConfig({
      servers: {
        enabled: { type: "stdio", command: "echo" },
        disabled: { type: "stdio", command: "echo", disabled: true },
      },
    });

    expect(Object.keys(result.servers)).toEqual(["enabled"]);
  });

  it("returns empty servers for null config", () => {
    expect(loadMcpConfig(null)).toEqual({ servers: {} });
  });

  it("returns empty servers for undefined config", () => {
    expect(loadMcpConfig(undefined)).toEqual({ servers: {} });
  });

  it("returns empty servers for missing servers key", () => {
    expect(loadMcpConfig({})).toEqual({ servers: {} });
  });

  it("returns empty servers for empty servers object", () => {
    expect(loadMcpConfig({ servers: {} })).toEqual({ servers: {} });
  });

  it("defaults type to stdio when not specified", () => {
    const result = loadMcpConfig({
      servers: {
        implicit: { command: "echo" },
      },
    });

    expect(result.servers.implicit.type).toBe("stdio");
  });

  it("handles multiple servers", () => {
    const result = loadMcpConfig({
      servers: {
        first: { type: "stdio", command: "cmd1" },
        second: { type: "stdio", command: "cmd2", args: ["-v"] },
      },
    });

    expect(Object.keys(result.servers)).toHaveLength(2);
    expect(result.servers.first.command).toBe("cmd1");
    expect(result.servers.second.command).toBe("cmd2");
    expect(result.servers.second.args).toEqual(["-v"]);
  });

  describe("headers", () => {
    it("parses valid headers from SSE config", () => {
      const result = loadMcpConfig({
        servers: {
          remote: {
            type: "sse",
            url: "https://example.com/events",
            headers: { Authorization: "Bearer tok123", "X-Api-Key": "abc" },
          },
        },
      });

      expect(result.servers.remote.headers).toEqual({
        Authorization: "Bearer tok123",
        "X-Api-Key": "abc",
      });
    });

    it("parses valid headers from HTTP config", () => {
      const result = loadMcpConfig({
        servers: {
          remote: {
            type: "http",
            url: "https://example.com/mcp",
            headers: { Authorization: "Bearer tok456" },
          },
        },
      });

      expect(result.servers.remote.headers).toEqual({
        Authorization: "Bearer tok456",
      });
    });

    it("accepts empty headers object", () => {
      const result = loadMcpConfig({
        servers: {
          remote: {
            type: "http",
            url: "https://example.com/mcp",
            headers: {},
          },
        },
      });

      expect(result.servers.remote.headers).toEqual({});
    });

    it("omits headers when not specified", () => {
      const result = loadMcpConfig({
        servers: {
          remote: {
            type: "http",
            url: "https://example.com/mcp",
          },
        },
      });

      expect(result.servers.remote.headers).toBeUndefined();
    });

    it("rejects non-string header values", () => {
      expect(() =>
        loadMcpConfig({
          servers: {
            bad: {
              type: "http",
              url: "https://example.com/mcp",
              headers: { "X-Count": 42 },
            },
          },
        }),
      ).toThrow('header "X-Count" must be a string value');
    });

    it("rejects array as headers value", () => {
      expect(() =>
        loadMcpConfig({
          servers: {
            bad: {
              type: "http",
              url: "https://example.com/mcp",
              headers: ["not", "valid"],
            },
          },
        }),
      ).toThrow('"headers" must be an object with string values');
    });

    it("rejects non-object headers value", () => {
      expect(() =>
        loadMcpConfig({
          servers: {
            bad: {
              type: "http",
              url: "https://example.com/mcp",
              headers: "not-an-object",
            },
          },
        }),
      ).toThrow('"headers" must be an object with string values');
    });
  });
});
