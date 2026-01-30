import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveGatewayStateDir } from "./paths.js";

describe("resolveGatewayStateDir", () => {
  it("uses the default state dir when no overrides are set", () => {
    const env = { HOME: "/Users/test" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".crocbot"));
  });

  it("appends the profile suffix when set", () => {
    const env = { HOME: "/Users/test", CROCBOT_PROFILE: "rescue" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".crocbot-rescue"));
  });

  it("treats default profiles as the base state dir", () => {
    const env = { HOME: "/Users/test", CROCBOT_PROFILE: "Default" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".crocbot"));
  });

  it("uses CROCBOT_STATE_DIR when provided", () => {
    const env = { HOME: "/Users/test", CROCBOT_STATE_DIR: "/var/lib/crocbot" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/var/lib/crocbot"));
  });

  it("expands ~ in CROCBOT_STATE_DIR", () => {
    const env = { HOME: "/Users/test", CROCBOT_STATE_DIR: "~/crocbot-state" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/Users/test/crocbot-state"));
  });

  it("preserves Windows absolute paths without HOME", () => {
    const env = { CROCBOT_STATE_DIR: "C:\\State\\crocbot" };
    expect(resolveGatewayStateDir(env)).toBe("C:\\State\\crocbot");
  });
});
