import { describe, expect, it } from "vitest";

import { validateMcpUrl } from "./transport-ssrf.js";
import { createSseTransport } from "./transport-sse.js";
import { createHttpTransport } from "./transport-http.js";

// ---------------------------------------------------------------------------
// SSRF validation E2E tests
//
// These tests exercise the full chain: transport factory -> validateMcpUrl ->
// resolvePinnedHostnameWithPolicy -> DNS lookup -> IP check.
//
// Private/localhost addresses must be rejected by default policy.
// Public URL structures must pass validation (URL parsing + protocol check).
// ---------------------------------------------------------------------------

describe("MCP SSRF validation E2E", () => {
  describe("validateMcpUrl rejects private/internal addresses", () => {
    const blockedUrls = [
      { url: "http://127.0.0.1:8080/mcp", label: "IPv4 loopback" },
      { url: "http://10.0.0.1:3000/sse", label: "10.x private range" },
      { url: "http://192.168.1.1:8080/mcp", label: "192.168.x private range" },
      { url: "http://172.16.0.1:8080/mcp", label: "172.16.x private range" },
      { url: "http://[::1]:8080/mcp", label: "IPv6 loopback" },
      { url: "http://localhost:8080/mcp", label: "localhost hostname" },
    ];

    for (const { url, label } of blockedUrls) {
      it(`rejects ${label}: ${url}`, async () => {
        await expect(validateMcpUrl(url)).rejects.toThrow();
      });
    }
  });

  describe("validateMcpUrl rejects invalid protocols", () => {
    it("rejects ftp:// protocol", async () => {
      await expect(validateMcpUrl("ftp://example.com/mcp")).rejects.toThrow(
        /Invalid MCP server URL protocol/,
      );
    });

    it("rejects file:// protocol", async () => {
      await expect(validateMcpUrl("file:///etc/passwd")).rejects.toThrow(
        /Invalid MCP server URL protocol/,
      );
    });
  });

  describe("validateMcpUrl accepts valid public URL structures", () => {
    it("accepts https:// URL with public domain", async () => {
      // Provide a promise-based lookup mock that returns a public IP
      // to avoid real DNS calls. LookupFn is typeof dns.promises.lookup.
      const lookupFn = async () => [{ address: "93.184.216.34", family: 4 }];
      const result = await validateMcpUrl("https://mcp.example.com/sse", {
        lookupFn: lookupFn as Parameters<typeof validateMcpUrl>[1]["lookupFn"],
      });
      expect(result.hostname).toBe("mcp.example.com");
      expect(result.protocol).toBe("https:");
    });

    it("accepts http:// URL with public domain", async () => {
      const lookupFn = async () => [{ address: "203.0.113.50", family: 4 }];
      const result = await validateMcpUrl("http://mcp-server.example.org:3000/api", {
        lookupFn: lookupFn as Parameters<typeof validateMcpUrl>[1]["lookupFn"],
      });
      expect(result.hostname).toBe("mcp-server.example.org");
      expect(result.protocol).toBe("http:");
    });
  });

  describe("SSE transport factory rejects private URLs", () => {
    it("rejects localhost SSE URL", async () => {
      await expect(
        createSseTransport({ type: "sse", url: "http://localhost:8080/sse" }),
      ).rejects.toThrow();
    });

    it("rejects 10.x SSE URL", async () => {
      await expect(
        createSseTransport({ type: "sse", url: "http://10.0.0.1:3000/sse" }),
      ).rejects.toThrow();
    });
  });

  describe("HTTP transport factory rejects private URLs", () => {
    it("rejects localhost HTTP URL", async () => {
      await expect(
        createHttpTransport({ type: "http", url: "http://localhost:8080/mcp" }),
      ).rejects.toThrow();
    });

    it("rejects 192.168.x HTTP URL", async () => {
      await expect(
        createHttpTransport({ type: "http", url: "http://192.168.1.100:3000/mcp" }),
      ).rejects.toThrow();
    });
  });
});
