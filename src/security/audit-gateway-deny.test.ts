import { describe, expect, it } from "vitest";

import { runSecurityAudit } from "./audit.js";
import type { crocbotConfig } from "../config/config.js";

function makeConfig(overrides: Partial<crocbotConfig> = {}): crocbotConfig {
  return { ...overrides } as crocbotConfig;
}

describe("audit gateway.tools.allow dangerous re-enable warning", () => {
  it("emits warning when gateway.tools.allow re-enables a denied tool on loopback", async () => {
    const cfg = makeConfig({
      gateway: {
        bind: "loopback",
        auth: { token: "a-long-enough-secret-token-1234" },
        tools: { allow: ["sessions_spawn"] },
      },
    });
    const report = await runSecurityAudit({
      config: cfg,
      includeFilesystem: false,
      includeChannelSecurity: false,
    });
    const finding = report.findings.find(
      (f) => f.checkId === "gateway.tools_invoke_http.dangerous_allow",
    );
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("warn");
    expect(finding?.detail).toContain("sessions_spawn");
  });

  it("emits critical when gateway binds beyond loopback", async () => {
    const cfg = makeConfig({
      gateway: {
        bind: "lan",
        auth: { token: "a-long-enough-secret-token-1234" },
        tools: { allow: ["sessions_spawn", "gateway"] },
      },
    });
    const report = await runSecurityAudit({
      config: cfg,
      includeFilesystem: false,
      includeChannelSecurity: false,
    });
    const finding = report.findings.find(
      (f) => f.checkId === "gateway.tools_invoke_http.dangerous_allow",
    );
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("critical");
    expect(finding?.detail).toContain("sessions_spawn");
    expect(finding?.detail).toContain("gateway");
  });

  it("emits critical when tailscale mode is funnel", async () => {
    const cfg = makeConfig({
      gateway: {
        bind: "loopback",
        auth: { token: "a-long-enough-secret-token-1234" },
        tailscale: { mode: "funnel" },
        tools: { allow: ["exec"] },
      },
    });
    const report = await runSecurityAudit({
      config: cfg,
      includeFilesystem: false,
      includeChannelSecurity: false,
    });
    const finding = report.findings.find(
      (f) => f.checkId === "gateway.tools_invoke_http.dangerous_allow",
    );
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("critical");
  });

  it("does not emit warning when gateway.tools.allow contains only safe tools", async () => {
    const cfg = makeConfig({
      gateway: {
        bind: "loopback",
        auth: { token: "a-long-enough-secret-token-1234" },
        tools: { allow: ["memory_search", "web_search"] },
      },
    });
    const report = await runSecurityAudit({
      config: cfg,
      includeFilesystem: false,
      includeChannelSecurity: false,
    });
    const finding = report.findings.find(
      (f) => f.checkId === "gateway.tools_invoke_http.dangerous_allow",
    );
    expect(finding).toBeUndefined();
  });

  it("does not emit warning when no gateway.tools.allow configured", async () => {
    const cfg = makeConfig({
      gateway: {
        bind: "loopback",
        auth: { token: "a-long-enough-secret-token-1234" },
      },
    });
    const report = await runSecurityAudit({
      config: cfg,
      includeFilesystem: false,
      includeChannelSecurity: false,
    });
    const finding = report.findings.find(
      (f) => f.checkId === "gateway.tools_invoke_http.dangerous_allow",
    );
    expect(finding).toBeUndefined();
  });
});
