import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs([
      "node",
      "crocbot",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "crocbot", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "crocbot", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "crocbot", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "crocbot", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "crocbot", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "crocbot", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it("rejects combining --dev with --profile (dev first)", () => {
    const res = parseCliProfileArgs(["node", "crocbot", "--dev", "--profile", "work", "status"]);
    expect(res.ok).toBe(false);
  });

  it("rejects combining --dev with --profile (profile first)", () => {
    const res = parseCliProfileArgs(["node", "crocbot", "--profile", "work", "--dev", "status"]);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join("/home/peter", ".crocbot-dev");
    expect(env.CROCBOT_PROFILE).toBe("dev");
    expect(env.CROCBOT_STATE_DIR).toBe(expectedStateDir);
    expect(env.CROCBOT_CONFIG_PATH).toBe(path.join(expectedStateDir, "crocbot.json"));
    expect(env.CROCBOT_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      CROCBOT_STATE_DIR: "/custom",
      CROCBOT_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.CROCBOT_STATE_DIR).toBe("/custom");
    expect(env.CROCBOT_GATEWAY_PORT).toBe("19099");
    expect(env.CROCBOT_CONFIG_PATH).toBe(path.join("/custom", "crocbot.json"));
  });
});

describe("formatCliCommand", () => {
  it("returns command unchanged when no profile is set", () => {
    expect(formatCliCommand("crocbot doctor --fix", {})).toBe("crocbot doctor --fix");
  });

  it("returns command unchanged when profile is default", () => {
    expect(formatCliCommand("crocbot doctor --fix", { CROCBOT_PROFILE: "default" })).toBe(
      "crocbot doctor --fix",
    );
  });

  it("returns command unchanged when profile is Default (case-insensitive)", () => {
    expect(formatCliCommand("crocbot doctor --fix", { CROCBOT_PROFILE: "Default" })).toBe(
      "crocbot doctor --fix",
    );
  });

  it("returns command unchanged when profile is invalid", () => {
    expect(formatCliCommand("crocbot doctor --fix", { CROCBOT_PROFILE: "bad profile" })).toBe(
      "crocbot doctor --fix",
    );
  });

  it("returns command unchanged when --profile is already present", () => {
    expect(
      formatCliCommand("crocbot --profile work doctor --fix", { CROCBOT_PROFILE: "work" }),
    ).toBe("crocbot --profile work doctor --fix");
  });

  it("returns command unchanged when --dev is already present", () => {
    expect(formatCliCommand("crocbot --dev doctor", { CROCBOT_PROFILE: "dev" })).toBe(
      "crocbot --dev doctor",
    );
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("crocbot doctor --fix", { CROCBOT_PROFILE: "work" })).toBe(
      "crocbot --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(formatCliCommand("crocbot doctor --fix", { CROCBOT_PROFILE: "  jbcroc  " })).toBe(
      "crocbot --profile jbcroc doctor --fix",
    );
  });

  it("handles command with no args after crocbot", () => {
    expect(formatCliCommand("crocbot", { CROCBOT_PROFILE: "test" })).toBe("crocbot --profile test");
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm crocbot doctor", { CROCBOT_PROFILE: "work" })).toBe(
      "pnpm crocbot --profile work doctor",
    );
  });
});
