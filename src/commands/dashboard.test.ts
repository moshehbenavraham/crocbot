import { beforeEach, describe, expect, it, vi } from "vitest";

import { dashboardCommand } from "./dashboard.js";

const mocks = vi.hoisted(() => ({
  readConfigFileSnapshot: vi.fn(),
  resolveGatewayPort: vi.fn(),
  resolveGatewayWsUrl: vi.fn(),
}));

vi.mock("../config/config.js", () => ({
  readConfigFileSnapshot: mocks.readConfigFileSnapshot,
  resolveGatewayPort: mocks.resolveGatewayPort,
}));

vi.mock("./onboard-helpers.js", () => ({
  resolveGatewayWsUrl: mocks.resolveGatewayWsUrl,
}));

const runtime = {
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn(),
};

function resetRuntime() {
  runtime.log.mockClear();
  runtime.error.mockClear();
  runtime.exit.mockClear();
}

function mockSnapshot(token = "abc") {
  mocks.readConfigFileSnapshot.mockResolvedValue({
    path: "/tmp/crocbot.json",
    exists: true,
    raw: "{}",
    parsed: {},
    valid: true,
    config: { gateway: { auth: { token } } },
    issues: [],
    legacyIssues: [],
  });
  mocks.resolveGatewayPort.mockReturnValue(18789);
  mocks.resolveGatewayWsUrl.mockReturnValue("ws://127.0.0.1:18789");
}

describe("dashboardCommand", () => {
  beforeEach(() => {
    resetRuntime();
    mocks.readConfigFileSnapshot.mockReset();
    mocks.resolveGatewayPort.mockReset();
    mocks.resolveGatewayWsUrl.mockReset();
  });

  it("prints the gateway WS URL and removal notice", async () => {
    mockSnapshot("abc123");

    await dashboardCommand(runtime);

    expect(mocks.resolveGatewayWsUrl).toHaveBeenCalledWith({
      port: 18789,
      bind: "loopback",
      customBindHost: undefined,
    });
    expect(runtime.log).toHaveBeenCalledWith("Gateway WS: ws://127.0.0.1:18789");
    expect(runtime.log).toHaveBeenCalledWith(
      "The browser-based UI has been removed. Use the TUI or Telegram to interact with crocbot.",
    );
  });

  it("uses bind mode from config", async () => {
    mocks.readConfigFileSnapshot.mockResolvedValue({
      path: "/tmp/crocbot.json",
      exists: true,
      raw: "{}",
      parsed: {},
      valid: true,
      config: { gateway: { bind: "lan", auth: { token: "t" } } },
      issues: [],
      legacyIssues: [],
    });
    mocks.resolveGatewayPort.mockReturnValue(18789);
    mocks.resolveGatewayWsUrl.mockReturnValue("ws://0.0.0.0:18789");

    await dashboardCommand(runtime);

    expect(mocks.resolveGatewayWsUrl).toHaveBeenCalledWith({
      port: 18789,
      bind: "lan",
      customBindHost: undefined,
    });
  });

  it("handles invalid config gracefully", async () => {
    mocks.readConfigFileSnapshot.mockResolvedValue({
      path: "/tmp/crocbot.json",
      exists: false,
      raw: "",
      parsed: {},
      valid: false,
      config: {},
      issues: [],
      legacyIssues: [],
    });
    mocks.resolveGatewayPort.mockReturnValue(18789);
    mocks.resolveGatewayWsUrl.mockReturnValue("ws://127.0.0.1:18789");

    await dashboardCommand(runtime);

    expect(runtime.log).toHaveBeenCalledWith(expect.stringContaining("Gateway WS:"));
  });
});
