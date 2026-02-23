import { describe, expect, it } from "vitest";
import {
  formatGatewayServiceDescription,
  GATEWAY_SYSTEMD_SERVICE_NAME,
  resolveGatewayProfileSuffix,
  resolveGatewaySystemdServiceName,
} from "./constants.js";

describe("resolveGatewaySystemdServiceName", () => {
  it("returns default service name when no profile is set", () => {
    const result = resolveGatewaySystemdServiceName();
    expect(result).toBe(GATEWAY_SYSTEMD_SERVICE_NAME);
    expect(result).toBe("crocbot-gateway");
  });

  it("returns default service name when profile is undefined", () => {
    const result = resolveGatewaySystemdServiceName(undefined);
    expect(result).toBe(GATEWAY_SYSTEMD_SERVICE_NAME);
  });

  it("returns default service name when profile is 'default'", () => {
    const result = resolveGatewaySystemdServiceName("default");
    expect(result).toBe(GATEWAY_SYSTEMD_SERVICE_NAME);
  });

  it("returns default service name when profile is 'DEFAULT' (case-insensitive)", () => {
    const result = resolveGatewaySystemdServiceName("DEFAULT");
    expect(result).toBe(GATEWAY_SYSTEMD_SERVICE_NAME);
  });

  it("returns profile-specific service name when profile is set", () => {
    const result = resolveGatewaySystemdServiceName("dev");
    expect(result).toBe("crocbot-gateway-dev");
  });

  it("returns profile-specific service name for custom profile", () => {
    const result = resolveGatewaySystemdServiceName("production");
    expect(result).toBe("crocbot-gateway-production");
  });

  it("trims whitespace from profile", () => {
    const result = resolveGatewaySystemdServiceName("  test  ");
    expect(result).toBe("crocbot-gateway-test");
  });

  it("returns default service name for empty string profile", () => {
    const result = resolveGatewaySystemdServiceName("");
    expect(result).toBe(GATEWAY_SYSTEMD_SERVICE_NAME);
  });

  it("returns default service name for whitespace-only profile", () => {
    const result = resolveGatewaySystemdServiceName("   ");
    expect(result).toBe(GATEWAY_SYSTEMD_SERVICE_NAME);
  });
});

describe("resolveGatewayProfileSuffix", () => {
  it("returns empty string when no profile is set", () => {
    expect(resolveGatewayProfileSuffix()).toBe("");
  });

  it("returns empty string for default profiles", () => {
    expect(resolveGatewayProfileSuffix("default")).toBe("");
    expect(resolveGatewayProfileSuffix(" Default ")).toBe("");
  });

  it("returns a hyphenated suffix for custom profiles", () => {
    expect(resolveGatewayProfileSuffix("dev")).toBe("-dev");
  });

  it("trims whitespace from profiles", () => {
    expect(resolveGatewayProfileSuffix("  staging  ")).toBe("-staging");
  });
});

describe("formatGatewayServiceDescription", () => {
  it("returns default description when no profile/version", () => {
    expect(formatGatewayServiceDescription()).toBe("crocbot Gateway");
  });

  it("includes profile when set", () => {
    expect(formatGatewayServiceDescription({ profile: "work" })).toBe(
      "crocbot Gateway (profile: work)",
    );
  });

  it("includes version when set", () => {
    expect(formatGatewayServiceDescription({ version: "2026.1.10" })).toBe(
      "crocbot Gateway (v2026.1.10)",
    );
  });

  it("includes profile and version when set", () => {
    expect(formatGatewayServiceDescription({ profile: "dev", version: "1.2.3" })).toBe(
      "crocbot Gateway (profile: dev, v1.2.3)",
    );
  });
});
