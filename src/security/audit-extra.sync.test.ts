import { describe, expect, it } from "vitest";

import {
  collectAttackSurfaceSummaryFindings,
  collectHooksHardeningFindings,
  collectWebhookSafetyFindings,
} from "./audit-extra.sync.js";

import type { crocbotConfig } from "../config/config.js";

function makeConfig(overrides: Partial<crocbotConfig> = {}): crocbotConfig {
  return { ...overrides } as crocbotConfig;
}

describe("audit attack surface summary - webhook vs internal hooks", () => {
  it("reports webhooks and internal hooks separately", () => {
    const cfg = makeConfig({
      hooks: {
        enabled: true,
        mappings: [{ id: "m1" }, { id: "m2" }],
        internal: { enabled: true, handlers: [{ event: "e", module: "m" }] },
      },
    });
    const findings = collectAttackSurfaceSummaryFindings(cfg);
    expect(findings.length).toBe(1);
    const detail = findings[0].detail;
    expect(detail).toContain("webhooks (HTTP): enabled, 2 mapping(s)");
    expect(detail).toContain("internal hooks: enabled, 1 handler(s)");
  });

  it("reports disabled state correctly", () => {
    const cfg = makeConfig({ hooks: { enabled: false } });
    const findings = collectAttackSurfaceSummaryFindings(cfg);
    const detail = findings[0].detail;
    expect(detail).toContain("webhooks (HTTP): disabled");
    expect(detail).toContain("internal hooks: disabled");
  });
});

describe("audit webhook safety findings", () => {
  it("flags allowUnsafeExternalContent on mappings", () => {
    const cfg = makeConfig({
      hooks: {
        enabled: true,
        mappings: [
          { id: "safe", allowUnsafeExternalContent: false },
          { id: "unsafe", allowUnsafeExternalContent: true },
        ],
      },
    });
    const findings = collectWebhookSafetyFindings(cfg);
    const unsafeFinding = findings.find((f) => f.checkId === "webhooks.unsafe_external_content");
    expect(unsafeFinding).toBeDefined();
    expect(unsafeFinding?.severity).toBe("critical");
    expect(unsafeFinding?.detail).toContain("unsafe");
  });

  it("flags unrestricted agent routing", () => {
    const cfg = makeConfig({
      hooks: {
        enabled: true,
        mappings: [{ id: "routed", agentId: "custom-agent" }],
      },
    });
    const findings = collectWebhookSafetyFindings(cfg);
    const routingFinding = findings.find(
      (f) => f.checkId === "webhooks.unrestricted_agent_routing",
    );
    expect(routingFinding).toBeDefined();
    expect(routingFinding?.severity).toBe("warn");
  });

  it("flags gmail unsafe external content", () => {
    const cfg = makeConfig({
      hooks: {
        enabled: true,
        gmail: { allowUnsafeExternalContent: true },
      },
    });
    const findings = collectWebhookSafetyFindings(cfg);
    const gmailFinding = findings.find(
      (f) => f.checkId === "webhooks.gmail.unsafe_external_content",
    );
    expect(gmailFinding).toBeDefined();
  });

  it("returns empty when webhooks disabled", () => {
    const cfg = makeConfig({ hooks: { enabled: false } });
    const findings = collectWebhookSafetyFindings(cfg);
    expect(findings).toEqual([]);
  });

  it("returns empty for safe configuration", () => {
    const cfg = makeConfig({
      hooks: {
        enabled: true,
        allowedAgentIds: ["main"],
        mappings: [{ id: "safe", agentId: "main" }],
      },
    });
    const findings = collectWebhookSafetyFindings(cfg);
    expect(findings).toEqual([]);
  });
});

describe("audit hooks hardening findings", () => {
  it("detects short webhook token", () => {
    const cfg = makeConfig({
      hooks: { enabled: true, token: "short" },
    });
    const findings = collectHooksHardeningFindings(cfg);
    const shortToken = findings.find((f) => f.checkId === "hooks.short_token");
    expect(shortToken).toBeDefined();
    expect(shortToken?.severity).toBe("warn");
  });

  it("returns empty when hooks disabled", () => {
    const cfg = makeConfig({ hooks: { enabled: false } });
    const findings = collectHooksHardeningFindings(cfg);
    expect(findings).toEqual([]);
  });
});
