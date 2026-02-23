import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_GATEWAY_URL,
  callGatewayTool,
  resolveGatewayOptions,
  validateGatewayUrl,
} from "./gateway.js";

const callGatewayMock = vi.fn();
vi.mock("../../gateway/call.js", () => ({
  callGateway: (...args: unknown[]) => callGatewayMock(...args),
}));

describe("gateway tool defaults", () => {
  beforeEach(() => {
    callGatewayMock.mockReset();
  });

  it("leaves url undefined so callGateway can use config", () => {
    const opts = resolveGatewayOptions();
    expect(opts.url).toBeUndefined();
  });

  it("passes through explicit overrides", async () => {
    callGatewayMock.mockResolvedValueOnce({ ok: true });
    await callGatewayTool(
      "health",
      { gatewayUrl: "ws://example", gatewayToken: "t", timeoutMs: 5000 },
      {},
    );
    expect(callGatewayMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "ws://example",
        token: "t",
        timeoutMs: 5000,
      }),
    );
  });
});

describe("validateGatewayUrl", () => {
  it("allows default gateway URL", () => {
    expect(() => validateGatewayUrl(DEFAULT_GATEWAY_URL)).not.toThrow();
  });

  it("allows public URLs", () => {
    expect(() => validateGatewayUrl("ws://gateway.example.com:18789")).not.toThrow();
    expect(() => validateGatewayUrl("wss://gateway.example.com")).not.toThrow();
    expect(() => validateGatewayUrl("http://gateway.example.com")).not.toThrow();
  });

  it("blocks private IP addresses", () => {
    expect(() => validateGatewayUrl("ws://10.0.0.1:18789")).toThrow("blocked");
    expect(() => validateGatewayUrl("ws://192.168.1.1:18789")).toThrow("blocked");
    expect(() => validateGatewayUrl("ws://172.16.0.1:18789")).toThrow("blocked");
  });

  it("blocks cloud metadata IP", () => {
    expect(() => validateGatewayUrl("ws://169.254.169.254")).toThrow("blocked");
  });

  it("blocks localhost hostname", () => {
    expect(() => validateGatewayUrl("ws://localhost:9999")).toThrow("blocked");
  });

  it("blocks .internal hostname", () => {
    expect(() => validateGatewayUrl("ws://api.internal:18789")).toThrow("blocked");
  });

  it("blocks credentials in URL (private host)", () => {
    expect(() => validateGatewayUrl("ws://user:pass@10.0.0.1:18789")).toThrow("blocked");
  });

  it("throws on invalid URL", () => {
    expect(() => validateGatewayUrl("not-a-url")).toThrow("invalid");
  });
});

describe("resolveGatewayOptions SSRF validation", () => {
  it("blocks private IP in gatewayUrl", () => {
    expect(() => resolveGatewayOptions({ gatewayUrl: "ws://10.0.0.1:18789" })).toThrow("blocked");
  });

  it("allows public URL in gatewayUrl", () => {
    const opts = resolveGatewayOptions({ gatewayUrl: "ws://public.example.com:18789" });
    expect(opts.url).toBe("ws://public.example.com:18789");
  });
});
