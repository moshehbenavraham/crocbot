import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveGatewayWsUrl } from "./onboard-helpers.js";

const mocks = vi.hoisted(() => ({
  runCommandWithTimeout: vi.fn(async () => ({
    stdout: "",
    stderr: "",
    code: 0,
    signal: null,
    killed: false,
  })),
  pickPrimaryTailnetIPv4: vi.fn(() => undefined),
}));

vi.mock("../process/exec.js", () => ({
  runCommandWithTimeout: mocks.runCommandWithTimeout,
}));

vi.mock("../infra/tailnet.js", () => ({
  pickPrimaryTailnetIPv4: mocks.pickPrimaryTailnetIPv4,
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveGatewayWsUrl", () => {
  it("uses customBindHost for custom bind", () => {
    const url = resolveGatewayWsUrl({
      port: 18789,
      bind: "custom",
      customBindHost: "192.168.1.100",
    });
    expect(url).toBe("ws://192.168.1.100:18789");
  });

  it("falls back to loopback for invalid customBindHost", () => {
    const url = resolveGatewayWsUrl({
      port: 18789,
      bind: "custom",
      customBindHost: "192.168.001.100",
    });
    expect(url).toBe("ws://127.0.0.1:18789");
  });

  it("uses tailnet IP for tailnet bind", () => {
    mocks.pickPrimaryTailnetIPv4.mockReturnValueOnce("100.64.0.9");
    const url = resolveGatewayWsUrl({
      port: 18789,
      bind: "tailnet",
    });
    expect(url).toBe("ws://100.64.0.9:18789");
  });

  it("keeps loopback for auto even when tailnet is present", () => {
    mocks.pickPrimaryTailnetIPv4.mockReturnValueOnce("100.64.0.9");
    const url = resolveGatewayWsUrl({
      port: 18789,
      bind: "auto",
    });
    expect(url).toBe("ws://127.0.0.1:18789");
  });
});
