import { describe, expect, it } from "vitest";
import { applySecurityHeaders, filterRequest } from "./security-headers.js";
import type { IncomingMessage, ServerResponse } from "node:http";

function createMockResponse(): ServerResponse {
  const headers = new Map<string, string>();
  return {
    setHeader: (name: string, value: string) => headers.set(name, value),
    removeHeader: (name: string) => headers.delete(name),
    _headers: headers,
  } as unknown as ServerResponse;
}

function createMockRequest(url: string): IncomingMessage {
  return { url } as unknown as IncomingMessage;
}

describe("applySecurityHeaders", () => {
  it("sets all required security headers", () => {
    const res = createMockResponse();
    applySecurityHeaders(res);

    const headers = (res as unknown as { _headers: Map<string, string> })._headers;
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-DNS-Prefetch-Control")).toBe("off");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()");
    expect(headers.get("Content-Security-Policy")).toBe("default-src 'none'");
  });

  it("removes X-Powered-By header", () => {
    const res = createMockResponse();
    const headers = (res as unknown as { _headers: Map<string, string> })._headers;
    headers.set("X-Powered-By", "Express");
    applySecurityHeaders(res);
    expect(headers.has("X-Powered-By")).toBe(false);
  });
});

describe("filterRequest", () => {
  it("allows normal requests", () => {
    expect(filterRequest(createMockRequest("/health")).blocked).toBe(false);
    expect(filterRequest(createMockRequest("/api/v1/chat")).blocked).toBe(false);
    expect(filterRequest(createMockRequest("/setup/export")).blocked).toBe(false);
  });

  it("blocks path traversal with ../", () => {
    const result = filterRequest(createMockRequest("/../../etc/passwd"));
    expect(result.blocked).toBe(true);
    expect(result.status).toBe(400);
  });

  it("blocks path traversal with ..\\", () => {
    const result = filterRequest(createMockRequest("/..\\..\\windows\\system32"));
    expect(result.blocked).toBe(true);
    expect(result.status).toBe(400);
  });

  it("blocks null bytes in URL", () => {
    const result = filterRequest(createMockRequest("/api/test\0malicious"));
    expect(result.blocked).toBe(true);
    expect(result.status).toBe(400);
  });

  it("blocks oversized URLs", () => {
    const longUrl = "/" + "a".repeat(8192);
    const result = filterRequest(createMockRequest(longUrl));
    expect(result.blocked).toBe(true);
    expect(result.status).toBe(414);
  });

  it("allows URLs at the length limit", () => {
    const url = "/" + "a".repeat(8190);
    expect(filterRequest(createMockRequest(url)).blocked).toBe(false);
  });

  it("handles missing URL gracefully", () => {
    const req = { url: undefined } as unknown as IncomingMessage;
    expect(filterRequest(req).blocked).toBe(false);
  });
});
