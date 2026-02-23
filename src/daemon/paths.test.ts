import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveGatewayStateDir } from "./paths.js";

describe("resolveGatewayStateDir", () => {
  it("uses the default state dir when no overrides are set", () => {
    const env = { HOME: "/home/test" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/home/test", ".crocbot"));
  });

  it("appends the profile suffix when set", () => {
    const env = { HOME: "/home/test", CROCBOT_PROFILE: "rescue" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/home/test", ".crocbot-rescue"));
  });

  it("treats default profiles as the base state dir", () => {
    const env = { HOME: "/home/test", CROCBOT_PROFILE: "Default" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/home/test", ".crocbot"));
  });

  it("uses CROCBOT_STATE_DIR when provided", () => {
    const env = { HOME: "/home/test", CROCBOT_STATE_DIR: "/var/lib/crocbot" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/var/lib/crocbot"));
  });

  it("expands ~ in CROCBOT_STATE_DIR", () => {
    const env = { HOME: "/home/test", CROCBOT_STATE_DIR: "~/crocbot-state" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/home/test/crocbot-state"));
  });

  it("resolves relative CROCBOT_STATE_DIR without HOME", () => {
    const env = { CROCBOT_STATE_DIR: "/var/lib/crocbot-alt" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/var/lib/crocbot-alt"));
  });
});
